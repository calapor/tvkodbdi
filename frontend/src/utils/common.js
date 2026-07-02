import {useState} from "react";


export const slugify = (text) => {
    return text
        .toLowerCase()                       // 1. Convert to lowercase
        .trim()                              // 2. Remove leading/trailing spaces
        .replace(/[:.,/#!$%^&*;'"{}=\-_`~()@[\]\\+<>?|]/g, '')  // 3. Remove special characters
        .replace(/\s+/g, '-')                // 4. Replace spaces (and multiple spaces) with hyphens
        .replace(/-+/g, '-');                // 5. Collapse multiple hyphens into one
};


// The two search URLs toggled by double-clicking a table. Configured at build
// time via REACT_APP_SEARCH_LINK_1 / _2 so they can be changed without a code
// change (see frontend/Dockerfile build args, docker-compose.yml, Jenkinsfile).
export const searchlink1 = process.env.REACT_APP_SEARCH_LINK_1 || 'http://localhost/search.php?q=';
export const searchlink2 = process.env.REACT_APP_SEARCH_LINK_2 || 'http://127.0.0.1/search.php?q=';
export const urllink1 = 'https://www.thetvdb.com';
export const urllink2 = 'http://localhost:9091/';

export const handleKodiClick = async () => {
        try {
            const response = await fetch('/api/user/kodirefresh', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}`);
            }
            alert(`Kodi Refresh responded with ${response.status}`);
            const result = await response.json();
            console.log('Kodi command executed:', result);
            // Optionally show a toast or alert
        } catch (error) {
            console.error('Error calling Kodi backend:', error);
            alert('Failed to run Kodi command');
        }
    };


