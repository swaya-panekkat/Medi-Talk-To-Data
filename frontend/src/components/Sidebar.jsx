import { Link } from 'react-router-dom';
import { Database, Upload } from 'lucide-react';
import SchemaList from './SchemaList';

export default function Sidebar({
  user, schemas, schemasError, history,
  dbStatus, onDbConnect, onImportData,
  onLogout, onTablePreview, onHistoryClick, onClearHistory,
}) {
  const initial = user ? user[0].toUpperCase() : 'U';
  const isCustomDb = dbStatus?.connected;

  return (
    <aside className="sidebar">
      <div className="brand">
        <img src="/logo.png" alt="Company logo" />
      </div>

      {/* Back to home */}
      <Link to="/" className="sidebar-home-link">
        <span className="sidebar-home-icon">⌂</span>
        Back to Home
      </Link>

      {/* Database connection */}
      <div className="sidebar-db-panel">
        <div className="sidebar-db-info">
          <span className={`sidebar-db-dot ${isCustomDb ? 'connected' : ''}`} />
          <div className="sidebar-db-text">
            <span className="sidebar-db-label">
              {isCustomDb ? 'External DB' : 'Default DB'}
            </span>
            <span className="sidebar-db-host">
              {isCustomDb
                ? `${dbStatus.config.host}/${dbStatus.config.dbname}`
                : `${dbStatus?.config?.host || 'localhost'}/${dbStatus?.config?.dbname || 'default'}`}
            </span>
          </div>
        </div>
        <div className="sidebar-db-actions">
          <button className="sidebar-db-btn" onClick={onDbConnect}>
            <Database size={13} />
            {isCustomDb ? 'Change' : 'Connect'}
          </button>
          <button className="sidebar-db-btn sidebar-import-btn" onClick={onImportData} title="Import SQL or CSV">
            <Upload size={13} />
          </button>
        </div>
      </div>

      <div className="profile">
        <div className="row">
          <div className="avatar">{initial}</div>
          <div className="name">{user || 'User'}</div>
        </div>
        <button className="logout-btn" type="button" onClick={onLogout} aria-label="Log out">
          Log out
        </button>
      </div>

      <section className="panel">
        <div className="collapsible-head">
          <span>Schemas (you can access)</span>
          <i className="chev" aria-hidden="true" />
        </div>
        <SchemaList schemas={schemas} error={schemasError} onTableClick={onTablePreview} />
      </section>

      <section className="panel">
        <h3>History</h3>
        <ul className="schema-list" aria-label="Query history">
          {history.length === 0 ? (
            <li className="schema-item" style={{ padding: '8px 10px', fontSize: '13px', color: '#7f93ad' }}>
              No recent queries.
            </li>
          ) : (
            history.map((q, i) => (
              <li key={i} className="schema-item">
                <button
                  className="schema-btn"
                  type="button"
                  style={{ fontSize: '12px', fontWeight: 600 }}
                  onClick={() => onHistoryClick(q)}
                >
                  {q.length > 70 ? q.slice(0, 67) + '…' : q}
                </button>
              </li>
            ))
          )}
        </ul>
        <button className="clear-btn" type="button" onClick={onClearHistory}>
          Clear history
        </button>
      </section>
    </aside>
  );
}
