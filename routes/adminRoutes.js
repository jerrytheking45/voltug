// investment-platform/server/routes/adminRoutes.js

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const adminAuth = require('../middleware/adminMiddleware');
const Transaction = require('../models/Transaction'); 

const DailyTask = require('../models/DailyTask');
const dayjs = require('dayjs');

// -----------------------------
// GET all users
 router.get('/users', adminAuth, async (req, res) => {
//router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password'); // exclude passwords
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  } 
});




// -----------------------------
//  admin reset daily tasks for all users
// -----------------------------

// Optional: import your default task generator if you have one
const DEFAULT_TASKS = [
  { taskName: 'Login today', reward: 500 },
  { taskName: 'Invite a friend', reward: 1000 },
  { taskName: 'Check your wallet', reward: 300 },
  { taskName: 'View investment page', reward: 400 },
  { taskName: 'Read today\'s update', reward: 200 },
  { taskName: 'Complete 3 actions', reward: 600 },
  { taskName: 'Share link on social media', reward: 700 },
  { taskName: 'Check your referral earnings', reward: 250 },
  { taskName: 'View profile', reward: 200 },
  { taskName: 'Visit the dashboard', reward: 300 },
  { taskName: 'Open notifications', reward: 150 },
  { taskName: 'Send feedback', reward: 350 },
  { taskName: 'Follow us on social media', reward: 450 },
  { taskName: 'Invite 2 friends', reward: 800 },
  { taskName: 'Complete all tasks', reward: 1000 },
  { taskName: 'Review your transactions', reward: 300 },
];

// Simple admin token check (replace with Firebase if you like)
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'OLigbPoHOFWLL9fj540eMMw';

// -----------------------------
//  Admin Reset Daily Tasks for All Users (Fixed Version)
// -----------------------------
router.post('/reset-daily-tasks', async (req, res) => {
  try {
    const { secret } = req.body;

    if (secret !== ADMIN_SECRET) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const today = dayjs().format('YYYY-MM-DD');

    // 1️⃣ Delete today's existing tasks
    const result = await DailyTask.deleteMany({ date: today });

    // 2️⃣ Fetch all users
    const users = await User.find({}, '_id email');
    if (!users.length) {
      return res.status(404).json({ message: 'No users found to reset tasks for.' });
    }

    // 3️⃣ Create new tasks for each user
    const allTasks = [];
    users.forEach(user => {
      DEFAULT_TASKS.forEach(task => {
        allTasks.push({
          userId: user._id,
          taskName: task.taskName,
          reward: task.reward,
          completed: false,
          date: today,
        });
      });
    });

    await DailyTask.insertMany(allTasks);

    return res.status(200).json({
      message: `✅ Reset successful for ${users.length} users! Deleted ${result.deletedCount} old tasks and added ${allTasks.length} new tasks.`,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error resetting tasks', error: error.message });
  }
});




// -----------------------------
//  Withdrawal Requests
// -----------------------------

// Get all pending withdrawals
router.get('/withdrawals/pending', adminAuth, async (req, res) => {
  try {
    const pending = await Transaction.find({ type: 'withdrawal', status: 'pending' })
                           .populate('userId', 'username phone walletBalance'); 
    res.json(pending);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch pending withdrawals', error: err.message });
  }
});

// Approve a withdrawal
router.post('/withdrawals/:id/approve', adminAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const tx = await Transaction.findById(id);
    if (!tx) return res.status(404).json({ message: 'Withdrawal request not found' });
    if (tx.status !== 'pending') return res.status(400).json({ message: 'Cannot approve non‑pending request' });

    const user = await User.findById(tx.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.walletBalance < tx.amount) {
      return res.status(400).json({ message: 'User has insufficient balance at approval time' });
    }

    // Deduct amount from user
    user.walletBalance -= tx.amount;
    await user.save();

    // Update transaction
    tx.status = 'approved';
    tx.approvedAt = new Date();
    tx.approvedBy = req.user._id;
    await tx.save();

    res.json({ message: 'Withdrawal approved', transaction: tx, newBalance: user.walletBalance });
  } catch (err) {
    res.status(500).json({ message: 'Approval failed', error: err.message });
  }
});

// Reject a withdrawal
router.post('/withdrawals/:id/reject', adminAuth, async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body; // optional

  try {
    const tx = await Transaction.findById(id);
    if (!tx) return res.status(404).json({ message: 'Withdrawal request not found' });
    if (tx.status !== 'pending') return res.status(400).json({ message: 'Cannot reject non‑pending request' });

    // Update transaction
    tx.status = 'rejected';
    tx.rejectedAt = new Date();
    tx.rejectedBy = req.user._id;
    tx.rejectReason = reason || 'No reason provided';
    await tx.save();

    res.json({ message: 'Withdrawal rejected', transaction: tx });
  } catch (err) {
    res.status(500).json({ message: 'Rejection failed', error: err.message });
  }
});



// -----------------------------
//  Deposit Request
// -----------------------------

// Get all pending deposits
router.get('/deposits/pending', adminAuth, async (req, res) => {
  try {
    const pending = await Transaction.find({ type: 'deposit', status: 'pending' })
      .populate('userId', 'username phone walletBalance');
    res.json(pending);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch pending deposits', error: err.message });
  }
});

// Approve a deposit
router.put('/deposits/:id/approve', adminAuth, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).json({ message: 'Deposit request not found' });
    if (transaction.status !== 'pending')
      return res.status(400).json({ message: 'Transaction already processed' });

    const user = await User.findById(transaction.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // ✅ Credit user's wallet
    user.walletBalance += transaction.amount;
    await user.save();

    // Update transaction
    transaction.status = 'approved';
    transaction.approvedAt = new Date();
    transaction.approvedBy = req.user._id;
    transaction.balanceAfter = user.walletBalance;
    await transaction.save();

    res.json({ message: 'Deposit approved', transaction, balance: user.walletBalance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Approval failed', error: err.message });
  }
});

// Reject a deposit
router.put('/deposits/:id/reject', adminAuth, async (req, res) => {
  try {
    const { reason } = req.body;
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).json({ message: 'Deposit request not found' });
    if (transaction.status !== 'pending')
      return res.status(400).json({ message: 'Transaction already processed' });

    transaction.status = 'rejected';
    transaction.rejectedAt = new Date();
    transaction.rejectedBy = req.user._id;
    transaction.rejectReason = reason || 'No reason provided';
    await transaction.save();

    res.json({ message: 'Deposit rejected', transaction });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Rejection failed', error: err.message });
  }
});





module.exports = router;
