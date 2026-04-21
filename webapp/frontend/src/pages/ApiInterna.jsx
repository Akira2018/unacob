import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpenText, HeartPulse, KeyRound, ShieldCheck } from 'lucide-react';
import DocumentationBreadcrumbs from '../components/DocumentationBreadcrumbs';

const nativeDocs = [
  { label: 'Swagger UI', path: '/docs' },
  { label: 'ReDoc', path: '/redoc' },
  { label: 'OpenAPI JSON', path: '/openapi.json' },
  { label: 'Healthcheck', path: '/api/health' },
];

const mainResources = [
  {
    title: 'Autenticação',
    items: ['POST /api/auth/login retorna JWT', 'GET /api/auth/me devolve o usuário autenticado', 'Header predominante: Authorization: Bearer <token>'],
  },
  {
    title: 'Usuários e associados',
    items: ['GET/POST /api/users para gestão interna', 'GET/POST /api/membros para consulta e cadastro', 'PUT/DELETE para manutenção de registros existentes'],
  },
  {
    title: 'Financeiro e conciliação',
    items: ['GET/POST /api/pagamentos', 'POST /api/pagamentos/baixa-automatica-banco', 'Uploads de CSV, OFX, RET, REM e PDF na conciliação'],
  },
];

const relatedGuides = [
  { label: 'Guia de arquitetura', route: '/documentacao/arquitetura' },
  { label: 'Troubleshooting interno', route: '/documentacao/troubleshooting' },
  { label: 'Hub de documentação', route: '/documentacao' },
];

export default function ApiInterna() {
  return (
    <div>
      <DocumentationBreadcrumbs
        items={[
          { label: 'Central de Documentação', to: '/documentacao' },
          { label: 'Guia de API' },
        ]}
      />

      <div className="topbar documentation-topbar">
        <div>
          <h2>Guia de API</h2>
          <p className="documentation-subtitle">
            Referência operacional para autenticação, healthcheck, recursos principais e pontos de consulta rápida da API.
          </p>
        </div>
        <Link to="/documentacao" className="btn btn-outline documentation-back-btn">
          <ArrowLeft size={15} /> Voltar para a central
        </Link>
      </div>

      <div className="card documentation-hero documentation-inner-hero">
        <div className="documentation-hero-copy">
          <span className="documentation-kicker">Integração</span>
          <h3>Comece pelo base path, confirme autenticação e só depois avance para payloads e regras específicas.</h3>
          <p>
            A maior parte dos endpoints usa JSON e exige token JWT. Alguns recursos retornam arquivos ou aceitam upload de documentos bancários.
          </p>
        </div>
      </div>

      <div className="documentation-columns">
        <div className="card documentation-inner-card">
          <div className="card-title"><KeyRound size={16} /> Visão geral</div>
          <ul className="documentation-list compact-list">
            <li>Base path principal: /api</li>
            <li>Documentação nativa: /docs, /redoc e /openapi.json</li>
            <li>Formato predominante: JSON, com downloads e uploads pontuais</li>
          </ul>
        </div>

        <div className="card documentation-inner-card">
          <div className="card-title"><HeartPulse size={16} /> Pontos de verificação</div>
          <ul className="documentation-list compact-list">
            {nativeDocs.map((item) => (
              <li key={item.path}>{item.label}: {item.path}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card documentation-inner-card">
        <div className="card-title"><ShieldCheck size={16} /> Recursos principais</div>
        <div className="documentation-guide-grid">
          {mainResources.map((resource) => (
            <div key={resource.title} className="documentation-guide-item">
              <strong>{resource.title}</strong>
              <ul className="documentation-list compact-list">
                {resource.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="card documentation-inner-card">
        <div className="card-title"><BookOpenText size={16} /> Guias relacionados</div>
        <div className="documentation-related-links documentation-related-links-spaced">
          {relatedGuides.map((guide) => (
            <Link key={guide.route} to={guide.route} className="documentation-inline-link">{guide.label}</Link>
          ))}
        </div>
      </div>
    </div>
  );
}