import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpenText,
  Workflow,
  ShieldCheck,
  Database,
  Wrench,
  FileSpreadsheet,
  Bug,
  Rocket,
  ArrowUpRight,
  HeartPulse,
  KeyRound,
  LifeBuoy,
  Printer,
} from 'lucide-react';
import { useAuth } from '../context/useAuth';

const ROLE_LABELS = {
  administrador: 'Administrador',
  gerente: 'Gerente',
  assistente: 'Assistente',
};

const ROLE_INTROS = {
  Administrador: 'Você está vendo primeiro o conteúdo de ambiente, acessos, segurança e operação administrativa.',
  Gerente: 'Você está vendo primeiro o conteúdo de fechamento, conciliação, relatórios e acompanhamento financeiro.',
  Assistente: 'Você está vendo primeiro o conteúdo de cadastros, lançamentos, importações e tarefas operacionais do dia a dia.',
};

const docsSections = [
  {
    icon: <BookOpenText size={20} />,
    title: 'O Que Existe no Sistema',
    color: 'var(--primary)',
    profiles: ['Administrador', 'Gerente', 'Assistente'],
    items: [
      'Gestão de associados, mensalidades, financeiro, eventos e relatórios.',
      'Perfis principais: administrador, gerente e assistente.',
      'Base técnica: React no frontend e FastAPI no backend.',
    ],
  },
  {
    icon: <Workflow size={20} />,
    title: 'Rotina do Mês',
    color: 'var(--success)',
    profiles: ['Gerente', 'Assistente'],
    items: [
      'Atualizar cadastros antes do fechamento do período.',
      'Lançar pagamentos, despesas e outras receitas no mês correto.',
      'Executar conciliação bancária antes de emitir relatórios finais.',
    ],
  },
  {
    icon: <Database size={20} />,
    title: 'Arquivos e Importações',
    color: '#0891b2',
    profiles: ['Administrador', 'Gerente', 'Assistente'],
    items: [
      'Extratos aceitos: CSV, OFX, RET e REM.',
      'PDF do Banco do Brasil para DABB exige texto extraível.',
      'PDF de aplicações financeiras depende do layout suportado no backend.',
    ],
  },
  {
    icon: <Rocket size={20} />,
    title: 'Deploy e Ambiente',
    color: '#975a16',
    profiles: ['Administrador'],
    items: [
      'Ambientes mapeados: local, Docker Compose, Render e Railway.',
      'Healthcheck principal: /api/health.',
      'Backup deve preceder qualquer deploy em produção.',
    ],
  },
  {
    icon: <Bug size={20} />,
    title: 'Problemas Comuns',
    color: 'var(--danger)',
    profiles: ['Administrador', 'Gerente', 'Assistente'],
    items: [
      'Falhas de sessão normalmente apontam para token expirado ou API incorreta.',
      'Falhas de importação pedem validação de extensão, conteúdo e parser.',
      'Falhas de relatório exigem revisão de filtros, dados e logs do backend.',
    ],
  },
  {
    icon: <ShieldCheck size={20} />,
    title: 'Acesso e Segurança',
    color: '#6b46c1',
    profiles: ['Administrador', 'Gerente'],
    items: [
      'SECRET_KEY não deve usar o valor de exemplo em produção.',
      'Backups e restauração são restritos a administradores.',
      'Rotinas com e-mail dependem de SMTP completo e validado.',
    ],
  },
];

