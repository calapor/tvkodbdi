import React, { useState, useEffect } from 'react';
import CurrentShows from './currentShows';
import EndedShows from './endedShows';
import ActiveRuntimes from './activeRuntimes';
import '../App.css';


const POLL_INTERVAL_MS = 3600 * 1000; // 1 hour

function TVKodiApp() {
    const [favorites, setFavorites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('currentshows')
    const [runtimeData, setRuntimeData] = useState([]);
    const [runtimeLoading, setRuntimeLoading] = useState(true);

    useEffect(() => {
        const cachedFavorites = localStorage.getItem('favorites');
        if (cachedFavorites) {
            setFavorites(JSON.parse(cachedFavorites));
            setLoading(false); // show data immediately
        } else {
            setLoading(true); // show loading when no cached data
        }
        const fetchFavorites = () => {
            //fetch(`${process.env.REACT_APP_BACKEND_URL}/user/favorites`)
            fetch('/api/user/favorites')
                .then((res) => res.json())
                .then((data) => {
                    setFavorites(data); // adjust based on your actual response
                    localStorage.setItem('favorites', JSON.stringify(data)); // cache it
                    setLoading(false);
                })
                .catch((err) => {
                    console.error(err);
                    setLoading(false);
                });
        };
        // Fetch once immediately
        //fetchFavorites();
        //if (document.visibilityState === 'visible') {
        //    fetchFavorites();
       // }


        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchFavorites(); // or whatever function you'd like
            }
        };
        // Run on first load if visible
        if (document.visibilityState === 'visible') {
            fetchFavorites();
        }
        document.addEventListener('visibilitychange', handleVisibilityChange);
        // Cleanup on unmount
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };

        // Set up polling every xx seconds
        const intervalId = setInterval(fetchFavorites, POLL_INTERVAL_MS);

        // Clean up on unmount
        return () => clearInterval(intervalId);
    }, []);


    useEffect(() => {
        const cachedRuntimeData = localStorage.getItem('runtimeData');
        if (cachedRuntimeData) {
            setRuntimeData(JSON.parse(cachedRuntimeData));
            setRuntimeLoading(false); // show data immediately
        } else {
            setRuntimeLoading(true); // show loading when no cached data
        }
        const fetchRuntimeData = () => {
            fetch('/api/user/lastplayed')
                .then((res) => res.json())
                .then((data) => {
                    setRuntimeData(data); // adjust based on your actual response
                    localStorage.setItem('runtimeData', JSON.stringify(data)); // cache it

                    setRuntimeLoading(false);
                })
                .catch((err) => {
                    console.error(err);
                    setRuntimeLoading(false);
                });
        };
        // Fetch once immediately
        //fetchFavorites();
        //if (document.visibilityState === 'visible') {
        //    fetchRuntimeData();
       // }

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchRuntimeData(); // or whatever function you'd like
            }
        };
        // Run on first load if visible
        if (document.visibilityState === 'visible') {
            fetchRuntimeData();
        }
        document.addEventListener('visibilitychange', handleVisibilityChange);
        // Cleanup on unmount
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };

        // Set up polling every xx seconds
        const intervalId = setInterval(fetchRuntimeData, POLL_INTERVAL_MS);
        // Clean up on unmount
        return () => clearInterval(intervalId);
    }, []);






    return (
        <div className="App">

            <div className="tab-buttons">
                <button
                    className={activeTab === 'currentshows' ? 'tab active' : 'tab'}
                    onClick={() => setActiveTab('currentshows')}
                >
                    Upcoming Shows
                </button>
                <button
                    className={activeTab === 'endedshows' ? 'tab active' : 'tab'}
                    onClick={() => setActiveTab('endedshows')}
                >
                    Ended Shows
                </button>
                <button
                    className={activeTab === 'runtimedata' ? 'tab active' : 'tab'}
                    onClick={() => setActiveTab('runtimedata')}
                >
                    Active Show Runtimes
                </button>
            </div>


            {/* Conditionally render the tab component and pass props */}
            <div className="tab-content">
                {activeTab === 'currentshows' && (
                    <CurrentShows favorites={favorites} loading={loading}/>
                )}
                {activeTab === 'endedshows' && (
                    <EndedShows favorites={favorites} loading={loading}/>
                )}
                {activeTab === 'runtimedata' && (
                    <ActiveRuntimes runtimeData={runtimeData} runtimeLoading={runtimeLoading}/>
                )}
            </div>
        </div>
    );
}

export default TVKodiApp;