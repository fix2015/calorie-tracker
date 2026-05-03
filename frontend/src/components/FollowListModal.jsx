import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { publicApi } from '../services/api';
import { photoSrc } from '../services/photoUrl';
import { useInfiniteScroll } from '../services/useInfiniteScroll';

export default function FollowListModal({ username, type, onClose }) {
  const [users, setUsers] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchFn = type === 'followers' ? publicApi.getFollowers : publicApi.getFollowing;

  useEffect(() => {
    setLoading(true);
    fetchFn(username).then((data) => {
      setUsers(data.users);
      setNextCursor(data.nextCursor);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [username, type]);

  const fetchMore = useCallback(() => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    fetchFn(username, nextCursor).then((data) => {
      setUsers((prev) => [...prev, ...data.users]);
      setNextCursor(data.nextCursor);
      setLoadingMore(false);
    }).catch(() => setLoadingMore(false));
  }, [username, nextCursor, loadingMore]);

  const sentinelRef = useInfiniteScroll(fetchMore, !!nextCursor && !loadingMore);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ marginBottom: 'var(--space-md)', textTransform: 'capitalize' }}>{type}</h2>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-xl)' }}><div className="spinner"></div></div>
        ) : users.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: 'var(--space-lg) 0' }}>
            No {type} yet
          </p>
        ) : (
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {users.map((u) => (
              <Link key={u.id} to={`/u/${u.username}`} className="follow-list-item" onClick={onClose}>
                {u.avatarUrl ? (
                  <img src={photoSrc(u.avatarUrl)} alt="" className="follow-list-avatar" />
                ) : (
                  <div className="follow-list-avatar-placeholder">
                    {u.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                )}
                <div className="follow-list-info">
                  <span className="follow-list-name">{u.name}</span>
                  <span className="follow-list-handle">@{u.username}</span>
                </div>
              </Link>
            ))}
            {loadingMore && <div style={{ textAlign: 'center', padding: 'var(--space-sm)' }}><div className="spinner"></div></div>}
            <div ref={sentinelRef} className="scroll-sentinel" />
          </div>
        )}
      </div>
    </div>
  );
}