const repoDocs = [
  {
    path: 'README.md',
    title: 'Guia principal do projeto',
    audience: 'Equipe técnica e operação',
    profiles: ['Administrador', 'Gerente', 'Assistente'],
    summary: 'Resumo executivo do sistema, módulos, arquitetura e navegação pelas demais referências.',
    highlights: ['Visão geral do produto e dos módulos', 'Resumo técnico do stack e da estrutura', 'Mapa para os demais documentos do projeto'],
    nextStep: 'Use este documento para orientar qualquer pessoa nova antes de aprofundar em API, ambiente ou operação.',
  },
  {
    path: 'docs/manual-do-usuario.md',
    title: 'Manual do usuário',
    audience: 'Usuários internos',
    profiles: ['Gerente', 'Assistente'],
    summary: 'Fluxos de uso por tela, orientações de operação e visão prática do sistema no dia a dia.',
    highlights: ['Tutoriais operacionais por módulo', 'Fluxos de uso recorrentes', 'Base para treinamento funcional'],
    nextStep: 'Abra quando a dúvida for sobre como executar uma rotina no sistema, e não sobre infraestrutura ou código.',
    internalRoute: '/documentacao/manual',
    internalLabel: 'Abrir manual do usuário',
  },
  {
    path: 'docs/api.md',
    title: 'Referência da API',
    audience: 'Backend, integrações e suporte',
    profiles: ['Administrador'],
    summary: 'Rotas, payloads, exemplos de resposta e atalhos para Swagger, ReDoc e OpenAPI.',
    highlights: ['Endpoints e exemplos de request/response', 'Docs nativas do FastAPI', 'Base para integrações e troubleshooting técnico'],
    nextStep: 'Consulte este material quando a dúvida estiver no contrato da API ou no comportamento de um endpoint.',
    internalRoute: '/documentacao/api',
    internalLabel: 'Abrir guia de API',
  },
  {
    path: 'docs/arquitetura.md',
    title: 'Arquitetura e desenho técnico',
    audience: 'Desenvolvimento e manutenção',
    profiles: ['Administrador'],
    summary: 'Camadas, domínios, fluxos principais e decisões estruturais do projeto.',
    highlights: ['Separação entre frontend, backend e persistência', 'Diagramas e domínios do sistema', 'Riscos e pontos de evolução técnica'],
    nextStep: 'Use este documento antes de alterar o desenho do sistema ou explicar a arquitetura para novos desenvolvedores.',
    internalRoute: '/documentacao/arquitetura',
    internalLabel: 'Abrir guia de arquitetura',
  },
  {
    path: 'docs/ambiente.md',
    title: 'Configuração de ambiente',
    audience: 'Desenvolvimento e DevOps',
    profiles: ['Administrador'],
    summary: 'Variáveis, arquivos .env, execução local, Docker Compose e plataformas de deploy.',
    highlights: ['Variáveis críticas e arquivos de exemplo', 'Execução local e via Docker', 'Parâmetros de deploy por plataforma'],
    nextStep: 'Abra este guia quando for preparar máquina, servidor ou revisar configuração quebrada.',
    internalRoute: '/documentacao/ambiente',
    internalLabel: 'Abrir guia de ambiente',
  },
  {
    path: 'docs/deploy-checklist.md',
    title: 'Checklist de deploy',
    audience: 'Operação e publicação',
    profiles: ['Administrador'],
    summary: 'Pré-deploy, validações, rollback e pontos de conferência pós-publicação.',
    highlights: ['Pré-checks antes de publicar', 'Conferência pós-deploy', 'Critérios claros de rollback'],
    nextStep: 'Use imediatamente antes de qualquer publicação, mesmo em mudanças pequenas.',
  },
  {
    path: 'docs/importacoes.md',
    title: 'Importações e arquivos suportados',
    audience: 'Financeiro e suporte funcional',
    profiles: ['Gerente', 'Assistente'],
    summary: 'Formatos aceitos, cuidados por parser e diagnóstico básico de falhas em arquivos.',
    highlights: ['Arquivos aceitos por rotina', 'Cuidados com CSV, OFX, REM, RET e PDF', 'Erros comuns de parser e conferência'],
    nextStep: 'Consulte quando houver dúvida sobre formato de arquivo ou falha na ingestão de dados.',
    internalRoute: '/documentacao/importacoes',
    internalLabel: 'Abrir guia de importações',
  },
  {
    path: 'docs/troubleshooting.md',
    title: 'Troubleshooting operacional',
    audience: 'Suporte e manutenção',
    profiles: ['Administrador', 'Gerente', 'Assistente'],
    summary: 'Erros recorrentes, causas prováveis e sequência curta de diagnóstico.',
    highlights: ['Falhas comuns de sessão, importação e relatórios', 'Causas prováveis e primeira checagem', 'Base para suporte de primeiro nível'],
    nextStep: 'Abra primeiro quando o problema já aconteceu e você precisa decidir por onde investigar.',
    internalRoute: '/documentacao/troubleshooting',
    internalLabel: 'Abrir ajuda para problemas comuns',
  },
  {
    path: 'docs/versionamento.md',
    title: 'Política de versionamento',
    audience: 'Equipe técnica',
    profiles: ['Administrador'],
    summary: 'Critérios para major, minor e patch, além do fluxo sugerido de release.',
    highlights: ['Regras de versionamento semântico', 'Critério para releases', 'Expectativa de comunicação das mudanças'],
    nextStep: 'Use quando precisar preparar release, tag ou organizar a comunicação técnica da entrega.',
  },
  {
    path: 'CHANGELOG.md',
    title: 'Histórico de mudanças',
    audience: 'Equipe técnica e gestão',
    profiles: ['Administrador', 'Gerente'],
    summary: 'Registro resumido das mudanças recentes baseado na evolução do repositório.',
    highlights: ['Mudanças recentes agrupadas por tipo', 'Visão rápida da evolução do sistema', 'Base para alinhamento entre técnica e gestão'],
    nextStep: 'Consulte quando precisar explicar o que mudou entre versões ou revisar entregas recentes.',
  },
];

