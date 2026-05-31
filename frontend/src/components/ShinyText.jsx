import { useEffect, useRef } from 'react';
import { animate } from 'framer-motion';

/**
 * Animated shiny-sweep text.
 * Uses framer-motion's animate() to drive backgroundPosition so the
 * highlight sweeps continuously from right → left.
 *
 * Props:
 *   children    – text content
 *   speed       – sweep duration in seconds  (default 3)
 *   baseColor   – base text colour           (default #64CEFB)
 *   shineColor  – highlight colour           (default #ffffff)
 *   spread      – gradient angle in degrees  (default 100)
 *   className   – extra class names
 */
export default function ShinyText({
  children,
  speed      = 3,
  baseColor  = '#64CEFB',
  shineColor = '#ffffff',
  spread     = 100,
  className  = '',
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;

    // Drive a plain number from 200 → -200 and write it directly
    // to backgroundPosition so we avoid React re-renders on every frame.
    const controls = animate(200, -200, {
      duration:   speed,
      repeat:     Infinity,
      ease:       'linear',
      onUpdate(v) {
        if (ref.current) {
          ref.current.style.backgroundPosition = `${v}% center`;
        }
      },
    });

    return () => controls.stop();
  }, [speed]);

  return (
    <span
      ref={ref}
      className={className}
      style={{
        /* Three-stop gradient: base → shine → base */
        background: `linear-gradient(
          ${spread}deg,
          ${baseColor}  20%,
          ${shineColor} 50%,
          ${baseColor}  80%
        )`,
        backgroundSize:            '200% auto',
        backgroundPosition:        '200% center',
        WebkitBackgroundClip:      'text',
        backgroundClip:            'text',
        WebkitTextFillColor:       'transparent',
        color:                     'transparent',
        display:                   'inline-block',
      }}
    >
      {children}
    </span>
  );
}
