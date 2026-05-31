export default function ResultsPanel({ results }) {
  const { state, message, sql, columns, rows, data } = results;

  function statusMessage() {
    if (state === 'idle')    return 'Results will appear here.';
    if (state === 'loading') return 'Working…';
    if (state === 'error')   return message;
    if (state === 'empty')   return 'No results.';
    if (state === 'preview' && data) {
      const hasSample = data.sample && Object.keys(data.sample).length > 0;
      const cols = data.columns?.length || 0;
      return hasSample
        ? `${data.schema}.${data.table} — ${cols} column(s), 1 sample row`
        : `${data.schema}.${data.table} — ${cols} column(s), table is empty`;
    }
    if (state === 'query') return `${rows.length} row(s)`;
    return '';
  }

  const showSql = sql && (state === 'query' || state === 'empty');

  return (
    <section className="panel" style={{ marginTop: '14px' }}>
      <h3>Results</h3>

      <div className="result-msg">{statusMessage()}</div>

      {/* Generated SQL */}
      {showSql && <pre className="result-sql">{sql}</pre>}

      {/* Table preview — column metadata */}
      {state === 'preview' && data?.columns?.length > 0 && (
        <div className="table-scroll" style={{ marginBottom: '10px' }}>
          <table>
            <thead><tr><th>Column</th><th>Type</th></tr></thead>
            <tbody>
              {data.columns.map(c => (
                <tr key={c.name}><td>{c.name}</td><td>{c.type}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Table preview — one sample row */}
      {state === 'preview' && data?.sample && Object.keys(data.sample).length > 0 && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>{Object.keys(data.sample).map(col => <th key={col}>{col}</th>)}</tr>
            </thead>
            <tbody>
              <tr>
                {Object.values(data.sample).map((val, i) => (
                  <td key={i}>{val === null || val === undefined ? '' : String(val)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* NL query — full results table */}
      {state === 'query' && columns && rows && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>{columns.map(col => <th key={col}>{col}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>{cell === null || cell === undefined ? '' : String(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