const internalGuides = [
  {
    title: 'Guia de API',
    route: '/documentacao/api',
    profiles: ['Administrador'],
    summary: 'Base path, autenticação, healthcheck, principais recursos e documentação nativa do FastAPI.',
  },
  {
    title: 'Guia de Arquitetura',
    route: '/documentacao/arquitetura',
    profiles: ['Administrador'],
    summary: 'Camadas da aplicação, domínios, riscos técnicos e decisões estruturais do projeto.',
  },
  {
    title: 'Manual do Usuário',
    route: '/documentacao/manual',
    profiles: ['Gerente', 'Assistente'],
    summary: 'Fluxos operacionais, perfis de acesso, tutoriais essenciais e boas práticas de uso diário.',
  },
  {
    title: 'Troubleshooting Interno',
    route: '/documentacao/troubleshooting',
    profiles: ['Administrador', 'Gerente', 'Assistente'],
    summary: 'Incidentes recorrentes, sequência de checagem e resposta inicial para suporte de primeiro nível.',
  },
  {
    title: 'Guia de Ambiente',
    route: '/documentacao/ambiente',
    profiles: ['Administrador'],
    summary: 'Variáveis críticas, diferenças entre local, Docker e hospedagem, com checklist pós-configuração.',
  },
  {
    title: 'Guia de Importações',
    route: '/documentacao/importacoes',
    profiles: ['Gerente', 'Assistente'],
    summary: 'Formatos aceitos, checklist antes de importar e falhas mais comuns em arquivos bancários e DABB.',
  },
];

const profileGuides = [
  {
    title: 'Administrador',
    focus: 'Configuração, usuários, backup, restauração e governança do ambiente.',
  },
  {
    title: 'Gerente',
    focus: 'Fechamento financeiro, conferência de relatórios, conciliação e acompanhamento mensal.',
  },
  {
    title: 'Assistente',
    focus: 'Rotinas operacionais, cadastros, lançamentos e acompanhamento de tarefas do dia a dia.',
  },
];

