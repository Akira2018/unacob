import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpenText, FileSpreadsheet, Workflow, Users } from 'lucide-react';
import DocumentationBreadcrumbs from '../components/DocumentationBreadcrumbs';
import { useAuth } from '../context/useAuth';
import InlineHelpCard from '../components/InlineHelpCard';

const ROLE_LABELS = {
  administrador: 'Administrador',
  gerente: 'Gerente',
  assistente: 'Assistente',
};

const ROLE_FOCUS = {
  administrador: 'Seu foco aqui é ambiente, usuários, segurança, backup e acompanhamento geral da operação.',
  gerente: 'Seu foco aqui é fechamento, conferência financeira, conciliação e validação dos relatórios.',
  assistente: 'Seu foco aqui é cadastro, lançamentos do dia a dia, conferência básica e execução das rotinas recorrentes.',
};

const quickTasks = [
  {
    title: 'Preciso atualizar um cadastro',
    guidance: 'Entre em Cadastro de Associados, localize a pessoa e revise os dados antes de salvar.',
    route: '/membros',
    routeLabel: 'Abrir associados',
    profiles: ['administrador', 'assistente'],
  },
  {
    title: 'Preciso lançar um pagamento ou receita',
    guidance: 'Confirme o mês de referência, informe a forma de pagamento correta e salve o lançamento.',
    route: '/pagamentos',
    routeLabel: 'Abrir pagamentos',
    profiles: ['administrador', 'gerente'],
  },
  {
    title: 'Preciso conferir um extrato',
    guidance: 'Use a tela de Conciliação, revise as sugestões automáticas e trate os itens pendentes antes do fechamento.',
    route: '/conciliacao',
    routeLabel: 'Abrir conciliação',
    profiles: ['administrador', 'gerente'],
  },
  {
    title: 'Preciso gerar um relatório',
    guidance: 'Abra Relatórios, escolha o período certo e valide os filtros antes de baixar ou imprimir.',
    route: '/relatorios',
    routeLabel: 'Abrir relatórios',
    profiles: ['administrador', 'gerente', 'assistente'],
  },
];

const accessProfiles = [
  {
    title: 'Administrador',
    description: 'Acesso total aos módulos, usuários, backup, restauração e recursos administrativos.',
    roles: ['administrador'],
  },
  {
    title: 'Gerente',
    description: 'Acesso às rotinas financeiras e operacionais, com foco no fechamento e na conferência.',
    roles: ['gerente'],
  },
  {
    title: 'Assistente',
    description: 'Acesso a cadastros e utilitários permitidos, sem o conjunto principal de telas financeiras.',
    roles: ['assistente'],
  },
];

const tutorials = [
  {
    title: 'Atualizar cadastro de associado',
    route: '/membros',
    routeLabel: 'Ir para associados',
    profiles: ['administrador', 'assistente'],
    steps: [
      'Abra Cadastro de Associados no menu lateral.',
      'Pesquise por nome, CPF, matrícula ou e-mail.',
      'Abra o registro desejado, revise os campos e salve as alterações.',
    ],
  },
  {
    title: 'Registrar mensalidade',
    route: '/pagamentos',
    routeLabel: 'Ir para pagamentos',
    profiles: ['administrador', 'gerente'],
    steps: [
      'Acesse Receitas de Mensalidades.',
      'Selecione o mês de referência e localize o associado.',
      'Informe valor, data, forma de pagamento e salve o lançamento.',
    ],
  },
  {
    title: 'Conciliar extrato bancário',
    route: '/conciliacao',
    routeLabel: 'Ir para conciliação',
    profiles: ['administrador', 'gerente'],
    steps: [
      'Entre em Conciliação e importe um extrato em formato aceito.',
      'Revise as sugestões automáticas e faça reconciliação manual quando necessário.',
      'Classifique itens pendentes como despesa ou receita antes de fechar o período.',
    ],
  },
  {
    title: 'Emitir relatórios',
    route: '/relatorios',
    routeLabel: 'Ir para relatórios',
    profiles: ['administrador', 'gerente', 'assistente'],
    steps: [
      'Acesse Relatórios.',
      'Escolha o tipo de saída e informe os filtros do período.',
      'Gere, revise e baixe o arquivo quando aplicável.',
    ],
  },
];

const bestPractices = [
  'Validar dados de associados antes de gerar relatórios e remessas.',
  'Conferir mês de referência antes de lançar pagamentos em lote.',
  'Executar backup antes de operações administrativas críticas.',
  'Revisar conciliações pendentes antes de fechar o período.',
  'Manter acesso administrativo restrito aos usuários responsáveis.',
];

const relatedGuides = [
  { label: 'Abrir ajuda para problemas comuns', to: '/documentacao/troubleshooting' },
  { label: 'Guia de importações', to: '/documentacao/importacoes' },
  { label: 'Guia de ambiente', to: '/documentacao/ambiente' },
  { label: 'Voltar ao hub de documentação', to: '/documentacao' },
];

