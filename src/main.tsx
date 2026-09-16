import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (typeof document !== 'undefined') {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    createRoot(rootElement)?.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  }
}

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker?.register('/sw.js')?.catch(error => {
      console.warn('Brutal Fist PWA service worker unavailable:', error);
    });
  });
}
