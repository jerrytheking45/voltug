// investment-platform/server/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/authMiddleware');

// ✅ Transaction model (create this file below)
const Transaction = require('../models/Transaction');

// Get my team (users I referred)
router.get('/my-team', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.userId);
    if (!currentUser) return res.status(404).json({ message: 'User not found' });

    const team = await User.find({ referredBy: currentUser.referralCode }).select('-password');

    res.json({ count: team.length, team });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});


// ✅ GET /api/users/:id/balance
router.get('/:id/balance', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ balance: user.walletBalance });
  } catch (err) {
    console.error('Error fetching balance:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});


// ✅ POST /api/users/:id/update-balance
router.post('/:id/update-balance', auth, async (req, res) => {
  const { amount, type } = req.body;
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const numericAmount = Number(amount);
    if (isNaN(numericAmount)) {
      return res.status(400).json({ message: 'Invalid amount value' });
    }

    // Update wallet balance
    user.walletBalance += numericAmount;

    // If type is commission or task, also add to commissionEarned
    if (type === 'commission' || type === 'task') {
      user.commissionEarned += numericAmount;
    }

    await user.save();

    // Log transaction
    await Transaction.create({
      userId: user._id,
      amount: numericAmount,
      type,
      balanceAfter: user.walletBalance,
    });

    res.json({
      success: true,
      newBalance: user.walletBalance,
      message: `Balance updated successfully (${type})`,
    });
  } catch (err) {
    console.error('Error updating balance:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
