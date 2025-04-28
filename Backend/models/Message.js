import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    conversationId: {
        type: String,
        required: true,
    },
    senderId: {
        type: String,
        required: true,
    },
    text: {
        type: String,
        required: true,
    }
});

const Message = mongoose.model('Message', messageSchema);

export default Message; // Use ES module export