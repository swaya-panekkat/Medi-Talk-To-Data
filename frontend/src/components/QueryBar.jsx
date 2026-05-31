export default function QueryBar({ value, onChange, onSubmit, loading }) {
  function handleSubmit(e) {
    e.preventDefault();
    onSubmit(value);
  }

  return (
    <div className="querybar" role="region" aria-label="Query input">
      <form className="query" onSubmit={handleSubmit}>
        <input
          type="text"
          name="q"
          placeholder="Ask something like: Top 5 tenders this year"
          autoComplete="off"
          value={value}
          onChange={e => onChange(e.target.value)}
        />
        <button className="submit-btn" type="submit" aria-label="Submit query" disabled={loading}>
          {loading ? '…' : '>'}
        </button>
      </form>
    </div>
  );
}
