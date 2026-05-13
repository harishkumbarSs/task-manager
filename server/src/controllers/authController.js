import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { RefreshToken } from "../models/RefreshToken.js";
import { User } from "../models/User.js";

function hashRefreshToken(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function randomRefreshToken() {
  return crypto.randomBytes(48).toString("base64url");
}

function signAccessToken(userId) {
  const expiresIn = process.env.JWT_EXPIRES_IN || "15m";
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn });
}

function refreshTtlMs() {
  const days = Number(process.env.REFRESH_TOKEN_DAYS) || 7;
  return days * 24 * 60 * 60 * 1000;
}

async function persistRefreshToken(userId, raw) {
  const tokenHash = hashRefreshToken(raw);
  const expiresAt = new Date(Date.now() + refreshTtlMs());
  await RefreshToken.create({ user: userId, tokenHash, expiresAt });
}

async function buildAuthResponse(user) {
  const accessToken = signAccessToken(user._id.toString());
  const refreshToken = randomRefreshToken();
  await persistRefreshToken(user._id, refreshToken);
  return {
    accessToken,
    refreshToken,
    user: { id: user._id, email: user.email },
  };
}

export async function register(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email: email.toLowerCase(), passwordHash });
    const payload = await buildAuthResponse(user);
    return res.status(201).json(payload);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Registration failed" });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const payload = await buildAuthResponse(user);
    return res.json(payload);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Login failed" });
  }
}

export async function refresh(req, res) {
  try {
    const { refreshToken: raw } = req.body || {};
    if (!raw || typeof raw !== "string") {
      return res.status(400).json({ message: "Refresh token is required" });
    }
    const tokenHash = hashRefreshToken(raw);
    const doc = await RefreshToken.findOne({
      tokenHash,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!doc) {
      return res.status(401).json({ message: "Invalid or expired refresh token" });
    }

    const user = await User.findById(doc.user).select("_id email");
    if (!user) {
      await RefreshToken.deleteOne({ _id: doc._id });
      return res.status(401).json({ message: "User not found" });
    }

    doc.revokedAt = new Date();
    await doc.save();

    const payload = await buildAuthResponse(user);
    return res.json(payload);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Refresh failed" });
  }
}

export async function logout(req, res) {
  try {
    const { refreshToken: raw } = req.body || {};
    if (raw && typeof raw === "string") {
      const tokenHash = hashRefreshToken(raw);
      await RefreshToken.updateOne(
        { tokenHash, revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
    }
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Logout failed" });
  }
}

export function me(req, res) {
  return res.json({ user: { id: req.user._id, email: req.user.email } });
}
