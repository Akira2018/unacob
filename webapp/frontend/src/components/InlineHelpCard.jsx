import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

const ROLE_LABELS = {
  administrador: 'Administrador',
  gerente: 'Gerente',
  assistente: 'Assistente',
};

export default function InlineHelpCard({
  messagesByRole,
  fallbackMessage,
  defaultLabel = 'Operação',
  links = [],
  title = 'Ajuda nesta tela',
  variant = 'help',
  style,
}) {
  const { user } = useAuth();
  const role = user?.role;
  const roleLabel = ROLE_LABELS[role] || defaultLabel;
  const helpText = messagesByRole?.[role] || fallbackMessage;

  return (
    <div className={`card inline-help-card inline-help-card-${variant}`} style={{ marginBottom: 16, ...style }}>
      <div className="card-title inline-help-card-title">{title}</div>
      <p className="documentation-note" style={{ marginBottom: 12 }}>
        <strong>{roleLabel}:</strong> {helpText}
      </p>
      <div className="documentation-next-links">
        {links.map((link) => (
          <Link key={link.to} to={link.to} className="documentation-inline-link">{link.label}</Link>
        ))}
      </div>
    </div>
  );
}