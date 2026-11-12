import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";

import { Navbar } from "./components/common/Navbar";
import { ProtectedRoute } from "./components/common/ProtectedRoute";
import { ToastContainer } from "./components/common/ToastContainer";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { WebSocketProvider } from "./context/WebSocketContext";
import { ActivityPage } from "./pages/ActivityPage";
import { AdminSnacksPage } from "./pages/AdminSnacksPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { SmartScannerPage } from "./pages/SmartScannerPage";
import { SnackDetailPage } from "./pages/SnackDetailPage";
import { SnacksPage } from "./pages/SnacksPage";

function AppLayout() {
  return (
    <div className="app-shell">
      <Navbar />
      <Outlet />
      <footer className="app-footer">
        <strong>Bipolar Factory</strong> · Snack Overflow Office Pantry · Coimbatore
      </footer>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <WebSocketProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/snacks" element={<SnacksPage />} />
                <Route path="/snacks/:id" element={<SnackDetailPage />} />

                <Route
                  path="/admin/snacks"
                  element={
                    <ProtectedRoute adminOnly>
                      <AdminSnacksPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/scanner"
                  element={
                    <ProtectedRoute adminOnly>
                      <SmartScannerPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/activity"
                  element={
                    <ProtectedRoute adminOnly>
                      <ActivityPage />
                    </ProtectedRoute>
                  }
                />
              </Route>

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>

            <ToastContainer />
          </WebSocketProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;

