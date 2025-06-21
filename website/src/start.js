import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import Logo from './logo.png';

const Start = () => {
  const navigate = useNavigate();
  // const [textInput, set]
  const [uploadedImage, setUploadedImage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [turnOnCam, setTurnOnCam] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setUploadedImage(URL.createObjectURL(file));
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setUploadedImage(URL.createObjectURL(file));
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDivClick = () => {
    fileInputRef.current.click();
  };

  const onSubmit = (e) => {
    e.preventDefault();
    alert("Form Submitted!");
  };

  return (
    <div className='h-screen animated-gradient relative flex flex-col items-center justify-center p-4'>
      <div 
        className='absolute top-4 left-4 cursor-pointer transition transform hover:scale-125'
        onClick={() => navigate('/')}
      >
        <img src={process.env.PUBLIC_URL + Logo} alt='Logo' className='h-12' />
      </div>

      <div className='flex flex-row items-center justify-center w-full gap-8 mb-8'>
        {/* Webcam on the left */}
        <div className='w-[600px] h-[600px] rounded-3xl overflow-hidden bg-black'>
          {turnOnCam ? (
            <Webcam
              audio={false}
              mirrored={true}
              className='w-full h-full object-cover'
            />
          ) : (
            <button 
              className='w-full h-full text-white text-2xl font-bold flex items-center justify-center' 
              onClick={() => setTurnOnCam(true)}
            >
              Press to turn on Camera
            </button>
          )}
        </div>
        
        {/* Dropzone on the right */}
        <div 
          className={`w-[600px] h-[600px] rounded-3xl border-4 border-dashed flex flex-col items-center justify-center text-gray-400 transition-colors cursor-pointer ${isDragging ? 'border-blue-500 bg-gray-800/50' : 'border-gray-600'}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onClick={handleDivClick}
        >
          <input 
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*"
          />
          {uploadedImage ? (
            <img src={uploadedImage} alt="Uploaded" className="w-full h-full object-cover rounded-2xl" />
          ) : (
            <>
              <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              <p className="text-center">Drag & drop an image here</p>
              <p className="text-sm">or</p>
              <p className="font-bold text-blue-500">Click to browse</p>
            </>
          )}
        </div>
      </div>

      {/* Object Input Form */}
      <form onSubmit={onSubmit} className="w-full max-w-2xl bg-gray-900/50 p-4 rounded-lg shadow-lg text-white flex items-center gap-4">
        <label htmlFor="object-input" className='font-bold flex-shrink-0'>Enter desired object:</label>
        <input id="object-input" name='object' className='w-full p-2 rounded bg-gray-800 border border-gray-700 text-white' placeholder='e.g., "a water bottle"' required/>
        <button type="submit" className='bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition transform hover:scale-105'>Identify</button>
      </form>
    </div>
  );
};

export default Start;
