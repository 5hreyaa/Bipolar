import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Activity,
  Camera,
  Cookie,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  UtensilsCrossed,
  X,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { useWebSocket } from "../../context/WebSocketContext";

export function Navbar() {
  const { user, isAdmin, logoutUser } = useAuth();
  const { status: wsStatus } = useWebSocket();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logoutUser();
    navigate("/login");
  };

  const wsLabel =
    wsStatus === "connected" ? "Live" : wsStatus === "connecting" ? "Syncing" : "Offline";

  const navItems = [
    { to: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={16} /> },
    { to: "/snacks", label: "Snacks", icon: <Cookie size={16} /> },
    ...(isAdmin
      ? [
          { to: "/admin/snacks", label: "Manage Pantry", icon: <ShieldCheck size={16} /> },
          { to: "/admin/scanner", label: "Smart Scanner", icon: <Camera size={16} /> },
          { to: "/admin/activity", label: "Activity", icon: <Activity size={16} /> },
        ]
      : []),
  ];

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <NavLink to="/dashboard" className="brand-link" onClick={() => setMobileOpen(false)}>
            <span className="brand-logo" aria-hidden="true">
              <UtensilsCrossed size={19} />
            </span>
            <span className="brand-stack">
              <span className="brand-company">Bipolar Factory</span>
              <span>Snack Overflow</span>
            </span>
          </NavLink>

          <nav className="nav-links" aria-label="Main navigation">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="nav-right">
          <span
            className="ws-pill"
            title={`Real-time WebSocket status: ${wsStatus}`}
            aria-label={`Live sync status: ${wsLabel}`}
          >
            <span className={`ws-dot ${wsStatus}`} />
            <span className="ws-label">{wsLabel}</span>
          </span>

          {user && (
            <div className="user-chip">
              <span className="user-name-text" style={{ fontWeight: 600 }}>
                {user.name}
              </span>
              <span className={`role-badge ${user.role}`}>{user.role}</span>
            </div>
          )}

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleLogout}
            aria-label="Log out"
          >
            <LogOut size={15} />
            <span>Sign out</span>
          </button>

          <button
            type="button"
            className="mobile-menu-btn"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      <nav
        className={`mobile-drawer${mobileOpen ? " open" : ""}`}
        aria-label="Mobile navigation"
      >
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
            onClick={() => setMobileOpen(false)}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
