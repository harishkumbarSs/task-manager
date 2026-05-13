import jwt from "jsonwebtoken";
import { Server } from "socket.io";

let io;

/**
 * @param {import("http").Server} httpServer
 * @param {string[]} allowedOrigins
 */
export function attachSocket(httpServer, allowedOrigins) {
  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins.length ? allowedOrigins : true,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token || typeof token !== "string") {
        return next(new Error("missing_token"));
      }
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = String(payload.sub);
      return next();
    } catch {
      return next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.userId}`);
  });

  return io;
}

export function notifyUserTasksChanged(userId) {
  if (!io || !userId) return;
  io.to(`user:${userId}`).emit("tasks:invalidate", { at: Date.now() });
}

/** After comment create/delete — clients refetch only that thread. */
export function notifyUserCommentsChanged(userId, taskId) {
  if (!io || !userId || !taskId) return;
  const tid = String(taskId);
  io.to(`user:${userId}`).emit("comments:invalidate", { taskId: tid, at: Date.now() });
}
