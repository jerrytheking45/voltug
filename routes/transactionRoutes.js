// server/routes/transactionRoutes.js
const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const auth = require('../middleware/authMiddleware');
const adminAuth = require('../middleware/adminMiddleware'); // admin auth

// -----------------------------
// Submit Withdrawal Request
// -----------------------------
// -----------------------------
// Submit Withdrawal Request (Modified)
// -----------------------------
router.post('/withdraw-request', auth, async (req, res) => {
  const { amount } = req.body;

  if (!amount || amount <= 0)
    return res.status(400).json({ message: 'Invalid amount' });

  // ✅ Minimum withdrawal check
  if (amount < 50000) {
    return res
      .status(400)
      .json({ message: 'Minimum withdrawal amount is UGX 50,000' });
  }

  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // 🚫 Check if user has at least one approved deposit before withdrawal
    const hasSuccessfulDeposit = await Transaction.exists({
      userId: user._id,
      type: 'deposit',
      status: 'approved',
    });

    if (!hasSuccessfulDeposit) {
      return res.status(400).json({
        message:
          'You cannot withdraw funds until you have made at least one successful deposit.',
      });
    }

    // ✅ Check sufficient balance
    if (user.walletBalance < amount) {
      return res
        .status(400)
        .json({ message: 'Insufficient balance for withdrawal request' });
    }

    // Create withdrawal transaction
    const transaction = new Transaction({
      userId: user._id,
      type: 'withdrawal',
      amount,
      status: 'pending',
      balanceAfter: user.walletBalance,
    });

    await transaction.save();

    res.status(200).json({
      message: 'Withdrawal request submitted and pending approval',
      transaction,
    });
  } catch (err) {
    console.error('❌ Withdrawal request failed:', err);
    res
      .status(500)
      .json({ message: 'Withdrawal request failed', error: err.message });
  }
});



// -----------------------------
// Admin Approves Withdrawal
// -----------------------------
router.put('/withdraw-approve/:id', adminAuth, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

    if (transaction.status !== 'pending')
      return res.status(400).json({ message: 'Transaction already processed' });

    // Approve transaction and deduct balance
    transaction.status = 'approved';
    transaction.approvedAt = new Date();
    transaction.approvedBy = req.user._id;
    await transaction.save();

    const user = await User.findById(transaction.userId);
    user.walletBalance -= transaction.amount; // deduct now
    await user.save();

    res.json({ message: 'Withdrawal approved', transaction, balance: user.walletBalance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Approval failed', error: err.message });
  }
});

// -----------------------------
// Admin Rejects Withdrawal
// -----------------------------
router.put('/withdraw-reject/:id', adminAuth, async (req, res) => {
  try {
    const { reason } = req.body;
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

    if (transaction.status !== 'pending')
      return res.status(400).json({ message: 'Transaction already processed' });

    transaction.status = 'rejected';
    transaction.rejectedAt = new Date();
    transaction.rejectedBy = req.user._id;
    transaction.rejectReason = reason || 'No reason provided';
    await transaction.save();

    res.json({ message: 'Withdrawal rejected', transaction });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Rejection failed', error: err.message });
  }
});


router.get('/', auth, async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: 'Failed to load transactions', error: err.message });
  }
});



// -----------------------------
// Submit Deposit Request
// -----------------------------
router.post('/deposit', auth, async (req, res) => {
  const { amount } = req.body;

  if (!amount || amount <= 0) return res.status(400).json({ message: 'Invalid deposit amount' });

  // ✅ Minimum deposit check
  if (amount < 10000) {
    return res.status(400).json({ message: 'Minimum deposit amount is UGX 10,000' });
  }

  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const transaction = new Transaction({
      transactionId: `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId: user._id,
      type: 'deposit',
      amount,
      status: 'pending',
      balanceAfter: user.walletBalance,
    });

    await transaction.save();

    res.status(200).json({
      message: 'Deposit request submitted and pending admin approval',
      transaction,
    });
  } catch (err) {
    console.error('Deposit request failed:', err);
    res.status(500).json({ message: 'Deposit request failed', error: err.message });
  }
});




// -----------------------------
// Complete Daily Task
// -----------------------------
router.post('/task', auth, async (req, res) => {
  const { taskId, reward, taskName } = req.body;

  if (!reward || reward <= 0) return res.status(400).json({ message: 'Invalid reward' });

  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Update user wallet balance
    user.walletBalance += reward;
    await user.save();

    // Log transaction
    const transaction = new Transaction({
      userId: user._id,
      type: 'task',
      amount: reward,
      balanceAfter: user.walletBalance,
    });
    await transaction.save();

    // ✅ Handle referral/team commission automatically
    if (user.referredBy) {
      const referrer = await User.findOne({ referralCode: user.referredBy });
      if (referrer) {
        const referralBonus = reward * 0.1; // 10% commission
        referrer.walletBalance += referralBonus;
        referrer.commissionEarned += referralBonus;
        await referrer.save();

        // Log commission transaction
        const commissionTx = new Transaction({
          userId: referrer._id,
          type: 'commission',
          amount: referralBonus,
          balanceAfter: referrer.walletBalance,
        });
        await commissionTx.save();
      }
    }

    res.json({
      message: 'Task completed successfully',
      reward,
      balance: user.walletBalance,
      transaction,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Task completion failed', error: err.message });
  }
});

// -----------------------------
// Manual Referral Commission (optional)
// -----------------------------
router.post('/commission', auth, async (req, res) => {
  const { amount, reason } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ message: 'Invalid commission amount' });

  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Update wallet balance
    user.walletBalance += amount;
    user.commissionEarned += amount;
    await user.save();

    // Log transaction
    const transaction = new Transaction({
      userId: user._id,
      type: 'commission',
      amount,
      balanceAfter: user.walletBalance,
    });
    await transaction.save();

    res.json({
      message: `Commission credited${reason ? ' for ' + reason : ''}`,
      amount,
      balance: user.walletBalance,
      transaction,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Commission credit failed', error: err.message });
  }
});



module.exports = router;
