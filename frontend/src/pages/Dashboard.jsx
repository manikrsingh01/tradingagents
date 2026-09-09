import React from 'react';
import { Activity, Zap, Server, CheckCircle2, XCircle, Globe, Hash } from 'lucide-react';

export default function Dashboard({
  ticker, setTicker,
  country, setCountry,
  tradeDate, setTradeDate,
  researchDepth, setResearchDepth,
  assetType, setAssetType,
  loading, result, error,
  agentProgress, activeAgent,
  elapsedSeconds, logs,
  handleAnalyze, handleCancel,
  COUNTRY_SUFFIXES
}) {

  // Helper to format seconds to MM:SS
  const formatTime = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Helper to calculate progress
  const completedCount = Object.values(agentProgress).filter(status => status === 'completed').length;
  const totalSteps = 7; // Approx number of agents
  const progressPercent = Math.min(100, Math.round((completedCount / totalSteps) * 100));

  return (
    <div className="dashboard-grid">
      <aside className="control-panel glass-panel">
        <h2><Zap size={24} style={{ display: 'inline', verticalAlign: 'text-bottom', color: 'var(--accent)' }} /> Configuration</h2>
        <form onSubmit={handleAnalyze} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="input-group">
            <label className="input-label" htmlFor="country"><Globe size={14} style={{ display: 'inline' }}/> Market / Country</label>
            <select
              id="country"
              className="glass-input"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              disabled={loading}
            >
              <option value="US">🇺🇸 United States</option>
              <option value="India">🇮🇳 India (.NS)</option>
              <option value="UK">🇬🇧 United Kingdom (.L)</option>
              <option value="Canada">🇨🇦 Canada (.TO)</option>
              <option value="Australia">🇦🇺 Australia (.AX)</option>
            </select>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="ticker"><Hash size={14} style={{ display: 'inline' }}/> Stock Symbol</label>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <input
                type="text"
                id="ticker"
                className="glass-input"
                style={{ flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder={country === 'India' ? "e.g. RELIANCE" : "e.g. NVDA"}
                disabled={loading}
                required
              />
              <div className="glass-input" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', borderLeft: 'none', borderTopLeftRadius: 0, borderBottomLeftRadius: 0, paddingLeft: '0.5rem', paddingRight: '1rem', height: '100%', display: 'flex', alignItems: 'center' }}>
                {COUNTRY_SUFFIXES[country] || ' '}
              </div>
            </div>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="assetType">Asset Type</label>
            <select
              id="assetType"
              className="glass-input"
              value={assetType}
              onChange={(e) => setAssetType(e.target.value)}
              disabled={loading}
            >
              <option value="stock">Stock</option>
              <option value="index">Index</option>
              <option value="etf">ETF</option>
              <option value="crypto">Crypto</option>
            </select>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="date">Analysis Date</label>
            <input
              type="date"
              id="date"
              className="glass-input"
              value={tradeDate}
              onChange={(e) => setTradeDate(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="depth">Research Depth</label>
            <select
              id="depth"
              className="glass-input"
              value={researchDepth}
              onChange={(e) => setResearchDepth(e.target.value)}
              disabled={loading}
            >
              <option value="shallow">Shallow (1 Round)</option>
              <option value="medium">Medium (3 Rounds)</option>
              <option value="deep">Deep (5 Rounds)</option>
            </select>
          </div>

          {!loading ? (
            <button type="submit" className="glass-button">
              <Activity size={20} /> Run Agents
            </button>
          ) : (
            <button type="button" className="glass-button" onClick={handleCancel} style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
              <XCircle size={20} /> Cancel Analysis
            </button>
          )}
        </form>

        {error && (
          <div className="result-card" style={{ borderColor: 'var(--danger)', marginTop: '1rem' }}>
            <h3 style={{ color: 'var(--danger)' }}>Error / Stopped</h3>
            <p>{error}</p>
          </div>
        )}
      </aside>

      <main className="results-panel glass-panel">
        {!result && !loading && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <Server size={64} style={{ opacity: 0.2, marginBottom: '1rem' }} />
            <h3>System Idle</h3>
            <p>Select a market, enter a stock symbol, and run the agents.</p>
          </div>
        )}

        {loading && !result && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '1.5rem' }}>
              <div className="loading-spinner" style={{ width: '48px', height: '48px', borderWidth: '4px' }}></div>
              <div style={{ textAlign: 'center', background: 'rgba(0,0,0,0.3)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.2rem' }}>Elapsed Time</div>
                <div style={{ fontSize: '1.5rem', fontFamily: 'monospace', color: 'var(--accent)' }}>{formatTime(elapsedSeconds)}</div>
              </div>
            </div>
            
            <h3 className="text-gradient">Agents Debating...</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>This may take a few minutes. Check the progress below.</p>
            
            <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', padding: '1rem', background: 'rgba(0,0,0,0.4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ color: 'var(--accent-secondary)' }}>Live Progress</h4>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', background: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.6rem', borderRadius: '12px' }}>
                  {progressPercent}% Complete
                </span>
              </div>
              
              <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', marginBottom: '1rem', overflow: 'hidden' }}>
                <div style={{ width: `${progressPercent}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent), var(--accent-secondary))', transition: 'width 0.5s ease-out' }}></div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {Object.entries(agentProgress).map(([node, status]) => (
                  <div key={node} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                    <span style={{ color: 'var(--text-main)', textTransform: 'capitalize' }}>{node.replace(/_/g, ' ')}</span>
                    {status === 'completed' ? (
                      <span style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}><CheckCircle2 size={16} /> Done</span>
                    ) : status === 'waiting' ? (
                      <span style={{ color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}><AlertCircle size={16} /> Rate Limit Pause</span>
                    ) : (
                      <span style={{ color: 'var(--accent-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}><div className="loading-spinner" style={{ width: '12px', height: '12px', borderWidth: '2px' }}></div> Active</span>
                    )}
                  </div>
                ))}

              {/* Terminal Logs Window */}
              {logs && logs.length > 0 && (
                <div
                  ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}
                  style={{
                  marginTop: '1.5rem',
                  padding: '0.75rem',
                  background: 'rgba(0, 0, 0, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  maxHeight: '150px',
                  overflowY: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  color: 'rgba(255, 255, 255, 0.8)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  {logs.map((log, i) => (
                    <div key={i} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '4px' }}>
                      {log}
                    </div>
                  ))}
                </div>
              )}
              
              {Object.keys(agentProgress).length === 0 && (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', display: 'block', padding: '1rem' }}>Initializing LangGraph framework...</span>
              )}
            </div>
          </div>
        </div>
        )}

        {result && (
          <div style={{ animation: 'fadeInDown 0.6s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2>Analysis Results for {result.ticker}</h2>
              <span className={`status-badge status-bullish`}>
                COMPLETE
              </span>
            </div>

            <div className="result-card">
              <h3><CheckCircle2 size={20} /> Final Trade Decision</h3>
              <div className="markdown-body" style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.9rem', color: 'var(--text-main)', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', maxHeight: '500px', overflowY: 'auto' }}>
                {result.summary || "The TradingAgents framework successfully evaluated the asset. The full detailed report is saved locally."}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
