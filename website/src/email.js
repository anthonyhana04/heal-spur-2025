import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import Logo from './logo.png'

const Email = () => {
  const navigate = useNavigate();
  const [result, setResult] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setResult("Sending....");
    
    const formData = new FormData(event.target);
    formData.append("access_key", "b3da352d-bc4b-4314-9bfa-36d8cad0d637");

    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setResult("Form Submitted Successfully");
        event.target.reset();
        Swal.fire({
          text: 'Message sent successfully!',
          icon: 'success',
          confirmButtonText: 'Great!',
          background: '#1f2937',
          color: '#ffffff',
          confirmButtonColor: '#3b82f6'
        });
      } else {
        console.log("Error", data);
        setResult(data.message);
        Swal.fire({
          text: 'Failed to send message. Please try again.',
          icon: 'error',
          confirmButtonText: 'OK',
          background: '#1f2937',
          color: '#ffffff',
          confirmButtonColor: '#ef4444'
        });
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      setResult("An error occurred. Please try again.");
      Swal.fire({
        text: 'Network error. Please check your connection and try again.',
        icon: 'error',
        confirmButtonText: 'OK',
        background: '#1f2937',
        color: '#ffffff',
        confirmButtonColor: '#ef4444'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen animated-gradient flex items-center justify-center p-4">
    <div 
        className='absolute top-4 left-4 cursor-pointer transition transform hover:scale-125'
        onClick={() => navigate('/')}
        >
        <img src={process.env.PUBLIC_URL + Logo} alt='Logo' className='h-12' />
      </div>
      <div className="w-full max-w-2xl bg-gray-900/50 p-8 rounded-lg shadow-lg text-white">
        <h2 className="text-3xl font-bold text-center mb-8">Contact Us</h2>
        
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">Full Name</label>
              <input 
                name="name" 
                className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors" 
                placeholder="Enter your name" 
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Email Address</label>
              <input 
                name="email" 
                type="email"
                className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors" 
                placeholder="Enter your email" 
                required
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Your Message</label>
            <textarea 
              name="message" 
              rows={6}
              className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors resize-none" 
              placeholder="Enter your message" 
              required
            />
          </div>
          
          <div className="flex items-center justify-between">
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isSubmitting ? "Sending..." : "Send Message"}
            </button>
            
            {result && (
              <span className={`text-sm ${result.includes("Successfully") ? "text-green-400" : "text-red-400"}`}>
                {result}
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default Email;