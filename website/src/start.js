import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import Logo from './logo.png';

const ObjectInput = () => {
  const [text, setText] = useState('');

  const onSubmit = (e) => {
    e.preventDefault();
    alert(`Identifying: ${text}`);
  };

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm sm:max-w-md lg:max-w-2xl bg-gray-900/50 p-3 sm:p-4 rounded-lg shadow-lg text-white flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
      <label htmlFor="object-input" className='font-bold flex-shrink-0 text-sm sm:text-base'>Enter desired object:</label>
      <textarea 
        id="object-input" 
        name='object' 
        className='w-full p-2 sm:p-3 rounded bg-gray-800 border border-gray-700 text-white resize-none text-sm sm:text-base' 
        placeholder='e.g., "a water bottle"' 
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        required
      />
      <button type="submit" className='bg-blue-600 text-white px-4 sm:px-6 py-2 rounded-md hover:bg-blue-700 transition transform hover:scale-105 text-sm sm:text-base whitespace-nowrap'>Identify</button>
    </form>
  );
};

const BoundingBox = ({ x, y, width, height, label, color = 'lime' }) => {
  const colorClasses = {
    lime: 'border-lime-400',
    red: 'border-red-400',
    blue: 'border-blue-400',
    yellow: 'border-yellow-400'
  };

  return (
    <div 
      className={`absolute border-4 ${colorClasses[color]}`}
      style={{ 
        left: `${x}px`, 
        top: `${y}px`, 
        width: `${width}px`, 
        height: `${height}px` 
      }}
    >
      <span className={`absolute -top-8 left-0 bg-gray-800 text-white text-sm px-2 py-0.5 rounded border ${colorClasses[color]}`}>
        {label}
      </span>
    </div>
  );
};

const Start = () => {
  const navigate = useNavigate();
  const [uploadedImage, setUploadedImage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [turnOnCam, setTurnOnCam] = useState(false);
  const [boundingBoxes, setBoundingBoxes] = useState([
    { x: 150, y: 100, width: 300, height: 250, label: 'Object 1', color: 'lime' },
    { x: 400, y: 200, width: 150, height: 150, label: 'Object 2', color: 'red' }
  ]);
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

  return (
    <div className='min-h-screen animated-gradient relative flex flex-col items-center justify-center p-4'>
      <div 
        className='absolute top-4 left-4 cursor-pointer transition transform hover:scale-125 z-10'
        onClick={() => navigate('/')}
      >
        <img src={process.env.PUBLIC_URL + Logo} alt='Logo' className='h-8 sm:h-10 lg:h-12' />
      </div>

      <div className='flex flex-col lg:flex-row items-center justify-center w-full gap-4 lg:gap-8 mb-4 lg:mb-8'>
        {/* Webcam on the left */}
        <div className='w-full sm:w-[400px] lg:w-[600px] h-[300px] sm:h-[400px] lg:h-[600px] rounded-2xl lg:rounded-3xl overflow-hidden bg-black relative'>
          {turnOnCam ? (
            <>
              <Webcam
                audio={false}
                mirrored={true}
                className='w-full h-full object-cover'
              />
              {boundingBoxes.map((box, index) => (
                <BoundingBox 
                  key={index}
                  x={box.x}
                  y={box.y}
                  width={box.width}
                  height={box.height}
                  label={box.label}
                  color={box.color}
                />
              ))}
            </>
          ) : (
            <button 
              className='w-full h-full text-white text-lg sm:text-xl lg:text-2xl font-bold flex items-center justify-center text-center px-4' 
              onClick={() => setTurnOnCam(true)}
            >
              Press to turn on Camera
            </button>
          )}
        </div>
        
        {/* Dropzone on the right */}
        <div className='w-full sm:w-[400px] lg:w-[600px] h-[300px] sm:h-[400px] lg:h-[600px] rounded-2xl lg:rounded-3xl border-4 border-dashed border-gray-600 relative'>
          <div 
            className={`w-full h-full flex flex-col items-center justify-center text-gray-400 transition-colors cursor-pointer ${isDragging ? 'border-blue-500 bg-gray-800/50' : ''}`}
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
              <div className="w-full h-full relative">
                <img src={uploadedImage} alt="Uploaded" className="w-full h-full object-cover rounded-xl lg:rounded-2xl" />
                {boundingBoxes.map((box, index) => (
                  <BoundingBox 
                    key={index}
                    x={box.x}
                    y={box.y}
                    width={box.width}
                    height={box.height}
                    label={box.label}
                    color={box.color}
                  />
                ))}
              </div>
            ) : (
              <>
                <svg className="w-8 h-8 sm:w-12 sm:h-12 lg:w-16 lg:h-16 mb-2 sm:mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                <p className="text-center text-sm sm:text-base">Drag & drop an image here</p>
                <p className="text-xs sm:text-sm">or</p>
                <p className="font-bold text-blue-500 text-sm sm:text-base">Click to browse</p>
              </>
            )}
          </div>
        </div>
      </div>

      <ObjectInput />
    </div>
  );
};

export default Start;
