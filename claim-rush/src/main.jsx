import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'

// Defensively unregister ANY service worker still installed from a previous
// deploy — old SWs have been observed intercepting fetches and serving a
// stale bundle that redirects /portal/rin/* to rin.aciunited.com. Current
// builds do not register a SW; this block only cleans up residue.
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => {
      r.unregister().then(ok => {
        if (ok) console.info('[sw] unregistered stale service worker:', r.scope);
      });
    });
  }).catch(() => {});
  // Clear any Cache Storage entries left over from those SWs.
  if ('caches' in window) {
    caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {});
  }
}

// Disable Partytown/GTM if GTM_ID is not configured — prevents Vercel
// analytics injection from crashing the app at runtime.
if (typeof window !== 'undefined') {
  window.__NEXT_DATA__ = window.__NEXT_DATA__ || {};
  if (!import.meta.env.VITE_GTM_ID && !window.dataLayer) {
    window.dataLayer = [];
    console.info('[Analytics] GTM_ID not configured — analytics disabled');
  }
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center', fontFamily: 'system-ui' }}>
          <h2>Something went wrong.</h2>
          <p style={{ color: '#888' }}>Please refresh the page or contact support.</p>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: 16, padding: '8px 24px', cursor: 'pointer' }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
