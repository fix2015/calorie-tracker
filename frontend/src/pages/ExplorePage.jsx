import { useState, useCallback, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { publicApi } from '../services/api';
import { useAuth } from '../services/AuthContext';
import { photoSrc } from '../services/photoUrl';
import { useInfiniteScroll } from '../services/useInfiniteScroll';
import PublicMealDetailModal from '../components/PublicMealDetailModal';

export default function ExplorePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef(null);

  const [trending, setTrending] = useState([]);
  const [trendingCursor, setTrendingCursor] = useState(null);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState(null);

  const [suggestions, setSuggestions] = useState([]);
  const [followingSet, setFollowingSet] = useState(new Set());

  // Load trending and suggestions on mount
  useEffect(() => {
    const promises = [
      publicApi.trending().catch(() => ({ meals: [], nextCursor: null })),
    ];
    if (user) {
      promises.push(publicApi.suggestions().catch(() => ({ users: [] })));
    }
    Promise.all(promises).then(([t, s]) => {
      setTrending(t.meals);
      setTrendingCursor(t.nextCursor);
      if (s) setSuggestions(s.users);
      setTrendingLoading(false);
    });
  }, [user]);

  // Search
  const search = useCallback((q) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setSearchLoading(true);
    setSearched(true);
    publicApi.search(trimmed).then((data) => {
      setResults(data.users);
      setSearchLoading(false);
    }).catch(() => {
      setResults([]);
      setSearchLoading(false);
    });
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, search]);

  // Infinite scroll for trending
  const fetchMoreTrending = useCallback(() => {
    if (!trendingCursor || loadingMore) return;
    setLoadingMore(true);
    publicApi.trending(trendingCursor).then((data) => {
      setTrending((prev) => [...prev, ...data.meals]);
      setTrendingCursor(data.nextCursor);
      setLoadingMore(false);
    }).catch(() => setLoadingMore(false));
  }, [trendingCursor, loadingMore]);

  const sentinelRef = useInfiniteScroll(fetchMoreTrending, !!trendingCursor && !loadingMore && !searched);

  const handleFollow = useCallback(async (username) => {
    if (!user) { navigate('/login'); return; }
    try {
      const res = await publicApi.follow(username);
      if (res.following) {
        setFollowingSet((prev) => new Set([...prev, username]));
      }
    } catch {}
  }, [user, navigate]);

  const isSearching = query.trim().length >= 2;

  return (
    <div className="page" style={!user ? { padding: 'var(--space-lg) var(--space-md)' } : undefined}>
      <h1 className="page-title">Explore</h1>

      {!user && (
        <div className="explore-auth-banner">
          <p>Join CalTracker to like, comment, follow, and share your meals</p>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'center' }}>
            <Link to="/login" className="action-btn action-btn-follow">Log In</Link>
            <Link to="/register" className="action-btn action-btn-message">Sign Up</Link>
          </div>
        </div>
      )}

      <div>
        <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or @username..."
            style={{ fontSize: '16px' }}
          />
        </div>

        {/* Search results */}
        {isSearching && (
          <>
            {searchLoading && <div style={{ textAlign: 'center' }}><div className="spinner"></div></div>}
            {!searchLoading && searched && results.length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>No profiles found</p>
            )}
            {!searchLoading && results.length > 0 && (
              <div className="explore-results">
                {results.map((user) => (
                  <Link key={user.id} to={`/u/${user.username}`} className="explore-result-item">
                    {user.avatarUrl ? (
                      <img src={photoSrc(user.avatarUrl)} alt="" className="explore-result-avatar" />
                    ) : (
                      <div className="explore-result-avatar-placeholder">
                        {user.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                    )}
                    <div className="explore-result-info">
                      <span className="explore-result-name">{user.name}</span>
                      <span className="explore-result-username">@{user.username}</span>
                      {user.bio && <span className="explore-result-bio">{user.bio}</span>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {/* Non-search content */}
        {!isSearching && (
          <>
            {/* Suggested users */}
            {suggestions.length > 0 && (
              <div className="feed-suggestions-section" style={{ marginBottom: 'var(--space-lg)' }}>
                <h3 className="feed-section-title">Suggested for you</h3>
                <div className="feed-suggestions">
                  {suggestions.map((u) => (
                    <div key={u.id} className="suggestion-card-mini">
                      <Link to={`/u/${u.username}`}>
                        {u.avatarUrl ? (
                          <img src={photoSrc(u.avatarUrl)} alt="" className="suggestion-avatar" />
                        ) : (
                          <div className="suggestion-avatar-placeholder">
                            {u.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                        )}
                        <span className="suggestion-name">{u.name}</span>
                        <span className="suggestion-handle">@{u.username}</span>
                      </Link>
                      <button
                        className="btn follow-btn"
                        onClick={() => handleFollow(u.username)}
                        disabled={followingSet.has(u.username)}
                      >
                        {followingSet.has(u.username) ? 'Following' : 'Follow'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trending meals */}
            {trendingLoading ? (
              <div style={{ textAlign: 'center' }}><div className="spinner"></div></div>
            ) : trending.length > 0 && (
              <>
                <h3 className="feed-section-title">Trending meals</h3>
                <div className="meal-grid">
                  {trending.map((meal) => (
                    <div key={meal.id} className="meal-tile" onClick={() => setSelectedMeal(meal)}>
                      {meal.photoUrl ? (
                        <>
                          <img src={photoSrc(meal.photoUrl)} alt={meal.name} loading="lazy" />
                          <div className="meal-tile-overlay">
                            <span>{meal.name}</span>
                            <span style={{ float: 'right' }}>{meal.calories} kcal</span>
                          </div>
                        </>
                      ) : (
                        <div className="meal-tile-placeholder">
                          <span className="meal-tile-name">{meal.name}</span>
                          <span className="meal-tile-cals">{meal.calories} kcal</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {loadingMore && <div style={{ textAlign: 'center', padding: 'var(--space-lg)' }}><div className="spinner"></div></div>}
                <div ref={sentinelRef} className="scroll-sentinel" />
              </>
            )}
          </>
        )}
      </div>

      {selectedMeal && (
        <PublicMealDetailModal
          mealId={selectedMeal.id}
          username={selectedMeal.user?.username}
          onClose={() => setSelectedMeal(null)}
        />
      )}
    </div>
  );
}
