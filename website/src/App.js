import React from 'react'
import Lottie from 'lottie-react'
import Camera from './camera.json'
import Start from './start.js'
import Login from './login.js'
import Email from './email.js'
import Logo from './logo.png'
import ScrollDown from './scrollDown.json'
import { useRef } from 'react'
import { useNavigate} from 'react-router-dom';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Parallax, ParallaxLayer } from '@react-spring/parallax'
import { useAuth0 } from '@auth0/auth0-react';

const AppContainer = () => {
  const navigate = useNavigate();
  const { loginWithRedirect, logout, isAuthenticated, isLoading } = useAuth0();
  
  function handleClick(){
    ref.current.scrollTo(0);
  }

  const handleLogin = async () => {
    try {
      console.log('Attempting to login with Auth0...');
      await loginWithRedirect();
    } catch (err) {
      console.error('Login error:', err);
      alert('Login failed. Please check your Auth0 configuration.');
    }
  };

  const handleLogout = () => {
    logout({ logoutParams: { returnTo: window.location.origin } });
  };

  const ref = useRef();

  return (
    <div className='h-screen flex flex-row items-center justify-center animated-gradient relative'>
      <Parallax pages={2} ref={ref}>
        {/* Page 1: Landing */}
        <ParallaxLayer 
          offset={0} 
          speed={0.5} 
          className="flex items-center justify-center"
        >
          <div className="flex items-center justify-center w-full">
            {/* Left-side Content */}
            <div className='flex flex-col items-center justify-center w-1/2'>
              <div 
                className='font-bold text-8xl bg-gradient-to-r from-blue-600 to-purple-600 text-transparent'
                style={{
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text'
                }}
              >
                HEALense
              </div>
              <p className='text-2xl text-gray-300 mt-4'>
                An intelligent lens that reveals your world.
              </p>
              <div className='mt-6 text-gray-400 flex gap-4'>
                <div className='flex items-center gap-2'>
                  <span className='text-green-500'>✓</span>
                  <span>Identifies items instantly</span>
                </div>
                <div className='flex items-center gap-2'>
                  <span className='text-green-500'>✓</span>
                  <span>Compares prices in real-time</span>
                </div>
              </div>
              <div className='mt-8'>
                <button className='bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition transform hover:scale-105' onClick={() => navigate('/start')}>
                  Get Started
                </button>
              </div>
            </div>

            {/* Right-side Lottie Animation */}
            <div className='w-1/3'>
              <Lottie animationData={Camera} loop={true} />
            </div>
          </div>
          <div 
            className='absolute bottom-4 left-1/2 -translate-x-1/2 w-12 h-24'
          >
            <Lottie animationData={ScrollDown} loop={true} />
          </div>
        </ParallaxLayer>

        {/* Page 2: About Me */}
        <ParallaxLayer 
          offset={1} 
          speed={0.8}
          className="flex flex-col items-center justify-center text-white"
        >
          <img src={process.env.PUBLIC_URL + Logo} alt='Logo' className='h-24 mb-8' />
          <h2 className="text-5xl font-bold">About <span style={{color: 'dodgerblue'}}>HEALense</span></h2>
          <p className="mt-4 text-xl max-w-2xl text-center">
            HEALense is a revolutionary tool designed to give you information about the world around you, instantly. 
            Just point your camera, and let our intelligent lens do the rest.
          </p>
          <button className='mt-8 bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition transform hover:scale-105' onClick={()=>navigate('/email')}>
            Send us an email
          </button>
        </ParallaxLayer>
      </Parallax> 
      <div className='absolute top-4 left-4 flex items-center gap-6'>
        <div className='transition transform hover:scale-125 cursor-pointer' onClick={handleClick}>
          <img src={process.env.PUBLIC_URL + Logo} alt='Logo' className='h-12' />
        </div>
        <button 
          className='text-white text-lg hover:text-blue-300 transition-colors' 
          onClick={() => ref.current.scrollTo(1)}
        >
          About Us
        </button>
      </div>
      <div className='absolute top-4 right-4 flex items-center gap-4'>
        {!isLoading && (
          <>
            {!isAuthenticated ? (
              <button className='bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition transform hover:scale-105' onClick={handleLogin}>
                Login
              </button>
            ) : (
              <button className='bg-red-600 text-white px-6 py-2 rounded-md hover:bg-red-700 transition transform hover:scale-105' onClick={handleLogout}>
                Logout
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<AppContainer />} />
        <Route path='/start' element={<Start />} />
        <Route path='/login' element={<Login/>}/>
        <Route path='/email' element={<Email/>}/>
      </Routes>
    </BrowserRouter>
  )
}

export default App

