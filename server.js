// server/server.js

// ===============================
// 📦 Imports
// ===============================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

// ===============================
// ⚙️ App Initialization
// ===============================
const app = express();

// ===============================
// 🌍 Allowed Origins Configuration
// ===============================
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:3000'];

console.log('✅ Allowed Origins:', allowedOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without an origin (like Postman)
      if (!origin) return callback(null, true);

      // Allow subdomains and HTTPS variations
      const isAllowed = allowedOrigins.some((allowed) =>
        origin.includes(allowed.replace(/^https?:\/\//, ''))
      );

      if (isAllowed) return callback(null, true);
      console.warn(`🚫 CORS blocked origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    optionsSuccessStatus: 200,
  })
);

// ===============================
// 🛡️ Security & Optimization Middleware
// ===============================
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '10kb' }));

// ===============================
// 🧭 Rate Limiting
// ===============================
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 1000, // limit each IP to 1000 requests per 15 minutes
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

// ===============================
// 💾 Temporary In-memory Stores
// ===============================
app.locals.wallets = {};
app.locals.transactions = [];

// ===============================
// 🌐 HTTP + Socket.IO Server
// ===============================
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
});

app.set('io', io);

// ===============================
// 💬 Socket.IO Logic
// ===============================
io.on('connection', (socket) => {
  const { userId, isAdmin } = socket.handshake.query;
  console.log('⚡ New socket connected:', socket.id);

  if (isAdmin === 'true') {
    socket.join('admins');
    console.log(`✅ Admin connected: ${socket.id}`);
  } else if (userId) {
    socket.join(userId);
    console.log(`✅ User connected: ${userId}`);
  }

  socket.on('joinUserRoom', ({ userId }) => {
    if (userId) {
      socket.join(userId);
      console.log(`👤 User joined room: ${userId}`);
    }
  });

  socket.on('newUserMessage', (msg) => {
    console.log('📨 New user message:', msg);
    io.to('admins').emit('newUserMessage', msg);
  });

  socket.on('adminReply', (msg) => {
    console.log('💬 Admin reply:', msg);
    if (msg?.userId) io.to(msg.userId).emit('adminReply', msg);
  });

  socket.on('reconnect_attempt', () => {
    console.log(`🔄 Socket ${socket.id} attempting to reconnect...`);
  });

  socket.on('disconnect', (reason) => {
    console.log(`❌ Socket disconnected (${socket.id}) due to: ${reason}`);
  });
});

// ===============================
// 🧩 Route Imports
// ===============================
const adminRoutes = require('./routes/adminRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const dailyTaskRoutes = require('./routes/dailyTaskRoutes');
const earningsRoutes = require('./routes/earningsRoutes');
const supportRoutes = require('./routes/supportRoutes');

// ===============================
// 🚏 Mount Routes
// ===============================
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/daily-tasks', dailyTaskRoutes);
app.use('/api/earnings', earningsRoutes);
app.use('/api/support', supportRoutes);

// ===============================
// 🏁 Default Route
// ===============================
app.get('/', (req, res) => {
  res.status(200).json({ message: '🚀 Investment Platform Backend is running' });
});

// ===============================
// 🌐 Database Connection
// ===============================
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => console.warn('⚠️ MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => console.log('🔄 MongoDB reconnected'));
  mongoose.set('strictQuery', true);
};

// ===============================
// ⏰ Cron Jobs / Scheduled Tasks
// ===============================
const { generateDailyTasksForUser } = require('./utils/dailyTaskScheduler');
// Optional: generateDailyTasksForUser();

// ===============================
// 🚀 Start Server
// ===============================
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  const runningServer = server.listen(PORT, () => {
    console.log(`✅ Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  });

  // Graceful shutdown
  const shutdown = (signal) => {
    console.log(`⚠️ Received ${signal}. Closing gracefully...`);
    runningServer.close(() => {
      console.log('🛑 Server closed.');
      mongoose.connection.close(false, () => {
        console.log('🔌 MongoDB connection closed.');
        process.exit(0);
      });
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

startServer();

// ===============================
// 🧩 Error Handlers
// ===============================
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

app.use((err, req, res, next) => {
  console.error('🔥 Server error:', err);
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Internal Server Error',
  });
});

process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  console.error('💥 Unhandled Rejection:', err);
  process.exit(1);
});
