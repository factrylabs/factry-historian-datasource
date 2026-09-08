package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
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

// Each resource getter has a *Cached variant wired to its own cache. This pins
// the wiring: a repeat of the same lookup must not reach the historian.
func TestCachedGettersServeRepeatsFromMemory(t *testing.T) {
	t.Parallel()

	const measurementUUID = "11111111-1111-1111-1111-111111111111"

	var mu sync.Mutex
	hits := map[string]int{}
	mux := http.NewServeMux()
	serve := func(pattern string, body string) {
		mux.HandleFunc(pattern, func(w http.ResponseWriter, r *http.Request) {
			mu.Lock()
			hits[r.URL.Path]++
			mu.Unlock()
			_, _ = w.Write([]byte(body))
		})
	}
	serve("GET /api/measurements", `[{"Name":"temperature"}]`)
	serve("GET /api/measurements/"+measurementUUID, `{"Name":"temperature"}`)
	serve("GET /api/collectors", `[{"Name":"opcua"}]`)
	serve("GET /api/event-types", `[{"Name":"batch"}]`)
	serve("GET /api/event-type-properties", `[{"Name":"recipe"}]`)
	serve("GET /api/event-configurations", `[{"Name":"configuration"}]`)

	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)

	client, err := NewAPIWithOptions(Options{
		URL:                srv.URL,
		Token:              "tok",
		Organization:       "org",
		ResolutionCacheTTL: time.Minute,
	})
	require.NoError(t, err)

	tests := []struct {
		name string
		path string
		call func(context.Context) (string, error)
	}{
		{"measurements", "/api/measurements", func(ctx context.Context) (string, error) {
			values, err := client.GetMeasurementsCached(ctx, "Keyword=temp")
			if err != nil {
				return "", err
			}
			require.Len(t, values, 1)
			return values[0].Name, nil
		}},
		{"measurement by UUID", "/api/measurements/" + measurementUUID, func(ctx context.Context) (string, error) {
			value, err := client.GetMeasurementCached(ctx, measurementUUID)
			return value.Name, err
		}},
		{"collectors", "/api/collectors", func(ctx context.Context) (string, error) {
			values, err := client.GetCollectorsCached(ctx)
			if err != nil {
				return "", err
			}
			require.Len(t, values, 1)
			return values[0].Name, nil
		}},
		{"event types", "/api/event-types", func(ctx context.Context) (string, error) {
			values, err := client.GetEventTypesCached(ctx, "Keyword=batch")
			if err != nil {
				return "", err
			}
			require.Len(t, values, 1)
			return values[0].Name, nil
		}},
		{"event type properties", "/api/event-type-properties", func(ctx context.Context) (string, error) {
			values, err := client.GetEventTypePropertiesCached(ctx, "EventTypeUUIDs[0]=a")
			if err != nil {
				return "", err
			}
			require.Len(t, values, 1)
			return values[0].Name, nil
		}},
		{"event configurations", "/api/event-configurations", func(ctx context.Context) (string, error) {
			values, err := client.GetEventConfigurationsCached(ctx)
			if err != nil {
				return "", err
			}
			require.Len(t, values, 1)
			return values[0].Name, nil
		}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			first, err := tt.call(context.Background())
			require.NoError(t, err)
			second, err := tt.call(context.Background())
			require.NoError(t, err)

			assert.Equal(t, first, second, "the cached repeat must return the same value")
			mu.Lock()
			hitCount := hits[tt.path]
			mu.Unlock()
			assert.Equal(t, 1, hitCount, "the repeat must be served from the cache")
		})
	}
}

// Two measurements must not share a cache entry.
func TestGetMeasurementCachedKeysOnTheUUID(t *testing.T) {
	t.Parallel()

	const (
		uuidA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
		uuidB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
	)

	fetches := &atomic.Int64{}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/measurements/{uuid}", func(w http.ResponseWriter, r *http.Request) {
		fetches.Add(1)
		_, _ = fmt.Fprintf(w, `{"Name":%q}`, r.PathValue("uuid"))
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)

	client, err := NewAPIWithOptions(Options{
		URL:                srv.URL,
		Token:              "tok",
		Organization:       "org",
		ResolutionCacheTTL: time.Minute,
	})
	require.NoError(t, err)

	for range 2 {
		a, err := client.GetMeasurementCached(context.Background(), uuidA)
		require.NoError(t, err)
		b, err := client.GetMeasurementCached(context.Background(), uuidB)
		require.NoError(t, err)
		assert.Equal(t, uuidA, a.Name)
		assert.Equal(t, uuidB, b.Name)
	}

	assert.Equal(t, int64(2), fetches.Load(), "each UUID is fetched once, then served from the cache")
}
