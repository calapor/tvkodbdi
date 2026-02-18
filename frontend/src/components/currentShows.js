import React, { useState } from 'react';
import { formatDaysAgo } from '../utils/dateUtils';
import '../App.css';

import { searchlink1,
         searchlink2,
         urllink1,
         urllink2,
         handleKodiClick,
    slugify
       } from '../utils/common';





export default function CurrentShows({ favorites, loading }) {

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
            {/*
            < p style={{ fontStyle: 'italic', fontSize: '0.9rem', textAlign: 'right', margin: '0 20px' }}>
                Link domain: {downloadDomain} (double-click to toggle)
            </p>
            */}

            <h1>Upcoming Episodes </h1>
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
                        <th>Next Aired</th>
                        <th>Days until</th>
                    </tr>
                    </thead>
                    <tbody>
                    {favorites
                        .filter(series =>
                            series.nextAiredDate &&
                            !isNaN(new Date(series.nextAiredDate)) &&
                            series.status?.name?.toLowerCase() !== 'ended'
                        )
                        .sort((a, b) => new Date(a.nextAiredDate) - new Date(b.nextAiredDate))
                        .map((series) => {
                            const today = new Date();
                            const nextAiredDate = new Date(series.nextAiredDate);
                            const lastAiredDate = new Date(series.lastAiredDate);

                            let lastSeason = series.lastEpisode?.season ?? null;
                            let lastEpisode = series.lastEpisode?.episode ?? null;
                            let localSeason = series.mostRecentLocal?.season ?? null;
                            let localEpisode = series.mostRecentLocal?.episode ?? null;

                            let daysUntilNext = !isNaN(nextAiredDate)
                                ? Math.ceil((nextAiredDate - today) / (1000 * 60 * 60 * 24))
                                : null;

                            return (
                                <tr key={series.id}>

                                    <td>
                                        {
                                            // Construct href based on whether siteLink includes 'thetvdb'
                                            (() => {
                                                const isTVDB = siteLink.includes('thetvdb');
                                                const href = isTVDB
                                                    ? `${siteLink}/series/${(series.slug ? series.slug : series.name)}`
                                                    : siteLink;

                                                return (
                                                    <a
                                                        href={href}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{marginLeft: '6px', textDecoration: 'none'}}
                                                    >
                                                        <img src={series.image} alt={series.name}
                                                             className="poster-thumb"/>
                                                    </a>
                                                );
                                            })()
                                        }
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
                                    <td>{series.nextAiredDate}</td>
                                    <td className={daysUntilNext <= 3 ? 'days-soon' : ''}>
                                        {daysUntilNext !== null && daysUntilNext >= 0 ? `${daysUntilNext} days` : '-'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}

            <h1>Episode in last 30 days - no next air date </h1>
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
                        <th>Days Since Last</th>
                        <th>Series Status</th>
                    </tr>
                    </thead>
                    <tbody>
                    {favorites
                        .filter(series =>
                            series.nextAiredDate === null &&
                            series.daysSinceLastAired <= 30
                        )
                        .sort((a, b) => a.daysSinceLastAired - b.daysSinceLastAired)
                        .map((series) => {
                            const today = new Date();
                            const lastAiredDate = new Date(series.lastAiredDate);

                            const lastSeason = series.lastEpisode?.season ?? null;
                            const lastEpisode = series.lastEpisode?.episode ?? null;
                            const localSeason = series.mostRecentLocal?.season ?? null;
                            const localEpisode = series.mostRecentLocal?.episode ?? null;

                            const daysSinceLast = !isNaN(lastAiredDate)
                                ? Math.ceil((today - lastAiredDate) / (1000 * 60 * 60 * 24) * -1)
                                : null;

                            return (
                                <tr key={series.id}>

                                    <td>
                                        {
                                            // Construct href based on whether siteLink includes 'thetvdb'
                                            (() => {
                                                const isTVDB = siteLink.includes('thetvdb');
                                                const href = isTVDB
                                                    ? `${siteLink}/series/${(series.slug ? series.slug : series.name)}`
                                                    : siteLink;

                                                return (
                                                    <a
                                                        href={href}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{marginLeft: '6px', textDecoration: 'none'}}
                                                    >
                                                        <img src={series.image} alt={series.name}
                                                             className="poster-thumb"/>
                                                    </a>
                                                );
                                            })()
                                        }
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
                                    <td>{daysSinceLast ? `${daysSinceLast * -1} days ago` : '-'}</td>
                                    <td>{series.status}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}

            <h1>Series not ended - no next air date</h1>
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
                        <th>Days Since Last</th>
                    </tr>
                    </thead>
                    <tbody>
                    {favorites
                        .filter(series =>
                            series.nextAiredDate === null &&
                            series.status !== 'Ended'
                        )
                        .sort((a, b) => a.daysSinceLastAired - b.daysSinceLastAired)
                        .map((series) => {
                            const today = new Date();
                            const nextAiredDate = new Date(series.nextAiredDate);
                            const lastAiredDate = new Date(series.lastAiredDate);

                            let lastSeason = series.lastEpisode?.season ?? null;
                            let lastEpisode = series.lastEpisode?.episode ?? null;
                            let localSeason = series.mostRecentLocal?.season ?? null;
                            let localEpisode = series.mostRecentLocal?.episode ?? null;

                            const daysSinceLast = !isNaN(lastAiredDate)
                                ? Math.ceil((today - lastAiredDate) / (1000 * 60 * 60 * 24) * -1)
                                : null;


                            return (
                                <tr key={series.id}>

                                    <td>
                                        {
                                            // Construct href based on whether siteLink includes 'thetvdb'
                                            (() => {
                                                const isTVDB = siteLink.includes('thetvdb');
                                                const href = isTVDB
                                                    ? `${siteLink}/series/${(series.slug ? series.slug : series.name)}`
                                                    : siteLink;

                                                return (
                                                    <a
                                                        href={href}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{marginLeft: '6px', textDecoration: 'none'}}
                                                    >
                                                        <img src={series.image} alt={series.name}
                                                             className="poster-thumb"/>
                                                    </a>
                                                );
                                            })()
                                        }
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
                                    <td>
                                        {daysSinceLast !== null
                                            ? `${formatDaysAgo(daysSinceLast)} (${daysSinceLast * -1} days)`
                                            : '-'}
                                    </td>

                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}

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
