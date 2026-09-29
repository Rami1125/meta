import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register PWA Service Worker
if ('serviceWorker' in navigator && process.env.NODE_ENV !== 'development') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((reg) => console.log('ServiceWorker registered:', reg.scope))
      .catch((err) => console.log('ServiceWorker registration failed:', err));
  });
} else if ('serviceWorker' in navigator) {
  // Also register in dev to enable PWA installability prompts and testing
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((reg) => console.log('ServiceWorker active for PWA install testing:', reg.scope))
      .catch(() => {});
  });
}

createRoot(document.getElementById('root')!).render(<App />);
