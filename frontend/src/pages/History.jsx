import React, { useState, useEffect } from 'react';
import { History, FileText, ChevronRight, Download } from 'lucide-react';

export default function HistoryPage({ authToken }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || ''}/api/history`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          setReports(data.reports);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load history", err);
        setLoading(false);
      });
  }, []);

  const handleViewReport = async (path) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/history/view`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}` 
        },
        body: JSON.stringify({ path })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setSelectedReport({ path, content: data.content });
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="dashboard-grid">
      <aside className="control-panel glass-panel">
        <h2><History size={24} style={{ display: 'inline', verticalAlign: 'text-bottom', color: 'var(--accent)' }} /> Saved Reports</h2>
        
        {loading ? (
           <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><div className="loading-spinner"></div></div>
        ) : reports.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No reports generated yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '600px', overflowY: 'auto' }}>
            {reports.map((report, idx) => (
              <div 
                key={idx} 
                onClick={() => handleViewReport(report.path)}
                style={{ 
                  padding: '1rem', 
                  background: selectedReport?.path === report.path ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${selectedReport?.path === report.path ? 'var(--accent)' : 'transparent'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'all 0.2s ease'
                }}
              >
                <div>
                  <h4 style={{ color: 'var(--text-main)', marginBottom: '0.25rem' }}>{report.name}</h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{report.date}</span>
                </div>
                <ChevronRight size={16} style={{ color: selectedReport?.path === report.path ? 'var(--accent)' : 'var(--text-muted)' }} />
              </div>
            ))}
          </div>
        )}
      </aside>

      <main className="results-panel glass-panel" style={{ minHeight: '600px', maxHeight: '800px', overflowY: 'auto' }}>
        {selectedReport ? (
          <div style={{ animation: 'fadeInDown 0.3s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText style={{ color: 'var(--accent-secondary)' }} /> Report Document
              </h2>
              <button className="glass-button" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>
                 <Download size={16} /> Export
              </button>
            </div>
            
            <div className="markdown-body" style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.9rem' }}>
              {selectedReport.content}
            </div>
          </div>
        ) : (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', paddingTop: '10rem' }}>
            <FileText size={64} style={{ opacity: 0.2, marginBottom: '1rem' }} />
            <h3>Select a Report</h3>
            <p>Click on a generated report from the sidebar to view it.</p>
          </div>
        )}
      </main>
    </div>
  );
}
