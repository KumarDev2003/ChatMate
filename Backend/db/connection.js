import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ChatApp';

mongoose.connect(mongoUri)
    .then(() => {
        console.log("Connected to MongoDB successfully");
    })
    .catch((err) => {
        console.log("Error connecting to MongoDB", err);
    });