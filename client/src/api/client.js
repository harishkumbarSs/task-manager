const rawBase = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "";

/** In dev, Vite proxy serves /api — use relative URL. In prod, use full API origin. */
export function apiUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (rawBase) return `${rawBase}${p}`;
  return p;
}

let refreshInFlight = null;

async function trySilentRefresh() {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const rt = localStorage.getItem("refreshToken");
      if (!rt) return false;
      try {
        const res = await fetch(apiUrl("/api/auth/refresh"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: rt }),
        });
        const text = await res.text();
        let data = null;
        if (text) {
          try {
            data = JSON.parse(text);
          } catch {
            return false;
          }
        }
        if (!res.ok || !data?.accessToken || !data?.refreshToken) {
          localStorage.removeItem("token");
          localStorage.removeItem("refreshToken");
          localStorage.removeItem("user");
          return false;
        }
        localStorage.setItem("token", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("auth:tokens", {
              detail: { accessToken: data.accessToken, refreshToken: data.refreshToken },
            })
          );
        }
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

function shouldSkipRefreshRetry(path) {
  return (
    path.startsWith("/api/auth/login") ||
    path.startsWith("/api/auth/register") ||
    path.startsWith("/api/auth/refresh") ||
    path.startsWith("/api/auth/logout")
  );
}

export async function apiFetch(path, options = {}, isRetry = false) {
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

  if (
    res.status === 401 &&
    !isRetry &&
    !shouldSkipRefreshRetry(path) &&
    localStorage.getItem("refreshToken")
  ) {
    const refreshed = await trySilentRefresh();
    if (refreshed) {
      return apiFetch(path, options, true);
    }
  }

  if (!res.ok) {
    let msg = data?.message;
    if (!msg && text) {
      const t = text.trim();
      if (t.startsWith("{")) {
        try {
          const j = JSON.parse(t);
          if (j && typeof j.message === "string") msg = j.message;
        } catch {
          /* ignore */
        }
      }
      if (!msg) {
        msg = t.length > 200 ? `${t.slice(0, 200)}…` : t;
      }
    }
    if (!msg) {
      msg = `${res.status} ${res.statusText || "Request failed"}`;
    }
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
