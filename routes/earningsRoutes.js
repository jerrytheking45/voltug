// investment-platform/server/routes/earningsRoutes.js

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { getUserEarnings } = require('../controllers/earningsController');

router.get('/', auth, getUserEarnings);
module.exports = router;
