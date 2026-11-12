import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Lock, Mail, ShieldCheck, User, UtensilsCrossed } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export function LoginPage() {
  const { isAuthenticated, loginUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const performLogin = async (loginEmail: string, loginPassword: string) => {
    setError("");
    setIsSubmitting(true);
    try {
      const loggedInUser = await loginUser(loginEmail, loginPassword);
      toast.success(`Welcome back, ${loggedInUser.name}!`, "Signed in");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid email or password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Please enter both email and password.");
      return;
    }
    await performLogin(email.trim(), password);
  };

  return (
    <main className="login-page">
      <div className="login-card">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <span className="brand-logo" style={{ width: 44, height: 44 }} aria-hidden="true">
            <UtensilsCrossed size={22} />
          </span>
          <div>
            <div className="brand-company" style={{ marginBottom: 2 }}>
              Bipolar Factory · Coimbatore
            </div>
            <h1 style={{ margin: 0, fontSize: "1.45rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
              Snack Overflow
            </h1>
            <p style={{ margin: 0, fontSize: "0.86rem", color: "var(--text-secondary)" }}>
              Internal Office Pantry Management Portal
            </p>
          </div>
        </div>

        {error && (
          <div className="alert alert-error" role="alert">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">
              Work Email
            </label>
            <div style={{ position: "relative" }}>
              <Mail
                size={16}
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                }}
              />
              <input
                id="login-email"
                type="email"
                className="input"
                style={{ paddingLeft: 36 }}
                placeholder="you@snackoverflow.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">
              Password
            </label>
            <div style={{ position: "relative" }}>
              <Lock
                size={16}
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                }}
              />
              <input
                id="login-password"
                type="password"
                className="input"
                style={{ paddingLeft: 36 }}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", padding: "11px 16px", marginTop: 4 }}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="demo-box">
          <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Quick Demo Access (1-Click Sign In)
          </div>

          <div className="demo-buttons">
            <button
              type="button"
              className="demo-account-btn"
              disabled={isSubmitting}
              onClick={() => {
                setEmail("admin@snackoverflow.com");
                setPassword("admin123");
                void performLogin("admin@snackoverflow.com", "admin123");
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: "0.85rem", color: "#0369a1" }}>
                <ShieldCheck size={15} />
                <span>Demo Admin</span>
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: 3 }}>
                admin@snackoverflow.com
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                Pass: admin123
              </div>
            </button>

            <button
              type="button"
              className="demo-account-btn"
              disabled={isSubmitting}
              onClick={() => {
                setEmail("member@snackoverflow.com");
                setPassword("member123");
                void performLogin("member@snackoverflow.com", "member123");
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: "0.85rem", color: "#047857" }}>
                <User size={15} />
                <span>Demo Member</span>
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: 3 }}>
                member@snackoverflow.com
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                Pass: member123
              </div>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

