import { ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AcessoNegado() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 36 }}>
      <div className="card" style={{ maxWidth: 560, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <ShieldAlert size={22} color="#e53e3e" />
          <h2 style={{ margin: 0 }}>Acesso negado</h2>
        </div>
        <p style={{ color: '#4a5568', marginBottom: 16 }}>
          Seu perfil não possui permissão para acessar este módulo.
        </p>
        <Link to="/" className="btn btn-primary">Voltar ao Painel</Link>
      </div>
    </div>
  );
}
