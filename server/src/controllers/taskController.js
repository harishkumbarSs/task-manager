import { Task } from "../models/Task.js";

export async function listTasks(req, res) {
  const tasks = await Task.find({ owner: req.user._id }).sort({ createdAt: -1 });
  return res.json(tasks);
}

export async function createTask(req, res) {
  const { title, description, completed } = req.body;
  if (!title || typeof title !== "string") {
    return res.status(400).json({ message: "Title is required" });
  }
  const task = await Task.create({
    title: title.trim(),
    description: typeof description === "string" ? description : "",
    completed: Boolean(completed),
    owner: req.user._id,
  });
  return res.status(201).json(task);
}

export async function updateTask(req, res) {
  const { id } = req.params;
  const task = await Task.findOne({ _id: id, owner: req.user._id });
  if (!task) {
    return res.status(404).json({ message: "Task not found" });
  }

  const { title, description, completed } = req.body;
  if (title !== undefined) task.title = String(title).trim();
  if (description !== undefined) task.description = String(description);
  if (completed !== undefined) task.completed = Boolean(completed);

  await task.save();
  return res.json(task);
}

export async function deleteTask(req, res) {
  const { id } = req.params;
  const result = await Task.deleteOne({ _id: id, owner: req.user._id });
  if (result.deletedCount === 0) {
    return res.status(404).json({ message: "Task not found" });
  }
  return res.status(204).send();
}
