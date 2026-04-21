import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpenText, Bug, HeartPulse, ShieldCheck } from 'lucide-react';
import DocumentationBreadcrumbs from '../components/DocumentationBreadcrumbs';
import { useAuth } from '../context/useAuth';
import InlineHelpCard from '../components/InlineHelpCard';

const ROLE_LABELS = {
  administrador: 'Administrador',
  gerente: 'Gerente',
  assistente: 'Assistente',
};

const ROLE_FOCUS = {
  administrador: 'Priorize ambiente, autenticação, backup, restauração e incidentes com impacto geral.',
  gerente: 'Priorize conciliação, relatórios, importações e falhas que afetem o fechamento do período.',
  assistente: 'Priorize sessão, arquivos rejeitados e falhas operacionais antes de escalar para suporte técnico.',
};

const incidents = [
  {
    title: 'Autenticação e sessão',
    profiles: ['administrador', 'gerente', 'assistente'],
    symptoms: ['Login falha', 'Usuário volta para a tela de login', 'Mensagem: Sessão expirada. Faça login novamente.'],
    checks: ['Confirmar resposta em /api/health', 'Validar VITE_API_BASE_URL e FRONTEND_URL', 'Reemitir token com novo login e checar SECRET_KEY'],
    actions: ['Limpar sessão local e autenticar novamente', 'Revisar configuração após deploy', 'Se o problema for global, avaliar rollback de configuração'],
  },
  {
    title: 'Backend indisponível',
    profiles: ['administrador'],
    symptoms: ['Servidor indisponível no login', 'Páginas carregam sem dados', 'Falha generalizada em relatórios e cadastros'],
    checks: ['Acessar GET /api/health', 'Revisar logs do uvicorn', 'Validar conexão com o banco e variáveis obrigatórias'],
    actions: ['Só reiniciar serviço depois de validar ambiente', 'Usar rollback quando healthcheck falhar após publicação', 'Se usar SQLite, conferir arquivo e volume persistente'],
  },
  {
    title: 'Importação falhando',
    profiles: ['administrador', 'gerente', 'assistente'],
    symptoms: ['Upload rejeitado', 'Nenhuma linha importada', 'Muitos itens pendentes após importação'],
    checks: ['Confirmar extensão e conteúdo do arquivo', 'Validar layout preservado para REM/RET', 'Revisar codigo_dabb quando a importação envolver DABB'],
    actions: ['Testar lotes grandes em ambiente controlado', 'Revisar pendências de conciliação manual', 'Conferir docs/importacoes.md quando houver dúvida de formato'],
  },
  {
    title: 'Problemas de backup e restauração',
    profiles: ['administrador'],
    symptoms: ['Acesso restrito a administradores', 'Arquivo .db inválido', 'Falha ao restaurar backup'],
    checks: ['Confirmar perfil administrador', 'Validar se o ambiente usa SQLite', 'Checar integridade SQLite antes da restauração'],
    actions: ['Gerar backup novo antes de restaurar', 'Não restaurar arquivo de origem duvidosa', 'Revisar permissões na pasta do banco e backups'],
  },
];

const relatedGuides = [
  { label: 'Abrir manual do usuário', to: '/documentacao/manual' },
  { label: 'Guia de ambiente', to: '/documentacao/ambiente' },
  { label: 'Guia de importações', to: '/documentacao/importacoes' },
  { label: 'Voltar ao hub de documentação', to: '/documentacao' },
];

export default function TroubleshootingInterno() {
  const { user } = useAuth();
  const currentRole = user?.role;
  const currentRoleLabel = ROLE_LABELS[currentRole] || 'Usuário';
  const roleFocus = ROLE_FOCUS[currentRole] || 'Comece pelo sintoma, confirme a checagem mínima e siga para a ação menos invasiva.';

  const visibleIncidents = currentRole
    ? incidents.filter((incident) => incident.profiles.includes(currentRole))
    : incidents;

  return (
    <div>
      <DocumentationBreadcrumbs
        items={[
          { label: 'Central de Documentação', to: '/documentacao' },
          { label: 'Troubleshooting' },
        ]}
      />

      <div className="topbar documentation-topbar">
        <div>
          <h2>Troubleshooting</h2>
          <p className="documentation-subtitle">
            Guia interno para resposta inicial, checagens e recuperação de problemas recorrentes.
          </p>
        </div>
        <Link to="/documentacao" className="btn btn-outline documentation-back-btn">
          <ArrowLeft size={15} /> Voltar para a central
        </Link>
      </div>

      <div className="card documentation-hero documentation-inner-hero documentation-troubleshooting-hero">
        <div className="documentation-hero-copy">
          <span className="documentation-kicker">Resposta inicial</span>
          <h3>Comece pelo sintoma, confirme as checagens mínimas e só depois avance para correções mais invasivas.</h3>
          <p>
            Esta página condensa o guia de troubleshooting em um formato operacional para atendimento rápido e triagem de primeiro nível.
          </p>
          <p>
            <strong>{currentRoleLabel}:</strong> {roleFocus}
          </p>
        </div>
      </div>

      <div className="documentation-columns">
        <div className="card documentation-inner-card">
          <div className="card-title"><HeartPulse size={16} /> Ordem sugerida de diagnóstico</div>
          <ol className="documentation-ordered-list">
            <li>Confirmar o sintoma real e se o problema é local ou geral.</li>
            <li>Testar saúde da API e sessão autenticada.</li>
            <li>Validar ambiente, variáveis e disponibilidade do banco.</li>
            <li>Executar ação corretiva mínima antes de reiniciar ou restaurar.</li>
          </ol>
        </div>

        <div className="card documentation-inner-card">
          <div className="card-title"><ShieldCheck size={16} /> Regras de escalonamento</div>
          <ul className="documentation-list">
            <li>Escalone para administração quando houver acesso, ambiente, deploy ou restauração.</li>
            <li>Mantenha suporte funcional no fluxo quando o problema for filtro, rotina ou operação do usuário.</li>
            <li>Antes de qualquer rollback, confirme o healthcheck e o impacto real do incidente.</li>
          </ul>
        </div>
      </div>

      <div className="card documentation-inner-card">
        <div className="card-title"><Bug size={16} /> Incidentes recorrentes</div>
        <div className="documentation-guide-grid">
          {visibleIncidents.map((incident) => (
            <div key={incident.title} className="documentation-guide-item documentation-troubleshooting-item">
              <strong>{incident.title}</strong>
              <span className="documentation-section-label">Sintomas</span>
              <ul className="documentation-list compact-list">
                {incident.symptoms.map((symptom) => (
                  <li key={symptom}>{symptom}</li>
                ))}
              </ul>
              <span className="documentation-section-label">Checagens</span>
              <ul className="documentation-list compact-list">
                {incident.checks.map((check) => (
                  <li key={check}>{check}</li>
                ))}
              </ul>
              <span className="documentation-section-label">Ações</span>
              <ul className="documentation-list compact-list">
                {incident.actions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <InlineHelpCard
        title="Próximo passo"
        variant="next-step"
        defaultLabel="Usuário"
        messagesByRole={{
          administrador: 'Depois da triagem, siga para ambiente ou manual conforme a causa do incidente.',
          gerente: 'Depois da checagem inicial, avance para o manual ou para o guia de importações conforme a rotina afetada.',
          assistente: 'Depois da primeira triagem, use o manual ou o guia de importações antes de escalar o problema.',
        }}
        fallbackMessage="Use estes atalhos para seguir a investigação ou voltar para o contexto operacional completo."
        links={relatedGuides}
      />
    </div>
  );
}