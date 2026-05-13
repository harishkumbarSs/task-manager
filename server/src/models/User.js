import mongoose from "mongoose";

const ROLES = ["user", "admin"];

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ROLES,
      default: "user",
      index: true,
    },
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
export { ROLES };
