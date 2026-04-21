import { Link as LinkIcon } from 'lucide-react';

export default function FestaLinkBar({
  text,
  onCopy,
  buttonLabel = 'Copiar link',
  disabled = false,
  title,
  className = '',
  marginBottom,
}) {
  const classes = ['festa-link-bar', className].filter(Boolean).join(' ');

  return (
    <div className={classes} style={marginBottom != null ? { marginBottom } : undefined}>
      <LinkIcon size={13} color="#1e3a5f" />
      <span className="festa-link-bar-text">{text}</span>
      <button className="btn btn-outline btn-sm" onClick={onCopy} disabled={disabled} title={title}>
        {buttonLabel}
      </button>
    </div>
  );
}