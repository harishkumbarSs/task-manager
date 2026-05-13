import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api/client.js";
import AppNav from "../components/AppNav.jsx";

const COLUMNS = [
  { value: "backlog", label: "Backlog" },
  { value: "in_progress", label: "In progress" },
  { value: "review", label: "Review" },
  { value: "done", label: "Done" },
];

const PRIORITIES = [
  { value: "", label: "Any priority" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

function kanbanTasksUrl(filters) {
  const p = new URLSearchParams();
  if (filters.priority) p.set("priority", filters.priority);
  if (filters.label) p.set("label", filters.label);
  const q = p.toString();
  return `/api/tasks${q ? `?${q}` : ""}`;
}

function priorityClass(p) {
  const v = p || "medium";
  return `badge badge-priority-${v}`;
}

function formatDue(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: "short" });
  } catch {
    return "";
  }
}

export default function KanbanPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterLabel, setFilterLabel] = useState("");
  const [allTags, setAllTags] = useState([]);
  const [draggingId, setDraggingId] = useState(null);

  const listFilters = useMemo(
    () => ({ priority: filterPriority, label: filterLabel }),
    [filterPriority, filterLabel]
  );

  const loadTags = useCallback(async () => {
    try {
      const list = await apiFetch("/api/tasks/tags");
      if (Array.isArray(list)) setAllTags(list);
    } catch {
      /* ignore */
    }
  }, []);

  const loadTasks = useCallback(async () => {
    setError("");
    try {
      const data = await apiFetch(kanbanTasksUrl(listFilters));
      setTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load tasks");
    } finally {
      setLoading(false);
    }
    loadTags();
  }, [listFilters, loadTags]);

  useEffect(() => {
    setLoading(true);
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    const handler = () => {
      void loadTasks();
    };
    window.addEventListener("tasks:invalidate", handler);
    return () => window.removeEventListener("tasks:invalidate", handler);
  }, [loadTasks]);

  const byStatus = useMemo(() => {
    const map = Object.fromEntries(COLUMNS.map((c) => [c.value, []]));
    for (const t of tasks) {
      const s = t.status && map[t.status] != null ? t.status : "backlog";
      map[s].push(t);
    }
    return map;
  }, [tasks]);

  async function moveTaskToStatus(taskId, newStatus) {
    const id = String(taskId);
    const prev = tasks;
    setTasks((list) =>
      list.map((t) =>
        String(t._id) === id
          ? { ...t, status: newStatus, completed: newStatus === "done" }
          : t
      )
    );
    setError("");
    try {
      await apiFetch(`/api/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (err) {
      setTasks(prev);
      setError(err.message || "Could not move task");
    }
  }

  function onDragStart(e, task) {
    setDraggingId(String(task._id));
    e.dataTransfer.setData("text/task-id", String(task._id));
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragEnd() {
    setDraggingId(null);
  }

  function onColumnDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function onColumnDrop(e, columnStatus) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/task-id");
    if (!id) return;
    const task = tasks.find((t) => String(t._id) === id);
    if (!task || task.status === columnStatus) return;
    void moveTaskToStatus(id, columnStatus);
  }

  return (
    <div className="app-shell kanban-shell">
      <AppNav />
      <div className="kanban-header">
        <h1 className="page-title">Board</h1>
        <p className="subtitle kanban-subtitle">
          Drag cards between columns to change status. Root tasks only — use <strong>Tasks</strong> in the nav for
          the full list, subtasks, and comments.
        </p>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="card toolbar kanban-toolbar">
        <div className="field">
          <label htmlFor="kb-priority">Priority</label>
          <select
            id="kb-priority"
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
          >
            {PRIORITIES.map((o) => (
              <option key={o.value || "any"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="kb-label">Label</label>
          <select
            id="kb-label"
            value={filterLabel}
            onChange={(e) => setFilterLabel(e.target.value)}
          >
            <option value="">Any label</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="subtitle">Loading board…</p>
      ) : (
        <div className="kanban-board">
          {COLUMNS.map((col) => (
            <section
              key={col.value}
              className="kanban-column"
              onDragOver={onColumnDragOver}
              onDrop={(e) => onColumnDrop(e, col.value)}
            >
              <header className="kanban-column-head">
                <h2>{col.label}</h2>
                <span className="kanban-count">{byStatus[col.value].length}</span>
              </header>
              <div className="kanban-column-body">
                {byStatus[col.value].map((task) => (
                  <article
                    key={task._id}
                    className={`kanban-card${draggingId === String(task._id) ? " kanban-card--dragging" : ""}`}
                  >
                    <div className="kanban-card-inner">
                      <div
                        className="kanban-grip"
                        draggable
                        onDragStart={(e) => onDragStart(e, task)}
                        onDragEnd={onDragEnd}
                        title="Drag to another column"
                        aria-label={`Drag task ${task.title} to another column`}
                      >
                        <span aria-hidden="true">⠿</span>
                      </div>
                      <div className="kanban-card-body">
                        <div className="kanban-card-top">
                          <p className="kanban-card-title">{task.title}</p>
                          <label className="kanban-card-sr-label">
                            <span className="sr-only">Status</span>
                            <select
                              className="kanban-card-status"
                              value={task.status || "backlog"}
                              onChange={(e) => moveTaskToStatus(task._id, e.target.value)}
                            >
                              {COLUMNS.map((c) => (
                                <option key={c.value} value={c.value}>
                                  {c.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <div className="kanban-card-meta">
                          <span className={priorityClass(task.priority)}>{task.priority || "medium"}</span>
                          {task.dueDate ? (
                            <span className="kanban-due">Due {formatDue(task.dueDate)}</span>
                          ) : null}
                        </div>
                        {Array.isArray(task.labels) && task.labels.length ? (
                          <div className="kanban-tags">
                            {task.labels.slice(0, 4).map((tag) => (
                              <span key={tag} className="tag-chip">
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
