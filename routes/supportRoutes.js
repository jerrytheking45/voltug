const express = require('express');
const router = express.Router();
const SupportMessage = require('../models/SupportMessage');

// ------------------------
// 🧍‍♂️ USER: Send message to admin (with real-time emit)
// ------------------------
router.post('/message', async (req, res) => {
  try {
    const { userId, name, phone, message } = req.body;

    if (!userId || !name || !phone || !message)
      return res.status(400).json({ error: 'All fields are required' });

    const newMsg = new SupportMessage({ userId, name, phone, message });
    await newMsg.save();

    // Emit event to admin dashboard in real-time
    const io = req.app.get('io');
    if (io) {
      io.emit('newUserMessage', newMsg); // broadcast to all admins
      console.log(`📨 New user message emitted for real-time admin update`);
    }

    res.status(201).json(newMsg);
  } catch (err) {
    console.error('❌ Error sending message:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// ------------------------
// 🧑‍💼 ADMIN: Get all messages
// ------------------------
router.get('/messages', async (req, res) => {
  try {
    const messages = await SupportMessage.find().sort({ date: -1 });
    res.status(200).json(messages);
  } catch (err) {
    console.error('❌ Error fetching messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// ------------------------
// 🧑‍💼 ADMIN: Reply to user (real-time)
// ------------------------
router.post('/reply/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { reply } = req.body;
    if (!reply) return res.status(400).json({ error: 'Reply cannot be empty' });

    const message = await SupportMessage.findById(id);
    if (!message) return res.status(404).json({ error: 'Message not found' });

    // Update reply
    message.reply = reply;
    message.status = 'Replied';
    message.replySeen = false;
    await message.save();

    // Emit real-time reply to the specific user
    const io = req.app.get('io');
    if (io) {
      io.to(message.userId).emit('adminReply', {
        messageId: message._id,
        reply: message.reply,
      });
      console.log(`📨 Real-time reply sent to user ${message.userId}`);
    }

    res.status(200).json({ message: 'Reply sent successfully', data: message });
  } catch (err) {
    console.error('❌ Error sending reply:', err);
    res.status(500).json({ error: 'Failed to send reply' });
  }
});

// ------------------------
// 🧍‍♂️ USER: Fetch user messages + replies
// ------------------------
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const messages = await SupportMessage.find({ userId }).sort({ date: -1 });
    res.status(200).json(messages);
  } catch (err) {
    console.error('❌ Error fetching user messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// ------------------------
// 🧍‍♂️ USER: Mark reply as seen
// ------------------------
router.patch('/mark-seen/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const message = await SupportMessage.findByIdAndUpdate(
      id,
      { replySeen: true },
      { new: true }
    );
    res.status(200).json({ message: 'Reply marked as seen', data: message });
  } catch (err) {
    console.error('❌ Error marking as seen:', err);
    res.status(500).json({ error: 'Failed to mark as seen' });
  }
});

module.exports = router;
