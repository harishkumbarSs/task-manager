const rawBase = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "";

/** In dev, Vite proxy serves /api — use relative URL. In prod, use full API origin. */
export function apiUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (rawBase) return `${rawBase}${p}`;
  return p;
}

export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = localStorage.getItem("token");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(apiUrl(path), { ...options, headers });
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }
  if (!res.ok) {
    const err = new Error(data?.message || res.statusText || "Request failed");
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
