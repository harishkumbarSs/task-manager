import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function AppNav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <nav className="nav">
      <span className="nav-brand">Task Manager</span>
      <div className="nav-actions">
        {user && (
          <>
            <Link
              to="/"
              className="btn btn-ghost"
              style={{
                textDecoration: "none",
                borderColor: pathname === "/" ? "var(--accent)" : undefined,
                color: pathname === "/" ? "var(--text)" : undefined,
              }}
            >
              Tasks
            </Link>
            <Link
              to="/kanban"
              className="btn btn-ghost"
              style={{
                textDecoration: "none",
                borderColor: pathname === "/kanban" ? "var(--accent)" : undefined,
                color: pathname === "/kanban" ? "var(--text)" : undefined,
              }}
            >
              Board
            </Link>
          </>
        )}
        {user && <span className="nav-user">{user.email}</span>}
        {user?.role === "admin" && (
          <Link to="/admin" className="btn btn-ghost" style={{ textDecoration: "none" }}>
            Admin
          </Link>
        )}
        <button type="button" className="btn btn-ghost" onClick={handleLogout}>
          Log out
        </button>
      </div>
    </nav>
  );
}

export function AuthNavLink({ to, children }) {
  return (
    <Link to={to} className="btn btn-ghost" style={{ textDecoration: "none" }}>
      {children}
    </Link>
  );
}
