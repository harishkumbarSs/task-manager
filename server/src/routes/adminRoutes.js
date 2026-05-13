import { Router } from "express";
import { getSummary } from "../controllers/adminController.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.get("/summary", getSummary);

export default router;
