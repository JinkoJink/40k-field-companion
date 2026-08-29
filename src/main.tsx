import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { DiagnosticsButton } from './DiagnosticsButton';
import { initializeResponsiveTiles } from './responsiveTiles';\nimport {appConfig} from './appConfig';
import './styles.css';
import './responsiveTiles.css';\n\ndocument.title=`${appConfig.appName} — 40K Field Companion`;\nconst description=document.querySelector<HTMLMetaElement>('meta[name="description"]');\nif(description)description.content=`${appConfig.appName}: offline ${appConfig.factionName} army building, datasheets, and battle reference.`;\nconst appleTitle=document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');\nif(appleTitle)appleTitle.content=appConfig.appName;\nconst manifest=document.querySelector<HTMLLinkElement>('link[rel="manifest"]');\nif(manifest&&appConfig.factionId==='genestealer_cults')manifest.href='./broodmind.webmanifest';

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
