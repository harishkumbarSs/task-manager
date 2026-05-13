import { PRIORITIES, STATUSES, Task } from "../models/Task.js";

function normalizeTask(t) {
  const o = t.toObject ? t.toObject() : { ...t };
  const status = o.status || (o.completed ? "done" : "backlog");
  const priority = o.priority || "medium";
  return { ...o, status, priority, completed: status === "done" };
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

export async function listTasks(req, res) {
  const { status, priority, sort } = req.query;
  const filter = { owner: req.user._id };
  if (priority && isValidEnum(priority, PRIORITIES)) filter.priority = priority;

  if (status && isValidEnum(status, STATUSES)) {
    if (status === "backlog") {
      filter.$or = [
        { status: "backlog" },
        { status: { $exists: false }, completed: { $ne: true } },
      ];
    } else if (status === "done") {
      filter.$or = [{ status: "done" }, { completed: true }];
    } else {
      filter.status = status;
    }
  }

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
  const { title, description, completed, priority, status, dueDate } = req.body;
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

  const task = await Task.create({
    title: title.trim(),
    description: typeof description === "string" ? description : "",
    completed: nextStatus === "done",
    priority: isValidEnum(priority, PRIORITIES) ? priority : "medium",
    status: nextStatus,
    dueDate: due === undefined ? null : due,
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

  const { title, description, completed, priority, status, dueDate } = req.body;
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
  const result = await Task.deleteOne({ _id: id, owner: req.user._id });
  if (result.deletedCount === 0) {
    return res.status(404).json({ message: "Task not found" });
  }
  return res.status(204).send();
}
