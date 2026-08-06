/* The flat mark: the same invitation fold as the 3D emblem, drawn once.
 *
 * Every coordinate is projected from the emblem's own geometry rather than
 * redrawn by eye — the card outline is notchPoly(0.775, 0.62, 0) mapped into a
 * 64-unit box, the three jaali piercings sit where the extruded holes sit, and
 * the flap is the cut triangle reflected across its hinge. That is why the mark
 * and the hero read as the same object rather than as a logo and a render. */

export function Mark({ size = 40, title }: { size?: number; title?: string }) {
  return (
    <svg
      className="mark"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {/* the light, behind the screen */}
      <circle cx="23.4" cy="40.6" r="15" className="mark-glow" />
      {/* card — ivory face, notched at the top right. evenodd turns the three
          jaali diamonds into real piercings so the light comes through them
          rather than being painted on top. */}
      <path
        className="mark-card"
        fillRule="evenodd"
        d="M6 58 L58 58 L58 26.8 L37.2 6 L6 6 Z
           M17.85 32.65 l2.3 2.3 -2.3 2.3 -2.3 -2.3 Z
           M23.44 38.25 l2.3 2.3 -2.3 2.3 -2.3 -2.3 Z
           M29.04 43.85 l2.3 2.3 -2.3 2.3 -2.3 -2.3 Z"
      />
      {/* recessed brass rule, one step inside the outline */}
      <path
        d="M11 53 L53 53 L53 28.9 L35.1 11 L11 11 Z"
        className="mark-rule"
        fill="none"
        strokeWidth="1.4"
      />
      {/* the corner, turned back */}
      <path d="M58 26.8 L37.2 6 L37.2 26.8 Z" className="mark-flap" />
      <path d="M58 26.8 L37.2 6" className="mark-hinge" fill="none" strokeWidth="1.3" />
    </svg>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand" aria-label="Nimanto">
      <Mark size={compact ? 24 : 28} />
      {!compact && <span className="brand-word">Nimanto</span>}
    </span>
  );
}
