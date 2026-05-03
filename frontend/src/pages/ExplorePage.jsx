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

  // Popular users
  const [popularUsers, setPopularUsers] = useState([]);
  const [usersOffset, setUsersOffset] = useState(0);
  const [usersHasMore, setUsersHasMore] = useState(false);
  const [usersLoading, setUsersLoading] = useState(true);

  // Trending meals
  const [trending, setTrending] = useState([]);
  const [trendingCursor, setTrendingCursor] = useState(null);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState(null);

  const [followingSet, setFollowingSet] = useState(new Set());

  const filterUser = (items, key = 'id') => {
    if (!user) return items;
    return items.filter((item) => (key === 'userId' ? item.user?.id : item[key]) !== user.id);
  };

  // Load initial data
  useEffect(() => {
    publicApi.popularUsers(0, 6).then((data) => {
      setPopularUsers(filterUser(data.users));
      setUsersHasMore(data.hasMore);
      setUsersOffset(data.nextOffset);
      setUsersLoading(false);
    }).catch(() => setUsersLoading(false));

    publicApi.trending(null, 12).then((data) => {
      setTrending(filterUser(data.meals, 'userId'));
      setTrendingCursor(data.nextCursor);
      setTrendingLoading(false);
    }).catch(() => setTrendingLoading(false));
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
      setResults(filterUser(data.users));
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

  // Load more popular users
  const loadMoreUsers = useCallback(() => {
    if (!usersHasMore) return;
    setUsersLoading(true);
    publicApi.popularUsers(usersOffset, 6).then((data) => {
      setPopularUsers((prev) => [...prev, ...filterUser(data.users)]);
      setUsersHasMore(data.hasMore);
      setUsersOffset(data.nextOffset);
      setUsersLoading(false);
    }).catch(() => setUsersLoading(false));
  }, [usersOffset, usersHasMore]);

  // Infinite scroll for trending meals
  const fetchMoreTrending = useCallback(() => {
    if (!trendingCursor || loadingMore) return;
    setLoadingMore(true);
    publicApi.trending(trendingCursor, 12).then((data) => {
      setTrending((prev) => [...prev, ...filterUser(data.meals, 'userId')]);
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
                {results.map((u) => (
                  <Link key={u.id} to={`/u/${u.username}`} className="explore-result-item">
                    {u.avatarUrl ? (
                      <img src={photoSrc(u.avatarUrl)} alt="" className="explore-result-avatar" />
                    ) : (
                      <div className="explore-result-avatar-placeholder">
                        {u.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                    )}
                    <div className="explore-result-info">
                      <span className="explore-result-name">{u.name}</span>
                      <span className="explore-result-username">@{u.username}</span>
                      {u.bio && <span className="explore-result-bio">{u.bio}</span>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {/* Browse content */}
        {!isSearching && (
          <>
            {/* Popular users */}
            <h3 className="feed-section-title">Popular users</h3>
            {popularUsers.length > 0 ? (
              <>
                <div className="explore-users-grid">
                  {popularUsers.map((u) => (
                    <Link key={u.id} to={`/u/${u.username}`} className="explore-user-card">
                      {u.avatarUrl ? (
                        <img src={photoSrc(u.avatarUrl)} alt="" className="explore-user-avatar" />
                      ) : (
                        <div className="explore-user-avatar-placeholder">
                          {u.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                      )}
                      <span className="explore-user-name">{u.name}</span>
                      <span className="explore-user-handle">@{u.username}</span>
                      <span className="explore-user-stats">{u._count?.followers || 0} followers</span>
                      <button
                        className={`btn follow-btn${followingSet.has(u.username) ? ' following' : ''}`}
                        onClick={(e) => { e.preventDefault(); handleFollow(u.username); }}
                      >
                        {followingSet.has(u.username) ? 'Following' : 'Follow'}
                      </button>
                    </Link>
                  ))}
                </div>
                {usersHasMore && (
                  <div style={{ textAlign: 'center', marginTop: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                    <button className="btn btn-secondary" onClick={loadMoreUsers} disabled={usersLoading}>
                      {usersLoading ? 'Loading...' : 'Show more users'}
                    </button>
                  </div>
                )}
              </>
            ) : usersLoading ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-md)' }}><div className="spinner"></div></div>
            ) : (
              <p style={{ color: 'var(--color-text-secondary)', padding: 'var(--space-md) 0' }}>No public users yet</p>
            )}

            {/* Trending meals */}
            <h3 className="feed-section-title" style={{ marginTop: 'var(--space-lg)' }}>Trending meals</h3>
            {trendingLoading ? (
              <div style={{ textAlign: 'center' }}><div className="spinner"></div></div>
            ) : trending.length > 0 ? (
              <>
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
            ) : (
              <p style={{ color: 'var(--color-text-secondary)', padding: 'var(--space-md) 0' }}>No meals yet</p>
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
