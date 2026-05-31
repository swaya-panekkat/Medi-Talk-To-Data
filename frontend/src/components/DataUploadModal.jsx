import { useState, useRef } from 'react';
import {
  X, Upload, FileText, FileSpreadsheet,
  CheckCircle, AlertCircle, Loader, Database,
} from 'lucide-react';

export default function DataUploadModal({ onClose, onSuccess }) {
  const [tab,       setTab]       = useState('sql');
  const [file,      setFile]      = useState(null);
  const [tableName, setTableName] = useState('');
  const [dragging,  setDragging]  = useState(false);
  const [status,    setStatus]    = useState(null);   // null | 'loading' | 'ok' | 'error'
  const [msg,       setMsg]       = useState('');
  const [result,    setResult]    = useState(null);
  const inputRef = useRef(null);

  function switchTab(t) {
    setTab(t); setFile(null); setStatus(null); setMsg(''); setResult(null);
  }

  function pickFile(f) {
    if (!f) return;
    const ok = tab === 'sql' ? f.name.endsWith('.sql') : f.name.endsWith('.csv');
    if (!ok) { setStatus('error'); setMsg(`Please select a .${tab} file`); return; }
    setFile(f); setStatus(null); setMsg('');
    if (tab === 'csv' && !tableName)
      setTableName(f.name.replace(/\.csv$/i, '').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase());
  }

  function onDrop(e) {
    e.preventDefault(); setDragging(false);
    pickFile(e.dataTransfer.files[0]);
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    setStatus('loading'); setMsg(''); setResult(null);

    const form = new FormData();
    form.append('file', file);

    const url = tab === 'sql'
      ? '/api/upload/sql'
      : `/api/upload/csv${tableName ? `?table_name=${encodeURIComponent(tableName)}` : ''}`;

    try {
      const res  = await fetch(url, { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setStatus('error'); setMsg(data.detail || 'Upload failed'); return; }
      setStatus('ok');
      setMsg(data.message || 'Success');
      setResult(data);
      onSuccess && onSuccess(data);
    } catch (err) {
      setStatus('error');
      setMsg('Network error: ' + err.message);
    }
  }

  return (
    <div className="db-modal-overlay" onClick={onClose}>
      <div className="db-modal upload-modal" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="db-modal-head">
          <div className="db-modal-title">
            <Upload size={18} />
            <span>Import Data</span>
          </div>
          <button className="db-modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        {/* ── Tabs ── */}
        <div className="upload-tabs">
          <button className={`upload-tab ${tab==='sql'?'active':''}`} onClick={() => switchTab('sql')}>
            <FileText size={14} /> SQL File
          </button>
          <button className={`upload-tab ${tab==='csv'?'active':''}`} onClick={() => switchTab('csv')}>
            <FileSpreadsheet size={14} /> CSV File
          </button>
        </div>

        {/* ── Info note ── */}
        <p className="db-modal-note">
          {tab === 'sql'
            ? 'Upload a .sql dump — CREATE TABLE and INSERT statements run automatically on your database.'
            : 'Upload a .csv file — a new table is created with your column names and data.'}
        </p>

        <form className="db-modal-form" onSubmit={handleUpload}>

          {/* CSV: table name override */}
          {tab === 'csv' && (
            <div className="db-field">
              <label>Table Name</label>
              <input
                type="text"
                placeholder="e.g. patients  (auto-filled from filename)"
                value={tableName}
                onChange={e => setTableName(e.target.value)}
              />
            </div>
          )}

          {/* ── Drop zone ── */}
          <div
            className={`upload-dropzone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
            onDrop={onDrop}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept={tab === 'sql' ? '.sql' : '.csv'}
              style={{ display: 'none' }}
              onChange={e => pickFile(e.target.files[0])}
            />

            {file ? (
              <div className="upload-file-name">
                {tab === 'sql' ? <FileText size={22} /> : <FileSpreadsheet size={22} />}
                <div>
                  <span className="upload-fname">{file.name}</span>
                  <span className="upload-fsize">{(file.size / 1024).toFixed(1)} KB</span>
                </div>
                <button
                  type="button"
                  className="upload-clear"
                  onClick={e => { e.stopPropagation(); setFile(null); setStatus(null); }}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="upload-hint">
                <Upload size={30} className="upload-hint-icon" />
                <span>Drag &amp; drop or <strong>click to select</strong></span>
                <span className="upload-ext">.{tab} files only</span>
              </div>
            )}
          </div>

          {/* Status */}
          {status === 'ok' && (
            <div className="db-status-msg db-status-ok">
              <CheckCircle size={14} />
              <span>{msg}</span>
              {result?.rows != null && <span className="upload-stat">· {result.rows} rows</span>}
              {result?.table  && <span className="upload-stat">· table: <strong>{result.table}</strong></span>}
            </div>
          )}
          {status === 'error' && (
            <div className="db-status-msg db-status-err">
              <AlertCircle size={14} /> {msg}
            </div>
          )}

          {/* Actions */}
          <div className="db-modal-actions">
            <button type="button" className="db-btn db-btn-disconnect" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="db-btn db-btn-connect"
              disabled={!file || status === 'loading'}
            >
              {status === 'loading'
                ? <><Loader size={14} className="db-spinner" /> Uploading…</>
                : <><Upload size={14} /> Upload &amp; Import</>}
            </button>
          </div>
        </form>

        {/* Example hint */}
        {status !== 'ok' && (
          <div className="upload-example">
            <Database size={12} />
            {tab === 'sql'
              ? 'Example: a pg_dump file or any .sql with CREATE/INSERT statements'
              : 'Example: patients.csv with columns like name, age, diagnosis'}
          </div>
        )}
      </div>
    </div>
  );
}
