import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './services/AuthContext';
import Navbar from './components/Navbar';
import TopBar from './components/TopBar';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ScanPage from './pages/ScanPage';
import ReportsPage from './pages/ReportsPage';
import ProfilePage from './pages/ProfilePage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import PublicProfilePage from './pages/PublicProfilePage';
import ExplorePage from './pages/ExplorePage';
import FeedPage from './pages/FeedPage';
import SavedPage from './pages/SavedPage';
import NotificationsPage from './pages/NotificationsPage';
import MessagesPage from './pages/MessagesPage';

const PAGE_TITLES = {
  '/': null,
  '/dashboard': 'My stats',
  '/scan': 'Scan',
  '/notifications': 'Notifications',
  '/messages': 'Messages',
  '/saved': 'Saved',
  '/reports': 'Reports',
  '/profile': 'Profile',
  '/explore': 'Discover',
};

function ProtectedLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="page"><div className="spinner" /></div>;
  }

  if (!user) {
    return <Navigate to="/explore" replace />;
  }

  const pathBase = '/' + (location.pathname.split('/')[1] || '');
  const title = PAGE_TITLES[pathBase] ?? null;

  return (
    <div className="app-layout">
      <Navbar />
      <div className="main-content">
        <TopBar title={title} />
        <Outlet />
      </div>
    </div>
  );
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="page"><div className="spinner" /></div>;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function ExploreWrapper() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="page"><div className="spinner" /></div>;
  }

  if (user) {
    return (
      <div className="app-layout">
        <Navbar />
        <div className="main-content">
          <TopBar title="Discover" />
          <ExplorePage />
        </div>
      </div>
    );
  }

  return <ExplorePage />;
}

function App() {
  return (
    <BrowserRouter basename={import.meta.env.VITE_BASE_PATH || '/'}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<FeedPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/scan" element={<ScanPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/messages/:conversationId" element={<MessagesPage />} />
            <Route path="/saved" element={<SavedPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>

          <Route path="/explore" element={<ExploreWrapper />} />
          <Route path="/u/:username" element={<PublicProfilePage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="*" element={<Navigate to="/explore" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