const profilePrintSummaries = {
  Administrador: {
    title: 'Resumo do Administrador',
    objective: 'Garantir configuração correta, controle de acesso, continuidade operacional e segurança do ambiente.',
    priorities: [
      'Validar ambiente, variáveis críticas e saúde geral da API.',
      'Revisar usuários, permissões e acessos negados antes de tratar erro funcional.',
      'Executar backup antes de deploy, correção sensível ou restauração.',
    ],
  },
  Gerente: {
    title: 'Resumo do Gerente',
    objective: 'Conduzir fechamento operacional e financeiro com conferência de dados, conciliação e relatórios.',
    priorities: [
      'Acompanhar importações, conciliação e consistência de relatórios.',
      'Usar a trilha de onboarding para padronizar conferência mensal.',
      'Escalar para administração apenas quando houver dependência de acesso, ambiente ou publicação.',
    ],
  },
  Assistente: {
    title: 'Resumo do Assistente',
    objective: 'Executar rotinas operacionais com consistência, registrando dúvidas e escalando apenas o necessário.',
    priorities: [
      'Concentrar o trabalho em cadastros, lançamentos e conferências básicas.',
      'Usar busca, incidentes e troubleshooting antes de pedir suporte informal.',
      'Confirmar formato e período de arquivos antes de repetir importações.',
    ],
  },
};

const onboardingTracks = {
  Administrador: [
    'Ler o guia principal do projeto para entender módulos, ambiente e responsabilidades gerais.',
    'Validar variáveis críticas do ambiente, especialmente SECRET_KEY, DATABASE_URL e integrações externas.',
    'Revisar usuários, perfis de acesso, rotina de backup e fluxo de restauração antes de liberar operação.',
    'Conferir checklist de deploy e troubleshooting para responder rápido a incidentes ou publicações.',
  ],
  Gerente: [
    'Começar pelo manual do usuário para entender as telas do fluxo mensal e financeiro.',
    'Revisar importações, conciliação e relatórios que fazem parte do fechamento do período.',
    'Usar a central para localizar troubleshooting e histórico de mudanças quando houver divergências operacionais.',
    'Padronizar uma rotina de conferência final antes de validar dados ou compartilhar relatórios.',
  ],
  Assistente: [
    'Ler o manual do usuário com foco em cadastros, lançamentos e rotinas recorrentes.',
    'Treinar o fluxo de importação de arquivos e conferência básica antes de escalar problemas.',
    'Usar os filtros por perfil e a busca para localizar rapidamente orientações por tarefa.',
    'Consultar troubleshooting sempre que houver falha de sessão, arquivo inválido ou dúvida operacional.',
  ],
};

const quickChecks = [
  { icon: <HeartPulse size={16} />, label: 'API saudável', profiles: ['Administrador'], value: 'Verifique /api/health após deploy ou incidente.' },
  { icon: <KeyRound size={16} />, label: 'Sessão e login', profiles: ['Administrador', 'Gerente', 'Assistente'], value: 'Token expirado ou API errada costuma derrubar o fluxo inteiro.' },
  { icon: <FileSpreadsheet size={16} />, label: 'Relatórios', profiles: ['Gerente', 'Assistente'], value: 'Teste pelo menos um relatório simples antes de liberar uso geral.' },
  { icon: <LifeBuoy size={16} />, label: 'Backup', profiles: ['Administrador'], value: 'Antes de restauração, confirme integridade do arquivo e perfil administrador.' },
];

