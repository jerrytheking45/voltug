// server/models/DailyTask.js

const mongoose = require('mongoose');

/**
 * DailyTask Schema
 * Represents a user's daily tasks and completion status.
 * Each user can have multiple tasks per day (up to 16 default ones).
 */

const dailyTaskSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    taskName: {
      type: String,
      required: true,
      trim: true,
    },
    taskType: {
      type: String,
      required: true,
      default: 'default',
    },
    reward: {
      type: Number,
      required: true,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
    },
    date: {
      type: String, // YYYY-MM-DD format
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

/**
 * ✅ Index Configuration
 * This ensures each user can have multiple tasks per day,
 * but no duplicate task names for the same day.
 *
 * Example:
 * - Allowed: "Login today", "Invite a friend" on same day for same user.
 * - Not allowed: Two "Login today" tasks for same user/date.
 */
dailyTaskSchema.index({ userId: 1, date: 1, taskName: 1 }, { unique: true });

module.exports = mongoose.model('DailyTask', dailyTaskSchema);
