import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpenText, Database, Rocket, ShieldCheck } from 'lucide-react';
import DocumentationBreadcrumbs from '../components/DocumentationBreadcrumbs';

const backendVars = [
  'DATABASE_URL',
  'SECRET_KEY',
  'ACCESS_TOKEN_EXPIRE_MINUTES',
  'SQLITE_BUSY_TIMEOUT_MS',
  'SQLITE_JOURNAL_MODE',
  'BACKUP_RETENTION_COUNT',
  'FRONTEND_URL',
  'SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD',
];

const frontendVars = [
  'VITE_API_BASE_URL',
  'VITE_BASE_PATH',
];

const environments = [
  {
    title: 'Execução local',
    notes: [
      'Backend lê webapp/backend/.env e tende a usar SQLite por padrão.',
      'Frontend pode usar webapp/frontend/.env.local com VITE_API_BASE_URL apontando para a API local.',
      'Após qualquer ajuste de ambiente, valide /api/health antes de seguir.',
    ],
  },
  {
    title: 'Docker Compose',
    notes: [
      'O backend usa webapp/backend/.env via env_file.',
      'O frontend costuma operar melhor com VITE_API_BASE_URL=/api quando há reverse proxy.',
      'Confirme volumes persistentes se o banco for SQLite.',
    ],
  },
  {
    title: 'Render e Railway',
    notes: [
      'SECRET_KEY e DATABASE_URL são obrigatórios em produção.',
      'SMTP precisa ser configurado manualmente se houver convites ou e-mails automáticos.',
      'Valide healthcheck e envio de e-mail após publicação.',
    ],
  },
];

const relatedGuides = [
  { label: 'Troubleshooting interno', route: '/documentacao/troubleshooting' },
  { label: 'Guia de importações', route: '/documentacao/importacoes' },
  { label: 'Manual do usuário', route: '/documentacao/manual' },
];

export default function AmbienteInterno() {
  return (
    <div>
      <DocumentationBreadcrumbs
        items={[
          { label: 'Central de Documentação', to: '/documentacao' },
          { label: 'Guia de Ambiente' },
        ]}
      />

      <div className="topbar documentation-topbar">
        <div>
          <h2>Guia de Ambiente</h2>
          <p className="documentation-subtitle">
            Versão interna para configuração local, Docker e hospedagem, com foco em variáveis essenciais e checagens pós-ajuste.
          </p>
        </div>
        <Link to="/documentacao" className="btn btn-outline documentation-back-btn">
          <ArrowLeft size={15} /> Voltar para a central
        </Link>
      </div>

      <div className="card documentation-hero documentation-inner-hero">
        <div className="documentation-hero-copy">
          <span className="documentation-kicker">Configuração</span>
          <h3>Ambiente correto primeiro, troubleshooting depois.</h3>
          <p>
            Use esta página para revisar variáveis, diferenças entre ambientes e a ordem mínima de validação depois de qualquer mudança de configuração.
          </p>
        </div>
      </div>

      <div className="documentation-columns">
        <div className="card documentation-inner-card">
          <div className="card-title"><Database size={16} /> Backend</div>
          <p className="documentation-note">Arquivo de referência: webapp/backend/.env.example</p>
          <ul className="documentation-list compact-list">
            {backendVars.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="card documentation-inner-card">
          <div className="card-title"><ShieldCheck size={16} /> Frontend</div>
          <p className="documentation-note">Arquivo sugerido: webapp/frontend/.env.local</p>
          <ul className="documentation-list compact-list">
            {frontendVars.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card documentation-inner-card">
        <div className="card-title"><Rocket size={16} /> Ambientes suportados</div>
        <div className="documentation-guide-grid">
          {environments.map((environment) => (
            <div key={environment.title} className="documentation-guide-item">
              <strong>{environment.title}</strong>
              <ul className="documentation-list compact-list">
                {environment.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="card documentation-inner-card">
        <div className="card-title"><BookOpenText size={16} /> Checagem final</div>
        <ol className="documentation-ordered-list">
          <li>Revisar segredos e URLs por ambiente.</li>
          <li>Confirmar resposta em /api/health.</li>
          <li>Validar login e uma operação simples no frontend.</li>
          <li>Testar SMTP e backup quando fizerem parte do ambiente.</li>
        </ol>
        <div className="documentation-related-links documentation-related-links-spaced">
          {relatedGuides.map((guide) => (
            <Link key={guide.route} to={guide.route} className="documentation-inline-link">{guide.label}</Link>
          ))}
        </div>
      </div>
    </div>
  );
}