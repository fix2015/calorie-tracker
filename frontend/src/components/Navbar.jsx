import { NavLink } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';

export default function Navbar() {
  const { logout } = useAuth();

  const links = [
    { to: '/', label: 'Dashboard', icon: '📊' },
    { to: '/scan', label: 'Scan', icon: '📷' },
    { to: '/reports', label: 'Reports', icon: '📈' },
    { to: '/profile', label: 'Profile', icon: '👤' },
  ];

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sidebar">
        <div className="logo">CalTracker</div>
        <nav>
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.to === '/'}>
              <span>{link.icon}</span> {link.label}
            </NavLink>
          ))}
        </nav>
        <button className="btn btn-secondary logout-btn" onClick={logout}>
          Logout
        </button>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="bottom-nav">
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.to === '/'}>
            <span className="icon">{link.icon}</span>
            {link.label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
