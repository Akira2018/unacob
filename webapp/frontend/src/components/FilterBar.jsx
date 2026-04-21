export default function FilterBar({ children, className = '', style }) {
  const classes = ['filters', className].filter(Boolean).join(' ');

  return (
    <div className={classes} style={style}>
      {children}
    </div>
  );
}