import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Activity, Settings, History, LineChart } from 'lucide-react';
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

function Navigation() {
  const location = useLocation();
  
  return (
    <nav className="glass-panel" style={{ display: 'flex', gap: '1rem', padding: '0.5rem 1rem', marginBottom: '2rem', borderRadius: '99px', width: 'fit-content', margin: '0 auto 2rem auto' }}>
      <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>
        <Activity size={18} /> Dashboard
      </Link>
      <Link to="/history" className={`nav-link ${location.pathname === '/history' ? 'active' : ''}`}>
        <History size={18} /> History
      </Link>
      <Link to="/settings" className={`nav-link ${location.pathname === '/settings' ? 'active' : ''}`}>
        <Settings size={18} /> Settings
      </Link>
    </nav>
  );
}

function App() {
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
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        await fetch('/api/cancel', { method: 'POST' });
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

  return (
    <BrowserRouter>
      <div className="app-container">
        <header className="header" style={{ padding: '2rem 0 1rem 0' }}>
          <h1 className="text-gradient" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
            <LineChart size={48} style={{ color: 'var(--accent)' }} />
            Trading Agents
          </h1>
          <p>AI-Powered Multi-Agent Financial Research Framework</p>
        </header>

        <Navigation />

        <Routes>
          <Route path="/" element={<Dashboard {...dashboardProps} />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
