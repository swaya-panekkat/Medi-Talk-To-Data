import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

/* ── Animated 3D key visual ─────────────────────────────── */
const RAYS = [
  { left: '28%', delay: '0s',   dur: '2.2s' },
  { left: '38%', delay: '0.4s', dur: '1.8s' },
  { left: '50%', delay: '0.8s', dur: '2.5s' },
  { left: '60%', delay: '0.2s', dur: '2.0s' },
  { left: '70%', delay: '1.0s', dur: '1.6s' },
  { left: '22%', delay: '1.4s', dur: '2.3s' },
  { left: '78%', delay: '0.6s', dur: '1.9s' },
];

const NODES = [
  { top: '18%', left: '12%',  size: 6,  delay: '0s',   dur: '3.5s' },
  { top: '32%', left: '85%',  size: 5,  delay: '0.8s', dur: '4.2s' },
  { top: '55%', left: '8%',   size: 4,  delay: '1.6s', dur: '3.0s' },
  { top: '70%', left: '80%',  size: 7,  delay: '0.4s', dur: '4.8s' },
  { top: '14%', left: '70%',  size: 4,  delay: '1.2s', dur: '3.8s' },
  { top: '82%', left: '20%',  size: 5,  delay: '2.0s', dur: '3.2s' },
];

function KeyVisual() {
  const platformDots = [0, 60, 120, 180, 240, 300].map(angle => {
    const r = (angle * Math.PI) / 180;
    return { x: 160 + 150 * Math.cos(r), y: 48 + 34 * Math.sin(r) };
  });

  return (
    <div className="kv-stage">

      {/* Rising rays */}
      {RAYS.map((r, i) => (
        <span key={i} className="kv-ray"
          style={{ left: r.left, animationDelay: r.delay, animationDuration: r.dur }} />
      ))}

      {/* Floating + spinning key */}
      <div className="kv-float-wrap">
        <div className="kv-spin-wrap">
          <svg className="kv-svg" viewBox="0 0 80 190" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="kv-gf" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="b"/>
                <feComposite in="SourceGraphic" in2="b" operator="over"/>
              </filter>
            </defs>

            {/* Soft glow layer */}
            <g filter="url(#kv-gf)" opacity="0.55">
              <circle cx="40" cy="38" r="33" stroke="#61c4ca" strokeWidth="5" fill="none"/>
              <circle cx="40" cy="38" r="17" stroke="#61c4ca" strokeWidth="3.5" fill="none"/>
              <line x1="40" y1="71" x2="40" y2="172" stroke="#61c4ca" strokeWidth="6" strokeLinecap="round"/>
              <line x1="40" y1="107" x2="62" y2="107" stroke="#61c4ca" strokeWidth="6" strokeLinecap="round"/>
              <line x1="40" y1="130" x2="55" y2="130" stroke="#61c4ca" strokeWidth="6" strokeLinecap="round"/>
              <line x1="40" y1="153" x2="63" y2="153" stroke="#61c4ca" strokeWidth="6" strokeLinecap="round"/>
            </g>

            {/* Main key shape */}
            <g fill="none" stroke="rgba(210,248,255,0.95)" strokeLinecap="round">
              <circle cx="40" cy="38" r="33" strokeWidth="3.5"/>
              <circle cx="40" cy="38" r="17" strokeWidth="2.5"/>
              <circle cx="40" cy="38" r="7"  strokeWidth="1.5" stroke="rgba(97,196,202,0.55)"/>
              <line x1="40" y1="71"  x2="40" y2="172" strokeWidth="4.5"/>
              <line x1="40" y1="107" x2="62" y2="107" strokeWidth="4.5"/>
              <line x1="40" y1="130" x2="55" y2="130" strokeWidth="4.5"/>
              <line x1="40" y1="153" x2="63" y2="153" strokeWidth="4.5"/>
            </g>

            {/* Circuit tick marks on bow */}
            <g stroke="rgba(97,196,202,0.5)" strokeWidth="1.5" strokeLinecap="round">
              <line x1="40" y1="5"  x2="40" y2="11"/>
              <line x1="73" y1="38" x2="67" y2="38"/>
              <line x1="7"  y1="38" x2="13" y2="38"/>
              <line x1="66" y1="12" x2="62" y2="16"/>
              <line x1="14" y1="12" x2="18" y2="16"/>
              <line x1="66" y1="64" x2="62" y2="60"/>
              <line x1="14" y1="64" x2="18" y2="60"/>
            </g>

            {/* Glowing joint dots */}
            <g fill="rgba(97,220,235,1)">
              <circle cx="40" cy="38"  r="4.5"/>
              <circle cx="40" cy="107" r="3.5"/>
              <circle cx="40" cy="130" r="3"/>
              <circle cx="40" cy="153" r="3.5"/>
            </g>
          </svg>
        </div>
      </div>

      {/* Circular platform rings */}
      <div className="kv-platform">
        <svg viewBox="0 0 320 96" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="160" cy="50" rx="150" ry="34" fill="none" stroke="rgba(97,196,202,0.55)" strokeWidth="1.5"/>
          <ellipse cx="160" cy="50" rx="112" ry="25" fill="none" stroke="rgba(97,196,202,0.30)" strokeWidth="1"/>
          <ellipse cx="160" cy="50" rx="74"  ry="16" fill="none" stroke="rgba(97,196,202,0.18)" strokeWidth="0.8"/>
          {platformDots.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r="3.5" fill="rgba(97,196,202,0.75)"/>
          ))}
        </svg>
      </div>

      {/* Floating ambient nodes */}
      {NODES.map((n, i) => (
        <span key={i} className="kv-node" style={{
          top: n.top, left: n.left,
          width: n.size, height: n.size,
          animationDelay: n.delay, animationDuration: n.dur,
        }} />
      ))}

      {/* Text label */}
      <div className="kv-label">
        <h2 className="kv-title">Secure Access</h2>
        <p className="kv-sub">Your clinical data, protected &amp; accessible.</p>
      </div>
    </div>
  );
}

