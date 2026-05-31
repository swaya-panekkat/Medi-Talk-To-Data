import { useState } from 'react';
import { X, Database, CheckCircle, AlertCircle, Loader } from 'lucide-react';

/**
 * Modal for connecting an external PostgreSQL database.
 * Uses the logged-in user's credentials automatically.
 *
 * Props:
 *   onClose   – called when modal is dismissed
 *   onConnect – called with { host, port, dbname } on success
 *   current   – current db status { connected, config }
 */
export default function DbConnectModal({ onClose, onConnect, current }) {
  const [host,   setHost]   = useState(current?.config?.host   || '');
  const [port,   setPort]   = useState(current?.config?.port   || 5432);
  const [dbname, setDbname] = useState(current?.config?.dbname || '');
  const [status, setStatus] = useState(null);   // null | 'loading' | 'ok' | 'error'
  const [msg,    setMsg]    = useState('');

  async function handleConnect(e) {
    e.preventDefault();
    if (!host || !dbname) return;
    setStatus('loading'); setMsg('');
    try {
      const res  = await fetch('/api/db_connect', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ host, port: Number(port), dbname }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus('error');
        setMsg(data.detail || 'Connection failed');
        return;
      }
      setStatus('ok');
      setMsg(data.message || 'Connected!');
      onConnect({ host, port: Number(port), dbname });
    } catch (err) {
      setStatus('error');
      setMsg('Network error: ' + err.message);
    }
  }

  async function handleDisconnect() {
    setStatus('loading'); setMsg('');
    try {
      await fetch('/api/db_disconnect', { method: 'POST' });
      setStatus(null); setMsg('');
      onConnect(null);   // parent resets to default DB
    } catch {
      setStatus('error'); setMsg('Failed to disconnect');
    }
  }

  return (
    <div className="db-modal-overlay" onClick={onClose}>
      <div className="db-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="db-modal-head">
          <div className="db-modal-title">
            <Database size={18} />
            <span>Connect External Database</span>
          </div>
          <button className="db-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Info note */}
        <p className="db-modal-note">
          Enter your PostgreSQL server details below. Your login credentials
          are used automatically — no re-entry needed.
        </p>

        {/* Form */}
        <form className="db-modal-form" onSubmit={handleConnect}>

          <div className="db-field">
            <label>Database Host</label>
            <input
              type="text"
              placeholder="e.g.  192.168.1.100  or  mydb.azure.com"
              value={host}
              onChange={e => setHost(e.target.value)}
              required
            />
          </div>

          <div className="db-field-row">
            <div className="db-field" style={{ flex: 1 }}>
              <label>Port</label>
              <input
                type="number"
                placeholder="5432"
                value={port}
                onChange={e => setPort(e.target.value)}
                min={1} max={65535}
              />
            </div>
            <div className="db-field" style={{ flex: 2 }}>
              <label>Database Name</label>
              <input
                type="text"
                placeholder="e.g.  hospital_db"
                value={dbname}
                onChange={e => setDbname(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Status message */}
          {status === 'ok' && (
            <div className="db-status-msg db-status-ok">
              <CheckCircle size={14} /> {msg}
            </div>
          )}
          {status === 'error' && (
            <div className="db-status-msg db-status-err">
              <AlertCircle size={14} /> {msg}
            </div>
          )}

          {/* Actions */}
          <div className="db-modal-actions">
            {current?.connected && (
              <button
                type="button"
                className="db-btn db-btn-disconnect"
                onClick={handleDisconnect}
                disabled={status === 'loading'}
              >
                Disconnect
              </button>
            )}
            <button
              type="submit"
              className="db-btn db-btn-connect"
              disabled={status === 'loading' || !host || !dbname}
            >
              {status === 'loading'
                ? <><Loader size={14} className="db-spinner" /> Testing…</>
                : 'Connect'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
