import React, { useState, useEffect, useRef } from 'react'
import Profile from '../assets/Profile.svg' 
import Send from '../assets/Send.svg'
import axios from 'axios'
import { io } from "socket.io-client"

const Home = () => {
  const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin
  const [socket, setSocket] = useState(null)
  const [user, _] = useState(() => {
    const userDetails = localStorage.getItem('user:detail')
    return userDetails ? JSON.parse(userDetails) : {}
  })

  // Socket.io setup
  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ["websocket"],
      withCredentials: true
    })
    setSocket(newSocket)
    return () => newSocket.disconnect()
  }, [SOCKET_URL])

  useEffect(() => {
    if (!socket || !user?.id) return

    socket.emit('addUser', user.id)

    socket.on('receiveMessage', data => {
      setMessages(msgs => [
        ...msgs,
        { user: { name: 'Chatter', email: 'chatter@example.com' }, message: data.message }
      ])
    })

    socket.on('getUsers', users => {
      setActiveUsers(users)
    })

    return () => {
      socket.off('receiveMessage')
      socket.off('getUsers')
    }
  }, [socket, user])

  // Fetch conversations
  const [conversation, setConversation] = useState([])
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const userDetails = JSON.parse(localStorage.getItem('user:detail'))
        if (!userDetails?.id) return
        const res = await axios.get(`/api/conversation/${userDetails.id}`)
        setConversation(res.data)
      } catch (err) {
        console.error('Error fetching conversations:', err.response?.data || err.message)
      }
    }
    fetchConversations()
  }, [])

  // Fetch messages
  const [messages, setMessages] = useState([])
  const fetchMessages = async conversationId => {
    try {
      const res = await axios.get(`/api/message/${conversationId}`)
      setMessages(res.data)
    } catch (err) {
      console.error('Error fetching messages:', err.response?.data || err.message)
    }
  }

  // New message input
  const [newMessage, setNewMessage] = useState('')
  const [selectedConversationId, setSelectedConversationId] = useState(null)

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversationId) return

    const conv = conversation.find(c => c.conversationId === selectedConversationId)
    if (!conv?.user?.id) return

    const receiverId = conv.user.id
    const payload = { conversationId: selectedConversationId, senderId: user.id, text: newMessage }

    socket.emit("sendMessage", {
      senderId: user.id,
      receiverId,
      message: newMessage,
      conversationId: selectedConversationId
    })

    setMessages(prev => [
      ...prev,
      { user: { name: user.name, email: user.email }, message: newMessage }
    ])

    try {
      await axios.post("/api/message", payload)
    } catch (err) {
      console.error('Error sending message:', err.response?.data || err.message)
    }

    setNewMessage('')
  }

  // Fetch all users
  const [users, setUsers] = useState([])
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await axios.get('/api/users')
        setUsers(res.data)
      } catch (err) {
        console.error('Error fetching users:', err.response?.data || err.message)
      }
    }
    fetchUsers()
  }, [])

  const handleAddConversation = async selectedUser => {
    try {
      const { data } = await axios.post('/api/conversation', {
        senderId: user.id,
        receiverId: selectedUser._id
      })
      const newConversationId = data.conversationId
      setConversation(prev => [...prev, { conversationId: newConversationId, user: selectedUser }])
      setSelectedConversationId(newConversationId)
      fetchMessages(newConversationId)
    } catch (err) {
      console.error('Error creating conversation:', err.response?.data || err.message)
    }
  }

  const messageRef = useRef(null)
  useEffect(() => {
    messageRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Active users
  const [activeUsers, setActiveUsers] = useState([])
  useEffect(() => {
    if (!socket) return
    socket.on("getUsers", users => setActiveUsers(users))
    return () => socket.off("getUsers")
  }, [socket])

  return (
    <div className="flex h-screen">
      <div className="w-[25%] h-full pl-2 pr-2 mt-5">
        <div className="flex flex-col items-center justify-center mt-5">
          <img src={Profile} alt="Profile" className='w-15' />
          <p className='pt-2 text-lg'>{user.name}</p>
          <p className='text-blue-500 text-xs'>{user.email}</p>
          <p className='pt-1 text-blue-500 hover:text-red-600'>
            <button onClick={async () => {
              try {
                await axios.post('/api/logout', { userId: user.id })
                localStorage.removeItem('user:detail')
                window.location.href = '/'
              } catch (err) {
                console.error('Error during logout:', err.response?.data || err.message)
              }
            }}>Logout</button>
          </p>
        </div>
        <hr className='text-gray-200 mt-5' />
        <div>
          <h2 className="text-lg font-bold mt-5">Messages</h2>
          <div className="flex flex-col mt-5 overflow-y-auto h-110 scrollbar-none">
            {conversation.map((contact, index) => (
              <div key={index}
                className="flex items-center mb-2 p-2 bg-gray-50 hover:bg-gray-100 shadow-md cursor-pointer"
                onClick={() => {
                  setSelectedConversationId(contact.conversationId)
                  fetchMessages(contact.conversationId)
                }}>
                <img src={Profile} alt="Profile" className="w-10 h-10 rounded-full" />
                <div className="ml-3">
                  <p className="text-lg">{contact.user.username}</p>
                  <p className="text-xs text-blue-500">{contact.user.email}</p>
                </div>
                <hr className="text-gray-200" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="w-[75%] h-full mt-5">
        {selectedConversationId ? (
          <>
            <div className="flex items-center mb-5 p-2 bg-blue-50 hover:bg-blue-100 shadow-md cursor-pointer">
              <img src={Profile} alt="Profile pic" className="w-10 h-10 rounded-full" />
              <div className="ml-3">
                {conversation.find(c => c.conversationId === selectedConversationId)?.user.username || 'Chatter Name'}
                <p className="text-sm text-gray-500">
                  {activeUsers.some(u => u.userId === conversation.find(c => c.conversationId === selectedConversationId)?.user.id)
                    ? "Online" : "Offline"}
                </p>
              </div>
              <hr className="text-gray-200" />
            </div>
            <div className="h-[70%] w-full bg-gray-100 shadow-md overflow-scroll">
              <div className="px-5 py-5">
                {messages.map((message, index) => (
                  message.user.email === user.email ?
                    <div key={index}
                      className="max-w-[45%] bg-blue-600 text-white p-2 rounded-b-xl rounded-tl-xl ml-auto mb-5"
                      ref={index === messages.length - 1 ? messageRef : null}>
                      {message.message}
                    </div>
                    :
                    <div key={index}
                      className="max-w-[45%] bg-gray-600 text-white p-2 rounded-b-xl rounded-tr-xl mr-auto mb-5"
                      ref={index === messages.length - 1 ? messageRef : null}>
                      {message.message}
                    </div>
                ))}
              </div>
            </div>
            <div className="flex justify-between bg-gray-100 mt-5 items-center w-[98%] p-2 rounded-full m-2 shadow-md">
              <input type="text" placeholder="Write a message..."
                className="w-[95%] outline-none pl-1"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)} />
              <div className="relative group">
                <img src={Send}
                  className="w-[40px] rounded-full bg-blue-500 p-2 hover:bg-blue-600 cursor-pointer"
                  alt="Send"
                  onClick={handleSendMessage} />
                <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-700 text-white text-xs rounded px-2 py-1 w-39">
                  Click to send the message
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 text-lg">Select a person to chat</p>
          </div>
        )}
      </div>
      <div className="w-[25%] h-full pl-2 pr-2 mt-5">
        <div className="flex items-center justify-center"><h1 className="text-xl font-bold">Other people's</h1></div>
        <div className="mt-5">
          {users
            .filter(otherUser =>
              otherUser.email !== user.email &&
              !conversation.some(c => c.user.email === otherUser.email)
            )
            .map((user, index) => (
              <div key={index}
                className="flex items-center mb-2 p-2 bg-gray-50 hover:bg-gray-100 shadow-md cursor-pointer"
                onClick={() => handleAddConversation(user)}>
                <img src={Profile} alt="Profile" className="w-10 h-10 rounded-full" />
                <div className="ml-3 w-full">
                  <p className="text-lg">{user.name}</p>
                  <div className="flex justify-between items-center w-full">
                    <p className="text-xs text-blue-500">{user.email}</p>
                    <div className="relative group">
                      <button className="bg-blue-500 hover:bg-blue-600 text-white pl-[8px] pr-[8px] pb-[2px] rounded-full">+</button>
                      <span className="absolute bottom-full transform -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-700 text-white text-xs rounded px-2 py-1 w-21">
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
