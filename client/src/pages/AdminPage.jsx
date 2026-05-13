import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { apiFetch } from "../api/client.js";
import AppNav from "../components/AppNav.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function AdminPage() {
  const { user, loading } = useAuth();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    let cancelled = false;
    (async () => {
      setError("");
      try {
        const data = await apiFetch("/api/admin/summary");
        if (!cancelled) setSummary(data);
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load summary");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) {
    return (
      <div className="app-shell">
        <p className="subtitle" style={{ marginTop: "3rem" }}>
          Loading…
        </p>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="app-shell">
      <AppNav />
      <p className="subtitle" style={{ marginBottom: "0.5rem" }}>
        <Link to="/">← Back to tasks</Link>
      </p>
      <h1 className="page-title">Admin</h1>
      <p className="subtitle">Role-based access: only users with the admin role can view this page.</p>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="card">
        <h2 style={{ margin: "0 0 1rem", fontSize: "1.1rem" }}>Platform summary</h2>
        {summary ? (
          <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "var(--text)" }}>
            <li>Registered users: {summary.users}</li>
            <li>Tasks (all users): {summary.tasks}</li>
          </ul>
        ) : (
          <p className="subtitle" style={{ margin: 0 }}>
            Loading summary…
          </p>
        )}
      </div>
    </div>
  );
}
