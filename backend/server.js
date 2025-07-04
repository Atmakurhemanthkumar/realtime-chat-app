require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const socketio = require('socket.io');
const jwt = require('jsonwebtoken'); // Add this line
const Message = require('./models/Message');
const User = require('./models/User');

const app = express();
const server = http.createServer(app);
const io = socketio(server, { 
  cors: { 
    origin: '*' 
  } 
});

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected')).catch(err => console.log(err));

app.use(cors());
app.use(express.json());
app.use('/api/auth', require('./routes/auth'));
app.use('/api/messages', require('./routes/messages'));

const onlineUsers = new Map();

io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.user.id;
    socket.username = decoded.user.username;
    onlineUsers.set(socket.userId, socket.id);
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', async (socket) => {
  console.log(`${socket.username} connected`);
  
  // Update user status
  await User.findByIdAndUpdate(socket.userId, { online: true });
  io.emit('user-status', { userId: socket.userId, online: true });
  
  // Get online users
  socket.emit('online-users', Array.from(onlineUsers.keys()));
  
  // Private message
  socket.on('private-message', async ({ receiverId, content }) => {
    try {
      const message = new Message({
        sender: socket.userId,
        receiver: receiverId,
        content
      });
      
      await message.save();
      
      const receiverSocket = onlineUsers.get(receiverId);
      if (receiverSocket) {
        io.to(receiverSocket).emit('private-message', message);
      }
      
      socket.emit('private-message', message);
    } catch (err) {
      console.error(err);
    }
  });
  
  // Disconnect
  socket.on('disconnect', async () => {
    console.log(`${socket.username} disconnected`);
    onlineUsers.delete(socket.userId);
    
    // Update user status
    await User.findByIdAndUpdate(socket.userId, { 
      online: false, 
      lastSeen: new Date() 
    });
    
    io.emit('user-status', { 
      userId: socket.userId, 
      online: false 
    });
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));
