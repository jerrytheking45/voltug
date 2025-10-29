const mongoose = require('mongoose');

const SupportMessageSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  name: String,
  phone: String,
  message: String,
  reply: { type: String, default: '' },
  replySeen: { type: Boolean, default: false },
  status: { type: String, enum: ['Pending', 'Replied'], default: 'Pending' },
  date: { type: Date, default: Date.now },
});

module.exports = mongoose.model('SupportMessage', SupportMessageSchema);
