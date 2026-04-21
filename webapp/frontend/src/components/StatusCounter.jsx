export default function StatusCounter({ count, singular, plural, className = 'status-counter' }) {
  return <span className={className}>{count} {count === 1 ? singular : plural}</span>;
}