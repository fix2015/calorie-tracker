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

export default function FeedCard({ meal, onOpenDetail }) {
  const [liked, setLiked] = useState(meal.isLiked || false);
  const [likesCount, setLikesCount] = useState(meal._count?.likes || 0);

  const handleLike = useCallback(async () => {
    try {
      const res = await publicApi.toggleLike(meal.id);
      setLiked(res.liked);
      setLikesCount(res.likesCount);
    } catch { /* ignore */ }
  }, [meal.id]);

  const handleShare = useCallback(async () => {
    const text = `${meal.name} — ${meal.calories} kcal\n${window.location.origin}/u/${meal.user?.username}`;
    await shareText(text, meal.name, meal.photoUrl ? photoSrc(meal.photoUrl) : null);
  }, [meal]);

  const totalMacros = meal.proteinG + meal.carbsG + meal.fatG;

  return (
    <div className="feed-card">
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
            <span className="feed-username">{meal.user?.name}</span>
            <span className="feed-handle">@{meal.user?.username}</span>
          </div>
        </Link>
        <span className="feed-time">{timeAgo(meal.consumedAt)}</span>
      </div>

      {meal.photoUrl && (
        <div className="feed-photo-wrap" onClick={() => onOpenDetail(meal)}>
          <img src={photoSrc(meal.photoUrl)} alt={meal.name} className="feed-photo" loading="lazy" />
        </div>
      )}

      <div className="feed-body">
        <div className="feed-actions">
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

        {likesCount > 0 && (
          <p className="feed-likes">{likesCount} like{likesCount !== 1 ? 's' : ''}</p>
        )}

        <p className="feed-meal-name">
          <strong>{meal.name}</strong> — {meal.calories} kcal
        </p>

        {totalMacros > 0 && (
          <p className="feed-macros">
            P: {Math.round(meal.proteinG)}g · C: {Math.round(meal.carbsG)}g · F: {Math.round(meal.fatG)}g
          </p>
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
