export function SummaryCardText({ as: Component = 'div', muted = false, className = '', style, children }) {
  const classes = [muted ? 'summary-card-text-muted' : 'summary-card-text', className].filter(Boolean).join(' ');

  return (
    <Component className={classes} style={style}>
      {children}
    </Component>
  );
}

export default function SummaryCard({
  title,
  titleIcon,
  variant = 'info',
  actions,
  className = '',
  style,
  children,
}) {
  const classes = ['card', 'summary-card', `summary-card-${variant}`, className].filter(Boolean).join(' ');

  return (
    <div className={classes} style={style}>
      {title ? <div className="card-title">{titleIcon}{title}</div> : null}
      {children}
      {actions ? <div className="summary-card-actions">{actions}</div> : null}
    </div>
  );
}