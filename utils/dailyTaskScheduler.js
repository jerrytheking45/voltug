const cron = require('node-cron');
const dayjs = require('dayjs');
const DailyTask = require('../models/DailyTask');
const User = require('../models/User');

// ✅ Default 16 tasks (frontend sync)
const DEFAULT_TASKS = [
  { taskName: 'Login today', reward: 500 },
  { taskName: 'Invite a friend', reward: 1000 },
  { taskName: 'Check your wallet', reward: 300 },
  { taskName: 'View today’s announcements', reward: 200 },
  { taskName: 'Visit your referral dashboard', reward: 250 },
  { taskName: 'Read one investment tip', reward: 400 },
  { taskName: 'Check your transaction history', reward: 150 },
  { taskName: 'Review your total earnings', reward: 200 },
  { taskName: 'Update your profile', reward: 300 },
  { taskName: 'Share app link on WhatsApp', reward: 600 },
  { taskName: 'View leaderboard', reward: 200 },
  { taskName: 'Reactivate one inactive referral', reward: 800 },
  { taskName: 'Post about us on social media', reward: 500 },
  { taskName: 'Watch short tutorial video', reward: 450 },
  { taskName: 'Check deposit/withdrawal updates', reward: 250 },
  { taskName: 'Send feedback to admin', reward: 350 },
];

// 🧩 Generate daily tasks for a specific user safely
async function generateDailyTasksForUser(user) {
  const today = dayjs().format('YYYY-MM-DD');
  const taskType = 'default';

  // Prevent duplicates
  await DailyTask.deleteMany({ userId: user._id, date: today, taskType });

  const newTasks = DEFAULT_TASKS.map((t) => ({
    userId: user._id,
    taskName: t.taskName,
    taskType,
    reward: t.reward,
    date: today,
  }));

  await DailyTask.insertMany(newTasks);
  console.log(`✅ Generated ${newTasks.length} tasks for ${user.email || user._id}`);
}

// 🔁 Run every midnight
cron.schedule('0 0 * * *', async () => {
  try {
    const users = await User.find({});
    const today = dayjs().format('YYYY-MM-DD');
    console.log(`🌙 [CRON] Refreshing daily tasks for ${users.length} users — ${today}`);

    for (const user of users) {
      await generateDailyTasksForUser(user);
    }

    console.log('✅ [CRON] Daily tasks refreshed successfully for all users');
  } catch (err) {
    console.error('❌ [CRON] Error refreshing daily tasks:', err);
  }
});

module.exports = { generateDailyTasksForUser };
