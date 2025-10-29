// investment-platform/server/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { registerUser, loginUser, adminlogin } = require('../controllers/authController');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Register User
router.post('/register', async (req, res) => {
  const { phone, username, password, referredBy } = req.body;

  try {
    const existingUser = await User.findOne({ $or: [{ phone }, { username }] });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const referralCode = Math.random().toString(36).substr(2, 6).toUpperCase();
   

    const newUser = new User({
      phone,
      username,
      password,
      referralCode,
      referredBy: referredBy || null
    });

    await newUser.save();

    const token = jwt.sign(
      { userId: newUser._id },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(201).json({
      token,
      user: {
        id: newUser._id,
        phone: newUser.phone,
        username: newUser.username,
        referralCode: newUser.referralCode,
        referredBy: newUser.referredBy
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/login', loginUser);

// Register Admin
router.post('/register-admin', async (req, res) => {
  const { phone, username, password } = req.body;

  try {
    const existingUser = await User.findOne({ $or: [{ phone }, { username }] });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    
    const newUser = new User({
      phone,
      username,
      password,
      referralCode: Math.random().toString(36).substr(2, 6).toUpperCase(),
      isAdmin: true
    });

    await newUser.save();

    const token = jwt.sign(
      { userId: newUser._id },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(201).json({
      token,
      user: {
        id: newUser._id,
        phone: newUser.phone,
        username: newUser.username,
        referralCode: newUser.referralCode,
        isAdmin: newUser.isAdmin
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/signin', adminlogin);


//.........forgot and reset password routes...........//

// 1️⃣ Forgot password
router.post('/forgot-password', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone number is required' });

  try {
    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Generate token
    const token = crypto.randomBytes(3).toString('hex'); // 6-character token
    const expiry = Date.now() + 15 * 60 * 1000; // 15 minutes

    user.resetToken = token;
    user.resetTokenExpiry = expiry;
    await user.save();

    // TODO: send token via SMS (for now, just log it)
    console.log(`Password reset token for ${phone}: ${token}`);

    res.json({ message: 'Reset token sent via SMS (check server logs in dev)' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 2️⃣ Reset password
router.post('/reset-password', async (req, res) => {
  const { phone, token, newPassword } = req.body;
  if (!phone || !token || !newPassword)
    return res.status(400).json({ error: 'Phone, token, and new password are required' });

  try {
    const user = await User.findOne({
      phone,
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() },
    });

    if (!user) return res.status(400).json({ error: 'Invalid or expired token' });

    user.password = newPassword; // pre-save hook hashes it
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 3️⃣ View all active or expired tokens (for admin/debug)
router.get('/tokens', async (req, res) => {
  try {
    // Fetch all users who have a resetToken (meaning they requested password reset)
    const usersWithTokens = await User.find(
      { resetToken: { $exists: true, $ne: null } },
      { username: 1, phone: 1, resetToken: 1, resetTokenExpiry: 1, createdAt: 1 }
    ).sort({ resetTokenExpiry: -1 });

    // Map users into token-like objects for frontend display
    const tokens = usersWithTokens.map((u) => ({
      _id: u._id,
      email: u.phone || u.username,
      token: u.resetToken,
      expiresAt: u.resetTokenExpiry,
    }));

    res.status(200).json(tokens);
  } catch (error) {
    console.error('Error fetching tokens:', error);
    res.status(500).json({ message: 'Failed to fetch tokens' });
  }
});

// 4️⃣ Delete a specific reset token
router.delete('/token/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.json({ message: 'Reset token deleted successfully' });
  } catch (error) {
    console.error('Error deleting token:', error);
    res.status(500).json({ message: 'Failed to delete token' });
  }
});


module.exports = router;
