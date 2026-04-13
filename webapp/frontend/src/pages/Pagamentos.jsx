import { useCallback, useEffect, useState, useMemo } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { Download, Upload } from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { getApiErrorMessage } from '../utils/apiError';

// --- FUNÇÕES AUXILIARES ---
const fmt = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const DEZ_A_DEZENOVE = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

function numeroAte999PorExtenso(numero) {
  const n = Number(numero) || 0;
  if (n === 0) return 'zero';
  if (n === 100) return 'cem';

  const centenas = Math.floor(n / 100);
  const resto = n % 100;
  const dezenas = Math.floor(resto / 10);
  const unidades = resto % 10;
  const partes = [];

  if (centenas) partes.push(CENTENAS[centenas]);

  if (resto >= 10 && resto <= 19) {
    partes.push(DEZ_A_DEZENOVE[resto - 10]);
  } else {
    if (dezenas) partes.push(DEZENAS[dezenas]);
    if (unidades) partes.push(UNIDADES[unidades]);
  }

  return partes.filter(Boolean).join(' e ');
}

function getMeses() {
  const result = [];
  for (let i = 0; i < 12; i++) {
    const d = subMonths(new Date(), i);
    result.push(format(d, 'yyyy-MM'));
  }
  return result;
}

function valorPorExtenso(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero <= 0) return '';

  const valorArredondado = Number(numero.toFixed(2));
  const reais = Math.floor(valorArredondado);
  const centavos = Math.round((valorArredondado - reais) * 100);
  const partes = [];

  if (reais > 0) {
    if (reais < 1000) {
      partes.push(`${numeroAte999PorExtenso(reais)} ${reais === 1 ? 'real' : 'reais'}`);
    } else {
      partes.push(`${reais.toLocaleString('pt-BR')} ${reais === 1 ? 'real' : 'reais'}`);
    }
  }

  if (centavos > 0) {
    const centavosTexto = numeroAte999PorExtenso(centavos);
    partes.push(`${centavosTexto} ${centavos === 1 ? 'centavo' : 'centavos'}`);
  }

  return partes.join(' e ');
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (text.includes(';') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function baixarCsvCodigosDabb(filename, items) {
  if (!Array.isArray(items) || items.length === 0) return;
  const linhas = [
    ['codigo_dabb', 'quantidade', 'valores', 'meses', 'registros'].map(csvEscape).join(';'),
    ...items.map((item) => [
      item.codigo_dabb,
      item.quantidade,
      asArray(item.valores).join(', '),
      asArray(item.meses).join(', '),
      asArray(item.registros).join(', '),
    ].map(csvEscape).join(';'))
  ];
  const blob = new Blob(["\ufeff" + linhas.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const DABB_HISTORY_STORAGE_KEY = 'unacob_dabb_import_history';

function sanitizeHistoricoItem(item) {
  return {
    id: item?.id || `${Date.now()}`,
    arquivo: String(item?.arquivo || 'arquivo_bancario'),
    importedAt: String(item?.importedAt || new Date().toISOString()),
    mes: String(item?.mes || ''),
    codigosSemMembro: asArray(item?.codigosSemMembro),
    codigosAmbiguos: asArray(item?.codigosAmbiguos),
    diagnosticoDabb: item?.diagnosticoDabb || null,
  };
}

function loadHistoricoDabb() {
  try {
    const raw = window.localStorage.getItem(DABB_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return asArray(parsed).map(sanitizeHistoricoItem);
  } catch {
    return [];
  }
}

function saveHistoricoDabb(items) {
  try {
    window.localStorage.setItem(DABB_HISTORY_STORAGE_KEY, JSON.stringify(asArray(items).slice(0, 12)));
  } catch {
    // noop
  }
}

function mesExtenso(mesAno) {
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  if (!mesAno) return '';
  const [, mes] = mesAno.split('-');
  return meses[parseInt(mes, 10) - 1];
}

  function anoExtenso(mesAno) {
    if (!mesAno || !mesAno.includes('-')) return '';
    return mesAno.split('-')[0];
  }

  function dataHoje() {
    const d = new Date();
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  }

export default function Pagamentos() {
  const handleImportPdfBB = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Selecione um arquivo PDF do Banco do Brasil');
      e.target.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setImportandoBanco(true);
    try {
      const res = await api.post('/conciliacao/importar/pdf-bb', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      aplicarResultadoImportacaoDabb(res, file, 'PDF BB');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao importar PDF do Banco do Brasil'));
    } finally {
      setImportandoBanco(false);
      e.target.value = '';
    }
  };
    // Estados para assinatura do recibo
    const [assinaturaNome, setAssinaturaNome] = useState('Sérgio Golino');
    const [assinaturaCargo, setAssinaturaCargo] = useState('Assessor Financeiro/UNACOB');
    // Campo editável para meses referentes no recibo
    const [referenteMeses, setReferenteMeses] = useState('');
  // Estados de dados e filtros
  const [mes, setMes] = useState(format(new Date(), 'yyyy-MM'));
  const [search, setSearch] = useState('');
  const [painel, setPainel] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estados de UI e Modais
  const [viewMode, setViewMode] = useState('cards');
  const [modal, setModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [showRecibo, setShowRecibo] = useState(false);
  
  // Estados de Formulario e Processamento
  const [form, setForm] = useState({ 
    valor_pago: '', 
    data_pagamento: format(new Date(), 'yyyy-MM-dd'), 
    status_pagamento: 'pago', 
    forma_pagamento: 'dinheiro', 
    observacoes: '' 
  });
  const [saving, setSaving] = useState(false);
  const [importandoBanco, setImportandoBanco] = useState(false);
  const [pendenciasConcil, setPendenciasConcil] = useState([]);
  const [carregandoPendencias, setCarregandoPendencias] = useState(false);
  const [confirmandoPendencia, setConfirmandoPendencia] = useState('');
  const [ultimoDiagnosticoDabb, setUltimoDiagnosticoDabb] = useState(null);
  const [historicoDabb, setHistoricoDabb] = useState([]);
  const valorPagoFormatado = Number(form.valor_pago || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  const referenciaReciboTexto = referenteMeses.trim() || `${mesExtenso(mes)} de ${anoExtenso(mes)}`;

  useEffect(() => {
    setHistoricoDabb(loadHistoricoDabb());
  }, []);

  // Helper para atualizar campos do form
  const setF = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  // Lógica de Separação de Dados (Pagos vs Pendentes)
  const { pagos, pendentes, totalArrecadado } = useMemo(() => {
    const listaPainel = asArray(painel);
    const p = listaPainel.filter(i => i.status === 'pago');
    const d = listaPainel.filter(i => i.status !== 'pago');
    const total = p.reduce((acc, curr) => acc + (Number(curr.valor_pago) || 0), 0);
    return { pagos: p, pendentes: d, totalArrecadado: total };
  }, [painel]);

  // Chamadas API
  const load = useCallback(() => {
    setLoading(true);
    api.get('/pagamentos/painel', { params: { mes_referencia: mes, search } })
      .then(r => setPainel(asArray(r.data)))
      .catch(err => toast.error(getApiErrorMessage(err, 'Erro ao carregar painel')))
      .finally(() => setLoading(false));
  }, [mes, search]);

  const loadPendenciasConcil = useCallback(() => {
    setCarregandoPendencias(true);
    api.get('/pagamentos/pendencias-conciliacao-manual', { params: { mes_referencia: mes } })
      .then(r => setPendenciasConcil(asArray(r.data?.pendencias)))
      .catch(() => setPendenciasConcil([]))
      .finally(() => setCarregandoPendencias(false));
  }, [mes]);

  const aplicarResultadoImportacaoDabb = useCallback((res, file, origemLabel) => {
    const total = Number(res.data?.total_importados || 0);
    const baixasAutomaticas = Number(res.data?.total_baixas_automaticas || 0);
    const semMembro = Number(res.data?.total_sem_membro || 0);
    const codigosAmbiguos = Number(res.data?.total_codigos_ambiguos || 0);
    const codigosSemMembro = Array.isArray(res.data?.codigos_sem_membro) ? res.data.codigos_sem_membro : [];
    const codigosAmbiguosLista = Array.isArray(res.data?.codigos_ambiguos) ? res.data.codigos_ambiguos : [];
    const diagnosticoDabb = res.data?.diagnostico_dabb;
    const mesesImportados = Array.isArray(res.data?.meses_importados) ? res.data.meses_importados : [];

    const diagnosticoAtual = {
      id: `${Date.now()}-${file.name || 'arquivo'}`,
      arquivo: file.name || 'arquivo_bancario',
      importedAt: new Date().toISOString(),
      mes: mesesImportados[0] || mes,
      codigosSemMembro,
      codigosAmbiguos: codigosAmbiguosLista,
      diagnosticoDabb,
    };

    setUltimoDiagnosticoDabb(diagnosticoAtual);
    setHistoricoDabb(prev => {
      const next = [diagnosticoAtual, ...prev.filter(item => item.arquivo !== diagnosticoAtual.arquivo || item.importedAt !== diagnosticoAtual.importedAt)]
        .slice(0, 12);
      saveHistoricoDabb(next);
      return next;
    });

    if (total > 0) {
      toast.success(res.data?.mensagem || `${total} lançamento(s) bancário(s) importado(s).`);
    } else {
      toast('Nenhum lançamento novo foi importado.');
    }

    if (baixasAutomaticas > 0 || semMembro > 0 || codigosAmbiguos > 0) {
      toast(
        `DABB: ${baixasAutomaticas} baixa(s) automática(s), ${semMembro} sem membro, ${codigosAmbiguos} código(s) ambíguo(s).`
      );
    }

    if (diagnosticoDabb?.linhas_detalhe_encontradas > 0) {
      const motivos = diagnosticoDabb?.motivos_invalidos || {};
      const resumoMotivos = Object.entries(motivos)
        .map(([motivo, qtd]) => `${motivo}: ${qtd}`)
        .join(', ');
      toast(
        `${origemLabel}: detalhes ${diagnosticoDabb.linhas_detalhe_encontradas}, válidas ${diagnosticoDabb.linhas_detalhe_validas}` +
        (resumoMotivos ? `, inválidas por motivo -> ${resumoMotivos}` : '.')
      );
    }

    if (codigosSemMembro.length > 0) {
      const amostra = codigosSemMembro
        .slice(0, 5)
        .map(item => item.codigo_dabb)
        .join(', ');
      toast(
        `Codigos DABB sem cadastro na tabela de membros: ${codigosSemMembro.length}. Ex.: ${amostra}`
      );
    }

    if (mesesImportados.length > 0 && !mesesImportados.includes(mes)) {
      setMes(mesesImportados[0]);
    } else {
      load();
      loadPendenciasConcil();
    }
  }, [load, loadPendenciasConcil, mes]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadPendenciasConcil(); }, [loadPendenciasConcil]);

  // Ações
  const resetReciboState = useCallback(() => {
    setShowRecibo(false);
    setReferenteMeses('');
  }, []);

  const closePagamentoModal = useCallback(() => {
    resetReciboState();
    setModal(false);
    setSelected(null);
  }, [resetReciboState]);

  const openPagamento = (item) => {
    resetReciboState();
    setSelected(item);
    setForm({
      valor_pago: item.valor_pago || item.valor_mensalidade || '',
      data_pagamento: item.data_pagamento || format(new Date(), 'yyyy-MM-dd'),
      status_pagamento: 'pago',
            forma_pagamento: 'transferencia',
      observacoes: item.observacoes || ''
    });
    setModal(true);
  };

  const openReciboModal = () => {
    setModal(false);
    setShowRecibo(true);
  };

  const closeReciboModal = () => {
    resetReciboState();
    setModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/pagamentos', { ...form, membro_id: selected.membro_id, mes_referencia: mes });
      toast.success('Pagamento atualizado!');
      closePagamentoModal();
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao salvar'));
    } finally {
      setSaving(false);
    }
  };

  const confirmarPendenciaManual = async (conciliacaoId, membroId) => {
    const opId = `${conciliacaoId}:${membroId}`;
    setConfirmandoPendencia(opId);
    try {
      await api.post('/pagamentos/conciliar-manual', { conciliacao_id: conciliacaoId, membro_id: membroId });
      toast.success('Conciliação realizada!');
      load();
      loadPendenciasConcil();
    } catch {
      toast.error('Erro na conciliação');
    } finally {
      setConfirmandoPendencia('');
    }
  };

  const handleImportBanco = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = (file.name || '').toLowerCase();
    if (!fileName.endsWith('.ret') && !fileName.endsWith('.rem') && !fileName.endsWith('.csv') && !fileName.endsWith('.ofx')) {
      toast.error('Selecione um arquivo RET, REM, CSV ou OFX');
      e.target.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('banco', 'DABB');

    setImportandoBanco(true);
    try {
      const res = await api.post('/conciliacao/importar/extrato', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      aplicarResultadoImportacaoDabb(res, file, 'RET/REM');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao importar arquivo bancário'));
    } finally {
      setImportandoBanco(false);
      e.target.value = '';
    }
  };

  const mesReferenciaImportacao = `${mesExtenso(mes)} de ${anoExtenso(mes)}`;
  const opcoesImportacao = [
    {
      key: 'ret-rem',
      titulo: 'Arquivo bancario DABB',
      formatos: 'RET, REM, CSV ou OFX',
      descricao: 'Use quando o banco ou sistema exportar arquivo de retorno/remessa para conciliacao automatica.',
      referencia: 'A baixa sera feita usando os codigos DABB e as datas encontradas no arquivo.',
      observacao: 'Ideal para arquivos de retorno do banco e exportacoes operacionais.',
      actionLabel: importandoBanco ? 'Importando...' : 'Selecionar RET/REM/CSV/OFX',
      accept: '.ret,.rem,.csv,.ofx',
      onChange: handleImportBanco,
      buttonClassName: 'btn btn-primary',
    },
    {
      key: 'pdf-bb',
      titulo: 'Extrato PDF Banco do Brasil',
      formatos: 'PDF',
      descricao: 'Use quando o extrato vier em PDF diretamente do Banco do Brasil.',
      referencia: 'Os lancamentos serao interpretados usando as datas identificadas no proprio PDF.',
      observacao: 'Escolha esta opcao somente para PDF do BB; outros PDFs podem nao ser reconhecidos.',
      actionLabel: importandoBanco ? 'Importando...' : 'Selecionar PDF do BB',
      accept: '.pdf',
      onChange: handleImportPdfBB,
      buttonClassName: 'btn btn-secondary',
    },
  ];

  const printRecibo = () => {
    const el = document.getElementById('recibo-print-area');
    if (!el) {
      toast.error('Não foi possível encontrar o recibo para impressão.');
      return;
    }
    const content = el.innerHTML;
    const win = window.open('', '', 'height=700,width=900');
    win.document.write(`<html><head><title>Recibo</title><style>body{font-family:sans-serif;padding:40px;}</style></head><body>${content}</body></html>`);
    win.document.close();
    // Aguarda a impressão terminar antes de permitir fechar o modal
    win.focus();
    win.print();
    win.onafterprint = () => {
      win.close();
    };
  };

  return (
    <div className="pagamentos-container" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <h2>Painel de Pagamentos</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-outline btn-sm"><Download size={14} /> Excel</button>
        </div>
      </div>

      <div
        className="card"
        style={{
          marginBottom: 20,
          padding: 20,
          border: '1px solid #dbe7f3',
          borderRadius: 16,
          background: 'linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18, alignItems: 'flex-start' }}>
          <div style={{ maxWidth: 760 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#1d4ed8', marginBottom: 6 }}>
              Importacao bancaria guiada
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#102a43', marginBottom: 6 }}>
              Escolha o tipo certo de arquivo antes de importar
            </div>
            <div style={{ fontSize: 14, color: '#486581', lineHeight: 1.6 }}>
              O sistema identifica automaticamente o mes de cada lancamento pela data presente no arquivo importado. O filtro de mes abaixo serve para abrir o painel, as pendencias e o historico no periodo que voce deseja revisar depois da importacao.
            </div>
          </div>
          <div style={{ minWidth: 240, padding: 14, borderRadius: 12, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
            <div style={{ fontSize: 12, color: '#1d4ed8', fontWeight: 700, marginBottom: 6 }}>Mes ativo no painel</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#102a43', textTransform: 'capitalize' }}>
              {mesReferenciaImportacao}
            </div>
            <div style={{ fontSize: 12, color: '#486581', marginTop: 6 }}>
              A importacao usa as datas do arquivo. Este periodo so define o que sera exibido no painel apos o processamento.
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, marginBottom: 18 }}>
          {[
            '1. Confira o formato do arquivo antes de importar.',
            '2. O sistema vai ler a data de cada lancamento e definir o mes automaticamente.',
            '3. Importe o arquivo e aguarde o processamento.',
            '4. Use o filtro de mes para revisar painel, diagnostico e pendencias.',
          ].map((item) => (
            <div key={item} style={{ padding: '12px 14px', borderRadius: 12, background: '#ffffff', border: '1px solid #e2e8f0', fontSize: 13, color: '#334e68' }}>
              {item}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
          {opcoesImportacao.map((opcao) => (
            <div
              key={opcao.key}
              style={{
                display: 'grid',
                gap: 12,
                padding: 16,
                borderRadius: 14,
                background: '#ffffff',
                border: '1px solid #d9e2ec',
                boxShadow: '0 10px 24px rgba(15, 23, 42, 0.04)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#102a43', marginBottom: 4 }}>{opcao.titulo}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{opcao.formatos}</div>
                </div>
                <div style={{ padding: '6px 10px', borderRadius: 999, background: '#f0f9ff', color: '#0369a1', fontSize: 12, fontWeight: 600 }}>
                  Mes {mes}
                </div>
              </div>

              <div style={{ fontSize: 13, color: '#334e68', lineHeight: 1.6 }}>{opcao.descricao}</div>

              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ padding: '10px 12px', borderRadius: 10, background: '#f8fafc', fontSize: 13, color: '#243b53' }}>
                  <strong>Quando usar:</strong> {opcao.observacao}
                </div>
                <div style={{ padding: '10px 12px', borderRadius: 10, background: '#f8fafc', fontSize: 13, color: '#243b53' }}>
                  <strong>Referencia esperada:</strong> {opcao.referencia}
                </div>
              </div>

              <label className={`${opcao.buttonClassName} btn-sm`} style={{ width: 'fit-content' }}>
                <Upload size={14} /> {opcao.actionLabel}
                <input
                  type="file"
                  accept={opcao.accept}
                  onChange={opcao.onChange}
                  disabled={importandoBanco}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Filtros */}
      <div className="filters-row" style={{ display: 'flex', gap: 15, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="form-group">
          <label>Mês</label>
          <select className="search-input" value={mes} onChange={e => setMes(e.target.value)}>
            {getMeses().map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Busca Rápida</label>
          <input className="search-input" placeholder="Filtrar por nome..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ alignSelf: 'flex-end', display: 'flex', gap: 5 }}>
          <button className={`btn btn-sm ${viewMode === 'cards' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setViewMode('cards')}>Cartões</button>
          <button className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setViewMode('table')}>Tabela</button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 15, marginBottom: 25 }}>
        <div className="stat-card green"><span>Pagos</span><strong>{pagos.length}</strong></div>
        <div className="stat-card red"><span>Pendentes</span><strong>{pendentes.length}</strong></div>
        <div className="stat-card blue"><span>Arrecadado</span><strong>{fmt(totalArrecadado)}</strong></div>
        <div className="stat-card yellow"><span>Adimplência</span><strong>{painel.length ? ((pagos.length / painel.length) * 100).toFixed(0) : 0}%</strong></div>
      </div>

      {/* Seção de Conciliação Pendente */}
      {ultimoDiagnosticoDabb && (ultimoDiagnosticoDabb.codigosSemMembro.length > 0 || ultimoDiagnosticoDabb.codigosAmbiguos.length > 0) && (
        <div className="card" style={{ marginBottom: 20, border: '1px solid #cbd5e0' }}>
          <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <span>Diagnóstico DABB do Último Arquivo</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {ultimoDiagnosticoDabb.codigosSemMembro.length > 0 && (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => baixarCsvCodigosDabb(`codigos_dabb_sem_cadastro_${mes}.csv`, ultimoDiagnosticoDabb.codigosSemMembro)}
                >
                  <Download size={13} /> CSV sem cadastro
                </button>
              )}
              {ultimoDiagnosticoDabb.codigosAmbiguos.length > 0 && (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => baixarCsvCodigosDabb(`codigos_dabb_ambiguos_${mes}.csv`, ultimoDiagnosticoDabb.codigosAmbiguos)}
                >
                  <Download size={13} /> CSV ambíguos
                </button>
              )}
            </div>
          </div>
          <div style={{ fontSize: 13, color: '#4a5568', marginBottom: 10 }}>
            Arquivo: <strong>{ultimoDiagnosticoDabb.arquivo}</strong>
          </div>
          {ultimoDiagnosticoDabb.codigosSemMembro.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                Códigos sem cadastro na tabela de membros: {ultimoDiagnosticoDabb.codigosSemMembro.length}
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                {ultimoDiagnosticoDabb.codigosSemMembro.slice(0, 8).map((item) => (
                  <div key={item.codigo_dabb} style={{ fontSize: 12, padding: '6px 8px', background: '#f7fafc', borderRadius: 6 }}>
                    <strong>{item.codigo_dabb}</strong> · qtd {item.quantidade} · valores {asArray(item.valores).join(', ') || '-'} · meses {asArray(item.meses).join(', ') || '-'}
                  </div>
                ))}
              </div>
            </div>
          )}
          {ultimoDiagnosticoDabb.codigosAmbiguos.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                Códigos ambíguos: {ultimoDiagnosticoDabb.codigosAmbiguos.length}
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                {ultimoDiagnosticoDabb.codigosAmbiguos.slice(0, 8).map((item) => (
                  <div key={item.codigo_dabb} style={{ fontSize: 12, padding: '6px 8px', background: '#fffaf0', borderRadius: 6 }}>
                    <strong>{item.codigo_dabb}</strong> · qtd {item.quantidade} · valores {asArray(item.valores).join(', ') || '-'} · meses {asArray(item.meses).join(', ') || '-'}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {historicoDabb.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <span>Histórico DABB</span>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                setHistoricoDabb([]);
                saveHistoricoDabb([]);
                toast.success('Histórico DABB limpo.');
              }}
            >
              Limpar histórico
            </button>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {historicoDabb.map((item) => (
              <div key={item.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 13 }}>
                    <strong>{item.arquivo}</strong> · mês {item.mes || '-'} · sem cadastro {item.codigosSemMembro.length} · ambíguos {item.codigosAmbiguos.length}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {item.codigosSemMembro.length > 0 && (
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => baixarCsvCodigosDabb(`codigos_dabb_sem_cadastro_${item.mes || 'historico'}.csv`, item.codigosSemMembro)}
                      >
                        <Download size={13} /> Sem cadastro
                      </button>
                    )}
                    {item.codigosAmbiguos.length > 0 && (
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => baixarCsvCodigosDabb(`codigos_dabb_ambiguos_${item.mes || 'historico'}.csv`, item.codigosAmbiguos)}
                      >
                        <Download size={13} /> Ambíguos
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {carregandoPendencias && (
        <div className="card" style={{ marginBottom: 20 }}>
          <small style={{ color: '#718096' }}>Carregando pendências de conciliação...</small>
        </div>
      )}
      {pendenciasConcil.length > 0 && (
        <div className="card" style={{ marginBottom: 20, border: '1px solid orange' }}>
          <div className="card-title" style={{ color: 'orange' }}>Pendências de Conciliação ({pendenciasConcil.length})</div>
          {pendenciasConcil.map(p => (
            <div key={p.conciliacao_id} style={{ padding: 10, borderBottom: '1px solid #eee' }}>
              <small>{p.data_extrato} - {fmt(p.valor_extrato)} - {p.descricao_extrato}</small>
              <div style={{ display: 'flex', gap: 10, marginTop: 5 }}>
                {p.candidatos?.map(c => (
                  <button key={c.membro_id} className="btn btn-success btn-xs" onClick={() => confirmarPendenciaManual(p.conciliacao_id, c.membro_id)} disabled={confirmandoPendencia === `${p.conciliacao_id}:${c.membro_id}`}>
                    Baixar para: {c.nome}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Listagem Principal */}
      {loading ? <div className="spinner" /> : (
        viewMode === 'cards' ? (
          <div className="payment-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 15 }}>
            {painel.map(item => (
              <div key={item.membro_id} className={`payment-card ${item.status === 'pago' ? 'paid' : 'pending'}`} onClick={() => openPagamento(item)}>
                <div className="member-name">{item.nome}</div>
                <div style={{ fontSize: 12 }}>Matrícula: {item.matricula || '-'}</div>
                <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between' }}>
                  <span>{item.status === 'pago' ? fmt(item.valor_pago) : fmt(item.valor_mensalidade)}</span>
                  <span className={`badge ${item.status === 'pago' ? 'badge-success' : 'badge-danger'}`}>{item.status}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="table-wrap card">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Mensalidade</th>
                  <th>Pago</th>
                  <th>Status</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {painel.map(item => (
                  <tr key={item.membro_id}>
                    <td>{item.nome}</td>
                    <td>{fmt(item.valor_mensalidade)}</td>
                    <td>{item.valor_pago ? fmt(item.valor_pago) : '-'}</td>
                    <td><span className={`badge ${item.status === 'pago' ? 'badge-success' : 'badge-danger'}`}>{item.status}</span></td>
                    <td><button className="btn btn-xs btn-primary" onClick={() => openPagamento(item)}>Editar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Modal de Pagamento */}
      {modal && selected && (
        <div className="modal-overlay" key={`pagamento-${selected.membro_id}`}>
          <div className="modal" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <div className="modal-title">Registrar Pagamento</div>
              <button onClick={closePagamentoModal}>✕</button>
            </div>
            <form onSubmit={handleSave} style={{ padding: 20 }}>
              <div style={{ marginBottom: 15, background: '#f9f9f9', padding: 10 }}>
                <strong>{selected.nome}</strong><br/>
                <small>Mensalidade base: {fmt(selected.valor_mensalidade)}</small>
              </div>
              <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label>Valor Pago</label>
                  <input type="number" step="0.01" value={form.valor_pago} onChange={e => setF('valor_pago', e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Data</label>
                  <input type="date" value={form.data_pagamento} onChange={e => setF('data_pagamento', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Forma</label>
                  <select value={form.forma_pagamento} onChange={e => setF('forma_pagamento', e.target.value)}>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="pix">PIX</option>
                    <option value="transferencia">Transferência</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select value={form.status_pagamento} onChange={e => setF('status_pagamento', e.target.value)}>
                    <option value="pago">Pago</option>
                    <option value="pendente">Pendente</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer" style={{ marginTop: 20, display: 'flex', gap: 10 }}>
                <button type="submit" className="btn btn-success" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
                {form.status_pagamento === 'pago' && (
                  <button type="button" className="btn btn-primary" onClick={openReciboModal}>Imprimir Recibo</button>
                )}
                <button type="button" className="btn btn-outline" onClick={closePagamentoModal}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Recibo */}
      {showRecibo && selected && (
        <div className="modal-overlay" key={`recibo-${selected.membro_id}`}>
          <div className="modal" style={{ maxWidth: 650, padding: 32 }}>
            {/* Campos editáveis para assinatura e meses */}
            <div style={{ marginBottom: 24, display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontWeight: 600, fontSize: 13 }}>Nome para assinatura</label>
                <input
                  type="text"
                  value={assinaturaNome || ''}
                  onChange={e => setAssinaturaNome(e.target.value)}
                  className="search-input"
                  placeholder="Nome do responsável"
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontWeight: 600, fontSize: 13 }}>Cargo</label>
                <input
                  type="text"
                  value={assinaturaCargo || ''}
                  onChange={e => setAssinaturaCargo(e.target.value)}
                  className="search-input"
                  placeholder="Cargo do responsável"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontWeight: 600, fontSize: 13 }}>Meses referentes (ex: janeiro, fevereiro, março de 2026)</label>
              <input
                type="text"
                value={referenteMeses}
                onChange={e => setReferenteMeses(e.target.value)}
                className="search-input"
                placeholder="Ex: janeiro, fevereiro, março de 2026"
                style={{ width: '100%' }}
              />
            </div>
            <div id="recibo-print-area" style={{ padding: 40, border: '1px solid #eee', background: '#fff', fontSize: 17, lineHeight: 1.7 }}>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>
                  RECIBO DE PAGAMENTO DE MENSALIDADES
                </div>
                <div style={{ fontSize: 13, marginBottom: 16 }}>
                  UNIÃO DOS APOSENTADOS DOS CORREIOS EM BAURU/SP - Rua 7 de Setembro, 8-25 – Centro – 17015-031 – Bauru/SP - Fone: (14) 3202-7391 – whatsapp (14) 99743-5701 – e-mail: secretaria@unacob.com.br
                </div>
              </div>

              <div style={{ fontSize: 16, marginBottom: 32, marginTop: 32 }}>
                <p style={{ margin: 0 }}>
                  Declaramos, para os devidos fins, que recebemos do associado <b>{selected.nome}</b> o valor de <b>R$ {valorPagoFormatado}</b> ({valorPorExtenso(form.valor_pago)}), correspondente à quitação da(s) mensalidade(s) associativa referente{' '}
                  <b>{referenteMeses.trim() ? `aos meses de ${referenciaReciboTexto}` : `ao mês de ${referenciaReciboTexto}`}</b>
                  .
                </p>
                <p style={{ margin: '12px 0 0 0' }}>
                  O presente registro confirma a regularidade da contribuição e a adimplência do associado perante a UNACOB.
                </p>
              </div>

              <div style={{ margin: '48px 0 40px 0', fontSize: 15 }}>
                Bauru/SP, {dataHoje()}.
              </div>

              <div style={{ marginTop: 64, textAlign: 'center' }}>
                <b>{assinaturaNome || 'Sérgio Golino'}</b><br />
                <span style={{ fontSize: 13 }}>{assinaturaCargo || 'Assessor Financeiro'}</span>
              </div>
            </div>
            <div className="modal-footer" style={{ marginTop: 24 }}>
              <button
                type="button"
                className="btn btn-primary modal-btn-save"
                onClick={printRecibo}
              >
                Imprimir Recibo
              </button>
              <button
                type="button"
                className="btn btn-outline modal-btn-cancel"
                onClick={closeReciboModal}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
