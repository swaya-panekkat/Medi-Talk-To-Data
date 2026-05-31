import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

/**
 * Glowing gradient-border feature card.
 *
 * Props:
 *   title       – card heading
 *   description – body text
 *   icon        – a lucide-react component (e.g. <Users />)
 *   gradient    – CSS gradient string used for glow + border
 *   linkText    – bottom CTA label  (e.g. "Query Patient Data")
 *   delay       – framer-motion entrance delay (seconds)
 */
export default function FeatureCard({
  title,
  description,
  icon: Icon,
  gradient,
  linkText,
  delay = 0,
}) {
  return (
    <motion.div
      style={{
        position:      'relative',
        display:       'flex',
        flexDirection: 'column',
        width:         '100%',
        margin:        '0 auto',
      }}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.8, ease: 'easeOut', delay }}
    >
      {/* ── Glow layer ── */}
      <div
        aria-hidden="true"
        style={{
          position:      'absolute',
          inset:         0,
          width:         '100%',
          height:        '100%',
          opacity:       0.52,
          borderRadius:  '40px',
          pointerEvents: 'none',
          background:    gradient,
          filter:        'blur(48px)',
          zIndex:        0,
        }}
      />

      {/* ── Foreground card ── */}
      <div
        className="feat-card-hover"
        style={{
          position:     'relative',
          alignSelf:    'stretch',
          borderRadius: '40px',
          zIndex:       10,
          overflow:     'hidden',
          border:       '8px solid transparent',
          background:   `linear-gradient(#0a1628, #071220) padding-box,
                         ${gradient} border-box`,
          width:        '100%',
          cursor:       'default',
        }}
      >
        {/* ── Content ── */}
        <div
          style={{
            width:          '100%',
            height:         '100%',
            padding:        '28px',
            display:        'flex',
            flexDirection:  'column',
            justifyContent: 'space-between',
            minHeight:      '280px',
            gap:            '16px',
          }}
        >
          {/* Top: Icon */}
          <div style={{ color: 'rgba(255,255,255,0.88)' }}>
            {Icon && <Icon size={32} strokeWidth={2.5} />}
          </div>

          {/* Middle: Title + Description (fills remaining space) */}
          <div style={{ flex: 1 }}>
            <h3
              style={{
                color:         '#ffffff',
                fontWeight:    600,
                fontSize:      '19px',
                margin:        '0 0 10px 0',
                letterSpacing: '-0.02em',
                lineHeight:    1.25,
              }}
            >
              {title}
            </h3>
            <p
              style={{
                color:      '#8fa8bf',
                fontSize:   '13.5px',
                lineHeight: 1.65,
                fontWeight: 400,
                margin:     0,
              }}
            >
              {description}
            </p>
          </div>

          {/* Bottom: CTA link */}
          {linkText && (
            <div className="feat-card-link">
              <span>{linkText}</span>
              <ArrowRight size={14} className="feat-card-arrow" />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
