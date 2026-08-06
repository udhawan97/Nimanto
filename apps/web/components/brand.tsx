export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand" aria-label="Nimanto">
      <svg className="brand-mark" viewBox="0 0 40 40" aria-hidden="true">
        <path d="M8 31V9h5.6l12.8 15.2V9H32v22h-5.5L13.6 15.7V31H8Z" fill="currentColor" />
        <path d="M28.6 7.5h5v5h-5z" className="brand-spark-frame" />
        <circle cx="31.1" cy="10" r="1.25" className="brand-spark" />
      </svg>
      {!compact && <span>Nimanto</span>}
    </span>
  );
}
