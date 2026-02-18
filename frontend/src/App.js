// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './components/landing';
import TVKodiApp from './components/tvkodbdi';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/tvkodbdi" element={<TVKodiApp />} />
      </Routes>
    </Router>
  );
}

export default App;

