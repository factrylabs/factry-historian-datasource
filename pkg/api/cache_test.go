package api

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"sync"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// newTestCache returns a cache plus a counting fetch that yields one value per
// call. Tests that depend on the TTL run under synctest, where time.Now is
// virtual and a time.Sleep advances it.
func newTestCache(t *testing.T, ttl time.Duration) (*resolutionCache[string], *atomic.Int64, func(context.Context) ([]string, error)) {
	t.Helper()
	cache := newResolutionCache[string](ttl)

	calls := &atomic.Int64{}
	fetch := func(context.Context) ([]string, error) {
		return []string{"value-" + strconv.FormatInt(calls.Add(1), 10)}, nil
	}
	return cache, calls, fetch
}

func TestResolutionCacheServesRepeatsFromMemory(t *testing.T) {
	t.Parallel()

	synctest.Test(t, func(t *testing.T) {
		cache, calls, fetch := newTestCache(t, time.Minute)

		first, err := cache.do(context.Background(), "key", fetch)
		require.NoError(t, err)

		time.Sleep(59 * time.Second)
		second, err := cache.do(context.Background(), "key", fetch)
		require.NoError(t, err)

		assert.Equal(t, first, second)
		assert.Equal(t, int64(1), calls.Load(), "a repeat inside the TTL must not reach the historian")
	})
}

func TestResolutionCacheRefetchesAfterTTL(t *testing.T) {
	t.Parallel()

	synctest.Test(t, func(t *testing.T) {
		cache, calls, fetch := newTestCache(t, time.Minute)

		first, err := cache.do(context.Background(), "key", fetch)
		require.NoError(t, err)

		time.Sleep(time.Minute)
		second, err := cache.do(context.Background(), "key", fetch)
		require.NoError(t, err)

		assert.NotEqual(t, first, second, "a reconfigured asset must be picked up once the TTL passes")
		assert.Equal(t, int64(2), calls.Load())
	})
}

func TestResolutionCacheKeysOnTheQuery(t *testing.T) {
	t.Parallel()

	cache, calls, fetch := newTestCache(t, time.Minute)

	first, err := cache.do(context.Background(), "AssetUUIDs[0]=a", fetch)
	require.NoError(t, err)
	second, err := cache.do(context.Background(), "AssetUUIDs[0]=b", fetch)
	require.NoError(t, err)

	assert.NotEqual(t, first, second)
	assert.Equal(t, int64(2), calls.Load())
}

// GetAssetProperties is called with an empty query to fetch every property, so
// the empty string is a real key and must not be confused with "no key".
func TestResolutionCacheHandlesTheEmptyKey(t *testing.T) {
	t.Parallel()

	cache, calls, fetch := newTestCache(t, time.Minute)

	first, err := cache.do(context.Background(), "", fetch)
	require.NoError(t, err)
	second, err := cache.do(context.Background(), "", fetch)
	require.NoError(t, err)

	assert.Equal(t, first, second)
	assert.Equal(t, int64(1), calls.Load())
}

// A cold dashboard whose panels all resolve the same assets issues one
// request, not one per panel.
func TestResolutionCacheCollapsesConcurrentMissesOnOneKey(t *testing.T) {
	t.Parallel()

	synctest.Test(t, func(t *testing.T) {
		cache, calls, _ := newTestCache(t, time.Minute)

		// The fetch stays blocked until every caller is parked, so a caller
		// that fails to join the flight must enter the fetch and be counted.
		release := make(chan struct{})
		entries := &atomic.Int64{}
		blocking := func(context.Context) ([]string, error) {
			entries.Add(1)
			<-release
			return []string{"value-" + strconv.FormatInt(calls.Add(1), 10)}, nil
		}

		const callers = 20
		results := make([][]string, callers)
		done := sync.WaitGroup{}
		done.Add(callers)
		for i := range callers {
			go func() {
				defer done.Done()
				value, err := cache.do(context.Background(), "key", blocking)
				assert.NoError(t, err)
				results[i] = value
			}()
		}

		// Wait returns once every goroutine in the bubble is durably blocked:
		// each caller is either inside the fetch waiting on release or parked
		// in the shared flight. The count is exact, not a race window.
		synctest.Wait()
		assert.Equal(t, int64(1), entries.Load(), "concurrent misses on one key must share a single request")

		close(release)
		done.Wait()

		assert.Equal(t, int64(1), calls.Load())
		for i := range results {
			assert.Equal(t, results[0], results[i], "every caller must get the shared result")
		}
	})
}

func TestResolutionCacheFetchesDifferentKeysConcurrently(t *testing.T) {
	t.Parallel()

	cache, calls, fetch := newTestCache(t, time.Minute)

	const callers = 8
	done := sync.WaitGroup{}
	done.Add(callers)
	for i := range callers {
		go func() {
			defer done.Done()
			_, err := cache.do(context.Background(), strconv.Itoa(i), fetch)
			assert.NoError(t, err)
		}()
	}
	done.Wait()

	assert.Equal(t, int64(callers), calls.Load(), "distinct keys are distinct requests")
}

