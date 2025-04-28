import React from 'react'
import Start from './page/Start'
import Home from './page/Home'
import {Routes, Route} from 'react-router-dom'
import { Navigate } from 'react-router-dom'

const ProtectedRoute = ({ children }) => {
  const isLoggedIn = localStorage.getItem('user:token') !== null || false

  if (!isLoggedIn) {
    return <Navigate to="/" />
  } else {
    return children
  }
}

const App = () => {
  
  return (
    <Routes>
      <Route path="/" element={<Start/>}/>
      <Route path="/home" element={
      <ProtectedRoute>
        <Home/>
      </ProtectedRoute>
      }/>
    </Routes>
  )
}

export default App