import { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';
import { notificationsApi, messagesApi } from '../services/api';
import { playNotificationSound } from '../services/notificationSound';

const icons = {
  home: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  dashboard: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  scan: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M3 9h2M19 9h2M3 15h2M19 15h2M9 3v2M15 3v2M9 19v2M15 19v2"/></svg>,
  explore: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  notifications: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  messages: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  profile: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  publicProfile: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [notifCount, setNotifCount] = useState(0);
  const [msgCount, setMsgCount] = useState(0);
  const prevNotifRef = useRef(0);
  const prevMsgRef = useRef(0);

  useEffect(() => {
    const check = () => {
      notificationsApi.unreadCount().then((data) => {
        if (data.count > prevNotifRef.current && !location.pathname.startsWith('/notifications')) {
          playNotificationSound();
        }
        prevNotifRef.current = data.count;
        setNotifCount(data.count);
      }).catch(() => {});

      messagesApi.list().then((data) => {
        const total = data.conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
        if (total > prevMsgRef.current && !location.pathname.startsWith('/messages')) {
          playNotificationSound();
        }
        prevMsgRef.current = total;
        setMsgCount(total);
      }).catch(() => {});
    };
    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, [location.pathname]);

  const links = [
    { to: '/', label: 'Home', icon: icons.home },
    { to: '/dashboard', label: 'Dashboard', icon: icons.dashboard },
    { to: '/scan', label: 'Scan', icon: icons.scan },
    { to: '/explore', label: 'Explore', icon: icons.explore },
    { to: '/notifications', label: 'Alerts', icon: icons.notifications, badge: notifCount },
    { to: '/messages', label: 'Messages', icon: icons.messages, badge: msgCount },
    { to: '/profile', label: 'Profile', icon: icons.profile },
  ];

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sidebar">
        <div className="logo">CalTracker</div>
        <nav>
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.to === '/'}>
              <span className="nav-icon">
                {link.icon}
                {link.badge > 0 && <span className="unread-badge">{link.badge > 9 ? '9+' : link.badge}</span>}
              </span>
              {link.label}
            </NavLink>
          ))}
          {user?.username && user?.isPublic && (
            <NavLink to={`/u/${user.username}`} className="public-profile-link">
              <span className="nav-icon">{icons.publicProfile}</span> My Public Profile
            </NavLink>
          )}
        </nav>
        <button className="btn btn-secondary logout-btn" onClick={logout}>
          Logout
        </button>
      </aside>

      {/* Mobile bottom nav: Home, Dashboard, Scan, Explore, Profile */}
      <nav className="bottom-nav">
        {[links[0], links[1], links[2], links[3], links[6]].map((link) => (
          <NavLink key={link.to} to={link.to} end={link.to === '/'}>
            <span className="nav-icon">
              {link.icon}
              {link.badge > 0 && <span className="unread-badge">{link.badge > 9 ? '9+' : link.badge}</span>}
            </span>
            {link.label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
