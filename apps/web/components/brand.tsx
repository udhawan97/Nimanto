/* The flat mark: the same fold lotus as the 3D emblem, drawn once.
 *
 * Every coordinate is projected from the emblem's own geometry rather than
 * redrawn by eye — each petal is petalShape(w, h) from the brand source, placed
 * at the angle and root offset the 3D scene uses, mapped into a 64-unit box.
 * That is why the mark and the hero read as the same object rather than as a
 * logo and a render. */

const PETALS = [
  {
    key: "outer-right",
    material: "ivory",
    at: "translate(34.70 48.68) rotate(64)",
    d: "M0 -27.50 Q8.08 -19.25 5.45 -8.25 Q3.30 -1.51 0 0 Q-3.30 -1.51 -5.45 -8.25 Q-8.08 -19.25 0 -27.50 Z",
    vein: "M0 0 L0 -27.50",
  },
  {
    key: "inner-right",
    material: "lacquer",
    at: "translate(33.63 47.48) rotate(33)",
    d: "M0 -36.00 Q9.80 -25.20 6.60 -10.80 Q4.00 -1.98 0 0 Q-4.00 -1.98 -6.60 -10.80 Q-9.80 -25.20 0 -36.00 Z",
    vein: "M0 0 L0 -36.00",
  },
  {
    key: "inner-left",
    material: "lacquer",
    at: "translate(30.64 47.33) rotate(-27)",
    d: "M0 -34.50 Q9.31 -24.15 6.27 -10.35 Q3.80 -1.90 0 0 Q-3.80 -1.90 -6.27 -10.35 Q-9.31 -24.15 0 -34.50 Z",
    vein: "M0 0 L0 -34.50",
  },
  {
    key: "crown",
    material: "lacquer",
    at: "translate(32.16 47.00) rotate(3)",
    d: "M0 -41.50 Q11.03 -29.05 7.43 -12.45 Q4.50 -2.28 0 0 Q-4.50 -2.28 -7.43 -12.45 Q-11.03 -29.05 0 -41.50 Z",
    vein: "M0 0 L0 -41.50",
  },
  {
    key: "outer-left",
    material: "ivory",
    at: "translate(29.51 48.32) rotate(-56)",
    d: "M0 -25.50 Q7.59 -17.85 5.12 -7.65 Q3.10 -1.40 0 0 Q-3.10 -1.40 -5.12 -7.65 Q-7.59 -17.85 0 -25.50 Z",
    vein: "M0 0 L0 -25.50",
  },
];

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
      {/* the light behind the seed */}
      <circle cx="32" cy="50" r="9" className="mark-glow" />
      {/* five petals: two ivory outer, three lacquer inner, brass at every edge.
          Lacquer first so the ivory pair reads in front, as it does in 3D. */}
      {PETALS.map((petal) => (
        <g key={petal.key} transform={petal.at}>
          <path className={`mark-petal is-${petal.material}`} d={petal.d} strokeWidth="0.5" />
          <path className="mark-vein" d={petal.vein} fill="none" strokeWidth="0.4" />
        </g>
      ))}
      {/* the seed at the axis, in its brass hub */}
      <circle cx="32" cy="50" r="3.1" className="mark-seed" />
      <circle cx="32" cy="50" r="4.2" className="mark-hub" fill="none" strokeWidth="1.5" />
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
