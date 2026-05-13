import { Task } from "../models/Task.js";
import { User } from "../models/User.js";

export async function getSummary(_req, res) {
  const [users, tasks] = await Promise.all([User.countDocuments(), Task.countDocuments()]);
  return res.json({ users, tasks });
}
