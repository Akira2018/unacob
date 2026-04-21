export function FestaSummaryItem({ label, value, valueClassName = '', children }) {
  return (
    <div>
      <span className="festa-summary-item-label">{label}</span>
      <br />
      {children || <strong className={["festa-summary-item-value", valueClassName].filter(Boolean).join(' ')}>{value}</strong>}
    </div>
  );
}

export default function FestaSummaryStrip({ children }) {
  return <div className="festa-summary-strip">{children}</div>;
}