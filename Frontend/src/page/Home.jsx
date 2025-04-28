import React, { useState, useEffect, useRef } from 'react'
import Profile from '../assets/Profile.svg' // Default import
import Send from '../assets/Send.svg'; // Correct capitalization
import axios from 'axios'; // Import axios for making API requests

// socket.io client setup
import { io } from "socket.io-client";


const Home = () => {

  // Socket.io setup

    const [socket, setSocket] = useState(null);

    useEffect(() => {
      // Connect to the socket server
      const newSocket = io("http://localhost:3001", {
        transports: ["websocket"], // Use WebSocket transport
        withCredentials: true, // Allow cross-origin requests
      });
  
      setSocket(newSocket); // Save the socket instance in state
  
      // Cleanup on component unmount
      return () => {
        newSocket.disconnect();
      };
    }, []);

    useEffect(() => {
      if (!socket) return;
  
      // announce yourself
      socket.emit('addUser', user.id);
  
      // listen for the server’s single “receiveMessage” event
      socket.on('receiveMessage', (data) => {
        setMessages(msgs => [
          ...msgs,
          {
            user: { name: 'Chatter', email: 'chatter@example.com' },
            message: data.message
          }
        ]);
      });
  
      // update the active-users list
      socket.on('getUsers', users => {
        setActiveUsers(users);
      });
  
      // cleanup
      return () => {
        socket.off('receiveMessage');
        socket.off('getUsers');
      };
    }, [socket]);
  

    // User details
    const [user, _] = useState(() => {
        const userDetails = localStorage.getItem('user:detail');
        return JSON.parse(userDetails);
    });

    useEffect(() => {
    }, [user]);

    // Fetch conversations
    const [conversation, setConversation] = useState([])

    useEffect(() => {
        const fetchConversations = async () => {
            try {
                // Retrieve the user ID from localStorage or state
                const userDetails = JSON.parse(localStorage.getItem('user:detail'));
                if (!userDetails || !userDetails.id) {
                    console.error('User ID not found in localStorage');
                    return;
                }
    
                const userId = userDetails.id;
    
                // Make the API call to fetch conversations
                const response = await axios.get(`/api/conversation/${userId}`);
    
                // Update the state with the fetched conversations
                setConversation(response.data);
            } catch (error) {
                console.error('Error fetching conversations:', error.response?.data || error.message);
            }
        };
    
        fetchConversations();
    }, []);

    // Fetch messages for a specific conversation

    const [messages, setMessages] = useState([]);

    const fetchMessages = async (conversationId) => {
        try {
          const response = await axios.get(`/api/message/${conversationId}`);
          setMessages(response.data); // Update the state with the fetched messages
        } catch (error) {
          console.error('Error fetching messages:', error.response?.data || error.message);
        }
      };

    // New Message
    const [newMessage, setNewMessage] = useState(''); // State to hold the input message
    const [selectedConversationId, setSelectedConversationId] = useState(null); // State to hold the selected conversation ID

    const handleSendMessage = async () => {
      if (!newMessage.trim()) {
        console.error("Message is empty");
        return;
      }
    
      if (!selectedConversationId) {
        console.error("No conversation selected");
        return;
      }
    
      try {
        const payload = {
          conversationId: selectedConversationId,
          senderId: user.id,
          text: newMessage,
        };
    
        // Retrieve the receiverId from the selected conversation
        const selectedConversation = conversation.find(
          (c) => c.conversationId === selectedConversationId
        );
    
        if (!selectedConversation || !selectedConversation.user || !selectedConversation.user.id) {
          console.error("Receiver ID is undefined");
          console.log("Selected conversation:", selectedConversation);
          return;
        }
    
        const receiverId = selectedConversation.user.id;
    
        // Emit the message to the server via socket
        socket?.emit("sendMessage", {
          senderId: user?.id,
          receiverId,
          message: newMessage,
          conversationId: selectedConversationId,
        });
    
        // Update the messages state immediately
        setMessages((prevMessages) => [
          ...prevMessages,
          { user: { name: user.name, email: user.email }, message: newMessage },
        ]);
    
        // Optionally, send the message to the backend for persistence
        await axios.post("/api/message", payload);
    
        setNewMessage(""); // Clear the input field
      } catch (error) {
        console.error("Error sending message:", error.response?.data || error.message);
      }
    };

    // Fetching all the users
    const [users, setUsers] = useState([]); // State to hold the list of users

    useEffect(() => {
  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/users'); // Fetch all users
      setUsers(response.data); // Update the state with the fetched users
    } catch (error) {
      console.error('Error fetching users:', error.response?.data || error.message);
    }
  };

  fetchUsers(); // Call the function when the component mounts
    }, []);

    const handleAddConversation = async (selectedUser) => {
      try {
        const payload = {
          senderId: user.id,
          receiverId: selectedUser._id,
        };
        const { data } = await axios.post('/api/conversation', payload);
        const newConversationId = data.conversationId;
  
        // immediately add it to your list so you don’t have to re-fetch
        setConversation(prev => [
          ...prev,
          { conversationId: newConversationId, user: selectedUser }
        ]);
  
        setSelectedConversationId(newConversationId);
        fetchMessages(newConversationId);
      } catch (error) {
        console.error('Error creating conversation:', error.response?.data || error.message);
      }
    };
  

    // useRef -> useRef is a hook that allows you to create a mutable object which holds a `.current` property. This object will persist for the full lifetime of the component.
    // matlab ki ye ki jab bhi aapko kisi cheez ki zarurat hoti hai jo ki baar baar render nahi hoti hai toh aap useRef ka use karte ho. 
    // useRef ka use karne se aapko baar baar render nahi karna padta hai.
    // chats ko neeche scroll karne ke liye useRef ka use kiya gaya hai.
    const messageRef = useRef(null)

    useEffect(() => {
      if (messageRef.current) {
        messageRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, [messages]);


    // User online or offline
    const [activeUsers, setActiveUsers] = useState([]); // State to hold active users

    useEffect(() => {
      if (socket) {
        socket.on("getUsers", (users) => {
          setActiveUsers(users); // Update the state with the active users
        });
      }
    
      // Cleanup the listener on component unmount
      return () => {
        socket?.off("getUsers");
      };
    }, [socket]);



  return (
    <div className="flex h-screen">


      <div className="w-[25%] h-full pl-2 pr-2 mt-5"> {/* First Section */}

        <div className="flex flex-col items-center justify-center mt-5">
            <img src={Profile} alt="Profile" className='w-15' />
            <p className='pt-2 text-lg'>{user.name}</p>
            <p className='text-blue-500 text-xs'>{user.email}</p>
            <p className='pt-1 text-blue-500 hover:text-red-600'>
  <button
    onClick={async () => {
      try {
        // Call the logout API
        await axios.post('/api/logout', { userId: user.id });

        // Clear user details from localStorage
        localStorage.removeItem('user:detail');

        // Redirect to the login page
        window.location.href = '/';
      } catch (error) {
        console.error('Error during logout:', error.response?.data || error.message);
      }
    }}
  >
    Logout
  </button>
            </p>
        </div>

        <hr className='text-gray-200 mt-5' />

        <div>
  <h2 className="text-lg font-bold mt-5">Messages</h2>
  <div className="flex flex-col mt-5 overflow-y-auto h-110 scrollbar-none"> {/* Hide scrollbar */}
  {conversation.map((contact, index) => (
  <div key={index} className="flex items-center mb-2 p-2 bg-gray-50 hover:bg-gray-100 shadow-md cursor-pointer"
  onClick={() => {
  setSelectedConversationId(contact.conversationId);
  fetchMessages(contact.conversationId);}}>
    <img src={Profile} alt="Profile" className="w-10 h-10 rounded-full" />
    <div className="ml-3">
      <p className="text-lg">{contact.user.username}</p> {/* Display the username */}
      <p className="text-xs text-blue-500">{contact.user.email}</p> {/* Display the email */}
    </div>
    <hr className="text-gray-200" />
  </div>
))}
  </div>
        </div>

      </div>

      <div className="w-[75%] h-full mt-5"> {/* Second Section */}
  {selectedConversationId ? (
    <>
      {/* Chat Header */}
      <div className="flex items-center mb-5 p-2 bg-blue-50 hover:bg-blue-100 shadow-md cursor-pointer">
        <img alt="Profile pic" src={Profile} className="w-10 h-10 rounded-full" />
        <div className="ml-3">
          {conversation.find((c) => c.conversationId === selectedConversationId)?.user.username || 'Chatter Name'}
          <p className="text-sm text-gray-500">
            {activeUsers.some((u) => u.userId === conversation.find((c) => c.conversationId === selectedConversationId)?.user.id)
              ? "Online"
              : "Offline"}
          </p>
        </div>
        <hr className="text-gray-200" />
      </div>

      {/* Chat Messages */}
      <div className="h-[70%] w-full bg-gray-100 shadow-md overflow-scroll">
        <div className="px-5 py-5">
          {messages.map((message, index) => (
            message.user.email === user.email ? (
              // Render the logged-in user's message
              <div
                key={index}
                className="max-w-[45%] bg-blue-600 text-white p-2 rounded-b-xl rounded-tl-xl ml-auto mb-5"
                ref={index === messages.length - 1 ? messageRef : null} // Attach ref to the last message
              >
                {message.message}
              </div>
            ) : (
              // Render the chatter's message
              <div
                key={index}
                className="max-w-[45%] bg-gray-600 text-white p-2 rounded-b-xl rounded-tr-xl mr-auto mb-5"
                ref={index === messages.length - 1 ? messageRef : null} // Attach ref to the last message
              >
                {message.message}
              </div>
            )
          ))}
        </div>
      </div>

      {/* Message Input */}
      <div className="flex justify-between bg-gray-100 mt-5 items-center w-[98%] p-2 rounded-full m-2 shadow-md">
        <input
          type="text"
          placeholder="Write a message..."
          className="w-[95%] outline-none pl-1"
          value={newMessage} // Bind the input value to the state
          onChange={(e) => setNewMessage(e.target.value)} // Update state on input change
        />
        <div className="relative group">
          <img
            src={Send}
            className="w-[40px] rounded-full bg-blue-500 p-2 hover:bg-blue-600 cursor-pointer"
            alt="Send"
            onClick={handleSendMessage} // Call the send message handler on click
          />
          <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-700 text-white text-xs rounded px-2 py-1 w-39">
            Click to send the message
          </span>
        </div>
      </div>
    </>
  ) : (
    // Show this message when no conversation is selected
    <div className="flex items-center justify-center h-full">
      <p className="text-gray-500 text-lg">Select a person to chat</p>
    </div>
  )}
      </div>

      <div className="w-[25%] h-full pl-2 pr-2 mt-5"> {/* Third Section */}
  <div className="flex items-center justify-center">
    <h1 className="text-xl font-bold">Other people's</h1>
  </div>
  <div className="mt-5">
    {users
      .filter(
        (otherUser) =>
          otherUser.email !== user.email && // Exclude the logged-in user
          !conversation.some((c) => c.user.email === otherUser.email) // Exclude users already in conversations
      )
      .map((user, index) => (
        <div
          key={index}
          className="flex items-center mb-2 p-2 bg-gray-50 hover:bg-gray-100 shadow-md cursor-pointer"
        >
          <img src={Profile} alt="Profile" className="w-10 h-10 rounded-full" />
          <div className="ml-3 w-full">
            <p className="text-lg">{user.name}</p> {/* Display the user's name */}
            <div className="flex justify-between items-center w-full">
              <p className="text-xs text-blue-500">{user.email}</p>
              <div className="relative group">
                <button
                  className="bg-blue-500 hover:bg-blue-600 text-white pl-[8px] pr-[8px] pb-[2px] rounded-full"
                  onClick={() => handleAddConversation(user)}
                >
                  +
                </button>
                <span className="absolute bottom-full  transform -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-700 text-white text-xs rounded px-2 py-1 w-21">
                  Click to chat
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
  </div>
      </div>


    </div>
  )
}

export default Home