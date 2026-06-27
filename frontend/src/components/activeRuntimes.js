import React from 'react';
import { formatDaysAgo } from '../utils/dateUtils';
import '../App.css'; // or './App.css' depending on file location


export default function ActiveRuntimes({runtimeData, runtimeLoading}) {

    return (
        <>
                <h1>Next Episode - Runtimes </h1>
                {runtimeLoading ? (
                    <p>Loading...</p>
                ) : (
                    <table className="series-table">
                        <thead>
                        <tr>
                            <th>Thumb</th>
                            <th>Name</th>
                            <th>Next Episode</th>
                            <th>Runtime</th>
                        </tr>
                        </thead>
                        <tbody>
                        {(Array.isArray(runtimeData) ? runtimeData : []).filter(series =>
                            series.lastplayed &&
                            series.nextUnwatched)
                            .sort((a, b) => new Date(b.lastplayed) - new Date(a.lastplayed))
                            .map((series) => {
                                const today = new Date();
                                const lastplayedDate = new Date(series.lastplayed);
                                const image = series.image || 'https://via.placeholder.com/100x150?text=No+Image';
                                let localNextSeason = null;
                                let localName = null
                                let localNextEpisode = null;
                                let localNextRuntime = null;
                                let formattedRuntime = null;
                                let finaleType = null;
                                let localNextEpisodeFinaleType = null;

                                if (series.nextUnwatched && series.nextUnwatched.season && series.nextUnwatched.episode) {
                                    localNextSeason = series.nextUnwatched.season;
                                    localNextEpisode = series.nextUnwatched.episode;
                                    localNextRuntime = series.nextUnwatched.runtime;
                                    formattedRuntime = localNextRuntime ? Math.round(localNextRuntime / 60) : 'N/A'; // Convert seconds to minutes
                                    if (series.nextUnwatched.finaleType) {
                                        const finaleType = series.nextUnwatched.finaleType;
                                        if (finaleType === 'series') {
                                            localNextEpisodeFinaleType = 'Series Finale';
                                        } else if (finaleType === 'season') {
                                            localNextEpisodeFinaleType = 'Season Finale';
                                        }
                                    }
                                    if (!localNextEpisodeFinaleType) {
                                        localNextEpisodeFinaleType = '';
                                    }
                                }



                                let localImage = series.image;
                                let daysSinceLast = null;
                                localName = series.showtitle
                                if (!isNaN(lastplayedDate)) {
                                    const diffTime = today - lastplayedDate;
                                    daysSinceLast = Math.ceil(diffTime / (1000 * 60 * 60 * 24) * -1);
                                }

                                return (
                                    <tr key={series.id} className={getRuntimeClass(formattedRuntime)}><td><img
                                            src={localImage}
                                            alt={`${localName} poster`}
                                            className="poster-thumb"
                                        />
                                        </td>
                                        <td>{localName}</td>
                                        <td>

                                            {localNextSeason != null && localNextEpisode != null ? `S${localNextSeason}E${localNextEpisode} ${localNextEpisodeFinaleType}` : ''}
                                        </td>

                                        <td>{formattedRuntime} Minutes</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}

        </>

    );



    function getRuntimeClass(runtime) {
        if (runtime <= 30) return 'row-short';
        if (runtime <= 40) return 'row-medium-short';
        if (runtime <= 50) return 'row-medium';
        return 'row-long';
    }

}
