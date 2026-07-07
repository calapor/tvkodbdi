// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import TVKodiApp from './components/tvkodbdi';

const APP_VERSION = process.env.REACT_APP_VERSION || 'dev';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<TVKodiApp />} />
      </Routes>
      <div
        title="Running build"
        style={{
          position: 'fixed',
          bottom: 4,
          right: 6,
          fontSize: '11px',
          fontFamily: 'monospace',
          color: '#888',
          opacity: 0.6,
          pointerEvents: 'none',
          zIndex: 9999,
        }}
      >
        {APP_VERSION}
      </div>
    </Router>
  );
}

export default App;

