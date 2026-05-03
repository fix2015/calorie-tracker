import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { notificationsApi } from '../services/api';
import { photoSrc } from '../services/photoUrl';
import { useInfiniteScroll } from '../services/useInfiniteScroll';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function notifText(n) {
  switch (n.type) {
    case 'like': return 'liked your meal';
    case 'comment': return 'commented on your meal';
    case 'follow': return 'started following you';
    case 'message': return 'sent you a message';
    case 'mention': return 'mentioned you in a comment';
    default: return 'interacted with you';
  }
}

function notifLink(n) {
  if (n.type === 'follow') return `/u/${n.actor.username}`;
  if (n.type === 'message') return '/messages';
  if (n.mealId) return null; // handled by onClick
  return `/u/${n.actor.username}`;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    notificationsApi.list().then((data) => {
      setNotifications(data.notifications);
      setNextCursor(data.nextCursor);
      setLoading(false);
    }).catch(() => setLoading(false));

    // Mark all as read on page open
    notificationsApi.readAll().catch(() => {});
  }, []);

  const fetchMore = useCallback(() => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    notificationsApi.list(nextCursor).then((data) => {
      setNotifications((prev) => [...prev, ...data.notifications]);
      setNextCursor(data.nextCursor);
      setLoadingMore(false);
    }).catch(() => setLoadingMore(false));
  }, [nextCursor, loadingMore]);

  const sentinelRef = useInfiniteScroll(fetchMore, !!nextCursor && !loadingMore);

  if (loading) {
    return <div className="page"><div className="spinner"></div></div>;
  }

  return (
    <div className="page">
      {notifications.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: 'var(--space-xl) 0' }}>
          No notifications yet
        </p>
      ) : (
        <div style={{ maxWidth: 560 }}>
          {notifications.map((n) => {
            const link = notifLink(n);
            const Wrapper = link ? Link : 'div';
            const wrapperProps = link ? { to: link } : {};
            return (
              <Wrapper key={n.id} className={`notif-item${!n.read ? ' unread' : ''}`} {...wrapperProps}>
                {n.actor.avatarUrl ? (
                  <img src={photoSrc(n.actor.avatarUrl)} alt="" className="notif-avatar" />
                ) : (
                  <div className="notif-avatar-placeholder">
                    {n.actor.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                )}
                <div className="notif-content">
                  <p className="notif-text">
                    <strong>{n.actor.name}</strong> {notifText(n)}
                  </p>
                  <span className="notif-time">{timeAgo(n.createdAt)}</span>
                </div>
              </Wrapper>
            );
          })}
        </div>
      )}

      {loadingMore && <div style={{ textAlign: 'center', padding: 'var(--space-lg)' }}><div className="spinner"></div></div>}
      <div ref={sentinelRef} className="scroll-sentinel" />
    </div>
  );
}
