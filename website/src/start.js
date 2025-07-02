import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import Logo from './logo.png';
import AiChat from './chat/AiChat.js';

const ObjectInput = ({ onIdentify, hasImage }) => {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported by this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
      setError('');
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setError(`Speech error: ${event.error}`);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setText(transcript);
      if (hasImage) {
        onIdentify(transcript);
      } else {
        setError('Please select an image before using voice input.');
      }
    };

    recognitionRef.current = recognition;
  }, [hasImage, onIdentify]);

  const handleMicClick = () => {
    if (!recognitionRef.current) {
      setError('Speech recognition is not supported.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    
    // Validate that we have an image
    if (!hasImage) {
      setError('Please take a screenshot or upload an image first before identifying objects');
      return;
    }
    
    // Validate that text is not empty
    const trimmedText = text.trim();
    if (!trimmedText) {
      setError('Please enter an object name to identify');
      return;
    }
    
    // Validate text length
    if (trimmedText.length > 50) {
      setError('Object name is too long. Please keep it under 50 characters');
      return;
    }
    
    try {
      
      onIdentify(trimmedText);
      setText('');
      setError('');
    } catch (err) {
      setError('Failed to identify object. Please try again.');
      console.error('Identification error:', err);
    }
  };

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm sm:max-w-md lg:max-w-4xl xl:max-w-5xl bg-gray-900/50 p-2 sm:p-3 lg:p-4 rounded-lg shadow-lg text-white flex flex-col sm:flex-row items-center gap-2 sm:gap-3 lg:gap-4">
      <label htmlFor="object-input" className='font-bold flex-shrink-0 text-xs sm:text-sm lg:text-base'>Enter desired object/action:</label>
      <textarea 
        id="object-input" 
        name='object' 
        className='w-full p-1.5 sm:p-2 lg:p-3 rounded bg-gray-800 border border-gray-700 text-white resize-none text-xs sm:text-sm lg:text-base' 
        placeholder='e.g., "a water bottle" or "find my keys"' 
        rows={1}
        value={text}
        onChange={(e) => {
          const newValue = e.target.value;
          setText(newValue);
          // Clear error when user starts typing
          if (error) setError('');
          // Prevent extremely long input
          if (newValue.length > 50) {
            setError('Object name is too long. Please keep it under 50 characters');
          }
        }}
        onKeyDown={(e) => {
          // Allow Enter to submit, but prevent other special keys
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSubmit(e);
          }
        }}
        maxLength={100}
        required
      />
      <button
        type="button"
        onClick={handleMicClick}
        className={`p-2 rounded-full transition-colors focus:outline-none ${
          isListening
            ? 'bg-red-600 text-white animate-pulse'
            : 'bg-gray-600 text-gray-300 hover:bg-gray-700'
        }`}
        title="Identify object with voice"
        disabled={!hasImage}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-14 0m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
      </button>
      <button 
        type="submit" 
        className={`px-2 sm:px-4 lg:px-6 py-1.5 sm:py-2 rounded-md transition transform hover:scale-105 text-xs sm:text-sm lg:text-base whitespace-nowrap ${
          hasImage 
            ? 'bg-blue-600 text-white hover:bg-blue-700' 
            : 'bg-gray-600 text-gray-300 cursor-not-allowed'
        }`}
        disabled={!hasImage || !text.trim()}
      >
        Send
      </button>
      {error && (
        <div className="w-full text-red-400 text-xs sm:text-sm mt-1 sm:mt-2 text-center">
          {error}
        </div>
      )}
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

const ObjectHistory = ({ onHistoryClick, objectHistory, onClearAll }) => {
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
        <button 
          className="text-gray-400 hover:text-white text-sm"
          onClick={onClearAll}
        >
          Clear All
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-2">
        {objectHistory.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-8">
            No objects identified yet
          </div>
        ) : (
          objectHistory.map((item) => (
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
          ))
        )}
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

// Helper: uploads a dataUrl/blob URL to the backend and returns an imageKey
async function uploadImageToServer(dataUrl) {
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const uploadResp = await fetch(`/api/image`, {
      method: 'POST',
      headers: { 'Content-Type': blob.type || 'application/octet-stream' },
      body: blob,
      credentials: 'include',
    });
    if (!uploadResp.ok) throw new Error('Image upload failed');
    const { key } = await uploadResp.json();
    return key;
  } catch (err) {
    console.error('Failed to upload image:', err);
    return null;
  }
}

