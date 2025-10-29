// routes/dailyTaskRoutes.js
const express = require('express');
const router = express.Router();
const dailyTaskController = require('../controllers/dailyTaskController');
const authMiddleware = require('../middleware/authMiddleware'); // must decode JWT

router.get('/', authMiddleware, dailyTaskController.getDailyTasks);
router.post('/:taskId/complete', authMiddleware, dailyTaskController.completeTask);

// Admin-only manual refresh
router.post('/admin/refresh', authMiddleware, dailyTaskController.adminGenerateAllDailyTasks); 

module.exports = router;
