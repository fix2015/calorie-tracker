import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';
import { publicApi, notificationsApi } from '../services/api';
import { photoSrc } from '../services/photoUrl';

export default function TopBar() {
  const { user } = useAuth();
  const [hasSaved, setHasSaved] = useState(false);
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    publicApi.savedMeals(null).then((data) => {
      setHasSaved((data.meals || []).length > 0);
    }).catch(() => {});
    notificationsApi.unreadCount().then((data) => setNotifCount(data.count)).catch(() => {});
  }, []);

  return (
    <div className="top-bar">
      <div className="top-bar-actions">
        {user?.username && user?.isPublic && (
          <Link to={`/u/${user.username}`} className="feed-my-profile">
            {user.avatarUrl ? (
              <img src={photoSrc(user.avatarUrl)} alt="" className="feed-my-avatar" />
            ) : (
              <div className="feed-my-avatar-placeholder">{user.name?.charAt(0)?.toUpperCase() || '?'}</div>
            )}
          </Link>
        )}
        {hasSaved && (
          <Link to="/saved" className="feed-top-btn">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          </Link>
        )}
        <Link to="/notifications" className="feed-top-btn" style={{ position: 'relative' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          {notifCount > 0 && <span className="unread-badge">{notifCount > 9 ? '9+' : notifCount}</span>}
        </Link>
        <Link to="/messages" className="feed-top-btn">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </Link>
      </div>
    </div>
  );
}
