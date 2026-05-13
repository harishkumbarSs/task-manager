import { Router } from "express";
import {
  createTask,
  deleteTask,
  listSubtasks,
  listTags,
  listTasks,
  updateTask,
} from "../controllers/taskController.js";
import { createComment, deleteComment, listComments } from "../controllers/commentController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

router.get("/tags", listTags);
router.get("/:id/subtasks", listSubtasks);
router.get("/:id/comments", listComments);
router.post("/:id/comments", createComment);
router.delete("/:id/comments/:commentId", deleteComment);
router.get("/", listTasks);
router.post("/", createTask);
router.patch("/:id", updateTask);
router.delete("/:id", deleteTask);

export default router;
