import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { publicApi } from '../services/api';
import { photoSrc } from '../services/photoUrl';
import { shareText } from '../services/share';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function getHealthTags(meal) {
  const tags = [];
  if (meal.proteinG >= 25) tags.push('High protein');
  if (meal.carbsG <= 20) tags.push('Low carb');
  if (meal.fatG <= 10) tags.push('Low fat');
  if (meal.calories <= 400) tags.push('Light meal');
  if (meal.calories >= 600) tags.push('Hearty');
  return tags.slice(0, 3);
}

export default function FeedCard({ meal, onOpenDetail }) {
  const [liked, setLiked] = useState(meal.isLiked || false);
  const [likesCount, setLikesCount] = useState(meal._count?.likes || 0);
  const [saved, setSaved] = useState(false);

  const handleLike = useCallback(async () => {
    try {
      const res = await publicApi.toggleLike(meal.id);
      setLiked(res.liked);
      setLikesCount(res.likesCount);
    } catch {}
  }, [meal.id]);

  const handleShare = useCallback(async () => {
    const text = `${meal.name} — ${meal.calories} kcal\n${window.location.origin}/u/${meal.user?.username}`;
    await shareText(text, meal.name, meal.photoUrl ? photoSrc(meal.photoUrl) : null);
  }, [meal]);

  const tags = getHealthTags(meal);

  return (
    <div className="feed-card">
      {/* Header */}
      <div className="feed-header">
        <Link to={`/u/${meal.user?.username}`} className="feed-header-user">
          {meal.user?.avatarUrl ? (
            <img src={photoSrc(meal.user.avatarUrl)} alt="" className="feed-avatar" />
          ) : (
            <div className="feed-avatar-placeholder">
              {meal.user?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
          )}
          <div>
            <span className="feed-username">{meal.user?.username || meal.user?.name}</span>
            <span className="feed-date">{new Date(meal.consumedAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
        </Link>
        <span className="feed-time">{timeAgo(meal.consumedAt)}</span>
      </div>

      {/* Photo with calorie badge */}
      {meal.photoUrl ? (
        <div className="feed-photo-wrap" onClick={() => onOpenDetail(meal)}>
          <img src={photoSrc(meal.photoUrl)} alt={meal.name} className="feed-photo" loading="lazy" />
          <div className="feed-calorie-badge">{meal.calories} kcal</div>
        </div>
      ) : (
        <div className="feed-no-photo" onClick={() => onOpenDetail(meal)}>
          <span className="feed-no-photo-name">{meal.name}</span>
          <span className="feed-calorie-badge-inline">{meal.calories} kcal</span>
        </div>
      )}

      <div className="feed-body">
        {/* Actions */}
        <div className="feed-actions">
          <div className="feed-actions-left">
            <button className={`feed-action-btn feed-action-like${liked ? ' liked' : ''}`} onClick={handleLike}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            </button>
            <button className="feed-action-btn feed-action-comment" onClick={() => onOpenDetail(meal)}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </button>
            <button className="feed-action-btn feed-action-share" onClick={handleShare}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
          <button className={`feed-action-btn feed-action-save${saved ? ' saved' : ''}`} onClick={() => setSaved(!saved)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          </button>
        </div>

        {likesCount > 0 && (
          <p className="feed-likes">{likesCount} like{likesCount !== 1 ? 's' : ''}</p>
        )}

        <p className="feed-meal-name">
          <Link to={`/u/${meal.user?.username}`} className="feed-caption-user">{meal.user?.username || meal.user?.name}</Link>
          {' '}{meal.name} — {meal.calories} kcal
        </p>

        {meal.description && (
          <p className="feed-description">{meal.description}</p>
        )}

        {/* Health tags */}
        {tags.length > 0 && (
          <div className="feed-tags">
            {tags.map((tag) => (
              <span key={tag} className="feed-tag">{tag}</span>
            ))}
          </div>
        )}

        {meal._count?.comments > 0 && (
          <button className="feed-view-comments" onClick={() => onOpenDetail(meal)}>
            View all {meal._count.comments} comment{meal._count.comments !== 1 ? 's' : ''}
          </button>
        )}
      </div>
    </div>
  );
}
