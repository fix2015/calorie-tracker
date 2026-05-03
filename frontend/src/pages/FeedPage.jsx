import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { publicApi } from '../services/api';
import { useAuth } from '../services/AuthContext';
import { useInfiniteScroll } from '../services/useInfiniteScroll';
import { photoSrc } from '../services/photoUrl';
import FeedCard from '../components/FeedCard';
import PublicMealDetailModal from '../components/PublicMealDetailModal';

export default function FeedPage() {
  const { user } = useAuth();
  const [meals, setMeals] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [followingSet, setFollowingSet] = useState(new Set());

  useEffect(() => {
    setLoading(true);
    Promise.all([
      publicApi.feed(null, 8).catch(() => ({ meals: [], nextCursor: null })),
      publicApi.suggestions().catch(() => ({ users: [] })),
    ]).then(([feedData, suggestData]) => {
      setMeals(feedData.meals);
      setNextCursor(feedData.nextCursor);
      setSuggestions(suggestData.users);
      setLoading(false);
    });
  }, []);

  const fetchMore = useCallback(() => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    publicApi.feed(nextCursor, 8).then((data) => {
      setMeals((prev) => [...prev, ...data.meals]);
      setNextCursor(data.nextCursor);
      setLoadingMore(false);
    }).catch(() => setLoadingMore(false));
  }, [nextCursor, loadingMore]);

  const sentinelRef = useInfiniteScroll(fetchMore, !!nextCursor && !loadingMore);

  const handleFollow = useCallback(async (username) => {
    try {
      const res = await publicApi.follow(username);
      if (res.following) {
        setFollowingSet((prev) => new Set([...prev, username]));
        setSuggestions((prev) => prev.filter(u => u.username !== username));
        // Load new user's meals into feed
        publicApi.feed(null, 8).then((data) => {
          setMeals(data.meals);
          setNextCursor(data.nextCursor);
        }).catch(() => {});
      }
    } catch { /* ignore */ }
  }, []);

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', paddingTop: 'var(--space-xl)' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="page feed-page">
      <div className="feed-top-bar">
        <span className="feed-logo">CalTracker</span>
        <div className="feed-top-actions">
          {user?.username && user?.isPublic && (
            <Link to={`/u/${user.username}`} className="feed-my-profile">
              {user.avatarUrl ? (
                <img src={photoSrc(user.avatarUrl)} alt="" className="feed-my-avatar" />
              ) : (
                <div className="feed-my-avatar-placeholder">{user.name?.charAt(0)?.toUpperCase() || '?'}</div>
              )}
            </Link>
          )}
          <Link to="/notifications" className="feed-top-btn">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          </Link>
          <Link to="/messages" className="feed-top-btn">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </Link>
        </div>
      </div>

      {/* Suggestions section */}
      {suggestions.length > 0 && (
        <div className="feed-suggestions-section">
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

      {/* Feed */}
      {meals.length === 0 && suggestions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-2xl) 0', color: 'var(--color-text-secondary)' }}>
          <p style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-md)' }}>Welcome to CalTracker!</p>
          <p>Follow people on the <Link to="/explore">Explore</Link> page to see their meals here.</p>
        </div>
      ) : meals.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: 'var(--space-lg) 0' }}>
          Follow people to see their meals in your feed
        </p>
      ) : (
        <div className="feed-list">
          {meals.map((meal) => (
            <FeedCard
              key={meal.id}
              meal={meal}
              onOpenDetail={(m) => setSelectedMeal(m)}
            />
          ))}
        </div>
      )}

      {loadingMore && (
        <div style={{ textAlign: 'center', padding: 'var(--space-lg)' }}>
          <div className="spinner"></div>
        </div>
      )}
      <div ref={sentinelRef} className="scroll-sentinel" />

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
