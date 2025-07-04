let socket;
let token = localStorage.getItem('token') || '';
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
let selectedUser = null;
let editingMessageId = null;
let emojiPicker;

// DOM Elements
const authBox = document.getElementById('auth-box');
const chatBox = document.getElementById('chat-box');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginTab = document.getElementById('loginTab');
const registerTab = document.getElementById('registerTab');
const usersList = document.getElementById('usersList');
const messagesContainer = document.getElementById('messages');
const msgInput = document.getElementById('msgInput');
const usernameDisplay = document.getElementById('usernameDisplay');
const chatWithUser = document.getElementById('chatWithUser');
const userStatus = document.getElementById('userStatus');
const searchUsers = document.getElementById('searchUsers');

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  // Setup tab switching
  loginTab.addEventListener('click', () => switchTab('login'));
  registerTab.addEventListener('click', () => switchTab('register'));
  
  // Setup emoji picker
  setupEmojiPicker();
  
  // Check if user is already logged in
  if (token && currentUser) {
    initializeChat();
  } else {
    authBox.classList.remove('hidden');
    chatBox.classList.add('hidden');
  }
});

function switchTab(tab) {
  if (tab === 'login') {
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
  } else {
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
  }
}

function setupEmojiPicker() {
  emojiPicker = new EmojiButton({
    position: 'top-end',
    autoHide: false
  });
  
  const emojiBtn = document.getElementById('emoji-btn');
  emojiPicker.on('emoji', emoji => {
    msgInput.value += emoji;
    msgInput.focus();
  });
  
  emojiBtn.addEventListener('click', () => {
    emojiPicker.togglePicker(emojiBtn);
  });
}

async function register() {
  const username = document.getElementById('registerUsername').value;
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;
  
  if (!username || !email || !password) {
    alert('Please fill all fields');
    return;
  }
  
  try {
    const response = await fetch('http://localhost:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      token = data.token;
      currentUser = data.user;
      localStorage.setItem('token', token);
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      initializeChat();
    } else {
      alert(data.msg || 'Registration failed');
    }
  } catch (err) {
    console.error('Registration error:', err);
    alert('Registration failed. Please try again.');
  }
}

async function login() {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  
  if (!email || !password) {
    alert('Please fill all fields');
    return;
  }
  
  try {
    const response = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      token = data.token;
      currentUser = data.user;
      localStorage.setItem('token', token);
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      initializeChat();
    } else {
      alert(data.msg || 'Login failed');
    }
  } catch (err) {
    console.error('Login error:', err);
    alert('Login failed. Please try again.');
  }
}

async function logout() {
  try {
    await fetch('http://localhost:5000/api/auth/logout', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-auth-token': token 
      }
    });
    
    // Clear local storage and reset state
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    token = '';
    currentUser = null;
    selectedUser = null;
    
    // Disconnect socket if exists
    if (socket) {
      socket.disconnect();
    }
    
    // Reset UI
    authBox.classList.remove('hidden');
    chatBox.classList.add('hidden');
    messagesContainer.innerHTML = '';
    usersList.innerHTML = '';
    
    // Reset forms
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('registerUsername').value = '';
    document.getElementById('registerEmail').value = '';
    document.getElementById('registerPassword').value = '';
    
    // Switch to login tab
    switchTab('login');
  } catch (err) {
    console.error('Logout error:', err);
  }
}

function initializeChat() {
  // Setup socket connection
  socket = io('http://localhost:5000', {
    auth: { token }
  });
  
  // Setup UI
  authBox.classList.add('hidden');
  chatBox.classList.remove('hidden');
  usernameDisplay.textContent = currentUser.username;
  
  // Socket event listeners
  socket.on('connect', () => {
    console.log('Connected to socket server');
  });
  
  socket.on('private-message', (message) => {
    if (selectedUser && (message.sender._id === selectedUser._id || message.receiver._id === selectedUser._id)) {
      addMessage(message);
    }
  });
  
  socket.on('online-users', (userIds) => {
    updateUserStatuses(userIds);
  });
  
  socket.on('user-status', ({ userId, online }) => {
    const userElement = document.querySelector(`.user-item[data-id="${userId}"]`);
    if (userElement) {
      const statusDot = userElement.querySelector('.user-status');
      statusDot.className = `user-status ${online ? 'online' : 'offline'}`;
    }
  });
  
  // Load users and messages
  loadUsers();
  
  // Setup search
  searchUsers.addEventListener('input', debounce(loadUsers, 300));
}