func TestResolutionCacheDoesNotCacheErrors(t *testing.T) {
	t.Parallel()

	cache, _, _ := newTestCache(t, time.Minute)

	wantErr := errors.New("historian is down")
	calls := 0
	failing := func(context.Context) ([]string, error) {
		calls++
		if calls == 1 {
			return nil, wantErr
		}
		return []string{"recovered"}, nil
	}

	_, err := cache.do(context.Background(), "key", failing)
	require.ErrorIs(t, err, wantErr)

	value, err := cache.do(context.Background(), "key", failing)
	require.NoError(t, err)
	assert.Equal(t, []string{"recovered"}, value, "a failed lookup must be retried, not cached")
}

func TestResolutionCacheZeroTTLBypassesTheCache(t *testing.T) {
	t.Parallel()

	cache, calls, fetch := newTestCache(t, 0)

	_, err := cache.do(context.Background(), "key", fetch)
	require.NoError(t, err)
	_, err = cache.do(context.Background(), "key", fetch)
	require.NoError(t, err)

	assert.Equal(t, int64(2), calls.Load(), "a zero TTL must disable caching")
	assert.Empty(t, cache.entries)
}

func TestResolutionCacheStaysBounded(t *testing.T) {
	t.Parallel()

	cache, _, fetch := newTestCache(t, time.Minute)
	cache.max = 8

	for i := range 100 {
		_, err := cache.do(context.Background(), strconv.Itoa(i), fetch)
		require.NoError(t, err)
	}

	assert.LessOrEqual(t, len(cache.entries), cache.max)
}

func TestResolutionCacheEvictsExpiredEntriesFirst(t *testing.T) {
	t.Parallel()

	synctest.Test(t, func(t *testing.T) {
		cache, _, fetch := newTestCache(t, time.Minute)
		cache.max = 4

		for i := range cache.max {
			_, err := cache.do(context.Background(), fmt.Sprintf("old-%d", i), fetch)
			require.NoError(t, err)
		}
		require.Len(t, cache.entries, cache.max)

		time.Sleep(2 * time.Minute)
		_, err := cache.do(context.Background(), "fresh", fetch)
		require.NoError(t, err)

		assert.Len(t, cache.entries, 1, "the expired entries make room for the new one")
		assert.Contains(t, cache.entries, "fresh")
	})
}

func TestResolutionCacheReturnsACopy(t *testing.T) {
	t.Parallel()

	cache, _, fetch := newTestCache(t, time.Minute)

	first, err := cache.do(context.Background(), "key", fetch)
	require.NoError(t, err)
	require.NotEmpty(t, first)
	first[0] = "mutated"

	second, err := cache.do(context.Background(), "key", fetch)
	require.NoError(t, err)
	assert.NotEqual(t, "mutated", second[0], "one caller must not be able to corrupt another's result")
}

// The fetch is shared by every waiter, so it must not inherit the cancellation
// of whichever caller happened to start it. The cancelled caller itself gets
// its cancellation back, but the fetch completes and fills the cache.
func TestResolutionCacheDetachesCallerCancellation(t *testing.T) {
	t.Parallel()

	synctest.Test(t, func(t *testing.T) {
		cache, _, _ := newTestCache(t, time.Minute)

		ctx, cancel := context.WithCancel(context.Background())
		cancel()

		fetchErr := make(chan error, 1)
		_, err := cache.do(ctx, "key", func(fetchCtx context.Context) ([]string, error) {
			fetchErr <- fetchCtx.Err()
			return []string{"served"}, nil
		})
		require.ErrorIs(t, err, context.Canceled, "a cancelled caller gets its cancellation, not the result")

		// Wait runs the abandoned fetch to completion.
		synctest.Wait()
		require.NoError(t, <-fetchErr, "the fetch must not inherit the caller's cancellation")

		value, ok := cache.get("key")
		require.True(t, ok, "the detached fetch must still fill the cache")
		assert.Equal(t, []string{"served"}, value)
	})
}

// The shared fetch is detached from cancellation, but a waiter is not: a
// cancelled caller returns immediately instead of blocking until the shared
// fetch finishes.
func TestResolutionCacheWaiterReturnsOnItsOwnCancellation(t *testing.T) {
	t.Parallel()

	synctest.Test(t, func(t *testing.T) {
		cache, _, _ := newTestCache(t, time.Minute)

		release := make(chan struct{})
		leaderDone := make(chan struct{})
		go func() {
			defer close(leaderDone)
			_, err := cache.do(context.Background(), "key", func(context.Context) ([]string, error) {
				<-release
				return []string{"served"}, nil
			})
			assert.NoError(t, err)
		}()
		// The leader is inside the fetch once everything is blocked.
		synctest.Wait()

		ctx, cancel := context.WithCancel(context.Background())
		waiterErr := make(chan error, 1)
		go func() {
			_, err := cache.do(ctx, "key", func(context.Context) ([]string, error) {
				return nil, errors.New("the waiter must join the in-flight fetch, not start its own")
			})
			waiterErr <- err
		}()
		// The waiter is parked in the shared flight.
		synctest.Wait()

		cancel()
		require.ErrorIs(t, <-waiterErr, context.Canceled, "the waiter must observe its own cancellation while the fetch is still running")

		close(release)
		<-leaderDone
	})
}
