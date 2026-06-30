import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout/Layout';
import Login         from './pages/Login';
import Dashboard     from './pages/Dashboard';
import Inventory     from './pages/Inventory';
import QualityCheck  from './pages/QualityCheck';
import Production    from './pages/Production';
import FinishedGoods from './pages/FinishedGoods';
import Invoices      from './pages/Invoices';
import Reports       from './pages/Reports';

// Guard: redirect to login if not authenticated
const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

const App = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Loading Starline IMS…</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index             element={<Dashboard />} />
        <Route path="inventory"  element={<Inventory />} />
        <Route path="qc"         element={<QualityCheck />} />
        <Route path="production" element={<Production />} />
        <Route path="finished"   element={<FinishedGoods />} />
        <Route path="invoices"   element={<Invoices />} />
        <Route path="reports"    element={<Reports />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
