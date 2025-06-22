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

const ObjectHistory = ({ onHistoryClick, onBackClick, isHistoryView, selectedItem }) => {
  const [objectHistory] = useState([
    { 
      id: 1, 
      object: 'water bottle', 
      timestamp: '2:30 PM', 
      status: 'identified',
      image: 'https://via.placeholder.com/400x300/1f2937/ffffff?text=Water+Bottle',
      boundingBoxes: [
        { x: 150, y: 100, width: 100, height: 80, label: 'Water Bottle', color: 'lime' },
        { x: 300, y: 150, width: 80, height: 60, label: 'Cap', color: 'blue' }
      ],
      details: {
        brand: 'Evian',
        price: '$2.99',
        location: 'Local Store',
        confidence: '95%'
      }
    },
    { 
      id: 2, 
      object: 'coffee mug', 
      timestamp: '2:32 PM', 
      status: 'identified',
      image: 'https://via.placeholder.com/400x300/1f2937/ffffff?text=Coffee+Mug',
      boundingBoxes: [
        { x: 200, y: 120, width: 120, height: 100, label: 'Coffee Mug', color: 'red' }
      ],
      details: {
        brand: 'Starbucks',
        price: '$15.99',
        location: 'Online Store',
        confidence: '92%'
      }
    },
    { 
      id: 3, 
      object: 'laptop', 
      timestamp: '2:35 PM', 
      status: 'identified',
      image: 'https://via.placeholder.com/400x300/1f2937/ffffff?text=Laptop',
      boundingBoxes: [
        { x: 100, y: 80, width: 250, height: 180, label: 'Laptop', color: 'yellow' },
        { x: 120, y: 100, width: 200, height: 120, label: 'Screen', color: 'blue' }
      ],
      details: {
        brand: 'MacBook Pro',
        price: '$1,299',
        location: 'Apple Store',
        confidence: '98%'
      }
    },
    { 
      id: 4, 
      object: 'phone charger', 
      timestamp: '2:38 PM', 
      status: 'searching',
      image: 'https://via.placeholder.com/400x300/1f2937/ffffff?text=Phone+Charger',
      boundingBoxes: [],
      details: {
        brand: 'Unknown',
        price: 'Searching...',
        location: 'Searching...',
        confidence: '45%'
      }
    },
    { 
      id: 5, 
      object: 'notebook', 
      timestamp: '2:40 PM', 
      status: 'identified',
      image: 'https://via.placeholder.com/400x300/1f2937/ffffff?text=Notebook',
      boundingBoxes: [
        { x: 180, y: 140, width: 140, height: 100, label: 'Notebook', color: 'lime' }
      ],
      details: {
        brand: 'Moleskine',
        price: '$12.99',
        location: 'Office Supply Store',
        confidence: '89%'
      }
    },
    { 
      id: 6, 
      object: 'headphones', 
      timestamp: '2:42 PM', 
      status: 'not found',
      image: 'https://via.placeholder.com/400x300/1f2937/ffffff?text=Headphones',
      boundingBoxes: [],
      details: {
        brand: 'Not Found',
        price: 'N/A',
        location: 'N/A',
        confidence: '0%'
      }
    },
  ]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'identified': return 'text-green-400';
      case 'searching': return 'text-yellow-400';
      case 'not found': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'identified': return '✓';
      case 'searching': return '⟳';
      case 'not found': return '✗';
      default: return '•';
    }
  };

  return (
    <div className="w-full h-full bg-gray-900/80 rounded-lg p-4 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white text-lg font-bold">Object History</h3>
        <button className="text-gray-400 hover:text-white text-sm">Clear All</button>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-2">
        {objectHistory.map((item) => (
          <div 
            key={item.id} 
            className="bg-gray-800/60 rounded-lg p-3 hover:bg-gray-800/80 transition-colors cursor-pointer"
            onClick={() => onHistoryClick(item)}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-white font-medium text-sm">{item.object}</span>
              <span className={`text-xs ${getStatusColor(item.status)}`}>
                {getStatusIcon(item.status)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-xs">{item.timestamp}</span>
              <span className={`text-xs capitalize ${getStatusColor(item.status)}`}>
                {item.status}
              </span>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="text-center">
          <p className="text-gray-400 text-sm mb-2">Recent searches</p>
          <p className="text-gray-500 text-xs">Click on any item to view on camera</p>
        </div>
      </div>
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
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
  const [showHistoryImage, setShowHistoryImage] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setUploadedImage(URL.createObjectURL(file));
      setShowHistoryImage(false);
      setSelectedHistoryItem(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setUploadedImage(URL.createObjectURL(file));
      setShowHistoryImage(false);
      setSelectedHistoryItem(null);
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

  const handleHistoryClick = (item) => {
    setSelectedHistoryItem(item);
    setShowHistoryImage(true);
    setTurnOnCam(false);
    setUploadedImage(null);
  };

  const handleCameraClick = () => {
    setTurnOnCam(true);
    setShowHistoryImage(false);
    setSelectedHistoryItem(null);
    setUploadedImage(null);
  };

  const handleCameraToggle = () => {
    if (turnOnCam) {
      setTurnOnCam(false);
    } else {
      setTurnOnCam(true);
      setShowHistoryImage(false);
      setSelectedHistoryItem(null);
      setUploadedImage(null);
    }
  };

  return (
    <div className='min-h-screen animated-gradient relative flex'>
      {/* Logo */}
      <div 
        className='absolute top-4 left-4 cursor-pointer transition transform hover:scale-125 z-10'
        onClick={() => navigate('/')}
      >
        <img src={process.env.PUBLIC_URL + Logo} alt='Logo' className='h-8 sm:h-10 lg:h-12' />
      </div>

      {/* Left Side - Main Content */}
      <div className='flex-1 flex flex-col items-center justify-center p-4 lg:p-6'>
        <div className='flex flex-col lg:flex-row items-center justify-center w-full gap-4 lg:gap-6 mb-4 lg:mb-6'>
          {/* Webcam */}
          <div className='w-full sm:w-[400px] lg:w-[450px] h-[280px] sm:h-[350px] lg:h-[450px] rounded-2xl overflow-hidden bg-black relative'>
            {showHistoryImage && selectedHistoryItem ? (
              <>
                <img 
                  src={selectedHistoryItem.image} 
                  alt={selectedHistoryItem.object} 
                  className='w-full h-full object-cover'
                />
                {selectedHistoryItem.boundingBoxes.map((box, index) => (
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
            ) : turnOnCam ? (
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
                className='w-full h-full text-white text-lg sm:text-xl font-bold flex items-center justify-center text-center px-4' 
                onClick={handleCameraToggle}
              >
                {turnOnCam ? 'Turn off Camera' : 'Press to turn on Camera'}
              </button>
            )}
          </div>
          
          {/* Dropzone */}
          <div className='w-full sm:w-[400px] lg:w-[450px] h-[280px] sm:h-[350px] lg:h-[450px] rounded-2xl border-4 border-dashed border-gray-600 relative'>
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
                  <img src={uploadedImage} alt="Uploaded" className="w-full h-full object-cover rounded-xl" />
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
                  <svg className="w-8 h-8 sm:w-12 sm:h-12 mb-2 sm:mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
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

      {/* Right Side - Object History */}
      <div className='w-72 lg:w-80 h-screen p-3 lg:p-4'>
        <ObjectHistory 
          onHistoryClick={handleHistoryClick}
          onBackClick={() => {}}
          isHistoryView={false}
          selectedItem={null}
        />
      </div>
    </div>
  );
};

export default Start;
