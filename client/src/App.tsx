import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { PageSpinner } from './components/States';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Board from './pages/Board';
import RequestDetailPage from './pages/RequestDetail';
import RequestForm from './pages/RequestForm';
import RequesterDashboard from './pages/RequesterDashboard';
import VolunteerDashboard from './pages/VolunteerDashboard';
import NotFound from './pages/NotFound';

// Heavier pages (charts, maps) are code-split.
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const MapPage = lazy(() => import('./pages/MapPage'));

export default function App() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Landing />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="board" element={<ProtectedRoute><Board /></ProtectedRoute>} />
          <Route path="map" element={<ProtectedRoute><MapPage /></ProtectedRoute>} />
          <Route path="requests/new" element={<ProtectedRoute roles={['REQUESTER']}><RequestForm /></ProtectedRoute>} />
          <Route path="requests/:id" element={<ProtectedRoute><RequestDetailPage /></ProtectedRoute>} />
          <Route path="requests/:id/edit" element={<ProtectedRoute roles={['REQUESTER']}><RequestForm /></ProtectedRoute>} />
          <Route path="my-requests" element={<ProtectedRoute roles={['REQUESTER']}><RequesterDashboard /></ProtectedRoute>} />
          <Route path="volunteer" element={<ProtectedRoute roles={['VOLUNTEER']}><VolunteerDashboard /></ProtectedRoute>} />
          <Route path="admin" element={<ProtectedRoute roles={['ADMIN']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
