import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';

import './db/connection.js';
import userModel from './models/User.js';
import conversationModel from './models/Conversation.js';
import messageModel from './models/Message.js';

// Update __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Socket.io setup

// const io = require('socket.io')(3001, {
//   cors: {
//     origin: "http://localhost:3000"
//   }
// });

// Dynamic port assignment
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables

const PORT = process.env.PORT || 3000;
const SOCKET_PORT = process.env.SOCKET_PORT || 3001;

let users = [];
const io = new Server(SOCKET_PORT, {
  cors: { origin: "http://localhost:5173", methods: ["GET","POST"], credentials: true }
});

io.on("connection", (socket) => {

  // Listen for the 'addUser' event from the client and store the user ID in the socket object
  socket.on("addUser", (userId) => {
    const isUserExist = users.find(user => user.userId === userId)
    if(!isUserExist){
      const user = { userId, socketId: socket.id };
      users.push(user); // Add the user to the connected users array'
      io.emit('getUsers', users);
    }// Log the connected users
  });

  socket.on("sendMessage", ({ senderId, receiverId, message, conversationId }) => {
    const user = users.find((user) => user.userId === receiverId); // Find the recipient by userId
  
    if (user) {
      // Emit the message only to the recipient
      io.to(user.socketId).emit("receiveMessage", {
        senderId,
        message,
        conversationId,
        receiverId,
      });
    } else {
      console.log(`User with ID ${receiverId} is not connected.`);
    }
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    users = users.filter((user) => user.socketId !== socket.id);
    io.emit("getUsers", users); // Emit the updated users list
    console.log("User disconnected:", socket.id);
  });
});


// Deployment

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Remove after testing
app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.path}`);
  next();
});


// Routes
app.get('/api', (req, res) => {
  res.send('Server is running on port 3000!');
});

app.post('/api/signUp', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Please fill all the fields' });
    }

    let user = await userModel.findOne({ email: email });
    if (user) {
      return res.status(400).json({ error: 'User already exists' });
    } else {
      // Hash the password using bcrypt
      const hashedPassword = await bcrypt.hash(password, 10);

      // Save the user with the hashed password
      user = new userModel({ name, email, password: hashedPassword });
      await user.save();
      return res.status(201).json({ message: 'User registered successfully' });
    }
  } catch (err) {
    console.log(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Please fill all the fields' });
    }

    const user = await userModel.findOne({ email: email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Compare the hashed password with the provided password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const payload = {
      userId: user._id,
      email: user.email
    }

    const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'JWT_SECRET_KEY';

    jwt.sign(payload, JWT_SECRET_KEY, { expiresIn: 84600 }, async (_, token) => {
      await userModel.updateOne({_id: user._id }, 
        { $set: {token} });
      user.save();
      next();
    });

    return res.status(200).json({ user: {id: user._id, name: user.name, email: user.email}, token: user.token });

  } catch (err) {
    console.log(err);
    res.status(500).send('Internal Server Error');
  }
})

// app.js (or wherever you define your routes)

// POST /api/conversation — create (or reuse) a convo and return its ID
app.post('/api/conversation', async (req, res) => {
  try {
    const { senderId, receiverId } = req.body;
    if (!senderId || !receiverId) {
      return res.status(400).json({ error: 'senderId and receiverId are required' });
    }

    // Check for an existing conversation between these two users
    let convo = await conversationModel.findOne({
      members: { $all: [senderId, receiverId] }
    });

    // If none exists, create a new one
    if (!convo) {
      convo = await new conversationModel({
        members: [senderId, receiverId]
      }).save();
    }

    // Return the actual conversationId
    return res.status(200).json({ conversationId: convo._id });
  } catch (err) {
    console.error('Error in POST /api/conversation:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.get('/api/conversation/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Find conversations where the user is a member
    const conversations = await conversationModel.find({ members: { $in: [userId] } });

    // Fetch user information and conversationId
    const conversationUserData = await Promise.all(
      conversations.map(async (conversation) => {
        const otherUserId = conversation.members.filter((member) => member !== userId)[0];

        // Validate otherUserId before querying the database
        if (!otherUserId || !mongoose.Types.ObjectId.isValid(otherUserId)) {
          console.error(`Invalid otherUserId: ${otherUserId}`);
          return null; // Skip invalid entries
        }

        const user = await userModel.findById(otherUserId).select('name email');
        if (!user) {
          console.error(`User not found for otherUserId: ${otherUserId}`);
          return null; // Skip if user is not found
        }

        return {
          user: {
            id: otherUserId, // Include the user ID
            username: user.name,
            email: user.email,
          },
          conversationId: conversation._id,
        };
      })
    );

    // Filter out null values from the result
    const filteredData = conversationUserData.filter((data) => data !== null);

    return res.status(200).json(filteredData);
  } catch (err) {
    console.error('Error in /api/conversation/:userId:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/message', async (req, res) => {
  try {
    const { conversationId, senderId, text, receiverId='' } = req.body;
    if(!senderId || !text) return res.status(400).json({ error: 'Please fill all the fields' });
    if(!conversationId && receiverId) {
      const newConversation = await new conversationModel({members: [senderId, receiverId]}).save();
      const newMessage = await new messageModel({ conversationId: newConversation._id, senderId, text }).save();
      return res.status(200).json({ message: 'Message saved successfully' });
    }else if(!conversationId && !receiverId) {
      return res.status(400).json({ error: 'Please fill all the fields' });
    }
    const message = await new messageModel({ conversationId, senderId, text }).save();
    return res.status(200).json({ message: 'Message saved successfully' });
  } catch (err) {
    console.log(err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/api/message/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    if(conversationId === 'new') return res.status(200).json([])

    // Find messages for the given conversationId
    const messages = await messageModel.find({ conversationId });

    // Fetch user details for each senderId and format the response
    const formattedMessages = await Promise.all(
      messages.map(async (message) => {
        const user = await userModel.findById(message.senderId).select('name email'); // Fetch user details
        return {
          user: {
            name: user?.name || 'Unknown', // Handle cases where user is not found
            email: user?.email || 'Unknown',
          },
          message: message.text,
        };
      })
    );

    return res.status(200).json(formattedMessages);
  } catch (err) {
    console.log(err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await userModel.find({}, { name: 1, email: 1 });
    return res.status(200).json(users);
  } catch (err) {
    console.log(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/logout', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Clear the token for the user
    await userModel.updateOne({ _id: userId }, { $unset: { token: "" } });

    return res.status(200).json({ message: 'User logged out successfully' });
  } catch (err) {
    console.error('Error during logout:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Deployment

// Serve React’s build output from ../Frontend/dist
app.use(
  express.static(
    path.join(__dirname, '..', 'Frontend', 'dist')
  )
);

// Fallback: for any request not handled above, send back React’s index.html
app.use((req, res) => {
  res.sendFile(
    path.join(__dirname, '..', 'Frontend', 'dist', 'index.html')
  );
});




// Start the server
app.listen(PORT, () => {
  console.log(`HTTP server running on http://localhost:${PORT}`);
  console.log(`WebSocket server running on port ${SOCKET_PORT}`);
});