import { useState } from 'react';

function SchemaItem({ item, onTableClick }) {
  const [open, setOpen] = useState(false);
  const tableCount = (item.tables || []).length;

  return (
    <li className="schema-item">
      <button
        className="schema-btn"
        type="button"
        aria-expanded={open}
        aria-controls={`tbl-${item.schema}`}
        aria-label={`Toggle tables for schema ${item.schema}`}
        onClick={() => setOpen(prev => !prev)}
      >
        <span className="meta">{item.schema}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge">{tableCount} table{tableCount === 1 ? '' : 's'}</span>
          <i className={`chev${open ? ' open' : ''}`} aria-hidden="true" />
        </span>
      </button>

      <ul className={`table-list${open ? ' open' : ''}`} id={`tbl-${item.schema}`}>
        {(item.tables || []).map(t => (
          <li key={t} className="table-item">
            <button
              className="table-btn"
              type="button"
              onClick={() => onTableClick(item.schema, t)}
            >
              {t}
            </button>
          </li>
        ))}
      </ul>
    </li>
  );
}

export default function SchemaList({ schemas, error, onTableClick }) {
  if (error) {
    return (
      <ul className="schema-list" aria-label="Schemas">
        <li className="schema-item" style={{ padding: '8px 10px', fontSize: '13px', color: '#c62828' }}>
          Failed to load schemas.
        </li>
      </ul>
    );
  }

  if (!schemas.length) {
    return (
      <ul className="schema-list" aria-label="Schemas">
        <li className="schema-item" style={{ padding: '8px 10px', fontSize: '13px', color: '#7f93ad' }}>
          No accessible schemas.
        </li>
      </ul>
    );
  }

  return (
    <ul className="schema-list" aria-label="Schemas">
      {schemas.map(item => (
        <SchemaItem key={item.schema} item={item} onTableClick={onTableClick} />
      ))}
    </ul>
  );
}
