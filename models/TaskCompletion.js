// server/models/TaskCompletion.js

const mongoose = require('mongoose');

const taskCompletionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'DailyTask', required: true },
  taskName: { type: String, required: true },
  reward: { type: Number, required: true },
  completedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('TaskCompletion', taskCompletionSchema);
