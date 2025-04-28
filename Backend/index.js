// backend/index.js
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';

import './db/connection.js';
import userModel from './models/User.js';
import conversationModel from './models/Conversation.js';
import messageModel from './models/Message.js';

import dotenv from 'dotenv';
dotenv.config();

const PORT = process.env.PORT || 3000;

const app = express();
const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: {
    origin: [process.env.FRONTEND_URL],
    methods: ["GET", "POST"],
    credentials: true
  }
});

let users = [];

io.on("connection", socket => {
  socket.on("addUser", userId => {
    if (!users.find(u => u.userId === userId)) {
      users.push({ userId, socketId: socket.id });
      io.emit("getUsers", users);
    }
  });

  socket.on("sendMessage", ({ senderId, receiverId, message, conversationId }) => {
    const recipient = users.find(u => u.userId === receiverId);
    if (recipient) {
      io.to(recipient.socketId).emit("receiveMessage", { senderId, message, conversationId, receiverId });
    }
  });

  socket.on("disconnect", () => {
    users = users.filter(u => u.socketId !== socket.id);
    io.emit("getUsers", users);
  });
});

// Express middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple logger (remove in production)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Routes
app.get('/api', (req, res) => {
  res.send('Server is running');
});

app.post('/api/signUp', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name||!email||!password) return res.status(400).json({ error: 'Please fill all fields' });

    let user = await userModel.findOne({ email });
    if (user) return res.status(400).json({ error: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    user = new userModel({ name, email, password: hashedPassword });
    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email||!password) return res.status(400).json({ error: 'Please fill all fields' });

    const user = await userModel.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    if (!await bcrypt.compare(password, user.password))
      return res.status(400).json({ error: 'Invalid credentials' });

    const payload = { userId: user._id, email: user.email };
    const token = jwt.sign(payload, process.env.JWT_SECRET_KEY, { expiresIn: '1d' });

    await userModel.updateOne({ _id: user._id }, { $set: { token } });
    res.status(200).json({ user: { id: user._id, name: user.name, email: user.email }, token });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

// Conversation routes
app.post('/api/conversation', async (req, res) => {
  try {
    const { senderId, receiverId } = req.body;
    if (!senderId||!receiverId) return res.status(400).json({ error: 'senderId and receiverId required' });

    let convo = await conversationModel.findOne({ members: { $all: [senderId, receiverId] } });
    if (!convo) convo = await new conversationModel({ members: [senderId, receiverId] }).save();

    res.status(200).json({ conversationId: convo._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/conversation/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const convos = await conversationModel.find({ members: userId });
    const result = await Promise.all(convos.map(async c => {
      const other = c.members.find(m => m.toString() !== userId);
      if (!mongoose.Types.ObjectId.isValid(other)) return null;
      const u = await userModel.findById(other).select('name email');
      if (!u) return null;
      return { user: { id: other, username: u.name, email: u.email }, conversationId: c._id };
    }));
    res.status(200).json(result.filter(x=>x));
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

// Message routes
app.post('/api/message', async (req, res) => {
  try {
    const { conversationId, senderId, text, receiverId='' } = req.body;
    if (!senderId||!text) return res.status(400).json({ error: 'Please fill all fields' });

    if (!conversationId && receiverId) {
      const newConvo = await new conversationModel({ members: [senderId, receiverId] }).save();
      await new messageModel({ conversationId: newConvo._id, senderId, text }).save();
    } else if (conversationId) {
      await new messageModel({ conversationId, senderId, text }).save();
    } else {
      return res.status(400).json({ error: 'Please fill all fields' });
    }

    res.status(200).json({ message: 'Message saved successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/api/message/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(conversationId))
      return res.status(400).json({ error: 'Invalid conversationId' });

    const msgs = await messageModel.find({ conversationId });
    const formatted = await Promise.all(msgs.map(async m => {
      const u = await userModel.findById(m.senderId).select('name email');
      return { user: { name: u?.name||'Unknown', email: u?.email||'Unknown' }, message: m.text };
    }));
    res.status(200).json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await userModel.find({}, { name:1, email:1 });
    res.status(200).json(users);
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/logout', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID required' });
    await userModel.updateOne({ _id: userId }, { $unset: { token: "" } });
    res.status(200).json({ message: 'User logged out successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

// Serve React build
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, '..', 'Frontend', 'dist')));
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '..', 'Frontend', 'dist', 'index.html'));
});

// Start combined HTTP + WebSocket server
httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
