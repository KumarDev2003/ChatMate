import React from 'react'
import SignUp from './SignUp'
import LogIn from './LogIn'

const Start = () => {
  return (
    <div className="flex flex-col justify-center items-center h-screen overflow-hidden">
      <div className="sticky top-0 bg-white z-10">
        <h1 className='text-4xl mt-10 text-white p-5 rounded-tl-2xl bg-blue-500 font-bold'>ChatMate</h1>
      </div>
      <div className="flex items-center gap-40">
        <SignUp />
        <div className="h-[500px] border-1 rounded-full text-gray-200"></div> {/* Vertical line */}
        <LogIn />
      </div>
    </div>
  )
}

export default Start