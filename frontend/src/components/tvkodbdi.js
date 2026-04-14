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
    const [favoritesFromCache, setFavoritesFromCache] = useState(false);
    const [runtimeFromCache, setRuntimeFromCache] = useState(false);
    const [favoritesError, setFavoritesError] = useState(false);
    const [runtimeError, setRuntimeError] = useState(false);

    useEffect(() => {
        const cachedFavorites = localStorage.getItem('favorites');
        if (cachedFavorites) {
            const parsed = JSON.parse(cachedFavorites);
            setFavorites(Array.isArray(parsed) ? parsed : []);
            setLoading(false);
        } else {
            setLoading(true);
        }

        const fetchFavorites = () => {
            fetch('/user/favorites')
                .then((res) => {
                    if (!res.ok) {
                        setFavoritesError(true);
                        setLoading(false);
                        return;
                    }
                    setFavoritesError(false);
                    return res.json();
                })
                .then((data) => {
                    if (!data) return;
                    const raw = data.fromCache ? data.data : data;
                    const safe = Array.isArray(raw) ? raw : []; // ✅ guard API response
                    setFavorites(safe);
                    setFavoritesFromCache(!!data.fromCache);
                    if (!data.fromCache) {
                        localStorage.setItem('favorites', JSON.stringify(safe));
                    }
                    setLoading(false);
                })
                .catch((err) => {
                    console.error(err);
                    setFavoritesError(true);
                    setLoading(false);
                });
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') fetchFavorites();
        };

        if (document.visibilityState === 'visible') fetchFavorites();

        document.addEventListener('visibilitychange', handleVisibilityChange);
        const intervalId = setInterval(fetchFavorites, POLL_INTERVAL_MS); // ✅ now reachable

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            clearInterval(intervalId); // ✅ single return handles both cleanups
        };
    }, []);


    useEffect(() => {
        const cachedRuntimeData = localStorage.getItem('runtimeData');
        if (cachedRuntimeData) {
            const parsed = JSON.parse(cachedRuntimeData);
            setRuntimeData(Array.isArray(parsed) ? parsed : []); // ✅ not just JSON.parse directly
            setRuntimeLoading(false);
        } else {
            setRuntimeLoading(true); // show loading when no cached data
        }
        const fetchRuntimeData = () => {
            fetch('/user/lastplayed')
                .then((res) => {
                    if (!res.ok) {
                        setRuntimeError(true);
                        setRuntimeLoading(false);
                        return;
                    }
                    setRuntimeError(false);
                    return res.json();
                })
                .then((data) => {
                    if (!data) return;
                    const parsed = data.fromCache ? data.data : data;
                    const safeData = Array.isArray(parsed) ? parsed : []; // ✅
                    setRuntimeData(safeData);
                    setRuntimeFromCache(!!data.fromCache);
                    if (!data.fromCache) {
                        localStorage.setItem('runtimeData', JSON.stringify(safeData));
                    }
                    setRuntimeLoading(false);
                })
                .catch((err) => {
                    console.error(err);
                    setRuntimeError(true);
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

            {(favoritesError || runtimeError) && (
                <div className="error-banner">
                    Unable to connect to live data source — backend or external service unreachable
                </div>
            )}

            {(favoritesFromCache || runtimeFromCache) && (
                <div className="cache-banner">
                    Showing cached data — live source unavailable
                </div>
            )}

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