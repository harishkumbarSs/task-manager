import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api/client.js";
import AppNav from "../components/AppNav.jsx";

const STATUSES = [
  { value: "backlog", label: "Backlog" },
  { value: "in_progress", label: "In progress" },
  { value: "review", label: "Review" },
  { value: "done", label: "Done" },
];

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

function formatDateTime(iso) {
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

function toInputDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function tasksUrl(filters) {
  const p = new URLSearchParams();
  if (filters.status) p.set("status", filters.status);
  if (filters.priority) p.set("priority", filters.priority);
  if (filters.label) p.set("label", filters.label);
  if (filters.sort) p.set("sort", filters.sort);
  const q = p.toString();
  return `/api/tasks${q ? `?${q}` : ""}`;
}

export default function DashboardPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newStatus, setNewStatus] = useState("backlog");
  const [newDue, setNewDue] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterLabel, setFilterLabel] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [allTags, setAllTags] = useState([]);
  const [newLabels, setNewLabels] = useState("");
  const [tagInputs, setTagInputs] = useState({});
  const [subExpanded, setSubExpanded] = useState({});
  const [subtasksByParent, setSubtasksByParent] = useState({});
  const [subtaskDraft, setSubtaskDraft] = useState({});

  const listFilters = useMemo(
    () => ({ status: filterStatus, priority: filterPriority, label: filterLabel, sort: sortBy }),
    [filterStatus, filterPriority, filterLabel, sortBy]
  );

  const loadTags = useCallback(async () => {
    try {
      const list = await apiFetch("/api/tasks/tags");
      if (Array.isArray(list)) setAllTags(list);
    } catch {
      /* ignore tag index errors */
    }
  }, []);

  const loadSubtasksFor = useCallback(async (parentId) => {
    const pid = String(parentId);
    try {
      const list = await apiFetch(`/api/tasks/${pid}/subtasks`);
      setSubtasksByParent((m) => ({ ...m, [pid]: Array.isArray(list) ? list : [] }));
    } catch {
      setSubtasksByParent((m) => ({ ...m, [pid]: [] }));
    }
  }, []);

  const loadTasks = useCallback(async () => {
    setError("");
    try {
      const data = await apiFetch(tasksUrl(listFilters));
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

  async function handleCreate(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setError("");
    try {
      const body = {
        title: title.trim(),
        description: description.trim(),
        priority: newPriority,
        status: newStatus,
      };
      if (newDue) body.dueDate = newDue;
      if (newLabels.trim()) body.labels = newLabels;
      await apiFetch("/api/tasks", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setTitle("");
      setDescription("");
      setNewPriority("medium");
      setNewStatus("backlog");
      setNewDue("");
      setNewLabels("");
      await loadTasks();
    } catch (err) {
      setError(err.message || "Could not create task");
    }
  }

  async function patchTask(id, patch) {
    setError("");
    try {
      const data = await apiFetch(`/api/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      await loadTasks();
      if (data?.parentTask) {
        await loadSubtasksFor(String(data.parentTask));
      }
      return data;
    } catch (err) {
      setError(err.message || "Update failed");
      throw err;
    }
  }

  function toggleSubtasksParent(task) {
    const pid = String(task._id);
    setSubExpanded((p) => {
      const next = !p[pid];
      if (next) void loadSubtasksFor(pid);
      return { ...p, [pid]: next };
    });
  }

  async function createSubtask(parentId, titleText) {
    if (!titleText.trim()) return;
    setError("");
    try {
      await apiFetch("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: titleText.trim(),
          status: "backlog",
          priority: "medium",
          parentTaskId: String(parentId),
        }),
      });
      setSubtaskDraft((d) => ({ ...d, [String(parentId)]: "" }));
      await loadSubtasksFor(String(parentId));
      await loadTasks();
    } catch (e) {
      setError(e.message || "Could not add subtask");
    }
  }

  async function deleteSubtask(parentId, subId) {
    setError("");
    try {
      await apiFetch(`/api/tasks/${subId}`, { method: "DELETE" });
      await loadSubtasksFor(String(parentId));
      loadTags();
    } catch (e) {
      setError(e.message || "Delete failed");
    }
  }

  function slugClient(raw) {
    return String(raw)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 32);
  }

  function appendLabel(task, raw) {
    const slug = slugClient(raw);
    if (!slug) return;
    const current = Array.isArray(task.labels) ? [...task.labels] : [];
    if (current.includes(slug) || current.length >= 15) return;
    patchTask(task._id, { labels: [...current, slug] });
  }

  function removeLabel(task, label) {
    const next = (Array.isArray(task.labels) ? task.labels : []).filter((l) => l !== label);
    patchTask(task._id, { labels: next });
  }

  async function toggleComplete(task) {
    const nextDone = !task.completed;
    await patchTask(task._id, { completed: nextDone });
  }

  async function removeTask(id) {
    setError("");
    try {
      await apiFetch(`/api/tasks/${id}`, { method: "DELETE" });
      setTasks((prev) => prev.filter((t) => t._id !== id));
      const sid = String(id);
      setSubExpanded((p) => {
        const n = { ...p };
        delete n[sid];
        return n;
      });
      setSubtasksByParent((m) => {
        const n = { ...m };
        delete n[sid];
        return n;
      });
      loadTags();
    } catch (err) {
      setError(err.message || "Delete failed");
    }
  }

  return (
    <div className="app-shell">
      <AppNav />
      <h1 className="page-title">Your tasks</h1>
      <p className="subtitle">
        Root tasks, subtasks (one level), labels, priority, status, and due dates — use filters to narrow the list.
      </p>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="card toolbar">
        <div className="field">
          <label htmlFor="filter-status">Status</label>
          <select
            id="filter-status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-priority">Priority</label>
          <select
            id="filter-priority"
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
          >
            <option value="">All</option>
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-label">Label</label>
          <select
            id="filter-label"
            value={filterLabel}
            onChange={(e) => setFilterLabel(e.target.value)}
          >
            <option value="">All</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="sort-by">Sort</label>
          <select id="sort-by" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="">Newest first</option>
            <option value="dueDate">Due date</option>
            <option value="priority">Priority</option>
          </select>
        </div>
      </div>

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
          <div className="field">
            <label htmlFor="task-desc">Description (optional)</label>
            <textarea
              id="task-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes or details…"
            />
          </div>
          <div className="field">
            <label htmlFor="task-labels">Labels (optional)</label>
            <input
              id="task-labels"
              value={newLabels}
              onChange={(e) => setNewLabels(e.target.value)}
              placeholder="e.g. frontend, sprint-1 (comma-separated)"
            />
          </div>
          <div className="toolbar" style={{ marginBottom: 0 }}>
            <div className="field">
              <label htmlFor="task-priority">Priority</label>
              <select
                id="task-priority"
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value)}
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="task-status">Status</label>
              <select
                id="task-status"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="task-due">Due date (optional)</label>
              <input
                id="task-due"
                type="date"
                value={newDue}
                onChange={(e) => setNewDue(e.target.value)}
              />
            </div>
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
        <div className="card empty-state">No tasks match. Try clearing filters or create one above.</div>
      ) : (
        <div className="task-list">
          {tasks.map((task) => {
            const due = task.dueDate ? new Date(task.dueDate) : null;
            const overdue =
              due &&
              !Number.isNaN(due.getTime()) &&
              due < startOfToday() &&
              task.status !== "done";
            return (
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
                  <div className="task-badges">
                    <span className={`badge badge-priority-${task.priority}`}>{task.priority}</span>
                    <span className={`badge badge-status-${task.status}`}>
                      {STATUSES.find((s) => s.value === task.status)?.label ?? task.status}
                    </span>
                  </div>
                  {task.labels && task.labels.length > 0 ? (
                    <div className="tag-list">
                      {task.labels.map((lab) => (
                        <span key={lab} className="tag-chip">
                          {lab}
                          <button
                            type="button"
                            className="tag-remove"
                            aria-label={`Remove label ${lab}`}
                            onClick={() => removeLabel(task, lab)}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <h3 className="task-title">{task.title}</h3>
                  {task.description ? <p className="task-desc">{task.description}</p> : null}
                  {task.dueDate ? (
                    <div className={`due-pill ${overdue ? "overdue" : ""}`}>
                      Due {formatDateTime(task.dueDate).split(",")[0] || toInputDate(task.dueDate)}
                      {overdue ? " (overdue)" : ""}
                    </div>
                  ) : null}
                  <div className="task-controls">
                    <select
                      aria-label="Status"
                      value={task.status}
                      onChange={(e) => patchTask(task._id, { status: e.target.value })}
                    >
                      {STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Priority"
                      value={task.priority}
                      onChange={(e) => patchTask(task._id, { priority: e.target.value })}
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <input
                      aria-label="Due date"
                      type="date"
                      value={toInputDate(task.dueDate)}
                      onChange={(e) =>
                        patchTask(task._id, { dueDate: e.target.value || null })
                      }
                    />
                    <input
                      aria-label="Add label"
                      placeholder="Add tag, Enter"
                      value={tagInputs[task._id] || ""}
                      onChange={(e) =>
                        setTagInputs((m) => ({ ...m, [task._id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        const v = tagInputs[task._id] || "";
                        appendLabel(task, v);
                        setTagInputs((m) => ({ ...m, [task._id]: "" }));
                      }}
                    />
                  </div>
                  <div className="subtask-section">
                    <button
                      type="button"
                      className="btn btn-ghost subtask-toggle"
                      onClick={() => toggleSubtasksParent(task)}
                    >
                      {subExpanded[String(task._id)] ? "Hide subtasks" : "Show subtasks"}
                      {subtasksByParent[String(task._id)] != null
                        ? ` (${subtasksByParent[String(task._id)].length})`
                        : ""}
                    </button>
                    {subExpanded[String(task._id)] ? (
                      <div className="subtask-block">
                        {(subtasksByParent[String(task._id)] || []).map((st) => (
                          <div key={st._id} className="subtask-row">
                            <input
                              type="checkbox"
                              checked={Boolean(st.completed)}
                              onChange={() => patchTask(st._id, { completed: !st.completed })}
                              aria-label="Subtask done"
                            />
                            <span className={st.completed ? "subtask-title done" : "subtask-title"}>
                              {st.title}
                            </span>
                            <button
                              type="button"
                              className="btn btn-danger btn-tiny"
                              onClick={() => deleteSubtask(task._id, st._id)}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                        <form
                          className="subtask-add"
                          onSubmit={(e) => {
                            e.preventDefault();
                            createSubtask(task._id, subtaskDraft[String(task._id)] || "");
                          }}
                        >
                          <input
                            placeholder="New subtask title"
                            value={subtaskDraft[String(task._id)] || ""}
                            onChange={(e) =>
                              setSubtaskDraft((d) => ({
                                ...d,
                                [String(task._id)]: e.target.value,
                              }))
                            }
                          />
                          <button type="submit" className="btn btn-primary">
                            Add
                          </button>
                        </form>
                      </div>
                    ) : null}
                  </div>
                  <div className="task-meta">
                    Updated {formatDateTime(task.updatedAt || task.createdAt)}
                  </div>
                </div>
                <div className="task-actions">
                  <button type="button" className="btn btn-danger" onClick={() => removeTask(task._id)}>
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