async function loadUsers(searchTerm = '') {
  try {
    const response = await fetch('http://localhost:5000/api/messages/users', {
      headers: { 'x-auth-token': token }
    });
    
    const users = await response.json();
    
    // Filter users based on search term
    const filteredUsers = users.filter(user => 
      user.username.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    // Render users
    usersList.innerHTML = filteredUsers.map(user => `
      <div class="user-item" data-id="${user._id}" onclick="selectUser('${user._id}')">
        <div class="user-avatar">${user.username.charAt(0).toUpperCase()}</div>
        <div class="user-info">
          <div class="user-name">${user.username}</div>
        </div>
        <div class="user-status ${user.online ? 'online' : 'offline'}"></div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading users:', err);
  }
}

async function selectUser(userId) {
  try {
    // Get user details
    const response = await fetch(`http://localhost:5000/api/messages/users`, {
      headers: { 'x-auth-token': token }
    });
    
    const users = await response.json();
    selectedUser = users.find(u => u._id === userId);
    
    // Update UI
    chatWithUser.textContent = selectedUser.username;
    userStatus.innerHTML = `
      <div class="user-status-indicator">
        <div class="status-dot ${selectedUser.online ? 'online' : 'offline'}"></div>
        <span>${selectedUser.online ? 'Online' : `Last seen ${new Date(selectedUser.lastSeen).toLocaleTimeString()}`}</span>
      </div>
    `;
    
    // Load messages with this user
    const messagesResponse = await fetch(`http://localhost:5000/api/messages/${userId}`, {
      headers: { 'x-auth-token': token }
    });
    
    const messages = await messagesResponse.json();
    messagesContainer.innerHTML = '';
    messages.forEach(msg => addMessage(msg));
    
    // Highlight selected user
    document.querySelectorAll('.user-item').forEach(el => {
      el.classList.remove('selected');
    });
    document.querySelector(`.user-item[data-id="${userId}"]`).classList.add('selected');
    
    // Scroll to bottom of messages
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  } catch (err) {
    console.error('Error selecting user:', err);
  }
}

function addMessage(message) {
  const isSent = message.sender._id === currentUser.id;
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
  
  messageDiv.innerHTML = `
    <div class="message-content">
      ${message.content}
      ${isSent ? `
        <div class="message-actions" onclick="editMessage('${message._id}', '${escapeHtml(message.content)}')">
          <i class="fas fa-edit"></i>
        </div>
      ` : ''}
    </div>
    <div class="message-info">
      <span>${new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
    </div>
  `;
  
  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function sendMessage() {
  if (!selectedUser) {
    alert('Please select a user to chat with');
    return;
  }
  
  const content = msgInput.value.trim();
  if (!content) return;
  
  if (editingMessageId) {
    // Update existing message
    try {
      const response = await fetch(`http://localhost:5000/api/messages/${editingMessageId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-auth-token': token 
        },
        body: JSON.stringify({ content })
      });
      
      const updatedMessage = await response.json();
      
      // Update in UI
      const messageElement = document.querySelector(`.message-content[data-id="${editingMessageId}"]`);
      if (messageElement) {
        messageElement.textContent = content;
      }
      
      editingMessageId = null;
      msgInput.value = '';
    } catch (err) {
      console.error('Error updating message:', err);
    }
  } else {
    // Send new message
    socket.emit('private-message', {
      receiverId: selectedUser._id,
      content
    });
    
    msgInput.value = '';
  }
}

function editMessage(messageId, content) {
  editingMessageId = messageId;
  msgInput.value = content;
  msgInput.focus();
}

async function deleteMessage(messageId) {
  if (confirm('Are you sure you want to delete this message?')) {
    try {
      await fetch(`http://localhost:5000/api/messages/${messageId}`, {
        method: 'DELETE',
        headers: { 'x-auth-token': token }
      });
      
      // Remove from UI
      const messageElement = document.querySelector(`.message[data-id="${messageId}"]`);
      if (messageElement) {
        messageElement.remove();
      }
    } catch (err) {
      console.error('Error deleting message:', err);
    }
  }
}

function updateUserStatuses(onlineUserIds) {
  document.querySelectorAll('.user-item').forEach(userEl => {
    const userId = userEl.dataset.id;
    const statusDot = userEl.querySelector('.user-status');
    if (statusDot) {
      statusDot.className = `user-status ${onlineUserIds.includes(userId) ? 'online' : 'offline'}`;
    }
  });
}

// Utility functions
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Handle Enter key for sending messages
msgInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendMessage();
  }
});
