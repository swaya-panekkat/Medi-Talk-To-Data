import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Menu, X, Users, Activity, ShieldCheck, BarChart3, Github, Twitter, Linkedin, Mail, MessageSquare, ClipboardList } from 'lucide-react';
import ShinyText    from '../components/ShinyText';
import FeatureCard  from '../components/FeatureCard';

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_105406_16f4600d-7a92-4292-b96e-b19156c7830a.mp4';


/* ── Framer-motion variants ───────────────────────── */
const fadeUp = {
  hidden:  { opacity: 0, y: 36 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.13, duration: 0.75, ease: [0.23, 1, 0.32, 1] },
  }),
};

/* ── Static data ──────────────────────────────────── */
const NAV_LINKS = ['Home', 'Features', 'Security', 'Departments', 'Contact'];

const FEATURES = [
  {
    icon:        Users,
    title:       'Patient Data Queries',
    description: 'Ask questions about admissions, diagnoses, treatment outcomes, and lab results — instantly, in plain English.',
    gradient:    'linear-gradient(137deg, #61c4ca 0%, #ffffff 50%, #2c99b7 100%)',
    linkText:    'Query Patient Data',
    delay:       0.1,
  },
  {
    icon:        Activity,
    title:       'Real-Time Clinical Insights',
    description: 'AI converts medical questions to SQL in milliseconds and queries your clinical database live — no waiting, no tickets.',
    gradient:    'linear-gradient(137deg, #2c99b7 0%, #61c4ca 50%, #0d8fa8 100%)',
    linkText:    'See It In Action',
    delay:       0.2,
  },
  {
    icon:        ShieldCheck,
    title:       'Role-Based Access Control',
    description: 'Doctors, nurses, and admins access only authorised data with PostgreSQL permissions.',
    gradient:    'linear-gradient(137deg, #1e3c61 0%, #2c99b7 50%, #61c4ca 100%)',
    linkText:    'Learn About Security',
    delay:       0.3,
  },
  {
    icon:        BarChart3,
    title:       'Live Medical Reports',
    description: 'View patient statistics, ward metrics, and lab summaries as clean tables the moment you ask — no dashboards to build.',
    gradient:    'linear-gradient(137deg, #61c4ca 0%, #2c99b7 50%, #1e3c61 100%)',
    linkText:    'View Sample Reports',
    delay:       0.4,
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Sign In Securely',
    desc: 'Log in with your hospital system credentials. Role-based access ensures each team member only sees authorised data.',
  },
  {
    n: '02',
    title: 'Ask a Clinical Question',
    desc: 'Type in plain English — e.g. "Show all diabetic patients admitted this month" or "List top 10 prescribed medications today".',
  },
  {
    n: '03',
    title: 'Get Instant Results',
    desc: 'AI generates the SQL, queries your clinical database, and returns a clean table — ready to act on in seconds.',
  },
];

/* ══════════════════════════════════════════════════
   LANDING PAGE
   ══════════════════════════════════════════════════ */