const taskShortcuts = [
  {
    title: 'Atualizar associados',
    route: '/membros',
    profiles: ['Administrador', 'Assistente'],
    summary: 'Entrada principal para cadastros, revisão de dados e manutenção de registros.',
  },
  {
    title: 'Conferir pagamentos',
    route: '/pagamentos',
    profiles: ['Administrador', 'Gerente'],
    summary: 'Use quando a rotina exigir consulta ou lançamento financeiro recorrente.',
  },
  {
    title: 'Executar conciliação',
    route: '/conciliacao',
    profiles: ['Administrador', 'Gerente'],
    summary: 'Ponto de entrada para comparar extratos, validar diferenças e fechar período.',
  },
  {
    title: 'Emitir relatórios',
    route: '/relatorios',
    profiles: ['Administrador', 'Gerente', 'Assistente'],
    summary: 'Atalho para geração e conferência de saídas usadas em auditoria e acompanhamento.',
  },
  {
    title: 'Gerenciar usuários',
    route: '/usuarios',
    profiles: ['Administrador'],
    summary: 'Tela crítica para criar acessos, revisar permissões e ajustar papéis.',
  },
  {
    title: 'Consultar meu cadastro',
    route: '/meu-cadastro',
    profiles: ['Administrador', 'Gerente', 'Assistente'],
    summary: 'Atalho pessoal para revisão de dados do próprio usuário autenticado.',
  },
];

const incidentActions = [
  {
    title: 'Sessão expirada ou login falhando',
    symptom: 'O usuário perde acesso, volta para login ou recebe erro de autenticação.',
    firstAction: 'Confirmar URL da API, token expirado e credenciais antes de escalar.',
    route: '/meu-cadastro',
    routeLabel: 'Revisar sessão atual',
    profiles: ['Administrador', 'Gerente', 'Assistente'],
  },
  {
    title: 'Importação rejeitada',
    symptom: 'Arquivo CSV, OFX, REM, RET ou PDF não é aceito ou gera inconsistência.',
    firstAction: 'Validar extensão, layout esperado e período do arquivo antes de repetir a rotina.',
    route: '/conciliacao',
    routeLabel: 'Abrir conciliação',
    profiles: ['Administrador', 'Gerente', 'Assistente'],
  },
  {
    title: 'Divergência de conciliação',
    symptom: 'Saldo, lançamentos ou totais importados não batem com o fechamento esperado.',
    firstAction: 'Revisar extrato, filtros do período e diferenças antes de emitir relatório final.',
    route: '/conciliacao',
    routeLabel: 'Comparar lançamentos',
    profiles: ['Administrador', 'Gerente'],
  },
  {
    title: 'Problema em relatório',
    symptom: 'Relatório vazio, parcial ou inconsistente com o que foi lançado no sistema.',
    firstAction: 'Conferir filtros, período e se os dados-base já foram conciliados.',
    route: '/relatorios',
    routeLabel: 'Testar relatório',
    profiles: ['Administrador', 'Gerente', 'Assistente'],
  },
  {
    title: 'Acesso ou permissão incorreta',
    symptom: 'Usuário não vê uma tela esperada ou cai em acesso negado.',
    firstAction: 'Verificar perfil atribuído e revisar se a operação depende de permissão financeira.',
    route: '/usuarios',
    routeLabel: 'Ajustar usuários',
    profiles: ['Administrador'],
  },
];

const profileFilters = ['Todos', 'Administrador', 'Gerente', 'Assistente'];

function buildBackendDocUrl(targetPath) {
  const rawValue = String(import.meta.env.VITE_API_BASE_URL || '').trim();
  const invalidValues = new Set(['', 'undefined', 'null', 'false']);

  if (invalidValues.has(rawValue.toLowerCase()) || rawValue === '/api') {
    return targetPath;
  }

  try {
    const parsed = new URL(rawValue);
    parsed.pathname = targetPath;
    parsed.hash = '';
    parsed.search = '';
    return parsed.toString();
  } catch {
    return targetPath;
  }
}

