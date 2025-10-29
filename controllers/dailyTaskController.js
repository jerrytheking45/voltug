const DailyTask = require('../models/DailyTask');
const TaskCompletion = require('../models/TaskCompletion');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const dayjs = require('dayjs');

// ✅ Task names only — reward will be 0.1% of user balance dynamically
const DEFAULT_TASKS = [
  { taskName: 'Login today' },
  { taskName: 'Invite a friend' },
  { taskName: 'Check your wallet' },
  { taskName: 'View today’s announcements' },
  { taskName: 'Visit your referral dashboard' },
  { taskName: 'Read one investment tip' },
  { taskName: 'Check your transaction history' },
  { taskName: 'Review your total earnings' },
  { taskName: 'Update your profile' },
  { taskName: 'Share app link on WhatsApp' },
  { taskName: 'View leaderboard' },
  { taskName: 'Reactivate one inactive referral' },
  { taskName: 'Post about us on social media' },
  { taskName: 'Watch short tutorial video' },
  { taskName: 'Check deposit/withdrawal updates' },
  { taskName: 'Send feedback to admin' },
];

// 🧍 Fetch daily tasks for logged-in user
// 🧍 Fetch daily tasks for logged-in user
exports.getDailyTasks = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId || req.user._id;
    const today = dayjs().format('YYYY-MM-DD');
    const taskType = 'default';

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // 🛑 Block users with no deposit and only referral balance
    const hasDeposited = await Transaction.exists({
      userId,
      type: 'deposit',
      status: 'approved'
    });

    if (!hasDeposited && user.walletBalance > 0 && user.commissionEarned >= user.walletBalance) {
      return res.status(403).json({
        message:
          'Access denied: You cannot access daily tasks until you make your first deposit.',
      });
    }

    // Fetch tasks
    let tasks = await DailyTask.find({ userId, date: today, taskType });

    if (tasks.length === 0) {
      const newTasks = DEFAULT_TASKS.map((t) => ({
        userId,
        taskName: t.taskName,
        taskType,
        reward: 0,
        date: today,
      }));

      try {
        await DailyTask.insertMany(newTasks, { ordered: false });
      } catch (err) {
        if (err.code !== 11000) throw err;
      }

      tasks = await DailyTask.find({ userId, date: today, taskType });
    }

    res.json({ success: true, count: tasks.length, tasks });
  } catch (err) {
    console.error('❌ Error fetching daily tasks:', err);
    res.status(500).json({ message: 'Failed to fetch daily tasks', error: err.message });
  }
};


// 🏁 Complete a task and reward user (0.1% of balance)
// 🏁 Complete a task and reward user (0.1% of balance)
exports.completeTask = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId || req.user._id;
    const { taskId } = req.params;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // 🚫 Prevent users who have never deposited from completing tasks
    const hasDeposited = await Transaction.exists({
      userId,
      type: 'deposit',
      status: 'approved'
    });

    if (!hasDeposited && user.walletBalance > 0 && user.commissionEarned >= user.walletBalance) {
      return res.status(403).json({
        message:
          'You cannot complete tasks because your balance is from referral commissions only. Please make your initial deposit first.',
      });
    }

    const task = await DailyTask.findOne({ _id: taskId, userId });
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (task.completed) return res.status(400).json({ message: 'Task already completed' });

    // Prevent zero-balance users
    if (!user.walletBalance || user.walletBalance <= 0) {
      return res.status(400).json({
        message:
          'You cannot complete tasks because your wallet balance is zero. Please make an initial deposit first.',
      });
    }

    // 💰 Reward = 0.1% of wallet
    const reward = Math.max(Math.floor(user.walletBalance * 0.001), 1);

    // Mark as completed
    task.completed = true;
    task.completedAt = new Date();
    task.reward = reward;
    await task.save();

    // Update wallet
    user.walletBalance += reward;
    await user.save();

    // Record completion
    await TaskCompletion.create({
      userId,
      taskId: task._id,
      taskName: task.taskName,
      reward,
    });

    // 💸 Referral bonus logic (same as before)
    if (user?.referredBy) {
      const referrer = await User.findOne({ referralCode: user.referredBy });
      if (referrer) {
        const bonus = Math.round(reward * 0.1);
        referrer.walletBalance += bonus;
        referrer.commissionEarned += bonus;
        await referrer.save();

        await TaskCompletion.create({
          userId: referrer._id,
          taskId: task._id,
          taskName: `Referral bonus from ${user.username}`,
          reward: bonus,
        });
      }
    }

    res.json({
      success: true,
      message: `Task completed successfully. You earned ${reward} UGX (0.1% of your balance).`,
      newBalance: user.walletBalance,
      task,
    });
  } catch (err) {
    console.error('❌ Error completing task:', err);
    res.status(500).json({ message: 'Failed to complete task', error: err.message });
  }
};


// 👑 Admin refresh daily tasks for all users
exports.adminGenerateAllDailyTasks = async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json({ message: 'Unauthorized' });

    const today = dayjs().format('YYYY-MM-DD');
    const users = await User.find({});
    const taskType = 'default';

    for (const user of users) {
      await DailyTask.deleteMany({ userId: user._id, date: today, taskType });

      const newTasks = DEFAULT_TASKS.map((t) => ({
        userId: user._id,
        taskName: t.taskName,
        taskType,
        reward: 0,
        date: today,
      }));

      try {
        await DailyTask.insertMany(newTasks, { ordered: false });
      } catch (err) {
        if (err.code !== 11000) throw err;
      }
    }

    res.json({ message: `✅ Daily tasks regenerated for ${users.length} users.` });
  } catch (err) {
    console.error('❌ Admin task refresh error:', err);
    res.status(500).json({ message: 'Failed to regenerate tasks', error: err.message });
  }
};
