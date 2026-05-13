export function requireRole(...allowed) {
  return (req, res, next) => {
    const role = req.user?.role || "user";
    if (!allowed.includes(role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    return next();
  };
}
