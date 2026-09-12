import React, { useState, useEffect } from 'react';
import { Settings, Save, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function SettingsPage({ authToken }) {
  const [keys, setKeys] = useState({
    google: '',
    anthropic: '',
    groq: '',
    openai: '',
    deepseek: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [showKeys, setShowKeys] = useState(false);
  const [activeModel, setActiveModel] = useState('deepseek');

  useEffect(() => {
    // Fetch current keys (masked) from backend
    fetch(`${import.meta.env.VITE_API_URL || ''}/api/settings`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          setKeys(data.keys);
          if (data.active_model) setActiveModel(data.active_model);
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
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/settings`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ ...keys, active_model: activeModel })
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
      await fetch(`${import.meta.env.VITE_API_URL || ''}/api/clear_cache`, { 
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
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
          <label className="input-label" htmlFor="active_model">Active Model</label>
          <select 
            id="active_model" 
            className="glass-input" 
            value={activeModel}
            onChange={(e) => setActiveModel(e.target.value)}
          >
            <option value="omniai">⚡ OmniAI (Intelligent Auto-Fallback Router)</option>
            <option value="deepseek">DeepSeek (V3)</option>
            <option value="openai">OpenAI (GPT-4)</option>
            <option value="anthropic">Anthropic (Claude 3.5)</option>
            <option value="groq">Groq (Llama 3)</option>
            <option value="gemini">Google Gemini</option>
          </select>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-1rem' }}>
          <button type="button" onClick={() => setShowKeys(!showKeys)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            {showKeys ? <EyeOff size={16} /> : <Eye size={16} />}
            {showKeys ? 'Hide Keys' : 'Show Keys'}
          </button>
        </div>

        <div className="input-group">
          <label className="input-label" htmlFor="openai">OpenAI API Key</label>
          <input
            type={showKeys ? "text" : "password"}
            id="openai"
            className="glass-input"
            value={keys.openai}
            onChange={(e) => setKeys({...keys, openai: e.target.value})}
            placeholder="sk-..."
          />
        </div>
        
        <div className="input-group">
          <label className="input-label" htmlFor="deepseek">DeepSeek API Key</label>
          <input
            type={showKeys ? "text" : "password"}
            id="deepseek"
            className="glass-input"
            value={keys.deepseek}
            onChange={(e) => setKeys({...keys, deepseek: e.target.value})}
            placeholder="sk-..."
          />
        </div>

        <div className="input-group">
          <label className="input-label" htmlFor="anthropic">Anthropic API Key</label>
          <input
            type={showKeys ? "text" : "password"}
            id="anthropic"
            className="glass-input"
            value={keys.anthropic}
            onChange={(e) => setKeys({...keys, anthropic: e.target.value})}
            placeholder="sk-ant-..."
          />
        </div>

        <div className="input-group">
          <label className="input-label" htmlFor="groq">Groq API Key</label>
          <input
            type={showKeys ? "text" : "password"}
            id="groq"
            className="glass-input"
            value={keys.groq}
            onChange={(e) => setKeys({...keys, groq: e.target.value})}
            placeholder="gsk_..."
          />
        </div>

        <div className="input-group">
          <label className="input-label" htmlFor="google">Google/Gemini API Key</label>
          <input
            type={showKeys ? "text" : "password"}
            id="google"
            className="glass-input"
            value={keys.google}
            onChange={(e) => setKeys({...keys, google: e.target.value})}
            placeholder="AIza..."
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
