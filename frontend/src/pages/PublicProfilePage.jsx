import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { publicApi, messagesApi } from '../services/api';
import { useAuth } from '../services/AuthContext';
import { useInfiniteScroll } from '../services/useInfiniteScroll';
import { shareText } from '../services/share';
import { photoSrc } from '../services/photoUrl';
import PublicMealDetailModal from '../components/PublicMealDetailModal';

function formatDayLabel(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function groupMealsByDay(meals) {
  const groups = [];
  let current = null;

  for (const meal of meals) {
    const day = new Date(meal.consumedAt).toDateString();
    if (!current || current.key !== day) {
      current = { key: day, date: meal.consumedAt, meals: [] };
      groups.push(current);
    }
    current.meals.push(meal);
  }

  return groups;
}

export default function PublicProfilePage() {
  const { username } = useParams();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [meals, setMeals] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [shareMsg, setShareMsg] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);

  useEffect(() => {
    setLoading(true);
    setMeals([]);
    setNextCursor(null);
    setNotFound(false);
    publicApi.getProfile(username).then((data) => {
      setProfile(data);
      setIsFollowing(data.isFollowing || false);
      setFollowersCount(data._count?.followers || 0);
      return publicApi.getMeals(username, null, 18);
    }).then((data) => {
      setMeals(data.meals);
      setNextCursor(data.nextCursor);
      setLoading(false);
    }).catch(() => {
      setNotFound(true);
      setLoading(false);
    });
  }, [username]);

  const fetchMore = useCallback(() => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    publicApi.getMeals(username, nextCursor, 18).then((data) => {
      setMeals((prev) => [...prev, ...data.meals]);
      setNextCursor(data.nextCursor);
      setLoadingMore(false);
    }).catch(() => setLoadingMore(false));
  }, [username, nextCursor, loadingMore]);

  const sentinelRef = useInfiniteScroll(fetchMore, !!nextCursor && !loadingMore);

  const dayGroups = useMemo(() => groupMealsByDay(meals), [meals]);

  const handleShare = useCallback(async () => {
    if (!profile) return;
    const text = [
      `Check out ${profile.name}'s nutrition log`,
      profile.bio || '',
      '',
      `${window.location.origin}/u/${profile.username}`,
    ].filter(Boolean).join('\n');
    const result = await shareText(text, `${profile.name}'s Profile`);
    if (result === 'copied') {
      setShareMsg('Link copied!');
      setTimeout(() => setShareMsg(''), 2000);
    }
  }, [profile]);

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', paddingTop: 'var(--space-xl)' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: 'var(--space-xl)' }}>
        <h2>Profile not found</h2>
        <p style={{ color: 'var(--color-text-secondary)' }}>This user doesn't exist or their profile is private.</p>
        <Link to="/" className="btn btn-primary" style={{ marginTop: 'var(--space-md)', display: 'inline-block' }}>Go Home</Link>
      </div>
    );
  }

  const initial = profile.name ? profile.name.charAt(0).toUpperCase() : '?';

  return (
    <div className="page public-profile-page" style={{ maxWidth: 700, margin: '0 auto' }}>
      {currentUser && (
        <div style={{ marginBottom: 'var(--space-md)' }}>
          <Link to="/" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-primary)' }}>&larr; Back to app</Link>
        </div>
      )}

      <div className="public-profile-header">
        {profile.avatarUrl ? (
          <img src={photoSrc(profile.avatarUrl)} alt={profile.name} className="public-avatar" />
        ) : (
          <div className="public-avatar-placeholder">{initial}</div>
        )}
        <h1 style={{ margin: '0 0 var(--space-xs)', fontSize: 'var(--font-size-xl)' }}>{profile.name}</h1>
        <p style={{ margin: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>@{profile.username}</p>

        <div className="profile-stats">
          <span><strong>{profile._count?.meals || 0}</strong> meals</span>
          <span><strong>{followersCount}</strong> followers</span>
          <span><strong>{profile._count?.following || 0}</strong> following</span>
        </div>

        {profile.bio && <p className="public-bio">{profile.bio}</p>}

        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-sm)', marginTop: 'var(--space-md)', flexWrap: 'wrap' }}>
          {currentUser && currentUser.id !== profile.id && (
            <>
              <button
                className={`action-btn action-btn-follow${isFollowing ? ' following' : ''}`}
                onClick={async () => {
                  try {
                    const res = await publicApi.follow(profile.username);
                    setIsFollowing(res.following);
                    setFollowersCount(res.followersCount);
                  } catch {}
                }}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
              <button
                className="action-btn action-btn-message"
                onClick={async () => {
                  try {
                    const conv = await messagesApi.start(profile.id);
                    navigate(`/messages/${conv.id}`);
                  } catch {}
                }}
              >
                Message
              </button>
            </>
          )}
          {!currentUser && (
            <>
              <Link to="/login" className="action-btn action-btn-follow">Follow</Link>
              <Link to="/login" className="action-btn action-btn-message">Message</Link>
            </>
          )}
          {profile.linkUrl && (
            <a href={profile.linkUrl} target="_blank" rel="noopener noreferrer" className="action-btn action-btn-link">
              Visit Link
            </a>
          )}
          <button className="action-btn action-btn-share" onClick={handleShare}>
            Share
          </button>
        </div>
        {shareMsg && <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-success)', marginTop: 'var(--space-sm)' }}>{shareMsg}</p>}
      </div>

      {meals.length === 0 && !loadingMore ? (
        <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: 'var(--space-xl) 0' }}>
          No meals yet
        </p>
      ) : (
        <>
          {dayGroups.map((group) => (
            <div key={group.key} className="day-group">
              <div className="day-group-header">{formatDayLabel(group.date)}</div>
              <div className="meal-grid">
                {group.meals.map((meal) => (
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
                    {(meal._count?.likes > 0 || meal._count?.comments > 0) && (
                      <div className="meal-tile-engagement">
                        {meal._count.likes > 0 && <span>&#x2764; {meal._count.likes}</span>}
                        {meal._count.comments > 0 && <span>&#x1F4AC; {meal._count.comments}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {loadingMore && (
            <div style={{ textAlign: 'center', padding: 'var(--space-lg)' }}>
              <div className="spinner"></div>
            </div>
          )}
          <div ref={sentinelRef} className="scroll-sentinel" />
        </>
      )}

      {selectedMeal && (
        <PublicMealDetailModal
          mealId={selectedMeal.id}
          username={profile.username}
          onClose={() => setSelectedMeal(null)}
        />
      )}
    </div>
  );
}