export default function Landing() {
  const navigate    = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="landing">

      {/* ════════════════════════════════════════════
          HERO  —  full-screen video background
          ════════════════════════════════════════════ */}
      <section className="lhero">

        {/* 1. Video */}
        <video
          className="lhero-video"
          autoPlay loop muted playsInline
        >
          <source src={VIDEO_URL} type="video/mp4" />
        </video>

        {/* 2. Dark gradient overlay */}
        <div className="lhero-overlay" />

        {/* 3. Particle network */}

        {/* 4. Dot-grid */}
        <div className="grid-overlay lhero-grid" />

        {/* ── NAVBAR ─────────────────────────────── */}
        <nav className="lnav">
          <div className="lnav-inner">

            {/* Logo */}
            <div className="lnav-logo">
              <div className="lnav-logo-ring">
                <div className="lnav-logo-dot" />
              </div>
              <img src="/logo.png" alt="Talk2Data" className="lnav-logo-img" />
            </div>

            {/* Desktop links */}
            <ul className="lnav-links">
              {NAV_LINKS.map(l => (
                <li key={l}>
                  <a
                    href={l === 'Home' ? '#' : `#${l.toLowerCase().replace(/\s/g,'-')}`}
                    className="lnav-link"
                  >
                    {l}
                  </a>
                </li>
              ))}
            </ul>

            {/* Desktop CTA */}
            <button className="lnav-cta" onClick={() => navigate('/login')}>
              Sign In <ArrowRight size={15} />
            </button>

            {/* Mobile hamburger */}
            <button className="lnav-hamburger" onClick={() => setMenuOpen(o => !o)}>
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>

          {/* Mobile menu */}
          {menuOpen && (
            <motion.div
              className="lnav-mobile"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {NAV_LINKS.map(l => (
                <a key={l} href="#" className="lnav-mobile-link" onClick={() => setMenuOpen(false)}>{l}</a>
              ))}
              <button className="lnav-cta" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
                onClick={() => navigate('/login')}>
                Sign In <ArrowRight size={15} />
              </button>
            </motion.div>
          )}
        </nav>

        {/* ── TWO-LINE INFO ROW ───────────────────── */}
        <motion.div
          className="lhero-inforow"
          variants={fadeUp} initial="hidden" animate="visible" custom={0}
        >
          <p className="lhero-info-left">
            We deliver intelligent data access tools that empower medical teams
            with instant insights from clinical databases — no SQL required.
          </p>
          <p className="lhero-info-right">
            5 000+ Clinical Queries Answered Daily !
          </p>
        </motion.div>

        {/* ── MAIN HERO CONTENT ───────────────────── */}
        <div className="lhero-center">

          <motion.p
            className="lhero-eyebrow"
            variants={fadeUp} initial="hidden" animate="visible" custom={1}
          >
            AI-Powered Clinical Data Intelligence
          </motion.p>

          <motion.h1
            className="lhero-headline"
            variants={fadeUp} initial="hidden" animate="visible" custom={2}
          >
            <span className="lhero-line1">Ask your</span>
            <br />
            <ShinyText
              speed={3}
              baseColor="#64CEFB"
              shineColor="#ffffff"
              spread={100}
              className="lhero-shiny"
            >
              Medical Data.
            </ShinyText>
            <br />
            <span className="lhero-line3">In Plain English.</span>
          </motion.h1>

          <motion.p
            className="lhero-sub"
            variants={fadeUp} initial="hidden" animate="visible" custom={3}
          >
            Query patient records, lab results &amp; hospital metrics —
            no SQL knowledge needed.
          </motion.p>

          <motion.div
            variants={fadeUp} initial="hidden" animate="visible" custom={4}
          >
            <button
              className="lhero-cta-btn group"
              onClick={() => navigate('/login')}
            >
              <span>Access Your Medical Data</span>
              <ArrowRight size={18} className="lhero-cta-arrow" />
            </button>
          </motion.div>

        </div>

        {/* Scroll hint */}
        <motion.div
          className="lhero-scroll"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          ↓
        </motion.div>
      </section>

      {/* ════════════════════════════════════════════
          MINI FEATURE STRIP
          ════════════════════════════════════════════ */}
      <section className="mini-strip">
        <div className="mini-strip-inner">

          <motion.div className="mini-item"
            initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }}
            viewport={{ once:true }} transition={{ duration:.6, ease:[.23,1,.32,1] }}>
            <div className="mini-icon-wrap">
              <MessageSquare size={22} />
            </div>
            <div className="mini-text">
              <h3>Query Without Code</h3>
              <p>Ask clinical questions in plain English and get instant SQL results — no technical knowledge required.</p>
            </div>
          </motion.div>

          <motion.div className="mini-item"
            initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }}
            viewport={{ once:true }} transition={{ delay:.12, duration:.6, ease:[.23,1,.32,1] }}>
            <div className="mini-icon-wrap">
              <ShieldCheck size={22} />
            </div>
            <div className="mini-text">
              <h3>Role-Based Security</h3>
              <p>Doctors, nurses, and admins each see only authorised data — powered by PostgreSQL native permissions.</p>
            </div>
          </motion.div>

          <motion.div className="mini-item"
            initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }}
            viewport={{ once:true }} transition={{ delay:.24, duration:.6, ease:[.23,1,.32,1] }}>
            <div className="mini-icon-wrap">
              <ClipboardList size={22} />
            </div>
            <div className="mini-text">
              <h3>Live Clinical Reports</h3>
              <p>Patient stats, lab results, and ward metrics on demand — no dashboards to build, no waiting for BI teams.</p>
            </div>
          </motion.div>

        </div>
      </section>

      {/* ════════════════════════════════════════════
          FEATURES
          ════════════════════════════════════════════ */}
      <section id="features" className="land-features">
        <div className="land-section-inner">
          <p className="land-eyebrow">CAPABILITIES</p>
          <h2 className="land-section-title">
            Built for the<br />
            <span className="land-grad">modern medical team</span>
          </h2>
          <div className="feat-glow-grid">
            {FEATURES.map(f => (
              <FeatureCard
                key={f.title}
                icon={f.icon}
                title={f.title}
                description={f.description}
                gradient={f.gradient}
                linkText={f.linkText}
                delay={f.delay}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          HOW IT WORKS — Vertical timeline
          ════════════════════════════════════════════ */}
      <section className="stl-section">
        <div className="stl-inner">

          {/* Left: badge + big heading */}
          <motion.div
            className="stl-left"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.23,1,0.32,1] }}
          >
            <span className="stl-badge">Why us</span>
            <h2 className="stl-heading">
              From question to<br />
              clinical insight<br />
              <span className="land-grad">in seconds</span>
            </h2>
          </motion.div>

          {/* Right: vertical timeline */}
          <div className="stl-right">
            <div className="stl-vline" />

            {STEPS.map((s, i) => (
              <motion.div
                key={s.n}
                className="stl-item"
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.65, ease: [0.23,1,0.32,1] }}
              >
                <div className="stl-dot" />
                <div className="stl-connector" />
                <div className="stl-content">
                  <p className="stl-step-num">Step {i + 1}</p>
                  <h3 className="stl-step-title">{s.title}</h3>
                  <p className="stl-step-desc">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

        </div>
      </section>

      {/* ════════════════════════════════════════════
          BOTTOM CTA
          ════════════════════════════════════════════ */}
      <section className="land-bottom-cta">
        <div className="land-cta-glow" />
        <div className="land-section-inner" style={{ textAlign:'center', position:'relative', zIndex:1 }}>
          <motion.h2
            className="land-cta-headline"
            initial={{ opacity:0, y:24 }}
            whileInView={{ opacity:1, y:0 }}
            viewport={{ once:true }}
            transition={{ duration:0.7, ease:[0.23,1,0.32,1] }}
          >
            Give your medical team<br />the data access they deserve.
          </motion.h2>
          <p className="land-cta-sub">
            Log in with your hospital credentials and start querying clinical
            data in plain English — in under 30 seconds.
          </p>
          <button className="land-cta-btn land-cta-large" onClick={() => navigate('/login')}>
            Access Your Clinical Data <span className="land-arrow">→</span>
          </button>
        </div>
      </section>

      {/* ════════════════════════════════════════════
          FOOTER
          ════════════════════════════════════════════ */}
      <footer className="site-footer">
        <div className="site-footer-inner">

          {/* ── Brand column ── */}
          <div className="footer-brand">
            <img src="/logo.png" alt="Talk2Data" className="footer-logo" />
            <p className="footer-desc">
              AI-powered clinical data intelligence for medical teams.
              Query patient records, lab results, and hospital metrics
              in plain English — no SQL required.
            </p>

            <div className="footer-socials">
              <a href="#" aria-label="GitHub"><Github size={16} /></a>
              <a href="#" aria-label="Twitter"><Twitter size={16} /></a>
              <a href="#" aria-label="LinkedIn"><Linkedin size={16} /></a>
              <a href="#" aria-label="Email"><Mail size={16} /></a>
            </div>

            <button className="footer-cta-btn" onClick={() => navigate('/login')}>
              Access Your Data <ArrowRight size={15} />
            </button>
          </div>

          {/* ── Pages ── */}
          <div className="footer-col">
            <h4>Pages</h4>
            <ul>
              <li><a href="#">Home</a></li>
              <li><a href="#features">Features</a></li>
              <li><a href="#">Security</a></li>
              <li><a href="#">Departments</a></li>
              <li><a href="#" onClick={() => navigate('/login')}>Sign In</a></li>
            </ul>
          </div>

          {/* ── Resources ── */}
          <div className="footer-col">
            <h4>Resources</h4>
            <ul>
              <li><a href="#">Dashboard</a></li>
              <li><a href="#">How It Works</a></li>
              <li><a href="#">Clinical Use Cases</a></li>
              <li><a href="#">Data Privacy</a></li>
              <li><a href="#">API Docs</a></li>
            </ul>
          </div>

          {/* ── Legal ── */}
          <div className="footer-col">
            <h4>Legal</h4>
            <ul>
              <li><a href="#">Privacy Policy</a></li>
              <li><a href="#">Terms of Service</a></li>
              <li><a href="#">HIPAA Compliance</a></li>
              <li><a href="#">Cookie Policy</a></li>
            </ul>
            <p className="footer-copy">
              © {new Date().getFullYear()} Mejuvante.<br />
              All rights reserved.
            </p>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="footer-bar">
          <span>talk2data.mejuvante.ai</span>
          <span>Built for medical teams worldwide</span>
        </div>
      </footer>
    </div>
  );
}
