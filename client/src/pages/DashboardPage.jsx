import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../api/client.js";
import AppNav from "../components/AppNav.jsx";

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "";
  }
}

export default function DashboardPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const loadTasks = useCallback(async () => {
    setError("");
    try {
      const data = await apiFetch("/api/tasks");
      setTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setError("");
    try {
      const created = await apiFetch("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
        }),
      });
      setTasks((prev) => [created, ...prev]);
      setTitle("");
      setDescription("");
    } catch (err) {
      setError(err.message || "Could not create task");
    }
  }

  async function toggleComplete(task) {
    setError("");
    try {
      const updated = await apiFetch(`/api/tasks/${task._id}`, {
        method: "PATCH",
        body: JSON.stringify({ completed: !task.completed }),
      });
      setTasks((prev) => prev.map((t) => (t._id === updated._id ? updated : t)));
    } catch (err) {
      setError(err.message || "Update failed");
    }
  }

  async function removeTask(id) {
    setError("");
    try {
      await apiFetch(`/api/tasks/${id}`, { method: "DELETE" });
      setTasks((prev) => prev.filter((t) => t._id !== id));
    } catch (err) {
      setError(err.message || "Delete failed");
    }
  }

  return (
    <div className="app-shell">
      <AppNav />
      <h1 className="page-title">Your tasks</h1>
      <p className="subtitle">Add tasks, mark them done, or remove them — updates stay in sync with the server.</p>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ margin: "0 0 1rem", fontSize: "1.1rem" }}>New task</h2>
        <form onSubmit={handleCreate}>
          <div className="field">
            <label htmlFor="task-title">Title</label>
            <input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="task-desc">Description (optional)</label>
            <textarea
              id="task-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes or details…"
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={!title.trim()}>
              Add task
            </button>
          </div>
        </form>
      </div>

      {loading ? (
        <p className="subtitle">Loading tasks…</p>
      ) : tasks.length === 0 ? (
        <div className="card empty-state">No tasks yet. Create one above.</div>
      ) : (
        <div className="task-list">
          {tasks.map((task) => (
            <article key={task._id} className={`task-row ${task.completed ? "completed" : ""}`}>
              <div className="checkbox-wrap">
                <input
                  type="checkbox"
                  checked={Boolean(task.completed)}
                  onChange={() => toggleComplete(task)}
                  aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
                />
              </div>
              <div className="task-main">
                <h3 className="task-title">{task.title}</h3>
                {task.description ? <p className="task-desc">{task.description}</p> : null}
                <div className="task-meta">
                  Updated {formatDate(task.updatedAt || task.createdAt)}
                </div>
              </div>
              <div className="task-actions">
                <button type="button" className="btn btn-danger" onClick={() => removeTask(task._id)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
