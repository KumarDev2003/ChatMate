import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema({
    members: {
        type: Array,
        required: true,
    }
});

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation; // Use ES module export