import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function AppNav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <nav className="nav">
      <span className="nav-brand">Task Manager</span>
      <div className="nav-actions">
        {user && <span className="nav-user">{user.email}</span>}
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
