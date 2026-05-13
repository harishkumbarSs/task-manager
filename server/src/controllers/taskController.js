import mongoose from "mongoose";
import { PRIORITIES, STATUSES, Task } from "../models/Task.js";

const MAX_LABELS = 15;
const MAX_LABEL_LEN = 32;

function slugLabel(s) {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, MAX_LABEL_LEN);
}

function normalizeLabels(value) {
  if (value === undefined) return undefined;
  if (value === null) return [];
  const parts = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,;\n]+/)
      : [];
  const out = [];
  const seen = new Set();
  for (const p of parts) {
    const slug = slugLabel(p);
    if (!slug) continue;
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
    if (out.length >= MAX_LABELS) break;
  }
  return out;
}

function normalizeTask(t) {
  const o = t.toObject ? t.toObject() : { ...t };
  const status = o.status || (o.completed ? "done" : "backlog");
  const priority = o.priority || "medium";
  const labels = Array.isArray(o.labels) ? o.labels : [];
  const parentTask = o.parentTask ? String(o.parentTask) : null;
  return { ...o, status, priority, completed: status === "done", labels, parentTask };
}

function parseDueDate(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function isValidEnum(value, allowed) {
  return typeof value === "string" && allowed.includes(value);
}

const PRIORITY_ORDER = { low: 0, medium: 1, high: 2, urgent: 3 };

function rootTaskClause() {
  return {
    $or: [{ parentTask: null }, { parentTask: { $exists: false } }],
  };
}

function buildListFilter(req) {
  const and = [{ owner: req.user._id }, rootTaskClause()];

  const { status, priority, label } = req.query;

  if (priority && isValidEnum(priority, PRIORITIES)) {
    and.push({ priority });
  }

  const labelSlug = typeof label === "string" ? slugLabel(label) : "";
  if (labelSlug) {
    and.push({ labels: labelSlug });
  }

  if (status && isValidEnum(status, STATUSES)) {
    if (status === "backlog") {
      and.push({
        $or: [
          { status: "backlog" },
          { status: { $exists: false }, completed: { $ne: true } },
        ],
      });
    } else if (status === "done") {
      and.push({
        $or: [{ status: "done" }, { completed: true }],
      });
    } else {
      and.push({ status });
    }
  }

  if (and.length === 1) return and[0];
  return { $and: and };
}

export async function listTags(req, res) {
  const rows = await Task.aggregate([
    {
      $match: {
        owner: req.user._id,
        labels: { $exists: true, $type: "array", $ne: [] },
      },
    },
    { $unwind: "$labels" },
    { $group: { _id: "$labels" } },
    { $sort: { _id: 1 } },
  ]);
  return res.json(rows.map((r) => r._id));
}

export async function listSubtasks(req, res) {
  const { parentId } = req.params;
  if (!mongoose.isValidObjectId(parentId)) {
    return res.status(400).json({ message: "Invalid parent task id" });
  }
  const parent = await Task.findOne({
    _id: parentId,
    owner: req.user._id,
    ...rootTaskClause(),
  }).lean();
  if (!parent) {
    return res.status(404).json({ message: "Parent task not found" });
  }
  const raw = await Task.find({ owner: req.user._id, parentTask: parentId })
    .sort({ createdAt: 1 })
    .lean();
  return res.json(raw.map(normalizeTask));
}

export async function listTasks(req, res) {
  const { sort } = req.query;
  const filter = buildListFilter(req);

  if (sort === "priority") {
    const raw = await Task.find(filter).lean();
    const tasks = raw.map(normalizeTask).sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority] ?? 1;
      const pb = PRIORITY_ORDER[b.priority] ?? 1;
      if (pa !== pb) return pb - pa;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    return res.json(tasks);
  }

  const sortSpec = sort === "dueDate" ? { dueDate: 1, createdAt: -1 } : { createdAt: -1 };
  const raw = await Task.find(filter).sort(sortSpec).lean();
  return res.json(raw.map(normalizeTask));
}

export async function createTask(req, res) {
  const { title, description, completed, priority, status, dueDate, labels, parentTaskId } = req.body;
  if (!title || typeof title !== "string") {
    return res.status(400).json({ message: "Title is required" });
  }
  const due = parseDueDate(dueDate);
  if (dueDate !== undefined && dueDate !== null && dueDate !== "" && due === undefined) {
    return res.status(400).json({ message: "Invalid due date" });
  }
  if (priority !== undefined && !isValidEnum(priority, PRIORITIES)) {
    return res.status(400).json({ message: "Invalid priority" });
  }
  if (status !== undefined && !isValidEnum(status, STATUSES)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  let nextStatus = typeof status === "string" && isValidEnum(status, STATUSES) ? status : "backlog";
  if (completed === true) nextStatus = "done";
  if (completed === false && nextStatus === "done") nextStatus = "backlog";

  const labelList = labels !== undefined ? normalizeLabels(labels) : [];

  let parentRef = null;
  if (parentTaskId !== undefined && parentTaskId !== null && parentTaskId !== "") {
    if (!mongoose.isValidObjectId(parentTaskId)) {
      return res.status(400).json({ message: "Invalid parent task id" });
    }
    const parent = await Task.findOne({
      _id: parentTaskId,
      owner: req.user._id,
      ...rootTaskClause(),
    });
    if (!parent) {
      return res.status(400).json({ message: "Parent task not found or is already a subtask" });
    }
    parentRef = parent._id;
  }

  const task = await Task.create({
    title: title.trim(),
    description: typeof description === "string" ? description : "",
    completed: nextStatus === "done",
    priority: isValidEnum(priority, PRIORITIES) ? priority : "medium",
    status: nextStatus,
    dueDate: due === undefined ? null : due,
    labels: labelList,
    parentTask: parentRef,
    owner: req.user._id,
  });
  return res.status(201).json(normalizeTask(task));
}

export async function updateTask(req, res) {
  const { id } = req.params;
  const task = await Task.findOne({ _id: id, owner: req.user._id });
  if (!task) {
    return res.status(404).json({ message: "Task not found" });
  }

  const { title, description, completed, priority, status, dueDate, labels } = req.body;
  if (title !== undefined) task.title = String(title).trim();
  if (description !== undefined) task.description = String(description);
  if (priority !== undefined) {
    if (!isValidEnum(priority, PRIORITIES)) {
      return res.status(400).json({ message: "Invalid priority" });
    }
    task.priority = priority;
  }
  if (dueDate !== undefined) {
    const due = parseDueDate(dueDate);
    if (dueDate !== null && dueDate !== "" && due === undefined) {
      return res.status(400).json({ message: "Invalid due date" });
    }
    task.dueDate = due === undefined ? null : due;
  }
  if (labels !== undefined) {
    task.labels = normalizeLabels(labels);
  }

  if (status !== undefined) {
    if (!isValidEnum(status, STATUSES)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    task.status = status;
    task.completed = status === "done";
  } else if (completed !== undefined) {
    task.completed = Boolean(completed);
    if (task.completed) task.status = "done";
    else if (task.status === "done") task.status = "backlog";
  }

  try {
    await task.save();
  } catch (e) {
    return res.status(400).json({ message: "Could not update task" });
  }
  return res.json(normalizeTask(task));
}

export async function deleteTask(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "Invalid task id" });
  }
  const task = await Task.findOne({ _id: id, owner: req.user._id });
  if (!task) {
    return res.status(404).json({ message: "Task not found" });
  }
  await Task.deleteMany({ owner: req.user._id, parentTask: id });
  await Task.deleteOne({ _id: id, owner: req.user._id });
  return res.status(204).send();
}
