import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Activity, Settings, History, LineChart, Menu, X, Moon, Sun, LogOut } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import SettingsPage from './pages/Settings';
import HistoryPage from './pages/History';
import './index.css';

// Common suffixes by country
const COUNTRY_SUFFIXES = {
  'US': '',
  'India': '.NS',
  'UK': '.L',
  'Canada': '.TO',
  'Australia': '.AX'
};

function Login({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (res.ok) {
        onLogin(password);
      } else {
        setError('Invalid password');
      }
    } catch (e) {
      setError('Failed to connect to server');
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg-color)' }}>
      <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', width: '300px' }}>
        <h2 style={{ margin: 0, textAlign: 'center' }}><LineChart size={24} style={{ display: 'inline', verticalAlign: 'text-bottom', color: 'var(--accent)' }}/> Login</h2>
        {error && <p style={{ color: 'var(--danger)', margin: 0, fontSize: '0.9rem', textAlign: 'center' }}>{error}</p>}
        <input 
          type="password" 
          value={password} 
          onChange={e => setPassword(e.target.value)} 
          placeholder="Master Password" 
          style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }} 
        />
        <button type="submit" disabled={loading} className="analyze-btn" style={{ marginTop: '0.5rem' }}>
          {loading ? 'Verifying...' : 'Unlock Dashboard'}
        </button>
      </form>
    </div>
  );
}

function Navigation({ onLogout, theme, toggleTheme }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  
  return (
    <nav className="top-nav">
      <Link to="/" className="nav-brand">
        <LineChart size={28} style={{ color: 'var(--accent)' }} />
        Trading Agents
      </Link>
      
      <button className="mobile-menu-btn" onClick={() => setMobileOpen(!mobileOpen)}>
        {mobileOpen ? <X size={28} /> : <Menu size={28} />}
      </button>

      <div className={`nav-links ${mobileOpen ? 'mobile-open' : ''}`}>
        <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`} onClick={() => setMobileOpen(false)}>
          <Activity size={18} /> Dashboard
        </Link>
        <Link to="/history" className={`nav-link ${location.pathname === '/history' ? 'active' : ''}`} onClick={() => setMobileOpen(false)}>
          <History size={18} /> History
        </Link>
        <Link to="/settings" className={`nav-link ${location.pathname === '/settings' ? 'active' : ''}`} onClick={() => setMobileOpen(false)}>
          <Settings size={18} /> Settings
        </Link>
        
        <button onClick={toggleTheme} className="nav-link" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
          {theme === 'dark' ? <><Sun size={18} /> Light Mode</> : <><Moon size={18} /> Dark Mode</>}
        </button>

        <button onClick={() => { onLogout(); setMobileOpen(false); }} className="nav-link" style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
          <LogOut size={18} /> Logout
        </button>
      </div>
    </nav>
  );
}

function App() {
  const [authToken, setAuthToken] = useState(localStorage.getItem('app_password') || null);
  const [theme, setTheme] = useState(localStorage.getItem('app_theme') || 'dark');

  useEffect(() => {
    document.body.className = theme === 'light' ? 'light-theme' : '';
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('app_theme', newTheme);
  };

  const handleLogin = (password) => {
    localStorage.setItem('app_password', password);
    setAuthToken(password);
  };

  const handleLogout = () => {
    localStorage.removeItem('app_password');
    setAuthToken(null);
  };

  // --- GLOBAL STATE ---
  const [ticker, setTicker] = useState('NIFTY50');
  const [country, setCountry] = useState('India');
  const [tradeDate, setTradeDate] = useState(new Date().toISOString().split('T')[0]);
  const [researchDepth, setResearchDepth] = useState('shallow');
  const [assetType, setAssetType] = useState('stock');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [agentProgress, setAgentProgress] = useState({});
  const [activeAgent, setActiveAgent] = useState(null);
  const [logs, setLogs] = useState([]);
  
  // Timer State
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  
  const abortController = useRef(null);
  const timerInterval = useRef(null);

  // Stop timer helper
  const stopTimer = () => {
    if (timerInterval.current) {
      clearInterval(timerInterval.current);
      timerInterval.current = null;
    }
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (loading) return; 
    
    let formattedTicker = ticker.toUpperCase();
    if (country === 'India' && formattedTicker === 'NIFTY50') {
      formattedTicker = '^NSEI';
    } else {
      const suffix = COUNTRY_SUFFIXES[country] || '';
      formattedTicker = formattedTicker + suffix;
    }
    
    setLoading(true);
    setError(null);
    setResult(null);
    setAgentProgress({});
    setActiveAgent(null);
    setElapsedSeconds(0);
    setLogs([]);
    
    // Start timer
    timerInterval.current = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    
    abortController.current = new AbortController();

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/analyze`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ ticker: formattedTicker, trade_date: tradeDate, research_depth: researchDepth, asset_type: assetType }),
        signal: abortController.current.signal
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to analyze');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              
              if (data.status === 'node_finished') {
                setAgentProgress(prev => ({ ...prev, [data.node]: 'completed' }));
                setActiveAgent(null);
              } else if (data.status === 'node_started') {
                setAgentProgress(prev => ({ ...prev, [data.node]: 'in_progress' }));
                setActiveAgent(data.node);
              } else if (data.status === 'rate_limited') {
                setAgentProgress(prev => ({ ...prev, [data.node]: 'waiting' }));
              } else if (data.status === 'log') {
                setLogs(prev => [...prev, `[${data.node}] ${data.message}`]);
              } else if (data.status === 'completed') {
                setResult({ ticker: formattedTicker, final_trade_decision: true, summary: data.summary });
                stopTimer();
              } else if (data.error) {
                setError(data.error);
                setLoading(false);
                stopTimer();
                return;
              }
            } catch (e) {
              console.error("Error parsing SSE JSON:", e);
            }
          }
        }
      }
    } catch (err) {
      stopTimer();
      if (err.name === 'AbortError') {
        setError('Analysis cancelled by user.');
      } else if (err.message.includes('fetch')) {
        setError('Network Error: Cannot connect to the local Python backend server.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
      stopTimer();
      abortController.current = null;
    }
  };

  const handleCancel = async () => {
    if (abortController.current) {
      abortController.current.abort();
      
      try {
        await fetch(`${import.meta.env.VITE_API_URL || ''}/api/cancel`, { 
          method: 'POST',
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
      } catch (e) {
        console.error("Failed to cancel backend", e);
      }
      
      setError('Analysis cancelled by user.');
      setLoading(false);
      stopTimer();
    }
  };

  const dashboardProps = {
    ticker, setTicker,
    country, setCountry,
    tradeDate, setTradeDate,
    researchDepth, setResearchDepth,
    assetType, setAssetType,
    handleAnalyze, handleCancel,
    loading, result, error,
    agentProgress, activeAgent,
    elapsedSeconds, logs,
    COUNTRY_SUFFIXES
  };

  if (!authToken) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <BrowserRouter>
      <div className="app-container">
        <Navigation onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} />

        <Routes>
          <Route path="/" element={<Dashboard {...dashboardProps} />} />
          <Route path="/history" element={<HistoryPage authToken={authToken} />} />
          <Route path="/settings" element={<SettingsPage authToken={authToken} />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
