import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpenText, Database, FileSpreadsheet, Upload } from 'lucide-react';
import DocumentationBreadcrumbs from '../components/DocumentationBreadcrumbs';
import { useAuth } from '../context/useAuth';
import InlineHelpCard from '../components/InlineHelpCard';

const ROLE_LABELS = {
  administrador: 'Administrador',
  gerente: 'Gerente',
  assistente: 'Assistente',
};

const ROLE_FOCUS = {
  administrador: 'Priorize integridade dos arquivos, segurança da operação e impacto das importações em produção.',
  gerente: 'Priorize período, conciliação, consistência dos lançamentos e fechamento financeiro.',
  assistente: 'Priorize formato do arquivo, conferência básica e prevenção de retrabalho antes de repetir a importação.',
};

const supportedFormats = [
  {
    title: 'CSV e OFX',
    profiles: ['administrador', 'gerente', 'assistente'],
    details: [
      'CSV simples: data, descricao, tipo e valor.',
      'CSV estilo Banco Real: Data, Lançamento, Detalhes, Nº documento, Valor e Tipo Lançamento.',
      'OFX pode ser detectado também pelo conteúdo, mesmo quando a extensão não ajuda.',
    ],
  },
  {
    title: 'REM e RET',
    profiles: ['administrador', 'gerente', 'assistente'],
    details: [
      'Tratados como movimentos DABB.',
      'Exigem preservação do layout posicional original.',
      'Dependem de codigo_dabb correto para localizar o associado.',
    ],
  },
  {
    title: 'PDF Banco do Brasil',
    profiles: ['administrador', 'gerente', 'assistente'],
    details: [
      'Aceito apenas em .pdf.',
      'Precisa ter texto extraível; PDF escaneado puro falha.',
      'Importação tenta localizar associado e fazer baixas automáticas quando possível.',
    ],
  },
];

const checklist = [
  {
    text: 'Conferir extensão e origem do arquivo.',
    profiles: ['administrador', 'gerente', 'assistente'],
  },
  {
    text: 'Validar se o período corresponde ao mês esperado.',
    profiles: ['administrador', 'gerente', 'assistente'],
  },
  {
    text: 'Revisar codigo_dabb quando a rotina envolver DABB.',
    profiles: ['administrador', 'gerente', 'assistente'],
  },
  {
    text: 'Gerar backup antes de importações volumosas.',
    profiles: ['administrador'],
  },
  {
    text: 'Após importar, revisar pendências de conciliação manual.',
    profiles: ['administrador', 'gerente', 'assistente'],
  },
];

const commonFailures = [
  {
    text: 'Arquivo vazio ou extensão inválida.',
    profiles: ['administrador', 'gerente', 'assistente'],
  },
  {
    text: 'PDF sem texto extraível.',
    profiles: ['administrador', 'gerente', 'assistente'],
  },
  {
    text: 'Layout REM/RET alterado manualmente.',
    profiles: ['administrador', 'gerente', 'assistente'],
  },
  {
    text: 'Duplicidade de lançamento já existente.',
    profiles: ['administrador', 'gerente', 'assistente'],
  },
  {
    text: 'Sem associado correspondente por codigo_dabb ausente, inconsistente ou duplicado.',
    profiles: ['administrador', 'gerente', 'assistente'],
  },
];

const relatedGuides = [
  { label: 'Ajuda para problemas comuns', to: '/documentacao/troubleshooting' },
  { label: 'Manual do usuário', to: '/documentacao/manual' },
  { label: 'Guia de ambiente', to: '/documentacao/ambiente' },
  { label: 'Voltar ao hub de documentação', to: '/documentacao' },
];

export default function ImportacoesInterno() {
  const { user } = useAuth();
  const currentRole = user?.role;
  const currentRoleLabel = ROLE_LABELS[currentRole] || 'Usuário';
  const roleFocus = ROLE_FOCUS[currentRole] || 'Valide formato, período e conferência mínima antes de importar.';

  const visibleFormats = currentRole
    ? supportedFormats.filter((format) => format.profiles.includes(currentRole))
    : supportedFormats;

  const visibleChecklist = currentRole
    ? checklist.filter((item) => item.profiles.includes(currentRole))
    : checklist;

  const visibleFailures = currentRole
    ? commonFailures.filter((item) => item.profiles.includes(currentRole))
    : commonFailures;

  return (
    <div>
      <DocumentationBreadcrumbs
        items={[
          { label: 'Central de Documentação', to: '/documentacao' },
          { label: 'Guia de Importações' },
        ]}
      />

      <div className="topbar documentation-topbar">
        <div>
          <h2>Guia de Importações</h2>
          <p className="documentation-subtitle">
            Versão interna para arquivos bancários, DABB e validações mínimas antes de importar em produção.
          </p>
        </div>
        <Link to="/documentacao" className="btn btn-outline documentation-back-btn">
          <ArrowLeft size={15} /> Voltar para a central
        </Link>
      </div>

      <div className="card documentation-hero documentation-inner-hero">
        <div className="documentation-hero-copy">
          <span className="documentation-kicker">Arquivos</span>
          <h3>Importe só depois de validar formato, período e cadastros que sustentam a conciliação.</h3>
          <p>
            Esta página reúne os formatos aceitos e os erros mais frequentes para reduzir retrabalho e lançamentos inconsistentes.
          </p>
          <p>
            <strong>{currentRoleLabel}:</strong> {roleFocus}
          </p>
        </div>
      </div>

      <div className="card documentation-inner-card">
        <div className="card-title"><Upload size={16} /> Formatos suportados</div>
        <div className="documentation-guide-grid">
          {visibleFormats.map((format) => (
            <div key={format.title} className="documentation-guide-item">
              <strong>{format.title}</strong>
              <ul className="documentation-list compact-list">
                {format.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="documentation-columns">
        <div className="card documentation-inner-card">
          <div className="card-title"><FileSpreadsheet size={16} /> Checklist antes de importar</div>
          <ul className="documentation-list compact-list">
            {visibleChecklist.map((item) => (
              <li key={item.text}>{item.text}</li>
            ))}
          </ul>
        </div>

        <div className="card documentation-inner-card">
          <div className="card-title"><Database size={16} /> Falhas comuns</div>
          <ul className="documentation-list compact-list">
            {visibleFailures.map((item) => (
              <li key={item.text}>{item.text}</li>
            ))}
          </ul>
        </div>
      </div>

      <InlineHelpCard
        title="Próximo passo"
        variant="next-step"
        defaultLabel="Usuário"
        messagesByRole={{
          administrador: 'Depois da validação inicial, siga para troubleshooting ou ambiente se a importação exigir revisão mais profunda.',
          gerente: 'Depois de confirmar o arquivo, siga para o manual ou troubleshooting conforme a pendência encontrada.',
          assistente: 'Depois da conferência básica, avance para o manual ou para a ajuda de problemas comuns se algo falhar.',
        }}
        fallbackMessage="Depois da checagem inicial, siga para o material de apoio mais útil para concluir a importação sem retrabalho."
        links={relatedGuides}
      />
    </div>
  );
}