/* ── Login page ──────────────────────────────────────────── */
export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [tilt, setTilt]         = useState({ x: 0, y: 0 });
  const [live, setLive]         = useState(false);

  useEffect(() => {
    fetch('/api/me')
      .then(r => { if (r.ok) navigate('/dashboard', { replace: true }); })
      .catch(() => {});
  }, [navigate]);

  function onMove(e) {
    const r = e.currentTarget.getBoundingClientRect();
    setTilt({
      x:  ((e.clientX - r.left) / r.width  - 0.5) * 18,
      y: -((e.clientY - r.top)  / r.height - 0.5) * 18,
    });
  }
  function onLeave() { setLive(false); setTilt({ x: 0, y: 0 }); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username || !password) return;
    setError(''); setLoading(true);
    try {
      const res  = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok)
        throw new Error((data && (data.detail || data.error)) || 'Login failed');
      localStorage.setItem('t2d_user', username);
      localStorage.setItem('t2d_authed', '1');
      navigate('/dashboard', { replace: true });
    } catch (ex) { setError(ex.message); }
    finally { setLoading(false); }
  }

  const cardStyle = {
    transform: `perspective(900px) rotateY(${tilt.x}deg) rotateX(${tilt.y}deg)`,
    transition: live ? 'transform 0.07s linear' : 'transform 0.7s cubic-bezier(0.23,1,0.32,1)',
    filter: `drop-shadow(${(-tilt.x*2).toFixed(1)}px ${(tilt.y*2+28).toFixed(1)}px 44px rgba(0,0,0,0.7))
             drop-shadow(0 0 24px rgba(97,196,202,0.16))`,
  };

  return (
    <div className="login-bg">

      <Link to="/" className="login-back-btn">← Home</Link>

      {/* Two-column layout */}
      <div className="login-split">

        {/* Left — form */}
        <div className="login-form-side">
          <main className="card" role="main" aria-labelledby="loginTitle"
            style={cardStyle}
            onMouseMove={onMove}
            onMouseEnter={() => setLive(true)}
            onMouseLeave={onLeave}
          >
            <div className="card-glow" />

            <div className="d3-layer" style={{ '--z': '55px' }}>
              <img className="logo" src="/logo.png" alt="Talk2Data" />
            </div>

            <div className="d3-layer" style={{ '--z': '38px' }}>
              <h1 id="loginTitle" className="login-title">Login to Talk2Data</h1>
              <p className="subtitle">Use your PostgreSQL username and password.</p>
            </div>

            <div className="d3-layer" style={{ '--z': '18px' }}>
              {error && <div className="error-box" role="alert">{error}</div>}
              <form onSubmit={handleSubmit} autoComplete="on">
                <div className="field">
                  <label htmlFor="username">Username</label>
                  <div className="input-wrap">
                    <input id="username" name="username" type="text"
                      placeholder="db_user" required
                      value={username} onChange={e => setUsername(e.target.value)} />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="password">Password</label>
                  <div className="input-wrap">
                    <input id="password" name="password" type="password"
                      placeholder="••••••••" required
                      value={password} onChange={e => setPassword(e.target.value)} />
                  </div>
                </div>
                <button className="btn" type="submit" disabled={loading}>
                  {loading ? 'Logging in…' : 'Log in'}
                </button>
                <div className="helper">
                  Forgot your password? <a href="#">Get help</a>
                </div>
              </form>
            </div>
          </main>
        </div>

        {/* Right — key visual */}
        <div className="login-key-side">
          <KeyVisual />
        </div>

      </div>
    </div>
  );
}
