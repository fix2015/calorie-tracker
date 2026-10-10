import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './services/AuthContext';
import { LanguageProvider, useTranslation } from './i18n';
import Navbar from './components/Navbar';
import TopBar from './components/TopBar';
import ToastHost from './components/ToastHost';
import OnboardingGate from './components/Onboarding';
import OfflineSync from './components/OfflineSync';
import ChunkErrorBoundary from './components/ChunkErrorBoundary';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import FeedPage from './pages/FeedPage';

// Route-level code splitting: heavy or rarely-first pages load on demand
// (Reports pulls in recharts, Scan pulls in quagga2).
const ScanPage = lazy(() => import('./pages/ScanPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const ExplorePage = lazy(() => import('./pages/ExplorePage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const PublicProfilePage = lazy(() => import('./pages/PublicProfilePage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const SavedPage = lazy(() => import('./pages/SavedPage'));
const ProductSearchPage = lazy(() => import('./pages/ProductSearchPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));

const pageSpinner = <div className="page"><div className="spinner" /></div>;

// After first paint, warm the chunks of frequently used routes so they also open offline
const PREFETCH = [
  () => import('./pages/ScanPage'),
  () => import('./pages/ExplorePage'),
  () => import('./pages/MessagesPage'),
  () => import('./pages/PublicProfilePage'),
  () => import('./pages/NotificationsPage'),
];
function usePrefetchRoutes() {
  useEffect(() => {
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 2000));
    const cancel = window.cancelIdleCallback || clearTimeout;
    const id = idle(() => PREFETCH.forEach((load) => load().catch(() => {})));
    return () => cancel(id);
  }, []);
}

function ProtectedLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { t } = useTranslation();

  const PAGE_TITLES = {
    '/': null,
    '/dashboard': t('nav.stats'),
    '/scan': t('nav.scan'),
    '/products': t('nav.products'),
    '/notifications': t('nav.notifications'),
    '/messages': t('nav.messages'),
    '/saved': t('nav.saved'),
    '/reports': t('nav.reports'),
    '/profile': t('nav.profile'),
    '/explore': t('nav.discover'),
  };

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
        <Suspense fallback={pageSpinner}>
          <Outlet />
        </Suspense>
      </div>
      <OnboardingGate key={user.id} userId={user.id} />
      <OfflineSync userId={user.id} />
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
  const { t } = useTranslation();

  if (loading) {
    return <div className="page"><div className="spinner" /></div>;
  }

  if (user) {
    return (
      <div className="app-layout">
        <Navbar />
        <div className="main-content">
          <TopBar title={t('nav.discover')} />
          <Suspense fallback={pageSpinner}>
            <ExplorePage />
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={pageSpinner}>
      <ExplorePage />
    </Suspense>
  );
}

function App() {
  usePrefetchRoutes();
  return (
    <BrowserRouter basename={import.meta.env.VITE_BASE_PATH || '/'}>
      <LanguageProvider>
        <AuthProvider>
          <ChunkErrorBoundary>
          <Suspense fallback={pageSpinner}>
          <Routes>
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

            <Route element={<ProtectedLayout />}>
              <Route path="/" element={<FeedPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/scan" element={<ScanPage />} />
              <Route path="/products" element={<ProductSearchPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/messages" element={<MessagesPage />} />
              <Route path="/messages/:conversationId" element={<MessagesPage />} />
              <Route path="/saved" element={<SavedPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Route>

            <Route path="/admin" element={<AdminPage />} />
            <Route path="/explore" element={<ExploreWrapper />} />
            <Route path="/u/:username" element={<PublicProfilePage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="*" element={<Navigate to="/explore" replace />} />
          </Routes>
          </Suspense>
          </ChunkErrorBoundary>
          <ToastHost />
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}

export default App;
