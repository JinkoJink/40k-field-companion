import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { DiagnosticsButton } from './DiagnosticsButton';
import { initializeResponsiveTiles } from './responsiveTiles';
import './styles.css';
import './responsiveTiles.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('./sw.js', window.location.href), {updateViaCache: 'none'}).catch(console.error);
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <DiagnosticsButton />
  </React.StrictMode>
);

initializeResponsiveTiles();
