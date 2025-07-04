const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Register
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    // Check if user exists
    let user = await User.findOne({ $or: [{ username }, { email }] });
    if (user) return res.status(400).json({ msg: 'User already exists' });

    // Create new user
    user = new User({ username, email, password, online: true });
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    await user.save();

    // Generate token
    const payload = { 
      user: { 
        id: user._id, 
        username: user.username 
      } 
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
    
    res.json({ token, user: { id: user._id, username: user.username } });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

    // Update user status
    user.online = true;
    user.lastSeen = new Date();
    await user.save();

    // Generate token
    const payload = { 
      user: { 
        id: user._id, 
        username: user.username 
      } 
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
    
    res.json({ token, user: { id: user._id, username: user.username } });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    
    user.online = false;
    user.lastSeen = new Date();
    await user.save();
    
    res.json({ msg: 'Logged out successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
