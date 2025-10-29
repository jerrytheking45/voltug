// controllers/earningsController.js
const TaskCompletion = require('../models/TaskCompletion');
const User = require('../models/User');

// GET USER EARNINGS
exports.getUserEarnings = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get all task completions by this user
    const taskCompletions = await TaskCompletion.find({ userId }).sort({ completedAt: -1 });

    const totalFromTasks = taskCompletions
      .filter((t) => !t.taskName.includes('Referral bonus'))
      .reduce((sum, t) => sum + t.reward, 0);

    const totalFromReferrals = taskCompletions
      .filter((t) => t.taskName.includes('Referral bonus'))
      .reduce((sum, t) => sum + t.reward, 0);

    const totalEarnings = totalFromTasks + totalFromReferrals;

    res.status(200).json({
      totalFromTasks,
      totalFromReferrals,
      totalEarnings,
      history: taskCompletions.map((t) => ({
        taskName: t.taskName,
        reward: t.reward,
        completedAt: t.completedAt,
      })),
    });
  } catch (err) {
    console.error('Error fetching earnings:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
