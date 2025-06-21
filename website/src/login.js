import React from "react";
import { useAuth0 } from "@auth0/auth0-react";

const Login = () => {
  const { loginWithRedirect, isAuthenticated, isLoading, error } = useAuth0();

  const handleLogin = async () => {
    try {
      await loginWithRedirect();
    } catch (err) {
      alert('Login failed. Please check your Auth0 configuration.');
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  if (isAuthenticated) {
    return <div>You are already logged in!</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold mb-6 text-center">Login</h1>
        <button 
          onClick={handleLogin}
          className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition transform hover:scale-105"
        >
          Log In with Auth0
        </button>
      </div>
    </div>
  );
};

export default Login; 