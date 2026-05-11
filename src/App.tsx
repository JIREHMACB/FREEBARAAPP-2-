import React, {
  useEffect,
  useState,
  Suspense,
  lazy,
} from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { UserContext } from './hooks/useAuth';
import type { UserContextType } from './types/types';
import SplashScreen from './components/SplashScreen';


// ── Lazy pages ────────────────────────────────────────────────────────────
const Layout        = lazy(() => import('./components/Layout'));
const Login         = lazy(() => import('./pages/Login'));
const Home          = lazy(() => import('./pages/Home'));
const Events        = lazy(() => import('./pages/Events'));
const EventWall     = lazy(() => import('./pages/EventWall'));
const Business      = lazy(() => import('./pages/Business'));
const Services      = lazy(() => import('./pages/Services'));
const Profile       = lazy(() => import('./pages/Profile'));
const Messages      = lazy(() => import('./pages/Messages'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Communities   = lazy(() => import('./pages/Communities'));
const Reseau        = lazy(() => import('./pages/Reseau'));
const Tasks         = lazy(() => import('./pages/Tasks'));
const Favorites     = lazy(() => import('./pages/Favorites'));
const AdminPanel    = lazy(() => import('./pages/AdminPanel'));

// ── Loading screen ────────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <span className="text-slate-500 text-sm font-medium">Chargement…</span>
      </div>
    </div>
  );  
}

// ── Private route guard (JWT) ─────────────────────────────────────────────
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');

  if (!token) return <Navigate to="/login" replace />;

  return (
    <Suspense fallback={<PageLoader />}>
      <Layout>{children}</Layout>
    </Suspense>
  );
}

// ── App root ──────────────────────────────────────────────────────────────
export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [authData, setAuthData] = useState<UserContextType>({
    user: null,
    profile: null,
    loading: true,
  });

  // ✅ Vérifie token au démarrage
  useEffect(() => {
    const token = localStorage.getItem('token');

    if (token) {
      setAuthData({
        user: { token } as any,
        profile: null,
        loading: false,
      });
    } else {
      setAuthData({
        user: null,
        profile: null,
        loading: false,
      });
    }
  }, []);

  return (
    <UserContext.Provider value={authData}>
      {/* Splash Screen — s'affiche uniquement au premier chargement */}
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}

      <BrowserRouter>
        <Toaster
          position="top-center"
          reverseOrder={false}
          toastOptions={{
            duration: 3000,
            style: { fontFamily: 'Plus Jakarta Sans, sans-serif' },
          }}
        />

        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />

            {/* Protected */}
            <Route path="/"                element={<PrivateRoute><Home /></PrivateRoute>} />
            <Route path="/events"          element={<PrivateRoute><Events /></PrivateRoute>} />
            <Route path="/events/:id"      element={<PrivateRoute><EventWall /></PrivateRoute>} />
            <Route path="/business"        element={<PrivateRoute><Business /></PrivateRoute>} />
            <Route path="/services"        element={<PrivateRoute><Services /></PrivateRoute>} />
            <Route path="/groups"          element={<PrivateRoute><Communities /></PrivateRoute>} />
            <Route path="/reseau"          element={<PrivateRoute><Reseau /></PrivateRoute>} />
            <Route path="/profile"         element={<PrivateRoute><Profile /></PrivateRoute>} />
            <Route path="/profile/:userId" element={<PrivateRoute><Profile /></PrivateRoute>} />
            <Route path="/favorites"       element={<PrivateRoute><Favorites /></PrivateRoute>} />
            <Route path="/tasks"           element={<PrivateRoute><Tasks /></PrivateRoute>} />
            <Route path="/messages"        element={<PrivateRoute><Messages /></PrivateRoute>} />
            <Route path="/messages/:id"    element={<PrivateRoute><Messages /></PrivateRoute>} />
            <Route path="/notifications"   element={<PrivateRoute><Notifications /></PrivateRoute>} />
             <Route path="/admin" element={<PrivateRoute><AdminPanel /></PrivateRoute>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </UserContext.Provider>
  );
}