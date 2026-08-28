package api

import (
	"context"
	"slices"
	"sync"
	"time"

	"github.com/factrylabs/factry-historian-datasource.git/pkg/schemas"
	"golang.org/x/sync/singleflight"
)

// resolutionCacheMaxEntries bounds how many distinct queries a cache holds.
// Ad-hoc explore queries and template variables produce unbounded key variety,
// so entries are evicted rather than kept until they expire.
const resolutionCacheMaxEntries = 1024

type cacheEntry[T any] struct {
	value  []T
	expiry time.Time
}

// resolutionCache serves repeated asset and measurement metadata lookups from
// memory for at most a TTL. Concurrent misses on the same key share a single
// request, so the moment an entry expires a dashboard refresh issues one round
// trip instead of one per panel.
//
// A cache belongs to one API client, so its contents are already scoped to that
// client's token and organization. It must never be shared between clients.
type resolutionCache[T any] struct {
	mu      sync.Mutex
	entries map[string]cacheEntry[T]
	group   singleflight.Group
	ttl     time.Duration
	max     int
}

// newResolutionCache returns a cache that holds values for ttl. A ttl of zero
// or less disables caching: every lookup goes to the historian.
func newResolutionCache[T any](ttl time.Duration) *resolutionCache[T] {
	return &resolutionCache[T]{
		entries: map[string]cacheEntry[T]{},
		ttl:     ttl,
		max:     resolutionCacheMaxEntries,
	}
}

// do returns the cached value for key, or calls fetch and caches the result.
// The returned slice is a fresh copy, but its elements still share pointer and
// nested slice fields with the cache, so callers must treat them as read-only.
func (c *resolutionCache[T]) do(ctx context.Context, key string, fetch func(context.Context) ([]T, error)) ([]T, error) {
	if c == nil || c.ttl <= 0 {
		return fetch(ctx)
	}

	if value, ok := c.get(key); ok {
		return value, nil
	}

	// singleflight hands one fetch's result to every waiter, so the request
	// outlives the caller that started it. Detaching cancellation keeps a panel
	// that navigates away from failing the queries that are waiting on it. The
	// HTTP client timeout still bounds the request.
	ch := c.group.DoChan(key, func() (any, error) {
		// A caller can lose the race between its cache check and joining the
		// flight: the previous flight stores its result and is forgotten in
		// between. Re-checking here turns that into a hit instead of a
		// duplicate request.
		if value, ok := c.get(key); ok {
			return value, nil
		}
		fetched, err := fetch(context.WithoutCancel(ctx))
		if err != nil {
			return nil, err
		}
		c.store(key, fetched)
		return fetched, nil
	})

	// The fetch keeps running for the other waiters, but this caller honors
	// its own cancellation instead of blocking on the shared result.
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case result := <-ch:
		if result.Err != nil {
			return nil, result.Err
		}
		return slices.Clone(result.Val.([]T)), nil
	}
}

// get returns a copy of the value stored for key while it is still fresh. The
// copy is made outside the lock: a stored slice is never mutated in place, so
// concurrent hits need not serialize behind each other's copies.
func (c *resolutionCache[T]) get(key string) ([]T, bool) {
	c.mu.Lock()
	entry, ok := c.entries[key]
	fresh := ok && time.Now().Before(entry.expiry)
	c.mu.Unlock()

	if !fresh {
		return nil, false
	}
	return slices.Clone(entry.value), true
}

// store keeps value under key until the TTL runs out, evicting first the
// expired entries and then whichever entry expires soonest.
func (c *resolutionCache[T]) store(key string, value []T) {
	c.mu.Lock()
	defer c.mu.Unlock()

	now := time.Now()
	if len(c.entries) >= c.max {
		for k, entry := range c.entries {
			if !now.Before(entry.expiry) {
				delete(c.entries, k)
			}
		}
	}
	if len(c.entries) >= c.max {
		var (
			nextKey    string
			nextExpiry time.Time
			found      bool
		)
		for k, entry := range c.entries {
			if !found || entry.expiry.Before(nextExpiry) {
				nextKey, nextExpiry, found = k, entry.expiry, true
			}
		}
		if found {
			delete(c.entries, nextKey)
		}
	}

	c.entries[key] = cacheEntry[T]{value: value, expiry: now.Add(c.ttl)}
}

// GetAssetsCached is GetAssets served from the resolution cache.
func (api *API) GetAssetsCached(ctx context.Context, query string) ([]schemas.Asset, error) {
	return api.assetCache.do(ctx, query, func(ctx context.Context) ([]schemas.Asset, error) {
		return api.GetAssets(ctx, query)
	})
}

// GetAssetPropertiesCached is GetAssetProperties served from the resolution cache.
func (api *API) GetAssetPropertiesCached(ctx context.Context, query string) ([]schemas.AssetProperty, error) {
	return api.assetPropertyCache.do(ctx, query, func(ctx context.Context) ([]schemas.AssetProperty, error) {
		return api.GetAssetProperties(ctx, query)
	})
}

// GetTimeseriesDatabasesCached is GetTimeseriesDatabases served from the
// resolution cache. The health check deliberately keeps using the uncached call
// so it always reaches the historian.
func (api *API) GetTimeseriesDatabasesCached(ctx context.Context, query string) ([]schemas.TimeseriesDatabase, error) {
	return api.databaseCache.do(ctx, query, func(ctx context.Context) ([]schemas.TimeseriesDatabase, error) {
		return api.GetTimeseriesDatabases(ctx, query)
	})
}
