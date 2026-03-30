/**
 * App
 * Root component: sets up BrowserRouter, AuthProvider, ToastContainer,
 * and all routes with ProtectedRoute + RoleRoute guards.
 *
 * Layout:
 *   Authenticated pages share a shell with Navbar + Sidebar.
 *   Auth pages (login/register) render without the shell.
 *
 * Route guard layers:
 *   ProtectedRoute — requires any authenticated user
 *   RoleRoute      — restricts to specific roles
 */
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import RoleRoute from './components/RoleRoute';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import DiagnosisChatbot from './components/DiagnosisChatbot';

import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import PatientList from './pages/PatientList';
import PatientDetail from './pages/PatientDetail';
import PatientRegister from './pages/PatientRegister';
import AppointmentCalendar from './pages/AppointmentCalendar';
import AppointmentBook from './pages/AppointmentBook';
import EHRRecord from './pages/EHRRecord';
import MedicalRecordList from './pages/MedicalRecordList';
import PharmacyDashboard from './pages/PharmacyDashboard';
import LabResults from './pages/LabResults';
import BillingPage from './pages/BillingPage';
import WardMap from './pages/WardMap';
import AdminPanel from './pages/AdminPanel';

/** Forces a fresh EHRRecord instance per record id so view state does not leak between routes */
function EHRRecordById() {
  const { id } = useParams();
  return <EHRRecord key={id} />;
}

/** Shell layout wrapping authenticated pages */
function AppShell({ children }) {
  const location = useLocation();
  // Desktop: sidebar visible by default; mobile: drawer closed until hamburger opens
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  );

  // Close the mobile drawer after navigation so content is not covered
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Mobile: dim background when drawer open */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {/* Sidebar: off-canvas on small screens, always visible on lg+ */}
      <div
        className={`fixed lg:static inset-y-0 left-0 z-40 flex flex-col flex-shrink-0 transition-transform duration-200 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0`}
      >
        <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen((o) => !o)} />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Navbar onMenuToggle={() => setSidebarOpen((o) => !o)} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Floating RAG chatbot — available to clinical staff on all authenticated pages */}
      <DiagnosisChatbot />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Authenticated routes — wrapped in shell */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <AppShell><Dashboard /></AppShell>
            </ProtectedRoute>
          } />

          <Route path="/patients" element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['admin', 'doctor', 'nurse', 'receptionist']}>
                <AppShell><PatientList /></AppShell>
              </RoleRoute>
            </ProtectedRoute>
          } />

          <Route path="/patients/register" element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['admin', 'receptionist', 'doctor']}>
                <AppShell><PatientRegister /></AppShell>
              </RoleRoute>
            </ProtectedRoute>
          } />

          <Route path="/patients/:id" element={
            <ProtectedRoute>
              <AppShell><PatientDetail /></AppShell>
            </ProtectedRoute>
          } />

          <Route path="/appointments" element={
            <ProtectedRoute>
              <AppShell><AppointmentCalendar /></AppShell>
            </ProtectedRoute>
          } />

          <Route path="/appointments/book" element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['admin', 'receptionist', 'doctor']}>
                <AppShell><AppointmentBook /></AppShell>
              </RoleRoute>
            </ProtectedRoute>
          } />

          {/* /records → list view (was incorrectly rendering the create form) */}
          <Route path="/records" element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['admin', 'doctor', 'nurse']}>
                <AppShell><MedicalRecordList /></AppShell>
              </RoleRoute>
            </ProtectedRoute>
          } />

          {/* /records/new → create form — must come before /:id so React Router matches it first */}
          <Route path="/records/new" element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['admin', 'doctor', 'nurse']}>
                {/* key resets local state when switching between new and an existing record */}
                <AppShell><EHRRecord key="records-new" /></AppShell>
              </RoleRoute>
            </ProtectedRoute>
          } />

          {/* /records/:id → view mode for an existing record */}
          <Route path="/records/:id" element={
            <ProtectedRoute>
              <AppShell><EHRRecordById /></AppShell>
            </ProtectedRoute>
          } />

          <Route path="/pharmacy" element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['admin', 'doctor', 'nurse']}>
                <AppShell><PharmacyDashboard /></AppShell>
              </RoleRoute>
            </ProtectedRoute>
          } />

          <Route path="/lab" element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['admin', 'doctor', 'lab_tech']}>
                <AppShell><LabResults /></AppShell>
              </RoleRoute>
            </ProtectedRoute>
          } />

          <Route path="/billing" element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['admin', 'receptionist']}>
                <AppShell><BillingPage /></AppShell>
              </RoleRoute>
            </ProtectedRoute>
          } />

          <Route path="/wards" element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['admin', 'doctor', 'nurse']}>
                <AppShell><WardMap /></AppShell>
              </RoleRoute>
            </ProtectedRoute>
          } />

          <Route path="/admin" element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['admin']}>
                <AppShell><AdminPanel /></AppShell>
              </RoleRoute>
            </ProtectedRoute>
          } />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>

      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} />
    </AuthProvider>
  );
}
