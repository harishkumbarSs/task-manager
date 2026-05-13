import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login, logout, me, refresh, register } from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimitKeyGenerator, rateLimitValidateRelaxed } from "../util/rateLimitKey.js";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 25,
  standardHeaders: true,
  legacyHeaders: false,
  validate: rateLimitValidateRelaxed,
  keyGenerator: (req) => rateLimitKeyGenerator(req),
  message: { message: "Too many login or signup attempts, try again later." },
});

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", requireAuth, me);

export default router;
