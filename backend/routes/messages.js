const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Message = require('../models/Message');
const User = require('../models/User');

// Get all users
router.get('/users', auth, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user.id } }).select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Get messages between two users
router.get('/:userId', auth, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.user.id, receiver: req.params.userId },
        { sender: req.params.userId, receiver: req.user.id }
      ]
    }).sort({ timestamp: 1 }).populate('sender receiver', 'username');
    
    res.json(messages);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Send message
router.post('/', auth, async (req, res) => {
  try {
    const { receiver, content } = req.body;
    const message = new Message({
      sender: req.user.id,
      receiver,
      content
    });
    
    await message.save();
    const populatedMsg = await Message.populate(message, { path: 'sender receiver', select: 'username' });
    
    res.json(populatedMsg);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Update message
router.put('/:id', auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ msg: 'Message not found' });
    if (message.sender.toString() !== req.user.id) return res.status(401).json({ msg: 'Unauthorized' });
    
    message.content = req.body.content;
    await message.save();
    
    res.json(message);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

// Delete message
router.delete('/:id', auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ msg: 'Message not found' });
    if (message.sender.toString() !== req.user.id) return res.status(401).json({ msg: 'Unauthorized' });
    
    await message.remove();
    res.json({ msg: 'Message deleted' });
  } catch (err) {
    res.status(500).send('Server error');
  }
});

module.exports = router;