// Helper: parse bounding box text response into objects
function parseBoundingBoxes(text) {
  const boxes = [];
  const cleaned = text.replace(/\n/g, ' ').replace(/\r/g, ' ');
  const regex = /\{([^}]+)\}/g;
  let match;
  while ((match = regex.exec(cleaned)) !== null) {
    const objStr = match[1]; // inner part of {...}
    const box = { color: 'lime' };
    objStr.split(',').forEach((seg) => {
      const [k, v] = seg.split(':').map((s) => s.trim());
      if (!k || v === undefined) return;
      if (k === 'label') {
        box.label = v.replace(/['"]/g, '');
      } else {
        box[k] = parseFloat(v);
      }
    });
    // Basic validation
    if (box.x !== undefined && box.y !== undefined && box.width && box.height) {
      boxes.push(box);
    }
  }
  return boxes;
}

const Start = () => {
  const navigate = useNavigate();
  const [uploadedImage, setUploadedImage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [turnOnCam, setTurnOnCam] = useState(false);
  const [boundingBoxes, setBoundingBoxes] = useState([]);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
  const [showHistoryImage, setShowHistoryImage] = useState(false);
  const [screenshotImage, setScreenshotImage] = useState(null);
  const [objectHistory, setObjectHistory] = useState([]);
  const [imageMode, setImageMode] = useState('webcam'); // 'webcam' or 'dropzone'
  const fileInputRef = useRef(null);
  const webcamRef = useRef(null);

  const handleToggleImageMode = () => {
    try {
      if (imageMode === 'webcam') {
        setImageMode('dropzone');
        setTurnOnCam(false);
        setScreenshotImage(null);
        setShowHistoryImage(false);
        setSelectedHistoryItem(null);
      } else {
        setImageMode('webcam');
        setUploadedImage(null);
        setShowHistoryImage(false);
        setSelectedHistoryItem(null);
      }
    } catch (err) {
      console.error('Error toggling image mode:', err);
    }
  };

  const handleFileChange = (e) => {
    try {
      const file = e.target.files[0];
      if (!file) {
        console.warn('No file selected');
        return;
      }
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        console.error('Invalid file type. Please select an image file.');
        return;
      }
      
      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        console.error('File too large. Please select an image under 10MB.');
        return;
      }
      
      // Create object URL and update state
      const imageUrl = URL.createObjectURL(file);
      setUploadedImage(imageUrl);
      setScreenshotImage(null);
      setShowHistoryImage(false);
      setSelectedHistoryItem(null);
      setImageMode('dropzone'); // Switch to dropzone mode
      
      // Reset file input
      e.target.value = '';
    } catch (err) {
      console.error('Error handling file upload:', err);
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
    
    // Check if we're actually leaving the dropzone container
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    try {
      const files = e.dataTransfer.files;
      if (!files || files.length === 0) {
        console.warn('No files dropped');
        return;
      }
      
      const file = files[0];
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        console.error('Invalid file type. Please drop an image file.');
        return;
      }
      
      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        console.error('File too large. Please drop an image under 10MB.');
        return;
      }
      
      // Create object URL and update state
      const imageUrl = URL.createObjectURL(file);
      setUploadedImage(imageUrl);
      setScreenshotImage(null);
      setShowHistoryImage(false);
      setSelectedHistoryItem(null);
      setImageMode('dropzone'); // Switch to dropzone mode
    } catch (err) {
      console.error('Error handling file drop:', err);
    }
  };

  const handleDivClick = () => {
    try {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      } else {
        console.error('File input reference not found');
      }
    } catch (err) {
      console.error('Error clicking file input:', err);
    }
  };

  const handleHistoryClick = (item) => {
    try {
      if (!item || !item.sourceArea) {
        console.error('Invalid history item');
        return;
      }
      
      setSelectedHistoryItem(item);
      
      if (item.sourceArea === 'webcam') {
        // Display in webcam area
        setShowHistoryImage(true);
        setTurnOnCam(false);
        setScreenshotImage(null);
        setUploadedImage(null);
        setImageMode('webcam');
      } else if (item.sourceArea === 'dropzone') {
        // Display in dropzone area
        setShowHistoryImage(false);
        setTurnOnCam(false);
        setScreenshotImage(null);
        setImageMode('dropzone');
        
        // Check if the image exists and is valid
        if (item.image) {
          setUploadedImage(item.image);
        } else {
          console.error('History item has no valid image');
          setUploadedImage(null);
        }
      } else {
        console.error('Unknown source area:', item.sourceArea);
      }
    } catch (err) {
      console.error('Error handling history click:', err);
    }
  };

  const handleCameraToggle = () => {
    try {
      if (turnOnCam) {
        setTurnOnCam(false);
      } else {
        setTurnOnCam(true);
        setShowHistoryImage(false);
        setSelectedHistoryItem(null);
        setScreenshotImage(null);
        setUploadedImage(null);
        setImageMode('webcam');
      }
    } catch (err) {
      console.error('Error toggling camera:', err);
    }
  };

  const captureScreenshot = () => {
    try {
      if (!webcamRef.current) {
        console.error('Webcam reference not found');
        return;
      }
      
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) {
        console.error('Failed to capture screenshot');
        return;
      }
      
      setScreenshotImage(imageSrc);
      setTurnOnCam(false);
      setUploadedImage(null);
      setImageMode('webcam');
    } catch (err) {
      console.error('Error capturing screenshot:', err);
    }
  };

  const handleIdentify = async (objectName) => {
    try {
      // Validate input
      if (!objectName || typeof objectName !== 'string') {
        console.error('Invalid object name provided');
        return;
      }
      
      const trimmedName = objectName.trim();
      if (!trimmedName) {
        console.error('Object name cannot be empty');
        return;
      }
      
      // Clear previous boxes immediately so UI resets while searching
      setBoundingBoxes([]);

      // Determine the active image
      const currentImage = screenshotImage || uploadedImage;
      if (!currentImage) {
        console.error('No image available for identification');
        return;
      }

      // Upload image first to get imageKey
      const imageKey = await uploadImageToServer(currentImage);
      if (!imageKey) {
        console.error('Unable to upload image for object detection');
        return;
      }

      // Call backend detection endpoint
      let detectedBoxes = [];
      try {
        const resp = await fetch('/api/detect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ objectName: trimmedName, imageKey }),
          credentials: 'include',
        });
        if (!resp.ok) throw new Error(await resp.text());
        const resultText = await resp.text();
        console.log('AI detection raw response:', resultText);
        detectedBoxes = parseBoundingBoxes(resultText);
        if (detectedBoxes.length) {
          setBoundingBoxes(detectedBoxes);
        } else {
          console.warn('No bounding boxes parsed from AI response. Raw text: ', resultText);
        }
      } catch (err) {
        console.error('Detection API error:', err);
      }

      // Determine the source area (for history tracking)
      const sourceArea = screenshotImage ? 'webcam' : 'dropzone';

      // Get current timestamp
      const now = new Date();
      const timestamp = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      // Create a new history item
      const newItem = {
        id: Date.now(), // Use timestamp as unique ID
        object: trimmedName,
        timestamp: timestamp,
        status: detectedBoxes.length ? 'identified' : 'searching',
        image: currentImage,
        boundingBoxes: detectedBoxes.length ? detectedBoxes : [...boundingBoxes],
        sourceArea: sourceArea, // Track which area this came from
        details: {
          brand: 'Searching...',
          price: 'Searching...',
          location: 'Searching...',
          confidence: '0%'
        }
      };

      // Add to history
      setObjectHistory(prev => [newItem, ...prev]);
    } catch (err) {
      console.error('Error in handleIdentify:', err);
    }
  };

  const handleClearAll = () => {
    try {
      setObjectHistory([]);
    } catch (err) {
      console.error('Error clearing history:', err);
    }
  };

  const handleClearUploadedImage = () => {
    try {
      setUploadedImage(null);
      // Clear dropzone history item if it's selected
      if (selectedHistoryItem && selectedHistoryItem.sourceArea === 'dropzone') {
        setSelectedHistoryItem(null);
      }
      // Reset drag state to ensure dropzone remains functional
      setIsDragging(false);
    } catch (err) {
      console.error('Error clearing uploaded image:', err);
    }
  };

  // Monitor drag state and reset if stuck
  useEffect(() => {
    if (isDragging) {
      const timeout = setTimeout(() => {
        setIsDragging(false);
      }, 1000); // Reset after 1 second if still dragging
      
      return () => clearTimeout(timeout);
    }
  }, [isDragging]);

  // Reset drag state when component mounts or when uploaded image changes
  useEffect(() => {
    setIsDragging(false);
  }, [uploadedImage]);

  // Cleanup object URLs when component unmounts or when images change
  useEffect(() => {
    return () => {
      // Cleanup blob URLs when they're no longer the current uploaded image
      if (uploadedImage && uploadedImage.startsWith('blob:')) {
        URL.revokeObjectURL(uploadedImage);
      }
    };
  }, [uploadedImage]);

  return (
    <div className='min-h-screen animated-gradient relative flex flex-col lg:flex-row'>
      {/* Logo */}
      <div 
        className='absolute top-4 left-4 cursor-pointer transition transform hover:scale-125 z-10'
        onClick={() => navigate('/')}
      >
        <img src={process.env.PUBLIC_URL + Logo} alt='Logo' className='h-8 sm:h-10 lg:h-12' />
      </div>

      {/* Main Content Area */}
      <div className='flex-1 flex flex-col items-center justify-center p-4 lg:p-6 w-full'>
        <div className='w-full max-w-4xl flex flex-col items-center gap-6'>
          {/* Unified Image Area */}
          <div className={`w-full max-w-[600px] h-[350px] sm:h-[450px] lg:max-w-[700px] lg:h-[550px] xl:max-w-[800px] xl:h-[650px] rounded-2xl overflow-hidden relative ${imageMode === 'webcam' ? 'bg-black' : 'bg-transparent'}`}>
            {/* Webcam Mode */}
            {imageMode === 'webcam' && (
              <>
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
                ) : screenshotImage ? (
                  <>
                    <img 
                      src={screenshotImage} 
                      alt="Screenshot" 
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
                ) : turnOnCam ? (
                  <>
                    <Webcam
                      audio={false}
                      mirrored={true}
                      className='w-full h-full object-cover'
                      ref={webcamRef}
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
                    className='w-full h-full text-white text-lg sm:text-xl font-bold flex flex-col items-center justify-center text-center px-4' 
                    onClick={handleCameraToggle}
                  >
                    <div className="mb-4">
                      {turnOnCam ? 'Turn off Camera' : 'Press to turn on Camera'}
                    </div>
                  </button>
                )}

                {/* --- Always-visible capture / retake button --- */}
                {imageMode === 'webcam' && (
                  <button
                    onClick={() => {
                      if (turnOnCam) {
                        captureScreenshot();
                      } else {
                        setScreenshotImage(null);
                        setTurnOnCam(true);
                      }
                    }}
                    className="absolute bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full shadow-lg transition-colors"
                    title={turnOnCam ? 'Take Screenshot' : 'New Image'}
                  >
                    {turnOnCam ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                  </button>
                )}
              </>
            )}

            {/* Dropzone Mode */}
            {imageMode === 'dropzone' && (
              <div 
                className={`w-full h-full flex flex-col items-center justify-center text-gray-400 transition-colors ${isDragging ? 'border-blue-500 bg-gray-800/50' : ''} ${!uploadedImage ? 'cursor-pointer' : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onClick={!uploadedImage ? handleDivClick : undefined}
              >
                <input 
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/*"
                />
                {uploadedImage ? (
                  <div className="w-full h-full relative bg-transparent">
                    <img src={uploadedImage} alt="Uploaded" className="w-full h-full object-cover rounded-xl" />
                    {(selectedHistoryItem && selectedHistoryItem.sourceArea === 'dropzone' 
                      ? selectedHistoryItem.boundingBoxes 
                      : boundingBoxes
                    ).map((box, index) => (
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
                    {/* Clear Uploaded Image Button */}
                    <button
                      onClick={handleClearUploadedImage}
                      className="absolute top-4 right-4 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full shadow-lg transition-colors"
                      title="Clear Image"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
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
            )}
          </div>
          
          <div className="flex justify-center">
            {imageMode === 'dropzone' ? (
              <button
                onClick={handleToggleImageMode}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                title="Switch to Webcam"
              >
                📷 Switch to Webcam
              </button>
            ) : (
              <button
                onClick={handleToggleImageMode}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                title="Switch to Dropzone"
              >
                📁 Switch to Dropzone
              </button>
            )}
          </div>
          <ObjectInput onIdentify={handleIdentify} hasImage={!!screenshotImage || !!uploadedImage} />
        </div>
      </div>

      {/* Side Panel - Chat and History */}
      <div className='w-full lg:w-96 lg:h-screen lg:flex-shrink-0 p-4'>
        <div className='h-full flex flex-col gap-4'>
          <div className='flex-1 min-h-[300px]'>
            <AiChat 
              currentImage={screenshotImage || uploadedImage}
            />
          </div>
          <div className='flex-1 min-h-[300px]'>
            <ObjectHistory 
              onHistoryClick={handleHistoryClick}
              objectHistory={objectHistory}
              onClearAll={handleClearAll}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Start;
