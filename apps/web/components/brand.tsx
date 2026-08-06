/* The flat mark: the same fold lotus as the 3D emblem, drawn once.
 *
 * Every coordinate is projected from the emblem's own geometry rather than
 * redrawn by eye — each petal is petalShape(w, h) from the brand source, placed
 * at the angle and root offset the 3D scene uses, mapped into a 64-unit box.
 * That is why the mark and the hero read as the same object rather than as a
 * logo and a render. */

const HUB = { x: 32, y: 54.57 };
const SEED_R = 3.27;
const HUB_R = 4.4;
const HUB_W = 2.05;
const GLOW_R = 11.93;
const STROKE = 0.57;
const VEIN_W = 0.45;

const PETALS = [
  {
    key: "inner-right",
    material: "lacquer",
    at: "translate(33.7 51.62) rotate(-30)",
    d: "M0 -40.06 Q10.85 -28.04 7.3 -12.02 Q4.43 -2.22 0 0 Q-4.43 -2.22 -7.3 -12.02 Q-10.85 -28.04 0 -40.06 Z",
    vein: "M0 0 L0 -40.06",
  },
  {
    key: "inner-left",
    material: "lacquer",
    at: "translate(30.3 51.62) rotate(30)",
    d: "M0 -40.06 Q10.85 -28.04 7.3 -12.02 Q4.43 -2.22 0 0 Q-4.43 -2.22 -7.3 -12.02 Q-10.85 -28.04 0 -40.06 Z",
    vein: "M0 0 L0 -40.06",
  },
  {
    key: "crown",
    material: "crown",
    at: "translate(32 51.16) rotate(0)",
    d: "M0 -47.16 Q12.53 -33.01 8.44 -14.15 Q5.11 -2.59 0 0 Q-5.11 -2.59 -8.44 -14.15 Q-12.53 -33.01 0 -47.16 Z",
    vein: "M0 0 L0 -47.16",
  },
  {
    key: "outer-right",
    material: "ivory",
    at: "translate(34.95 52.87) rotate(-60)",
    d: "M0 -30.12 Q8.92 -21.08 5.99 -9.04 Q3.64 -1.65 0 0 Q-3.64 -1.65 -5.99 -9.04 Q-8.92 -21.08 0 -30.12 Z",
    vein: "M0 0 L0 -30.12",
  },
  {
    key: "outer-left",
    material: "ivory",
    at: "translate(29.05 52.87) rotate(60)",
    d: "M0 -30.12 Q8.92 -21.08 5.99 -9.04 Q3.64 -1.65 0 0 Q-3.64 -1.65 -5.99 -9.04 Q-8.92 -21.08 0 -30.12 Z",
    vein: "M0 0 L0 -30.12",
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
      <circle cx={HUB.x} cy={HUB.y} r={GLOW_R} className="mark-glow" />
      {/* five petals: two ivory outer, three lacquer inner, brass at every edge.
          Lacquer first so the ivory pair reads in front, as it does in 3D. */}
      {PETALS.map((petal) => (
        <g key={petal.key} transform={petal.at}>
          <path className={`mark-petal is-${petal.material}`} d={petal.d} strokeWidth={STROKE} />
          <path className="mark-vein" d={petal.vein} fill="none" strokeWidth={VEIN_W} />
        </g>
      ))}
      {/* the seed at the axis, in its brass hub */}
      <circle cx={HUB.x} cy={HUB.y} r={SEED_R} className="mark-seed" />
      <circle
        cx={HUB.x}
        cy={HUB.y}
        r={HUB_R}
        className="mark-hub"
        fill="none"
        strokeWidth={HUB_W}
      />
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