export default function ManualInterno() {
  const { user } = useAuth();
  const currentRole = user?.role;
  const currentRoleLabel = ROLE_LABELS[currentRole] || 'Usuário';
  const roleFocus = ROLE_FOCUS[currentRole] || 'Use este guia para localizar a rotina necessária e seguir para a tela certa.';

  const visibleQuickTasks = currentRole
    ? quickTasks.filter((task) => task.profiles.includes(currentRole))
    : quickTasks;

  const visibleProfiles = currentRole
    ? accessProfiles.filter((profile) => profile.roles.includes(currentRole))
    : accessProfiles;

  const visibleTutorials = currentRole
    ? tutorials.filter((tutorial) => tutorial.profiles.includes(currentRole))
    : tutorials;

  return (
    <div>
      <DocumentationBreadcrumbs
        items={[
          { label: 'Central de Documentação', to: '/documentacao' },
          { label: 'Manual do Usuário' },
        ]}
      />

      <div className="topbar documentation-topbar">
        <div>
          <h2>Manual do Usuário</h2>
          <p className="documentation-subtitle">
            Guia de consulta rápida para uso diário do sistema, com os fluxos e orientações mais importantes para operação.
          </p>
        </div>
        <Link to="/documentacao" className="btn btn-outline documentation-back-btn">
          <ArrowLeft size={15} /> Voltar para a central
        </Link>
      </div>

      <div className="card documentation-hero documentation-inner-hero">
        <div className="documentation-hero-copy">
          <span className="documentation-kicker">Ajuda no sistema</span>
          <h3>Use este guia para localizar rapidamente o que fazer em cada rotina mais comum do sistema.</h3>
          <p>
            Este conteúdo resume o essencial do dia a dia: acesso, cadastros, lançamentos, conciliação e emissão de relatórios, sem exigir leitura técnica.
          </p>
          <p>
            <strong>{currentRoleLabel}:</strong> {roleFocus}
          </p>
        </div>
      </div>

      <div className="card documentation-inner-card">
        <div className="card-title"><BookOpenText size={16} /> O que você precisa fazer agora?</div>
        <div className="documentation-guide-grid">
          {visibleQuickTasks.map((task) => (
            <div key={task.title} className="documentation-guide-item">
              <strong>{task.title}</strong>
              <p>{task.guidance}</p>
              <Link to={task.route} className="documentation-inline-link">{task.routeLabel}</Link>
            </div>
          ))}
        </div>
      </div>

      <div className="documentation-grid documentation-inner-grid">
        <div className="card documentation-inner-card">
          <div className="card-title"><Users size={16} /> O que cada perfil pode acessar</div>
          <div className="documentation-profile-grid">
            {visibleProfiles.map((profile) => (
              <div key={profile.title} className="documentation-profile-item">
                <strong>{profile.title}</strong>
                <p>{profile.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card documentation-inner-card">
          <div className="card-title"><Workflow size={16} /> Sequência recomendada do mês</div>
          <ol className="documentation-ordered-list">
            <li>Login</li>
            <li>Atualizar cadastros</li>
            <li>Lançar pagamentos e receitas</li>
            <li>Lançar despesas</li>
            <li>Conciliar extrato</li>
            <li>Emitir relatórios</li>
            <li>Executar backup</li>
          </ol>
        </div>
      </div>

      <div className="card documentation-inner-card">
        <div className="card-title"><BookOpenText size={16} /> Passo a passo das tarefas mais frequentes</div>
        <div className="documentation-guide-grid">
          {visibleTutorials.map((tutorial) => (
            <div key={tutorial.title} className="documentation-guide-item">
              <strong>{tutorial.title}</strong>
              <ol className="documentation-ordered-list compact">
                {tutorial.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <Link to={tutorial.route} className="documentation-inline-link">{tutorial.routeLabel}</Link>
            </div>
          ))}
        </div>
      </div>

      <div className="documentation-columns">
        <div className="card documentation-inner-card">
          <div className="card-title"><FileSpreadsheet size={16} /> Cuidados para evitar erro</div>
          <ul className="documentation-list">
            {bestPractices.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <InlineHelpCard
          title="Próximo passo"
          variant="next-step"
          defaultLabel="Usuário"
          messagesByRole={{
            administrador: 'Quando a dúvida sair da rotina diária, siga para os guias de suporte, importação ou ambiente.',
            gerente: 'Quando a rotina exigir apoio extra, avance para troubleshooting ou para o guia de importações.',
            assistente: 'Quando a tarefa não estiver clara ou algo falhar, siga para os materiais de apoio antes de escalar.',
          }}
          fallbackMessage="Quando a dúvida for mais específica ou houver erro na operação, siga para estes materiais de apoio."
          links={relatedGuides}
        />
      </div>
    </div>
  );
}