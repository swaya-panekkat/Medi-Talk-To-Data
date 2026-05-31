import { useRef, useEffect } from 'react';

/*
 * Animated beam pipeline — three neumorphic nodes connected by a
 * light-beam that sweeps left→right with a splash at the centre.
 * Colors match the landing page teal/sky/navy palette.
 */
export default function HeroBeam() {
  const pipelineRef   = useRef(null);
  const nodeStackRef  = useRef(null);
  const nodeXRef      = useRef(null);
  const nodeShieldRef = useRef(null);
  const beamPathRef   = useRef(null);
  const beamGlowRef   = useRef(null);
  const gradientRef   = useRef(null);
  const splashRef     = useRef(null);

  useEffect(() => {
    const pipeline   = pipelineRef.current;
    const nodeStack  = nodeStackRef.current;
    const nodeX      = nodeXRef.current;
    const nodeShield = nodeShieldRef.current;
    const beamPath   = beamPathRef.current;
    const beamGlow   = beamGlowRef.current;
    const gradient   = gradientRef.current;
    const splash     = splashRef.current;
    if (!pipeline || !nodeStack || !nodeX || !nodeShield) return;

    const svgEl = pipeline.querySelector('svg.hb-svg');

    /* Recompute beam path from DOM positions */
    function computePath() {
      const pRect  = pipeline.getBoundingClientRect();
      const sRect  = nodeStack.getBoundingClientRect();
      const xRect  = nodeX.getBoundingClientRect();
      const shRect = nodeShield.getBoundingClientRect();

      const startX = sRect.left  + sRect.width  / 2 - pRect.left;
      const startY = sRect.top   + sRect.height / 2 - pRect.top;
      const midX   = xRect.left  + xRect.width  / 2 - pRect.left;
      const midY   = xRect.top   + xRect.height / 2 - pRect.top;
      const endX   = shRect.left + shRect.width  / 2 - pRect.left;
      const endY   = shRect.top  + shRect.height / 2 - pRect.top;

      const d = `M ${startX},${startY} L ${midX},${midY} L ${endX},${endY}`;
      beamPath?.setAttribute('d', d);
      beamGlow?.setAttribute('d', d);

      if (svgEl) {
        svgEl.setAttribute('width',  String(pRect.width));
        svgEl.setAttribute('height', String(pRect.height));
      }
    }

    /* Ease in-out */
    function ease(t) {
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    /* Slide the bright window along the gradient */
    function moveGradient(pct) {
      if (!gradient) return;
      const c = pct * 100;
      gradient.setAttribute('x1', `${c - 10}%`);
      gradient.setAttribute('x2', `${c + 10}%`);
    }

    /* State machine ─────────────────────────────── */
    let state      = 'p1';
    let lastChange = performance.now();
    let rafId;

    function tick(now) {
      const elapsed = now - lastChange;

      if (state === 'p1') {
        const t   = Math.min(elapsed / 800, 1);
        const pct = ease(t) * 0.5;
        moveGradient(pct);

        if (pct < 0.3) nodeStack.classList.add('active');
        else           nodeStack.classList.remove('active');

        if (t >= 1) {
          nodeStack.classList.remove('active');
          if (beamPath) beamPath.style.opacity = '0';
          if (beamGlow) beamGlow.style.opacity = '0';
          if (splash) {
            splash.classList.remove('animate');
            void splash.offsetWidth;          // force reflow to restart animation
            splash.classList.add('animate');
          }
          state      = 'splash';
          lastChange = now;
        }

      } else if (state === 'splash') {
        if (elapsed >= 800) {
          if (beamPath) beamPath.style.opacity = '1';
          if (beamGlow) beamGlow.style.opacity = '0.6';
          state      = 'p2';
          lastChange = now;
        }

      } else if (state === 'p2') {
        const t   = Math.min(elapsed / 800, 1);
        const pct = 0.5 + ease(t) * 0.5;
        moveGradient(pct);

        if (pct > 0.65) nodeShield.classList.add('active');
        else             nodeShield.classList.remove('active');

        if (t >= 1) {
          nodeShield.classList.remove('active');
          state      = 'idle';
          lastChange = now;
        }

      } else if (state === 'idle') {
        if (elapsed >= 1000) {
          moveGradient(0);
          state      = 'p1';
          lastChange = now;
        }
      }

      rafId = requestAnimationFrame(tick);
    }

    computePath();
    window.addEventListener('resize', computePath);
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', computePath);
    };
  }, []);

  return (
    <div className="hb-pipeline" ref={pipelineRef}>

      {/* ── Beam SVG (sits on top of everything) ── */}
      <svg className="hb-svg" style={{
        position: 'absolute', top: 0, left: 0,
        overflow: 'visible', pointerEvents: 'none', zIndex: 2,
      }}>
        <defs>
          <filter id="hb-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur"/>
            <feComposite in="SourceGraphic" in2="blur" operator="over"/>
          </filter>
          <linearGradient
            id="hb-beam-grad"
            ref={gradientRef}
            gradientUnits="userSpaceOnUse"
            x1="-10%" x2="10%" y1="0%" y2="0%"
          >
            <stop offset="0%"   stopColor="#2c99b7" stopOpacity="0"/>
            <stop offset="20%"  stopColor="#2c99b7" stopOpacity="0.85"/>
            <stop offset="50%"  stopColor="#ffffff" stopOpacity="1"/>
            <stop offset="80%"  stopColor="#61c4ca" stopOpacity="0.85"/>
            <stop offset="100%" stopColor="#61c4ca" stopOpacity="0"/>
          </linearGradient>
        </defs>

        {/* Glow layer */}
        <path ref={beamGlowRef}
          stroke="url(#hb-beam-grad)" strokeWidth="2.5"
          fill="none" filter="url(#hb-glow)"
          style={{ opacity: 0.6 }}
        />
        {/* Core line */}
        <path ref={beamPathRef}
          stroke="url(#hb-beam-grad)" strokeWidth="0.9"
          fill="none"
        />
      </svg>

      {/* ── Left node  (Layers / database schema) ── */}
      <div className="hb-node hb-node-left" ref={nodeStackRef}>
        <svg viewBox="0 0 24 24" width="20" height="20"
          stroke="rgba(255,255,255,0.75)" strokeWidth="1.5"
          fill="none" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2"/>
          <polyline points="2 17 12 22 22 17"/>
          <polyline points="2 12 12 17 22 12"/>
        </svg>
      </div>

      {/* ── Connector left ── */}
      <div className="hb-line"/>

      {/* ── Centre node (Database cylinder) ── */}
      <div style={{ position: 'relative' }}>
        <div className="hb-splash" ref={splashRef}/>
        <div className="hb-node-center" ref={nodeXRef}>
          <svg viewBox="0 0 24 24" width="28" height="28"
            fill="none" stroke="white" strokeWidth="1.6"
            strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="5" rx="9" ry="3"/>
            <path d="M3 5v4c0 1.657 4.029 3 9 3s9-1.343 9-3V5"/>
            <path d="M3 9v4c0 1.657 4.029 3 9 3s9-1.343 9-3V9"/>
            <path d="M3 13v4c0 1.657 4.029 3 9 3s9-1.343 9-3v-4"/>
          </svg>
        </div>
      </div>

      {/* ── Connector right ── */}
      <div className="hb-line hb-line-right"/>

      {/* ── Right node (Shield / access control) ── */}
      <div className="hb-node hb-node-right" ref={nodeShieldRef}>
        <svg viewBox="0 0 24 24" width="20" height="20"
          stroke="rgba(255,255,255,0.75)" strokeWidth="1.5"
          fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <polyline points="9 12 11 14 15 10"/>
        </svg>
      </div>

    </div>
  );
}
