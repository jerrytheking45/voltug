// investment-platform/server/middleware/adminMiddleware.js

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const adminAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No token or malformed header');
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      console.log('❌ Token is empty');
      return res.status(401).json({ message: 'Empty token' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.userId) {
      console.log('❌ Invalid decoded token:', decoded);
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Fetch user from DB
    const user = await User.findById(decoded.userId);
    if (!user) {
      console.log('❌ User not found for ID:', decoded.userId);
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.isAdmin) {
      console.log('❌ User is not an admin:', user.email);
      return res.status(403).json({ message: 'Admin access only' });
    }

    // ✅ All good
    req.user = user;
    console.log('✅ Admin verified:', user.email);
    next();
  } catch (err) {
    console.error('❌ Middleware error:', err.message);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = adminAuth;
