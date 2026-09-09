import React, { useState, useEffect } from 'react';
import { Settings, Save, CheckCircle2, AlertCircle } from 'lucide-react';

export default function SettingsPage() {
  const [keys, setKeys] = useState({
    google: '',
    anthropic: '',
    groq: '',
    openai: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    // Fetch current keys (masked) from backend
    fetch('https://tradingagents-dg06.onrender.com/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          setKeys(data.keys);
        }
        setLoading(false);
      })
      .catch(err => {
        setMessage({ type: 'error', text: 'Failed to load settings.' });
        setLoading(false);
      });
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('https://tradingagents-dg06.onrender.com/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(keys)
      });
      const data = await res.json();
      
      if (res.ok) {
        setMessage({ type: 'success', text: 'API keys saved successfully to .env' });
      } else {
        throw new Error(data.error || 'Failed to save');
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleClearCache = async () => {
    try {
      setMessage(null);
      await fetch('https://tradingagents-dg06.onrender.com/api/clear_cache', { method: 'POST' });
      setMessage({ type: 'success', text: 'Backend cache cleared and processes reset successfully.' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to clear cache.' });
    }
  };

  if (loading) {
    return <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem' }}>Loading Settings...</div>;
  }

  return (
    <div className="glass-panel" style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem', animation: 'fadeIn 0.4s ease-out' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
        <Settings size={28} className="text-gradient" />
        <h2 style={{ margin: 0 }}>API Configuration</h2>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        <div className="input-group">
          <label className="input-label" htmlFor="openai">OpenAI API Key</label>
          <input
            type="password"
            id="openai"
            className="glass-input"
            value={keys.openai}
            onChange={(e) => setKeys({...keys, openai: e.target.value})}
            placeholder="sk-..."
          />
        </div>

        <div className="input-group">
          <label className="input-label" htmlFor="anthropic">Anthropic API Key</label>
          <input
            type="password"
            id="anthropic"
            className="glass-input"
            value={keys.anthropic}
            onChange={(e) => setKeys({...keys, anthropic: e.target.value})}
            placeholder="sk-ant-..."
          />
        </div>

        <div className="input-group">
          <label className="input-label" htmlFor="google">Google API Key (Gemini)</label>
          <input
            type="password"
            id="google"
            className="glass-input"
            value={keys.google}
            onChange={(e) => setKeys({...keys, google: e.target.value})}
            placeholder="AIza..."
          />
        </div>

        <div className="input-group">
          <label className="input-label" htmlFor="groq">Groq API Key</label>
          <input
            type="password"
            id="groq"
            className="glass-input"
            value={keys.groq}
            onChange={(e) => setKeys({...keys, groq: e.target.value})}
            placeholder="gsk_..."
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          <button type="submit" className="glass-button" disabled={saving}>
            {saving ? <div className="loading-spinner" style={{ width: '20px', height: '20px' }}></div> : <Save size={20} />}
            Save API Keys
          </button>
          
          <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.1)', margin: '0.5rem 0' }}></div>
          
          <button type="button" className="glass-button" onClick={handleClearCache} style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
            <AlertCircle size={20} />
            Reset Backend
          </button>
        </div>
      </form>

      {message && (
        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          borderRadius: '8px',
          background: message.type === 'success' ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 71, 87, 0.1)',
          border: `1px solid ${message.type === 'success' ? 'var(--accent)' : 'var(--danger)'}`,
          color: message.type === 'success' ? 'var(--accent)' : 'var(--danger)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          {message.text}
        </div>
      )}
    </div>
  );
}
