import React from 'react';
import { WelcomeWizard } from './WelcomeWizard';

const slides = [
  {
    visual: (
      <div className="ww-visual">
        <img
          src="/tvkodbdi_white.jpg"
          alt="TheTVDB Kodi"
          style={{ height: 80, width: 'auto', borderRadius: 8 }}
        />
      </div>
    ),
    headline: 'Welcome to TheTVDB Kodi Dashboard',
    body: (
      <ul>
        <li>Track upcoming episodes for all your favourite shows in one place</li>
        <li>See ended shows and when they last aired</li>
        <li>Monitor active runtimes — how long until your next unwatched episode</li>
        <li>Trigger a Kodi library refresh directly from the dashboard</li>
        <li>Double-click show names to search across two configurable search engines</li>
      </ul>
    ),
  },
  {
    visual: (
      <div className="ww-visual">
        <div className="ww-icon-circle" style={{ gap: 6 }}>
          <img
            src="/kodi.png"
            alt="Kodi"
            style={{ height: 48, width: 48, objectFit: 'contain' }}
          />
        </div>
      </div>
    ),
    headline: 'Powered by TheTVDB, TMDb & Kodi',
    body: (
      <ul>
        <li><strong>TheTVDB</strong> provides episode schedules, air dates, and show metadata</li>
        <li><strong>TMDb</strong> supplements with additional show and episode details</li>
        <li><strong>Kodi</strong> reports your library state and last-played positions via JSON-RPC</li>
        <li>Backend caches responses with a TTL so the dashboard stays snappy even if APIs are slow</li>
        <li>Browser localStorage gives instant loads on repeat visits, with a cache-age banner when data is stale</li>
      </ul>
    ),
  },
  {
    visual: (
      <div className="ww-visual">
        <div className="ww-icon-circle">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="44"
            height="44"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#52525b"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        </div>
      </div>
    ),
    headline: 'Built with solid engineering patterns',
    body: (
      <ul>
        <li><strong>React 19 + CRA</strong> frontend served by Nginx in production</li>
        <li><strong>Node.js backend</strong> with file-based TTL cache — no database required</li>
        <li><strong>Kubernetes on k3s</strong> — self-hosted on a Raspberry Pi cluster</li>
        <li><strong>GitHub Actions CI</strong> with Vitest unit tests and automated Docker builds</li>
        <li>1-hour polling interval with visibility-change listener for background-tab efficiency</li>
      </ul>
    ),
  },
  {
    visual: (
      <div className="ww-visual">
        <div className="ww-icon-circle ww-icon-circle--emerald">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="44"
            height="44"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#059669"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      </div>
    ),
    headline: "You're all set",
    body: (
      <div>
        <ul>
          <li>Your favourites load automatically from your configured TheTVDB account.</li>
          <li>Use the tabs to switch between upcoming episodes, ended shows, and active runtimes.</li>
        </ul>
        <div className="ww-disclaimer">
          <strong>Note:</strong> This is a portfolio project demonstrating self-hosted TV tracking with TheTVDB, TMDb, and Kodi integrations deployed on a home Kubernetes cluster.
        </div>
      </div>
    ),
  },
];

export function TVKodiWelcomeWizard() {
  return <WelcomeWizard slides={slides} sessionKey="tvkodi_welcome_seen" />;
}
