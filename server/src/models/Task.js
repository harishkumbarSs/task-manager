import mongoose from "mongoose";

export const PRIORITIES = ["low", "medium", "high", "urgent"];
export const STATUSES = ["backlog", "in_progress", "review", "done"];

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    completed: { type: Boolean, default: false },
    priority: {
      type: String,
      enum: PRIORITIES,
      default: "medium",
    },
    status: {
      type: String,
      enum: STATUSES,
      default: "backlog",
    },
    dueDate: { type: Date, default: null },
    labels: {
      type: [String],
      default: [],
    },
    parentTask: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null,
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

taskSchema.index({ owner: 1, status: 1 });
taskSchema.index({ owner: 1, dueDate: 1 });
taskSchema.index({ owner: 1, labels: 1 });
taskSchema.index({ owner: 1, parentTask: 1 });

export const Task = mongoose.model("Task", taskSchema);
