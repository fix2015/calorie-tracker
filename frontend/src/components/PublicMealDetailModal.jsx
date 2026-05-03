import { useState, useEffect, useCallback } from 'react';
import { publicApi } from '../services/api';
import { useAuth } from '../services/AuthContext';
import { photoSrc } from '../services/photoUrl';
import { shareText } from '../services/share';

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function CommentText({ text }) {
  const parts = text.split(/(@[a-zA-Z0-9_]{3,30})/g);
  return (
    <span>
      {parts.map((part, i) =>
        /^@[a-zA-Z0-9_]{3,30}$/.test(part) ? (
          <a key={i} href={`/u/${part.slice(1)}`} className="mention-link" onClick={(e) => e.stopPropagation()}>
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

function CommentItem({ comment: c, user }) {
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(c._count?.likes || 0);

  const handleLike = async () => {
    if (!user) return;
    try {
      const res = await publicApi.toggleCommentLike(c.id);
      setLiked(res.liked);
      setLikesCount(res.likesCount);
    } catch {}
  };

  return (
    <div className="comment-item">
      <div className="comment-body">
        <div>
          <a href={c.user.username ? `/u/${c.user.username}` : '#'} className="comment-author" onClick={(e) => e.stopPropagation()}>{c.user.name}</a>
          <CommentText text={c.text} />
        </div>
        <button className={`comment-like-btn${liked ? ' liked' : ''}`} onClick={handleLike} disabled={!user}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
      </div>
      <div className="comment-meta">
        <span className="comment-time">{timeAgo(c.createdAt)}</span>
        {likesCount > 0 && <span className="comment-likes">{likesCount} like{likesCount !== 1 ? 's' : ''}</span>}
      </div>
    </div>
  );
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(dateStr);
}

export default function PublicMealDetailModal({ mealId, username, onClose }) {
  const { user } = useAuth();
  const [meal, setMeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  const [shareMsg, setShareMsg] = useState('');

  useEffect(() => {
    setLoading(true);
    publicApi.getMealDetail(mealId).then((data) => {
      setMeal(data);
      setLiked(data.isLiked);
      setLikesCount(data._count.likes);
      setComments(data.comments || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [mealId]);

  const handleLike = useCallback(async () => {
    if (!user) return;
    try {
      const res = await publicApi.toggleLike(mealId);
      setLiked(res.liked);
      setLikesCount(res.likesCount);
    } catch { /* ignore */ }
  }, [mealId, user]);

  const handleComment = useCallback(async (e) => {
    e.preventDefault();
    if (!commentText.trim() || posting) return;
    setPosting(true);
    try {
      const comment = await publicApi.addComment(mealId, commentText.trim());
      setComments((prev) => [comment, ...prev]);
      setCommentText('');
    } catch { /* ignore */ }
    setPosting(false);
  }, [mealId, commentText, posting]);

  const handleShare = useCallback(async () => {
    if (!meal) return;
    const text = [
      `${meal.name} \u2014 ${meal.calories} kcal`,
      `P: ${Math.round(meal.proteinG)}g \u00B7 C: ${Math.round(meal.carbsG)}g \u00B7 F: ${Math.round(meal.fatG)}g`,
      '',
      `${window.location.origin}/u/${username}`,
    ].join('\n');
    const result = await shareText(text, meal.name, meal.photoUrl ? photoSrc(meal.photoUrl) : null);
    if (result === 'copied') {
      setShareMsg('Link copied!');
      setTimeout(() => setShareMsg(''), 2000);
    }
  }, [meal, username]);

  const totalMacros = meal ? meal.proteinG + meal.carbsG + meal.fatG : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500, maxHeight: '90vh', overflow: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-xl)' }}><div className="spinner"></div></div>
        ) : !meal ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>Meal not found</div>
        ) : (
          <>
            {meal.photoUrl && (
              <img
                src={photoSrc(meal.photoUrl)}
                alt={meal.name}
                style={{
                  width: 'calc(100% + calc(var(--space-lg) * 2))',
                  margin: `calc(-1 * var(--space-lg)) calc(-1 * var(--space-lg)) var(--space-md)`,
                  maxHeight: 280,
                  objectFit: 'cover',
                  borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
                  display: 'block',
                }}
              />
            )}

            <h2 style={{ margin: '0 0 var(--space-xs)', fontSize: 'var(--font-size-lg)' }}>{meal.name}</h2>
            <p style={{ margin: '0 0 var(--space-md)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              {formatDate(meal.consumedAt)} at {formatTime(meal.consumedAt)}
            </p>

            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--color-primary)', marginBottom: 'var(--space-sm)' }}>
              {meal.calories} kcal
            </div>

            {totalMacros > 0 && (
              <div style={{ marginBottom: 'var(--space-md)' }}>
                <div className="macro-bar" style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 'var(--space-xs)' }}>
                  <div style={{ width: `${(meal.proteinG / totalMacros) * 100}%`, background: '#3B82F6' }} />
                  <div style={{ width: `${(meal.carbsG / totalMacros) * 100}%`, background: '#F59E0B' }} />
                  <div style={{ width: `${(meal.fatG / totalMacros) * 100}%`, background: '#EF4444' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                  <span style={{ color: '#3B82F6' }}>P: {Math.round(meal.proteinG)}g</span>
                  <span style={{ color: '#F59E0B' }}>C: {Math.round(meal.carbsG)}g</span>
                  <span style={{ color: '#EF4444' }}>F: {Math.round(meal.fatG)}g</span>
                </div>
              </div>
            )}

            {meal.description && (
              <div style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-sm) var(--space-md)', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {meal.description}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)', padding: 'var(--space-sm) 0' }}>
              <button
                className={`feed-action-btn feed-action-like${liked ? ' liked' : ''}`}
                onClick={handleLike}
                disabled={!user}
                title={user ? (liked ? 'Unlike' : 'Like') : 'Login to like'}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              </button>
              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{likesCount}</span>
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginLeft: 'auto' }}>
                {meal._count.comments} comment{meal._count.comments !== 1 ? 's' : ''}
              </span>
              <button className="action-btn action-btn-share" style={{ padding: 'var(--space-xs) var(--space-md)' }} onClick={handleShare}>
                Share
              </button>
            </div>

            {shareMsg && <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-success)', marginBottom: 'var(--space-sm)' }}>{shareMsg}</p>}

            <div className="comment-list">
              {comments.length === 0 && (
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', textAlign: 'center', padding: 'var(--space-md) 0' }}>
                  No comments yet
                </p>
              )}
              {comments.map((c) => (
                <CommentItem key={c.id} comment={c} user={user} />
              ))}
            </div>

            {user ? (
              <form onSubmit={handleComment} className="comment-input-row">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  maxLength={500}
                />
                <button type="submit" className="btn btn-primary" disabled={posting || !commentText.trim()} style={{ padding: 'var(--space-xs) var(--space-md)', whiteSpace: 'nowrap' }}>
                  {posting ? '...' : 'Post'}
                </button>
              </form>
            ) : (
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', textAlign: 'center', marginTop: 'var(--space-sm)' }}>
                <a href="/login">Login</a> to like and comment
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
