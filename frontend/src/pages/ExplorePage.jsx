import { useState, useCallback, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { publicApi } from '../services/api';
import { useAuth } from '../services/AuthContext';
import { photoSrc } from '../services/photoUrl';
import { useInfiniteScroll } from '../services/useInfiniteScroll';
import PublicMealDetailModal from '../components/PublicMealDetailModal';

const FILTER_TAGS = ['All', 'High protein', 'Low carb', 'Low fat', 'Light', 'Healthy'];

export default function ExplorePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef(null);

  const [activeTag, setActiveTag] = useState('All');
  const [trending, setTrending] = useState([]);
  const [trendingCursor, setTrendingCursor] = useState(null);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState(null);

  const filterUser = (items, key = 'id') => {
    if (!user) return items;
    return items.filter((item) => (key === 'userId' ? item.user?.id : item[key]) !== user.id);
  };

  // Load trending meals
  useEffect(() => {
    setTrendingLoading(true);
    setTrending([]);
    setTrendingCursor(null);
    const tag = activeTag === 'All' ? undefined : activeTag;
    publicApi.trending(null, 12, tag).then((data) => {
      setTrending(filterUser(data.meals, 'userId'));
      setTrendingCursor(data.nextCursor);
      setTrendingLoading(false);
    }).catch(() => setTrendingLoading(false));
  }, [activeTag, user]);

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
  }, [user]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, search]);

  // Infinite scroll
  const fetchMoreTrending = useCallback(() => {
    if (!trendingCursor || loadingMore) return;
    setLoadingMore(true);
    const tag = activeTag === 'All' ? undefined : activeTag;
    publicApi.trending(trendingCursor, 12, tag).then((data) => {
      setTrending((prev) => [...prev, ...filterUser(data.meals, 'userId')]);
      setTrendingCursor(data.nextCursor);
      setLoadingMore(false);
    }).catch(() => setLoadingMore(false));
  }, [trendingCursor, loadingMore, activeTag, user]);

  const sentinelRef = useInfiniteScroll(fetchMoreTrending, !!trendingCursor && !loadingMore && !searched);

  const isSearching = query.trim().length >= 2;

  return (
    <div className="page" style={!user ? { padding: 'var(--space-lg) var(--space-md)' } : undefined}>
      {!user && (
        <div className="explore-auth-banner">
          <p>Join CalTracker to like, comment, follow, and share your meals</p>
          <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'center' }}>
            <Link to="/login" className="action-btn action-btn-follow">Log In</Link>
            <Link to="/register" className="action-btn action-btn-message">Sign Up</Link>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="discover-search">
        <svg className="discover-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search meals, users, hashtags..."
        />
      </div>

      {/* Search results */}
      {isSearching && (
        <div style={{ marginBottom: 'var(--space-lg)' }}>
          {searchLoading && <div style={{ textAlign: 'center' }}><div className="spinner"></div></div>}
          {!searchLoading && searched && results.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>No results found</p>
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
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filter chips + meal grid */}
      {!isSearching && (
        <>
          <div className="discover-chips">
            {FILTER_TAGS.map((tag) => (
              <button
                key={tag}
                className={`discover-chip${activeTag === tag ? ' active' : ''}`}
                onClick={() => setActiveTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>

          {trendingLoading ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-xl)' }}><div className="spinner"></div></div>
          ) : trending.length > 0 ? (
            <>
              <div className="discover-grid">
                {trending.map((meal) => (
                  <div key={meal.id} className="discover-card" onClick={() => setSelectedMeal(meal)}>
                    {meal.photoUrl ? (
                      <div className="discover-card-img-wrap">
                        <img src={photoSrc(meal.photoUrl)} alt={meal.name} loading="lazy" />
                        <div className="discover-card-overlay">
                          <span className="discover-card-name">{meal.name}</span>
                          <span className="discover-card-kcal">{meal.calories} kcal</span>
                        </div>
                        <button className="discover-card-more" onClick={(e) => e.stopPropagation()}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                        </button>
                      </div>
                    ) : (
                      <div className="discover-card-placeholder">
                        <span className="discover-card-name">{meal.name}</span>
                        <span className="discover-card-kcal">{meal.calories} kcal</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {loadingMore && <div style={{ textAlign: 'center', padding: 'var(--space-lg)' }}><div className="spinner"></div></div>}
              <div ref={sentinelRef} className="scroll-sentinel" />
            </>
          ) : (
            <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: 'var(--space-xl) 0' }}>
              {activeTag !== 'All' ? `No ${activeTag.toLowerCase()} meals found` : 'No meals yet'}
            </p>
          )}
        </>
      )}

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
