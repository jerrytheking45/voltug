// investment-platform/server/controllers/authController.js
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const generateReferralCode = () => {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
};

// REGISTER
exports.registerUser = async (req, res) => {
  const { phone, username, password, referredBy } = req.body;

  try {
    const existingUser = await User.findOne({ $or: [{ phone }, { username }] });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

   
    const referralCode = generateReferralCode();

    const newUser = new User({
      phone,
      username,
      password,
      referralCode,
      referredBy: referredBy || null,
    });

    await newUser.save();

    res.status(201).json({ message: 'User registered successfully' });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// LOGIN
exports.loginUser = async (req, res) => {
  const { usernameOrPhone, password } = req.body;

  try {
    const user = await User.findOne({
      $or: [{ username: usernameOrPhone }, { phone: usernameOrPhone }],
    });

    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { userId: user._id, phone: user.phone, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      token,
      user: {
        id: user._id,
        phone: user.phone,
        username: user.username,
        referralCode: user.referralCode,
      },
    });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ADMIN LOGIN
exports.adminlogin = async (req, res) => {
  const { usernameOrPhone, password } = req.body;

  try {
    const user = await User.findOne({
      $or: [{ username: usernameOrPhone }, { phone: usernameOrPhone }],
    });

    if (!user || !user.isAdmin)
      return res.status(403).json({ message: 'Access denied' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { userId: user._id, isAdmin: user.isAdmin },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        phone: user.phone,
        username: user.username,
        referralCode: user.referralCode,
        isAdmin: user.isAdmin,
        walletBalance: user.walletBalance,
        commissionEarned: user.commissionEarned
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
