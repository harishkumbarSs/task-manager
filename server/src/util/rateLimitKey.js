/**
 * Client key for rate limiting behind reverse proxies (e.g. Render).
 * Avoids relying on `req.ip` alone, which can be missing in some edge cases.
 */
export function rateLimitKeyGenerator(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.trim()) {
    const first = xf.split(",")[0].trim();
    if (first) return first;
  }
  const direct = req.ip || req.socket?.remoteAddress;
  if (direct) return String(direct);
  return "unknown";
}

/** Relax express-rate-limit validations that throw behind common proxy setups. */
export const rateLimitValidateRelaxed = {
  ip: false,
  xForwardedForHeader: false,
  trustProxy: false,
};