export default function Documentacao() {
  const { user } = useAuth();
  const currentProfile = ROLE_LABELS[user?.role] || 'Todos';
  const [searchTerm, setSearchTerm] = useState('');
  const [activeProfile, setActiveProfile] = useState(currentProfile);
  const [selectedDocPath, setSelectedDocPath] = useState('README.md');
  const normalizedSearch = searchTerm.trim().toLowerCase();

  const matchesProfile = (itemProfiles = []) => activeProfile === 'Todos' || itemProfiles.includes(activeProfile);

  const quickLinks = [
    { label: 'Swagger UI', href: buildBackendDocUrl('/docs') },
    { label: 'ReDoc', href: buildBackendDocUrl('/redoc') },
    { label: 'OpenAPI JSON', href: buildBackendDocUrl('/openapi.json') },
    { label: 'Healthcheck', href: buildBackendDocUrl('/api/health') },
  ];

  const filteredSections = docsSections.filter((section) => {
    if (!matchesProfile(section.profiles)) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    return [section.title, ...section.items].some((value) => value.toLowerCase().includes(normalizedSearch));
  });

  const filteredProfiles = profileGuides.filter((profile) => {
    if (!matchesProfile([profile.title])) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    return [profile.title, profile.focus].some((value) => value.toLowerCase().includes(normalizedSearch));
  });

  const filteredChecks = quickChecks.filter((check) => {
    if (!matchesProfile(check.profiles)) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    return [check.label, check.value].some((value) => value.toLowerCase().includes(normalizedSearch));
  });

  const filteredRepoDocs = repoDocs.filter((doc) => {
    if (!matchesProfile(doc.profiles)) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    return [doc.title, doc.path, doc.audience, doc.summary].some((value) => value.toLowerCase().includes(normalizedSearch));
  });

  const filteredTaskShortcuts = taskShortcuts.filter((shortcut) => {
    if (!matchesProfile(shortcut.profiles)) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    return [shortcut.title, shortcut.route, shortcut.summary].some((value) => value.toLowerCase().includes(normalizedSearch));
  });

  const filteredIncidentActions = incidentActions.filter((incident) => {
    if (!matchesProfile(incident.profiles)) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    return [incident.title, incident.symptom, incident.firstAction, incident.route, incident.routeLabel]
      .some((value) => value.toLowerCase().includes(normalizedSearch));
  });

  const filteredInternalGuides = internalGuides.filter((guide) => {
    if (!matchesProfile(guide.profiles)) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    return [guide.title, guide.route, guide.summary].some((value) => value.toLowerCase().includes(normalizedSearch));
  });

  const onboardingProfiles = activeProfile === 'Todos'
    ? profileGuides.map((profile) => profile.title)
    : [activeProfile];

  const visibleProfileSummaries = activeProfile === 'Todos'
    ? Object.keys(profilePrintSummaries)
    : [activeProfile];

  const selectedRepoDoc = filteredRepoDocs.find((doc) => doc.path === selectedDocPath) || filteredRepoDocs[0] || null;

  const totalMatches = filteredSections.length + filteredProfiles.length + filteredChecks.length + filteredRepoDocs.length + filteredTaskShortcuts.length + filteredIncidentActions.length + filteredInternalGuides.length;

  return (
    <div>
      <div className="topbar documentation-topbar">
        <div>
          <h2>Central de Documentação</h2>
          <p className="documentation-subtitle">
            Ponto central de ajuda para uso do sistema, tarefas frequentes e materiais de apoio.
          </p>
        </div>
        <button type="button" className="btn btn-outline documentation-print-btn" onClick={() => window.print()}>
          <Printer size={15} /> Imprimir
        </button>
      </div>

      <div className="documentation-hero card">
        <div className="documentation-hero-copy">
          <span className="documentation-kicker">Ajuda rápida</span>
          <h3>Use esta página para encontrar rápido o que fazer, onde clicar e como reagir quando algo falhar.</h3>
          <p>
            A documentação mais completa continua no repositório. Aqui ficam os atalhos e resumos mais úteis para quem está operando o sistema no dia a dia.
          </p>
          {activeProfile !== 'Todos' ? (
            <p>
              <strong>Perfil atual: {activeProfile}.</strong> {ROLE_INTROS[activeProfile]}
            </p>
          ) : null}
        </div>
        <div className="documentation-actions">
          {quickLinks.map((link) => (
            <a key={link.label} className="btn btn-outline documentation-link-btn" href={link.href} target="_blank" rel="noreferrer">
              <ArrowUpRight size={15} /> {link.label}
            </a>
          ))}
        </div>
      </div>

      <div className="card documentation-search-card">
        <div className="documentation-search-header">
          <div>
            <div className="card-title"><BookOpenText size={16} /> Busca rápida</div>
            <p className="documentation-note">
              Pesquise por tarefa, perfil, problema ou nome de documento.
            </p>
          </div>
          <span className="badge badge-info documentation-results-badge">
            {normalizedSearch ? `${totalMatches} resultados` : activeProfile === 'Todos' ? 'Busca em toda a central' : `Filtrado para ${activeProfile}`}
          </span>
        </div>

        <div className="form-group documentation-search-group">
          <label htmlFor="documentation-search">Buscar na documentação</label>
          <input
            id="documentation-search"
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Ex.: backup, conciliação, assistente, deploy, API"
          />
        </div>

        <div className="documentation-profile-filters">
          {profileFilters.map((profile) => (
            <button
              key={profile}
              type="button"
              className={`documentation-filter-chip ${activeProfile === profile ? 'documentation-filter-chip-active' : ''}`}
              onClick={() => setActiveProfile(profile)}
            >
              {profile}
            </button>
          ))}
        </div>
        {activeProfile !== 'Todos' ? (
          <p className="documentation-note documentation-related-links-spaced">
            A central abriu priorizando seu perfil. Se quiser explorar todos os materiais, clique em Todos.
          </p>
        ) : null}
      </div>

      <div className="card documentation-profile-summary-card">
        <div className="card-title"><ShieldCheck size={16} /> O que importa em cada perfil</div>
        <p className="documentation-note">
          Resumo curto para consulta rápida em tela ou impressão, destacando foco e prioridades de cada perfil.
        </p>
        <div className="documentation-profile-summary-grid">
          {visibleProfileSummaries.map((profile) => {
            const summary = profilePrintSummaries[profile];

            return (
              <div key={profile} className="documentation-profile-summary-item">
                <strong>{summary.title}</strong>
                <p>{summary.objective}</p>
                <ul>
                  {summary.priorities.map((priority) => (
                    <li key={priority}>{priority}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card documentation-guides-card">
        <div className="card-title"><BookOpenText size={16} /> Guias para consulta</div>
        <p className="documentation-note">
          Abra aqui os guias principais já adaptados para leitura dentro do sistema.
        </p>
        <div className="documentation-guides-grid">
          {filteredInternalGuides.map((guide) => (
            <Link key={guide.route} to={guide.route} className="documentation-guide-link-card">
              <strong>{guide.title}</strong>
              <span>{guide.route}</span>
              <p>{guide.summary}</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="documentation-grid">
        {filteredSections.map((section) => (
          <div key={section.title} className="card documentation-card">
            <div className="documentation-card-header" style={{ color: section.color }}>
              {section.icon}
              <h3>{section.title}</h3>
            </div>
            <ul className="documentation-list">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="card documentation-profiles-card">
        <div className="card-title"><ShieldCheck size={16} /> Por onde começar em cada perfil</div>
        <p className="documentation-note">
          Se a pessoa estiver começando agora, este recorte ajuda a encontrar a orientação certa sem perder tempo.
        </p>
        <div className="documentation-profile-grid">
          {filteredProfiles.map((profile) => (
            <div key={profile.title} className="documentation-profile-item">
              <strong>{profile.title}</strong>
              <p>{profile.focus}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card documentation-onboarding-card">
        <div className="card-title"><Workflow size={16} /> Como começar sem se perder</div>
        <p className="documentation-note">
          Sequência sugerida para começar a operar o sistema com menos dúvida e menos dependência de ajuda informal.
        </p>
        <div className="documentation-onboarding-grid">
          {onboardingProfiles.map((profile) => (
            <div key={profile} className="documentation-onboarding-item">
              <strong>{profile}</strong>
              <ol>
                {onboardingTracks[profile].map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>

      <div className="card documentation-shortcuts-card">
        <div className="card-title"><ArrowUpRight size={16} /> Atalhos por tarefa</div>
        <p className="documentation-note">
          Ações rápidas para sair da leitura e ir direto para a tela mais provável dentro do sistema.
        </p>
        <div className="documentation-shortcuts-grid">
          {filteredTaskShortcuts.map((shortcut) => (
            <Link key={shortcut.route} to={shortcut.route} className="documentation-shortcut-item">
              <strong>{shortcut.title}</strong>
              <span>{shortcut.route}</span>
              <p>{shortcut.summary}</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="card documentation-incidents-card">
        <div className="card-title"><Bug size={16} /> Se algo der errado</div>
        <p className="documentation-note">
          Quando algo falhar, comece por aqui: veja o sintoma, faça a primeira checagem e abra a tela mais útil para investigar.
        </p>
        <div className="documentation-incidents-grid">
          {filteredIncidentActions.map((incident) => (
            <div key={incident.title} className="documentation-incident-item">
              <strong>{incident.title}</strong>
              <p className="documentation-incident-symptom">{incident.symptom}</p>
              <p>{incident.firstAction}</p>
              <Link to={incident.route} className="documentation-incident-link">
                <ArrowUpRight size={14} /> {incident.routeLabel}
              </Link>
            </div>
          ))}
        </div>
      </div>

      <div className="documentation-columns">
        <div className="card">
          <div className="card-title"><Wrench size={16} /> Conferência rápida</div>
          <div className="documentation-checks">
            {filteredChecks.map((check) => (
              <div key={check.label} className="documentation-check-item">
                <div className="documentation-check-icon">{check.icon}</div>
                <div>
                  <strong>{check.label}</strong>
                  <p>{check.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title"><BookOpenText size={16} /> Documentos completos</div>
          <p className="documentation-note">
            Índice dos arquivos mantidos fora da aplicação, com indicação rápida de quando usar cada um.
          </p>
          <div className="documentation-doc-index">
            {filteredRepoDocs.map((doc) => (
              <button
                key={doc.path}
                type="button"
                className={`documentation-doc-item ${selectedRepoDoc?.path === doc.path ? 'documentation-doc-item-active' : ''}`}
                onClick={() => setSelectedDocPath(doc.path)}
              >
                <div className="documentation-doc-head">
                  <strong>{doc.title}</strong>
                  <span className="badge badge-gray documentation-file-badge">{doc.path}</span>
                </div>
                <span className="documentation-doc-audience">{doc.audience}</span>
                <p>{doc.summary}</p>
              </button>
            ))}
          </div>

          {selectedRepoDoc ? (
            <div className="documentation-doc-detail">
              <div className="documentation-doc-detail-header">
                <div>
                  <strong>{selectedRepoDoc.title}</strong>
                  <span className="badge badge-info documentation-doc-detail-badge">{selectedRepoDoc.path}</span>
                </div>
                <span className="documentation-doc-audience">{selectedRepoDoc.audience}</span>
              </div>
              <p className="documentation-note">{selectedRepoDoc.nextStep}</p>
              {selectedRepoDoc.internalRoute ? (
                <div className="documentation-next-links">
                  <Link to={selectedRepoDoc.internalRoute} className="documentation-inline-link">{selectedRepoDoc.internalLabel}</Link>
                </div>
              ) : null}
              <ul className="documentation-doc-detail-list">
                {selectedRepoDoc.highlights.map((highlight) => (
                  <li key={highlight}>{highlight}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      {normalizedSearch && totalMatches === 0 ? (
        <div className="card documentation-empty-state">
          <h3>Nenhum resultado encontrado</h3>
          <p>
            Tente buscar por um termo mais amplo, como módulo, perfil, rotina operacional ou tipo de incidente.
          </p>
        </div>
      ) : null}
    </div>
  );
}