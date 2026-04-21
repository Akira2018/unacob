import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpenText, Database, Layers3, ShieldCheck } from 'lucide-react';
import DocumentationBreadcrumbs from '../components/DocumentationBreadcrumbs';

const layers = [
  {
    title: 'Frontend SPA',
    items: ['React + Vite no navegador', 'React Router para rotas protegidas', 'Axios e contexto de autenticação no cliente'],
  },
  {
    title: 'Backend monolítico',
    items: ['FastAPI como camada HTTP', 'JWT e roles para autenticação e autorização', 'Regras de negócio concentradas em main.py'],
  },
  {
    title: 'Persistência e integrações',
    items: ['SQLAlchemy para modelos e sessão', 'SQLite local ou PostgreSQL via DATABASE_URL', 'Arquivos operacionais e SMTP como integrações de apoio'],
  },
];

const risks = [
  'main.py concentra muitas responsabilidades e aumenta acoplamento.',
  'Não há suíte formal de testes cobrindo regras críticas.',
  'Não existe migração versionada explícita de banco.',
  'Artefatos legados na raiz exigem disciplina operacional.',
];

const relatedGuides = [
  { label: 'Guia de API', route: '/documentacao/api' },
  { label: 'Guia de ambiente', route: '/documentacao/ambiente' },
  { label: 'Hub de documentação', route: '/documentacao' },
];

export default function ArquiteturaInterna() {
  return (
    <div>
      <DocumentationBreadcrumbs
        items={[
          { label: 'Central de Documentação', to: '/documentacao' },
          { label: 'Guia de Arquitetura' },
        ]}
      />

      <div className="topbar documentation-topbar">
        <div>
          <h2>Guia de Arquitetura</h2>
          <p className="documentation-subtitle">
            Visão técnica do desenho atual do sistema, camadas, domínios e riscos estruturais mais relevantes.
          </p>
        </div>
        <Link to="/documentacao" className="btn btn-outline documentation-back-btn">
          <ArrowLeft size={15} /> Voltar para a central
        </Link>
      </div>

      <div className="card documentation-hero documentation-inner-hero">
        <div className="documentation-hero-copy">
          <span className="documentation-kicker">Estrutura</span>
          <h3>O sistema combina frontend SPA, backend monolítico em FastAPI e persistência relacional com forte foco operacional.</h3>
          <p>
            Use esta página para explicar o desenho atual, localizar responsabilidades por camada e entender os principais riscos de manutenção.
          </p>
        </div>
      </div>

      <div className="card documentation-inner-card">
        <div className="card-title"><Layers3 size={16} /> Camadas principais</div>
        <div className="documentation-guide-grid">
          {layers.map((layer) => (
            <div key={layer.title} className="documentation-guide-item">
              <strong>{layer.title}</strong>
              <ul className="documentation-list compact-list">
                {layer.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="documentation-columns">
        <div className="card documentation-inner-card">
          <div className="card-title"><Database size={16} /> Domínios funcionais</div>
          <ul className="documentation-list compact-list">
            <li>Segurança e usuários</li>
            <li>Cadastro de associados</li>
            <li>Financeiro, pagamentos e fluxo de caixa</li>
            <li>Conciliação bancária e importações</li>
            <li>Aplicações financeiras, eventos e utilitários</li>
          </ul>
        </div>

        <div className="card documentation-inner-card">
          <div className="card-title"><ShieldCheck size={16} /> Riscos técnicos</div>
          <ul className="documentation-list compact-list">
            {risks.map((risk) => (
              <li key={risk}>{risk}</li>
            ))}
          </ul>
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