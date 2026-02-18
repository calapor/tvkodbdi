import React, {useState} from 'react';
import { formatDaysAgo } from '../utils/dateUtils';
import '../App.css'; // or './App.css' depending on file location


import { searchlink1,
    searchlink2,
    urllink1,
    urllink2,
    handleKodiClick,
    slugify
} from '../utils/common';


export default function EndedShows({ favorites, loading }) {
    const [downloadDomain, setDownloadDomain] = useState(searchlink1);
    const [siteLink, setUrlLink] = useState(urllink1);
    const isTheTVDB = siteLink.includes('thetvdb');
    const handleDoubleClick = () => {
        setDownloadDomain(prev =>
            prev === searchlink1 ? searchlink2 : searchlink1);
        setUrlLink(prev =>
            prev === urllink1 ? urllink2 : urllink1);
    };
    return (
        <div onDoubleClick={handleDoubleClick}>
            <>


                <h1>All Favourited Series ended</h1>
                {loading ? (
                    <p>Loading...</p>
                ) : (
                    <table className="series-table">
                        <thead>
                        <tr>
                            <th>Thumb</th>
                            <th>Name</th>
                            <th>Last Aired</th>
                            <th>Last Episode</th>
                            <th>Last Downloaded Episode</th>
                            <th>Days since last</th>
                        </tr>
                        </thead>
                        <tbody>
                        {favorites.filter(series => (series.status === 'Ended'))
                            // .filter(series => (series.status.name !== 'Ended'))
                            .sort((a, b) => a.daysSinceLastAired - b.daysSinceLastAired)
                            .map((series) => {
                                const today = new Date();
                                console.log(series.nextAiredDate);
                                const lastAiredDate = new Date(series.lastAiredDate);
                                let daysSinceLast = null;
                                let lastSeason = series.lastEpisode?.season ?? null;
                                let lastEpisode = series.lastEpisode?.episode ?? null;
                                let localSeason = series.mostRecentLocal?.season ?? null;
                                let localEpisode = series.mostRecentLocal?.episode ?? null;

                                if (!isNaN(lastAiredDate)) {
                                    const diffTime = today - lastAiredDate;
                                    daysSinceLast = Math.ceil(diffTime / (1000 * 60 * 60 * 24) * -1);
                                    console.log(daysSinceLast);
                                }

                                return (
                                    <tr key={series.id}>
                                        <td><img
                                            src={series.image}
                                            alt={`${series.name} poster`}
                                            className="poster-thumb"
                                        />
                                        </td>
                                        <td>{series.name}</td>
                                        <td>{series.lastAiredDate}</td>
                                        <td>{lastSeason && lastEpisode ? `S${lastSeason}E${lastEpisode}` : ''}</td>
                                        <td>
                                            {localSeason && localEpisode ? (
                                                <>
                                                    {`S${localSeason}E${localEpisode}`}
                                                    {(lastEpisode > localEpisode || lastSeason > localSeason) && (
                                                        <a
                                                            href={`${downloadDomain}${series.name.replace(/\s+/g, '-').toLowerCase()}-megusta-x265`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            style={{marginLeft: '6px', textDecoration: 'none'}}
                                                        >
                                                            ⚠️
                                                        </a>
                                                    )}
                                                </>
                                            ) : (
                                                <a
                                                    href={`${downloadDomain}${series.name.replace(/\s+/g, '-').toLowerCase()}-megusta-x265`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{marginLeft: '6px', textDecoration: 'none'}}
                                                >
                                                    ⚠️
                                                </a>
                                            )}
                                        </td>
                                        <td>{formatDaysAgo(daysSinceLast)} ({daysSinceLast * -1} days)</td>

                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}

            </>
            <div className="bottom-left-link" onClick={handleKodiClick} title="Run Kodi Refresh">
                <img
                    src="/kodi.png"
                    alt="Run Kodi"
                    className="bottom-left-image"
                />
            </div>
        </div>
    );
}



