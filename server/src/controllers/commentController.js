import mongoose from "mongoose";
import { Comment } from "../models/Comment.js";
import { Task } from "../models/Task.js";
import { notifyUserTasksChanged } from "../socketHub.js";

async function assertTaskOwned(taskId, userId) {
  if (!mongoose.isValidObjectId(taskId)) return null;
  return Task.findOne({ _id: taskId, owner: userId }).select("_id").lean();
}

export async function listComments(req, res) {
  const { id: taskId } = req.params;
  const task = await assertTaskOwned(taskId, req.user._id);
  if (!task) {
    return res.status(404).json({ message: "Task not found" });
  }
  const rows = await Comment.find({ task: taskId })
    .sort({ createdAt: 1 })
    .populate("user", "email")
    .lean();
  const list = rows.map((c) => ({
    id: c._id,
    body: c.body,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    user: { id: c.user?._id, email: c.user?.email },
  }));
  return res.json(list);
}

export async function createComment(req, res) {
  const { id: taskId } = req.params;
  const task = await assertTaskOwned(taskId, req.user._id);
  if (!task) {
    return res.status(404).json({ message: "Task not found" });
  }
  const { body } = req.body || {};
  if (!body || typeof body !== "string" || !body.trim()) {
    return res.status(400).json({ message: "Comment body is required" });
  }
  const text = body.trim();
  if (text.length > 2000) {
    return res.status(400).json({ message: "Comment is too long" });
  }
  const doc = await Comment.create({
    task: taskId,
    user: req.user._id,
    body: text,
  });
  await doc.populate("user", "email");
  notifyUserTasksChanged(req.user._id.toString());
  return res.status(201).json({
    id: doc._id,
    body: doc.body,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    user: { id: doc.user._id, email: doc.user.email },
  });
}

export async function deleteComment(req, res) {
  const { id: taskId, commentId } = req.params;
  const task = await assertTaskOwned(taskId, req.user._id);
  if (!task) {
    return res.status(404).json({ message: "Task not found" });
  }
  if (!mongoose.isValidObjectId(commentId)) {
    return res.status(400).json({ message: "Invalid comment id" });
  }
  const comment = await Comment.findOne({ _id: commentId, task: taskId });
  if (!comment) {
    return res.status(404).json({ message: "Comment not found" });
  }
  const isAdmin = req.user.role === "admin";
  const ownerId = comment.user?.toString?.() || String(comment.user);
  if (ownerId !== req.user._id.toString() && !isAdmin) {
    return res.status(403).json({ message: "You can only delete your own comments" });
  }
  await Comment.deleteOne({ _id: commentId, task: taskId });
  notifyUserTasksChanged(req.user._id.toString());
  return res.status(204).send();
}
