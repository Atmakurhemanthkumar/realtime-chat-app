const mongoose = require('mongoose');
const MessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // null for group messages
  content: String,
  timestamp: { type: Date, default: Date.now },
  isGroup: { type: Boolean, default: false }
});
module.exports = mongoose.model('Message', MessageSchema);
