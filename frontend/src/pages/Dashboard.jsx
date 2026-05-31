import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar        from '../components/Sidebar';
import ResultsPanel   from '../components/ResultsPanel';
import QueryBar       from '../components/QueryBar';
import DbConnectModal   from '../components/DbConnectModal';
import DataUploadModal  from '../components/DataUploadModal';

const HISTORY_KEY = 't2d_history';

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}

function saveHistory(list) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 20)));
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser]                 = useState(null);
  const [schemas, setSchemas]           = useState([]);
  const [schemasError, setSchemasError] = useState(false);
  const [history, setHistory]           = useState(loadHistory);
  const [queryInput, setQueryInput]     = useState('');
  const [results, setResults]           = useState({ state: 'idle' });
  const [heroTilt, setHeroTilt]         = useState({ x: 0, y: 0 });
  const [heroHover, setHeroHover]       = useState(false);
  const [dbStatus, setDbStatus]         = useState({ connected: false, config: {} });
  const [showDbModal, setShowDbModal]   = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    fetch('/api/me')
      .then(async r => {
        if (r.status === 401) { navigate('/login', { replace: true }); return; }
        const me = await r.json();
        setUser((me && (me.full_name || me.email)) || 'User');
      })
      .catch(() => navigate('/login', { replace: true }));
  }, [navigate]);

  useEffect(() => {
    fetch('/api/schemas')
      .then(r => r.json())
      .then(data => setSchemas(data.schemas || []))
      .catch(() => setSchemasError(true));
  }, [dbStatus]);   // re-load whenever DB changes

  // Load current DB connection status on mount
  useEffect(() => {
    fetch('/api/db_status')
      .then(r => r.json())
      .then(data => setDbStatus(data))
      .catch(() => {});
  }, []);

  /* 3D tilt on hero section */
  function onHeroMouseMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width  - 0.5;
    const y = (e.clientY - rect.top)  / rect.height - 0.5;
    setHeroTilt({ x: x * 7, y: -y * 7 });
  }

  function onHeroMouseLeave() {
    setHeroHover(false);
    setHeroTilt({ x: 0, y: 0 });
  }

  const heroStyle = {
    transform: `perspective(900px) rotateY(${heroTilt.x}deg) rotateX(${heroTilt.y}deg)`,
    transition: heroHover
      ? 'transform 0.1s linear'
      : 'transform 0.65s cubic-bezier(0.23, 1, 0.32, 1)',
  };

  const addToHistory = useCallback((q) => {
    if (!q) return;
    setHistory(prev => {
      const next = [q, ...prev.filter(x => x !== q)].slice(0, 20);
      saveHistory(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
  }, []);

  const handleTablePreview = useCallback(async (schema, table) => {
    setResults({ state: 'loading' });
    try {
      const res = await fetch(`/api/table_preview?schema=${encodeURIComponent(schema)}&table=${encodeURIComponent(table)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        setResults({ state: 'error', message: 'Error: ' + (err.detail || `HTTP ${res.status}`) });
        return;
      }
      const preview = await res.json();
      setResults({ state: 'preview', data: preview });
    } catch (e) {
      setResults({ state: 'error', message: 'Network error: ' + e.message });
    }
  }, []);

  const runQuery = useCallback(async (q) => {
    setResults({ state: 'loading' });
    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setResults({ state: 'error', message: 'Error: ' + (data.error || `HTTP ${res.status}`) });
        return;
      }
      if (data.empty || !data.rows || data.rows.length === 0) {
        setResults({ state: 'empty', sql: data.sql });
        return;
      }
      setResults({ state: 'query', sql: data.sql, columns: data.columns, rows: data.rows });
      addToHistory(q);
    } catch (err) {
      setResults({ state: 'error', message: 'Network error: ' + err.message });
    }
  }, [addToHistory]);

  const handleHistoryClick = useCallback((q) => {
    setQueryInput(q);
    runQuery(q);
  }, [runQuery]);

  const handleQuerySubmit = useCallback((q) => {
    if (!q.trim()) return;
    runQuery(q.trim());
  }, [runQuery]);

  const handleLogout = useCallback(async () => {
    try { await fetch('/api/logout', { method: 'POST' }); } catch (_) {}
    localStorage.removeItem('t2d_authed');
    localStorage.removeItem('t2d_user');
    navigate('/login', { replace: true });
  }, [navigate]);

  return (
    <div className="dashboard-bg">
      <div className="wrap">
        <Sidebar
          user={user}
          schemas={schemas}
          schemasError={schemasError}
          history={history}
          dbStatus={dbStatus}
          onDbConnect={() => setShowDbModal(true)}
          onImportData={() => setShowUploadModal(true)}
          onLogout={handleLogout}
          onTablePreview={handleTablePreview}
          onHistoryClick={handleHistoryClick}
          onClearHistory={clearHistory}
        />

        {/* Data upload modal */}
        {showUploadModal && (
          <DataUploadModal
            onClose={() => setShowUploadModal(false)}
            onSuccess={() => {
              setShowUploadModal(false);
              // Reload schemas so new tables appear in the sidebar
              fetch('/api/schemas').then(r => r.json()).then(d => setSchemas(d.schemas || [])).catch(() => {});
            }}
          />
        )}

        {/* DB connect modal */}
        {showDbModal && (
          <DbConnectModal
            current={dbStatus}
            onClose={() => setShowDbModal(false)}
            onConnect={cfg => {
              setShowDbModal(false);
              fetch('/api/db_status').then(r => r.json()).then(setDbStatus).catch(() => {});
              if (!cfg) setDbStatus({ connected: false, config: {} });
            }}
          />
        )}

        <main className="main">
          <section
            className="hero"
            style={heroStyle}
            onMouseMove={onHeroMouseMove}
            onMouseEnter={() => setHeroHover(true)}
            onMouseLeave={onHeroMouseLeave}
          >
            <h1 className="dash-title">Talk2Data</h1>
            <p className="dash-subtitle">Ask questions about your database in natural language.</p>
            <hr />
          </section>

          <ResultsPanel results={results} />
        </main>
      </div>

      <QueryBar
        value={queryInput}
        onChange={setQueryInput}
        onSubmit={handleQuerySubmit}
        loading={results.state === 'loading'}
      />
    </div>
  );
}
