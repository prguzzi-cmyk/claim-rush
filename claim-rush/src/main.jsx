import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'

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
