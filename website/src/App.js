import React from 'react'
import Lottie from 'lottie-react'
import Camera from './camera.json'
import Start from './start.js'
import Login from './login.js'
import Logo from './logo.png'
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
    <div className='h-screen flex flex-col lg:flex-row items-center justify-center animated-gradient relative overflow-hidden'>
      <Parallax pages={2} ref={ref}>
        {/* Page 1: Landing */}
        <ParallaxLayer 
          offset={0} 
          speed={0.5} 
          className="flex items-center justify-center"
        >
          <div className="flex flex-col lg:flex-row items-center justify-center w-full px-4">
            {/* Left-side Content */}
            <div className='flex flex-col items-center justify-center w-full lg:w-1/2 text-center lg:text-left mb-8 lg:mb-0'>
              <div 
                className='font-bold text-4xl sm:text-6xl lg:text-8xl bg-gradient-to-r from-blue-600 to-purple-600 text-transparent'
                style={{
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text'
                }}
              >
                HEALense
              </div>
              <p className='text-lg sm:text-xl lg:text-2xl text-gray-300 mt-4'>
                An intelligent lens that reveals your world.
              </p>
              <div className='mt-6 text-gray-400 flex flex-col sm:flex-row gap-2 sm:gap-4'>
                <div className='flex items-center justify-center sm:justify-start gap-2'>
                  <span className='text-green-500'>✓</span>
                  <span className='text-sm sm:text-base'>Identifies items instantly</span>
                </div>
                <div className='flex items-center justify-center sm:justify-start gap-2'>
                  <span className='text-green-500'>✓</span>
                  <span className='text-sm sm:text-base'>Compares prices in real-time</span>
                </div>
              </div>
              <div className='mt-8'>
                <button className='bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition transform hover:scale-105' onClick={() => navigate('/start')}>
                  Get Started
                </button>
              </div>
            </div>

            {/* Right-side Lottie Animation */}
            <div className='w-full sm:w-2/3 lg:w-1/3 max-w-md lg:max-w-none'>
              <Lottie animationData={Camera} loop={true} />
            </div>
          </div>
        </ParallaxLayer>

        {/* Page 2: About Me */}
        <ParallaxLayer 
          offset={1} 
          speed={0.8}
          className="flex flex-col items-center justify-center text-white px-4"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-center">About HEALense</h2>
          <p className="mt-4 text-lg sm:text-xl max-w-2xl text-center">
            HEALense is a revolutionary tool designed to give you information about the world around you, instantly. 
            Just point your camera, and let our intelligent lens do the rest.
          </p>
        </ParallaxLayer>
      </Parallax> 
      <div className='absolute top-4 left-4 transition transform hover:scale-125 z-10' onClick={handleClick}>
            <img src={process.env.PUBLIC_URL + Logo} alt='Logo' className='h-8 sm:h-10 lg:h-12' />
      </div>  
      <div className='absolute top-4 right-4 flex items-center gap-2 sm:gap-4 z-10 pr-2'>
            {!isLoading && (
              <>
                {!isAuthenticated ? (
                  <button className='bg-blue-600 text-white px-4 sm:px-6 py-2 rounded-md hover:bg-blue-700 transition transform hover:scale-105 text-sm sm:text-base' onClick={handleLogin}>
                    Login
                  </button>
                ) : (
                  <button className='bg-red-600 text-white px-4 sm:px-6 py-2 rounded-md hover:bg-red-700 transition transform hover:scale-105 text-sm sm:text-base' onClick={handleLogout}>
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
      </Routes>
    </BrowserRouter>
  )
}

export default App

