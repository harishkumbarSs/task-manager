import { io } from "socket.io-client";

let socket;

/**
 * Connects to the API host (Vite dev: same origin + `/socket.io` proxy).
 * In production set `VITE_API_URL` to your API origin (e.g. Render URL).
 */
export function connectTaskSocket(accessToken) {
  disconnectTaskSocket();
  if (!accessToken) return;

  const base = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "";

  socket = io(base || undefined, {
    path: "/socket.io",
    auth: { token: accessToken },
    transports: ["websocket", "polling"],
    autoConnect: true,
  });

  socket.on("tasks:invalidate", () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("tasks:invalidate"));
    }
  });
}

export function disconnectTaskSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = undefined;
  }
}
