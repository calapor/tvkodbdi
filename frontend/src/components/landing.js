// src/components/Landing.js
import React from 'react';
import './landing.css'; // (optional for styling)

const Landing = () => {
  return (
    <div className="button-container">
      <a href="/tvkodbdi" className="app-button">TV Kodi Shows</a>
      {/* Add more buttons for other apps */}
    </div>
  );
};

export default Landing;

