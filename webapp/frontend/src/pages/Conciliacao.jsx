import { useCallback, useEffect, useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, CheckCircle, XCircle, Upload } from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { getApiErrorMessage } from '../utils/apiError';
import InlineHelpCard from '../components/InlineHelpCard';

const HELP_BY_ROLE = {
  administrador: 'Confira saúde do ambiente, importação do arquivo e diferenças antes de agir em lote ou restaurar dados.',
  gerente: 'Use esta tela para comparar extratos, tratar pendências e fechar o período antes dos relatórios finais.',
};

const HELP_LINKS = [
  { to: '/documentacao/importacoes', label: 'Ver guia de importações' },
  { to: '/documentacao/troubleshooting', label: 'Ver ajuda para problemas comuns' },
  { to: '/documentacao/manual', label: 'Abrir manual do usuário' },
];

const fmt = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const getMeses = () => { const r = []; for (let i = 0; i < 13; i++) r.push(format(subMonths(new Date(), i), 'yyyy-MM')); return r; };
const emptyForm = { data_extrato: format(new Date(), 'yyyy-MM-dd'), descricao_extrato: '', valor_extrato: '', tipo: 'debito', conciliado: false, observacoes: '' };
const emptyLaunchForm = { conta_id: '', categoria: '', contraparte: '', forma_pagamento: 'extrato_bancario', observacoes: '' };

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

const isSaldoLinha = (item) => {
  const desc = normalizeText(item?.descricao_extrato);
  if (!desc) return false;
  if (desc === 'saldo' || desc === 'saldo do dia' || desc === 'saldo anterior') return true;
  if (desc.replace(/\s/g, '') === 'saldo') return true;
  return desc.startsWith('saldo ') || desc.includes(' saldo ');
};

export default function Conciliacao() {
  const [items, setItems] = useState([]);
  const [mes, setMes] = useState(format(new Date(), 'yyyy-MM'));
  const [saldoAnterior, setSaldoAnterior] = useState(0);
  const [origemSaldoAnterior, setOrigemSaldoAnterior] = useState('calculado');
  const [saldoObservacoes, setSaldoObservacoes] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [sugestoes, setSugestoes] = useState([]);
  const [carregandoSugestoes, setCarregandoSugestoes] = useState(false);
  const [membroSearchTerm, setMembroSearchTerm] = useState('');
  const [membroSearchResults, setMembroSearchResults] = useState([]);
  const [membroSelecionado, setMembroSelecionado] = useState(null);
  const [buscandoMembros, setBuscandoMembros] = useState(false);
  const [carregandoSugestaoMembro, setCarregandoSugestaoMembro] = useState(false);
  const [saldoModal, setSaldoModal] = useState(false);
  const [saldoInput, setSaldoInput] = useState('');
  const [saldoObsInput, setSaldoObsInput] = useState('');
  const [savingSaldo, setSavingSaldo] = useState(false);
  const [contasEntrada, setContasEntrada] = useState([]);
  const [contasSaida, setContasSaida] = useState([]);
  const [launchModal, setLaunchModal] = useState(false);
  const [launchItem, setLaunchItem] = useState(null);
  const [launchForm, setLaunchForm] = useState(emptyLaunchForm);
  const [launchSaving, setLaunchSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const paramsConciliacao = mes ? { mes_referencia: mes } : undefined;

    if (!mes) {
      api.get('/conciliacao', { params: paramsConciliacao })
        .then((conciliacaoResp) => {
          setItems(conciliacaoResp.data || []);
          setSaldoAnterior(0);
          setOrigemSaldoAnterior('calculado');
          setSaldoObservacoes('');
        })
        .catch(err => toast.error(getApiErrorMessage(err, 'Erro')))
        .finally(() => setLoading(false));
      return;
    }

    Promise.all([
      api.get('/conciliacao', { params: paramsConciliacao }),
      api.get('/saldo-inicial', { params: { mes_referencia: mes } })
    ])
      .then(([conciliacaoResp, saldoResp]) => {
        setItems(conciliacaoResp.data || []);
        setSaldoAnterior(saldoResp.data?.valor_saldo_inicial || 0);
        setOrigemSaldoAnterior(saldoResp.data?.origem || 'calculado');
        setSaldoObservacoes(saldoResp.data?.observacoes || '');
      })
      .catch(err => toast.error(getApiErrorMessage(err, 'Erro')))
      .finally(() => setLoading(false));
  }, [mes]);

  useEffect(() => {
    const timerId = setTimeout(load, 0);
    return () => clearTimeout(timerId);
  }, [load]);

  useEffect(() => {
    Promise.all([
      api.get('/contas', { params: { tipo: 'entrada', apenas_ativas: true } }),
      api.get('/contas', { params: { tipo: 'saida', apenas_ativas: true } })
    ])
      .then(([entradaResp, saidaResp]) => {
        setContasEntrada(Array.isArray(entradaResp.data) ? entradaResp.data : []);
        setContasSaida(Array.isArray(saidaResp.data) ? saidaResp.data : []);
      })
      .catch(err => toast.error(getApiErrorMessage(err, 'Erro ao carregar plano de contas')));
  }, []);

  const openModal = (item = null) => {
    setEditing(item);
    setForm(item ? { ...emptyForm, ...item, valor_extrato: item.valor_extrato || '' } : emptyForm);
    setSugestoes([]);
    setMembroSelecionado(null);
    setMembroSearchTerm('');
    setMembroSearchResults([]);
    setModal(true);
    if (item && item.tipo === 'credito' && !item.conciliado) {
      carregarSugestoesMensalidade(item);
    }
  };

  const openLaunchModal = (item) => {
    if (item?.tipo === 'credito') {
      openModal(item);
      return;
    }
    const contas = item?.tipo === 'credito' ? contasEntrada : contasSaida;
    const contaPadrao = contas[0]?.id || '';
    const contaSelecionada = contas.find(c => c.id === contaPadrao);
    setLaunchItem(item);
    setLaunchForm({
      ...emptyLaunchForm,
      conta_id: contaPadrao,
      categoria: contaSelecionada?.nome || ''
    });
    setLaunchModal(true);
  };

  const buscarMembros = (termo) => {
    setMembroSearchTerm(termo);
    if (termo.length < 2) {
      setMembroSearchResults([]);
      return;
    }
    setBuscandoMembros(true);
    api.get('/conciliacao/membros/buscar', { params: { q: termo } })
      .then(r => setMembroSearchResults(r.data))
      .catch(() => setMembroSearchResults([]))
      .finally(() => setBuscandoMembros(false));
  };

  const carregarSugestoesMensalidade = (item) => {
    if (!item?.id) return;
    setCarregandoSugestaoMembro(true);
    api.get(`/conciliacao/${item.id}/sugestoes-mensalidade`)
      .then(r => {
        const termo = r.data?.termo_busca || '';
        const membros = Array.isArray(r.data?.membros) ? r.data.membros : [];
        setMembroSearchTerm(termo);
        setMembroSearchResults(membros);
        if (membros.length === 1) {
          carregarPagamentosMembro(membros[0].membro_id, item);
        }
      })
      .catch(() => {
        setMembroSearchResults([]);
      })
      .finally(() => setCarregandoSugestaoMembro(false));
  };

  const carregarPagamentosMembro = (membroId, itemReferencia = editing) => {
    setCarregandoSugestoes(true);
    api.get(`/conciliacao/membro/${membroId}/pagamentos-pendentes`, {
      params: {
        mes_referencia: itemReferencia?.mes_referencia,
        valor: itemReferencia?.valor_extrato
      }
    })
      .then(r => {
        setMembroSelecionado(r.data);
        setSugestoes(r.data.pagamentos.map(p => ({
          pagamento_id: p.pagamento_id,
          membro_id: p.membro_id || r.data.membro_id,
          membro_nome: r.data.nome,
          mes: p.mes,
          valor: p.valor,
          status: p.status,
          diferenca: Math.abs(Number(itemReferencia?.valor_extrato || 0) - p.valor)
        })));
      })
        .catch(err => toast.error(getApiErrorMessage(err, 'Erro ao carregar pagamentos')))
      .finally(() => setCarregandoSugestoes(false));
  };

  const handleSave = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, valor_extrato: parseFloat(form.valor_extrato) };
      if (editing) {
        await api.put(`/conciliacao/${editing.id}`, payload);
        toast.success('Atualizado!');
      } else {
        await api.post('/conciliacao', payload);
        toast.success('Registrado!');
      }
      setModal(false);
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao salvar'));
    } finally {
      setSaving(false);
    }
  };

  const vincularPagamento = async (sugestao) => {
    try {
      await api.post(`/conciliacao/${editing.id}/reconciliar`, sugestao.pagamento_id
        ? { pagamento_id: sugestao.pagamento_id }
        : { membro_id: sugestao.membro_id }
      );
      toast.success('Pagamento reconciliado!');
      setModal(false);
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro'));
    }
  };

  const handleImportExtrato = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = (file.name || '').toLowerCase();
    if (!fileName.endsWith('.csv') && !fileName.endsWith('.ofx') && !fileName.endsWith('.ret') && !fileName.endsWith('.rem')) {
      toast.error('Selecione um arquivo CSV, OFX, RET ou REM');
      e.target.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('banco', 'Importado');

    try {
      const res = await api.post('/conciliacao/importar/extrato', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const total = Number(res.data?.total_importados || 0);
      const linhasLidas = Number(res.data?.linhas_lidas || 0);
      const linhasDuplicadas = Number(res.data?.linhas_duplicadas || 0);
      const linhasInvalidas = Number(res.data?.linhas_invalidas || 0);
      const baixasAutomaticas = Number(res.data?.total_baixas_automaticas || 0);
      const semMembro = Number(res.data?.total_sem_membro || 0);
      const codigosAmbiguos = Number(res.data?.total_codigos_ambiguos || 0);
      const codigosSemMembro = Array.isArray(res.data?.codigos_sem_membro) ? res.data.codigos_sem_membro : [];
      const diagnosticoDabb = res.data?.diagnostico_dabb;
      const mesesImportados = Array.isArray(res.data?.meses_importados) ? res.data.meses_importados : [];
      const mesesLidos = Array.isArray(res.data?.meses_lidos) ? res.data.meses_lidos : [];

      if (total === 0) {
        toast(
          `Nenhum lancamento novo foi importado. Lidas: ${linhasLidas}, duplicadas: ${linhasDuplicadas}, invalidas: ${linhasInvalidas}.`
        );
      } else {
        toast.success(`${total} lancamentos importados!`);
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
          `RET/REM: detalhes ${diagnosticoDabb.linhas_detalhe_encontradas}, válidas ${diagnosticoDabb.linhas_detalhe_validas}` +
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

      const mesDestino =
        (mes && mesesImportados.length > 0 && !mesesImportados.includes(mes) && mesesImportados[0]) ||
        (mes && total === 0 && linhasLidas > 0 && linhasDuplicadas > 0 && mesesLidos.length > 0 && !mesesLidos.includes(mes) && mesesLidos[0]) ||
        null;

      if (mesDestino) {
        setMes(mesDestino);
        toast('Ha lancamentos do arquivo em outro mes. Ajustei o filtro automaticamente.');
      } else {
        load();
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao importar extrato'));
    }
    e.target.value = '';
  };

  const toggleConciliado = async (item) => {
    try {
      await api.put(`/conciliacao/${item.id}`, { conciliado: !item.conciliado });
      toast.success(item.conciliado ? 'Desconciliado' : 'Conciliado!');
      load();
    } catch (err) { toast.error(getApiErrorMessage(err, 'Erro')); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remover?')) return;
    try { await api.delete(`/conciliacao/${id}`); toast.success('Removido'); load(); }
    catch (err) { toast.error(getApiErrorMessage(err, 'Erro')); }
  };

  const handleLaunch = async (e) => {
    e.preventDefault();
    if (!launchItem) return;
    if (!launchForm.conta_id) {
      toast.error('Selecione uma conta');
      return;
    }

    setLaunchSaving(true);
    try {
      if (launchItem.tipo === 'credito') {
        await api.post(`/conciliacao/${launchItem.id}/lancar-receita`, {
          conta_id: launchForm.conta_id,
          categoria: launchForm.categoria || null,
          fonte: launchForm.contraparte || null,
          observacoes: launchForm.observacoes || null
        });
        toast.success('Crédito lançado em Outras Receitas');
      } else {
        await api.post(`/conciliacao/${launchItem.id}/lancar-despesa`, {
          conta_id: launchForm.conta_id,
          categoria: launchForm.categoria || null,
          fornecedor: launchForm.contraparte || null,
          forma_pagamento: launchForm.forma_pagamento || 'extrato_bancario',
          observacoes: launchForm.observacoes || null
        });
        toast.success('Débito lançado em Despesas');
      }
      setLaunchModal(false);
      setLaunchItem(null);
      setLaunchForm(emptyLaunchForm);
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao lançar conciliação'));
    } finally {
      setLaunchSaving(false);
    }
  };

  const openSaldoModal = () => {
    if (!mes) {
      toast('Selecione um mes especifico para editar o saldo inicial.');
      return;
    }
    setSaldoInput(String(saldoAnterior ?? 0));
    setSaldoObsInput(saldoObservacoes || '');
    setSaldoModal(true);
  };

  const salvarSaldoInicial = async (e) => {
    e.preventDefault();
    const valor = parseFloat(saldoInput);
    if (!Number.isFinite(valor)) {
      toast.error('Informe um valor válido para o saldo inicial');
      return;
    }

    setSavingSaldo(true);
    try {
      await api.put('/saldo-inicial', {
        mes_referencia: mes,
        valor_saldo_inicial: valor,
        observacoes: saldoObsInput || null
      });
      toast.success('Saldo inicial salvo com sucesso');
      setSaldoModal(false);
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao salvar saldo inicial'));
    } finally {
      setSavingSaldo(false);
    }
  };

  const removerSaldoManual = async () => {
    if (origemSaldoAnterior !== 'manual') return;
    if (!confirm(`Remover o saldo manual de ${mes} e voltar ao cálculo automático?`)) return;

    setSavingSaldo(true);
    try {
      await api.delete('/saldo-inicial', { params: { mes_referencia: mes } });
      toast.success('Saldo manual removido. Cálculo automático reativado.');
      setSaldoModal(false);
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao remover saldo manual'));
    } finally {
      setSavingSaldo(false);
    }
  };

  const itensCalculo = items.filter(item => !isSaldoLinha(item));
  const itensTotais = itensCalculo.filter(item => item.conciliado);
  const totalCreditos = itensTotais
    .filter(i => i.tipo === 'credito')
    .reduce((s, i) => s + Number(i.valor_extrato || 0), 0);
  const totalDebitos = itensTotais
    .filter(i => i.tipo === 'debito')
    .reduce((s, i) => s + Number(i.valor_extrato || 0), 0);
  const saldoExtrato = totalCreditos - totalDebitos;
  const saldoFinal = saldoAnterior + saldoExtrato;
  const conciliados = itensCalculo.filter(i => i.conciliado).length;
  const totalPendentes = itensCalculo.length - conciliados;
  const searchTerm = search.trim().toLowerCase();
  const itensFiltrados = itensCalculo.filter(item => {
    if (statusFilter === 'conciliados' && !item.conciliado) {
      return false;
    }

    if (statusFilter === 'pendentes' && item.conciliado) {
      return false;
    }

    if (!searchTerm) {
      return true;
    }

    const dataFmt = item.data_extrato ? format(new Date(item.data_extrato), 'dd/MM/yyyy') : '';
    return [
      item.descricao_extrato,
      item.banco,
      item.numero_documento,
      item.tipo,
      dataFmt,
      String(item.valor_extrato ?? '')
    ]
      .filter(Boolean)
      .some(v => String(v).toLowerCase().includes(searchTerm));
  });

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setLaunchField = (k, v) => setLaunchForm(f => ({ ...f, [k]: v }));
  const contasLancamento = launchItem?.tipo === 'credito' ? contasEntrada : contasSaida;
  const contaJaLancada = Boolean(launchItem?.despesa_id || launchItem?.outra_renda_id);

  return (
    <div>
      <div className="topbar">
        <h2>Conciliação Bancária</h2>
        <div className="topbar-actions">
          <button className="btn btn-outline" onClick={openSaldoModal}>Saldo Inicial</button>
          <label className="btn btn-info">
            <Upload size={15} /> Importar Extrato
            <input type="file" accept="*/*" onChange={handleImportExtrato} style={{ display: 'none' }} />
          </label>
          <button className="btn btn-primary" onClick={() => openModal()}><Plus size={15} /> Novo Lançamento</button>
        </div>
      </div>

      <InlineHelpCard
        title="Atenção nesta tela"
        variant="attention"
        defaultLabel="Operação"
        messagesByRole={HELP_BY_ROLE}
        fallbackMessage="Revise o extrato, trate as pendências e confirme o período antes de concluir a conciliação."
        links={HELP_LINKS}
      />

      <div className="filters">
        <div className="form-group" style={{ margin: 0 }}>
          <label>Mês</label>
          <select className="search-input" value={mes} onChange={e => setMes(e.target.value)}>
            <option value="">Todos os meses</option>
            {getMeses().map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <input
          className="search-input search-input-wide"
          placeholder="Buscar por descrição, banco, tipo, valor, data..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={`btn btn-sm ${statusFilter === 'todos' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setStatusFilter('todos')}
          >
            Todos ({itensCalculo.length})
          </button>
          <button
            className={`btn btn-sm ${statusFilter === 'pendentes' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setStatusFilter('pendentes')}
          >
            Pendentes ({totalPendentes})
          </button>
          <button
            className={`btn btn-sm ${statusFilter === 'conciliados' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setStatusFilter('conciliados')}
          >
            Conciliados ({conciliados})
          </button>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card blue">
          <div className="stat-label">Saldo Anterior</div>
          <div className="stat-value money-value money-value-compact">{fmt(saldoAnterior)}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <div className="stat-sub">Origem: {origemSaldoAnterior === 'manual' ? 'Manual' : 'Calculado'}</div>
            {origemSaldoAnterior === 'manual' && <span className="badge badge-warning">Saldo Manual Ativo</span>}
          </div>
        </div>
        <div className="stat-card green"><div className="stat-label">Créditos</div><div className="stat-value money-value money-value-compact">{fmt(totalCreditos)}</div></div>
        <div className="stat-card red"><div className="stat-label">Débitos</div><div className="stat-value money-value money-value-compact">{fmt(totalDebitos)}</div></div>
        <div className="stat-card blue"><div className="stat-label">Saldo Extrato</div><div className="stat-value money-value money-value-compact">{fmt(saldoExtrato)}</div></div>
        <div className={`stat-card ${saldoFinal >= 0 ? 'green' : 'red'}`}><div className="stat-label">Saldo Final</div><div className="stat-value money-value money-value-compact">{fmt(saldoFinal)}</div></div>
        <div className="stat-card yellow"><div className="stat-label">Conciliados</div><div className="stat-value">{conciliados}/{itensCalculo.length}</div></div>
      </div>

      <div className="card">
        {loading ? <div className="spinner" /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Data</th><th>Descrição</th><th>Tipo</th><th>Valor</th><th>Banco</th><th>Conciliado</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {itensFiltrados.length === 0 ? (
                  <tr><td colSpan={7} className="conciliacao-empty-message">{mes ? 'Sem lancamentos neste mes' : 'Sem lancamentos'}</td></tr>
                ) : itensFiltrados.map(item => (
                  <tr key={item.id} className={item.conciliado ? 'row-green' : ''}>
                    <td>{format(new Date(item.data_extrato), 'dd/MM/yyyy')}</td>
                    <td className="conciliacao-text-small-strong">{item.descricao_extrato}</td>
                    <td><span className={`badge ${item.tipo === 'credito' ? 'badge-success' : 'badge-danger'}`}>{item.tipo}</span></td>
                    <td className={item.tipo === 'credito' ? 'conciliacao-value-credito' : 'conciliacao-value-debito'}>{fmt(item.valor_extrato)}</td>
                    <td className="conciliacao-text-muted">{item.banco || '-'}</td>
                    <td>
                      <button className={`btn btn-sm ${item.conciliado ? 'btn-success' : 'btn-outline'}`} onClick={() => toggleConciliado(item)}>
                        {item.conciliado ? <CheckCircle size={13} /> : <XCircle size={13} />}
                        {item.conciliado ? ' Conciliado' : ' Pendente'}
                      </button>
                    </td>
                    <td className="conciliacao-acoes-cell">
                      <div className="conciliacao-acoes">
                        <button
                          className="btn btn-outline btn-sm conciliacao-acao-principal"
                          onClick={() => item.tipo === 'credito' ? openModal(item) : openLaunchModal(item)}
                          disabled={Boolean(
                            item.tipo === 'credito'
                              ? item.pagamento_id
                              : item.despesa_id || item.outra_renda_id
                          )}
                          title={
                            item.tipo === 'credito'
                              ? (item.pagamento_id
                                  ? 'Este crédito já foi vinculado a uma mensalidade'
                                  : 'Dar baixa em Receitas de Mensalidades')
                              : (item.despesa_id || item.outra_renda_id
                                  ? 'Este lançamento já foi enviado para despesas'
                                  : 'Lançar em Despesas')
                          }
                        >
                          {item.tipo === 'credito'
                            ? (item.pagamento_id ? 'Baixado' : 'Mensalidade')
                            : (item.despesa_id || item.outra_renda_id ? 'Lançado' : 'Despesa')}
                        </button>
                        <button className="btn btn-outline btn-icon btn-sm conciliacao-acao-icon" onClick={() => openModal(item)}><Edit size={12} /></button>
                        <button className="btn btn-danger btn-icon btn-sm conciliacao-acao-icon" onClick={() => handleDelete(item.id)}><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {saldoModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <div className="modal-title">Saldo Inicial ({mes})</div>
              <button className="btn btn-outline btn-sm modal-close-btn" onClick={() => setSaldoModal(false)}>✕</button>
            </div>
            <form onSubmit={salvarSaldoInicial}>
              <div className="form-grid">
                <div className="form-group form-full">
                  <label>Saldo Inicial / Saldo Anterior (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={saldoInput}
                    onChange={e => setSaldoInput(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group form-full">
                  <label>Observações</label>
                  <textarea value={saldoObsInput} onChange={e => setSaldoObsInput(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                {origemSaldoAnterior === 'manual' && (
                  <button type="button" className="btn btn-danger btn-sm saldo-modal-btn-danger" onClick={removerSaldoManual} disabled={savingSaldo}>
                    Remover Saldo Manual
                  </button>
                )}
                <button type="button" className="btn btn-outline btn-sm saldo-modal-btn-cancel" onClick={() => setSaldoModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary btn-sm saldo-modal-btn-save" disabled={savingSaldo}>{savingSaldo ? 'Salvando...' : 'Salvar Saldo'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <div className="modal-title">{editing ? 'Editar Lançamento' : 'Novo Lançamento'}</div>
              <button className="btn btn-outline btn-sm modal-close-btn" onClick={() => setModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Data *</label>
                  <input type="date" required value={form.data_extrato} onChange={e => setF('data_extrato', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Tipo *</label>
                  <select value={form.tipo} onChange={e => setF('tipo', e.target.value)}>
                    <option value="credito">Crédito</option>
                    <option value="debito">Débito</option>
                  </select>
                </div>
                <div className="form-group form-full">
                  <label>Descrição *</label>
                  <input required value={form.descricao_extrato} onChange={e => setF('descricao_extrato', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Valor *</label>
                  <input type="number" step="0.01" required value={form.valor_extrato} onChange={e => setF('valor_extrato', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Banco</label>
                  <input value={form.banco || ''} onChange={e => setF('banco', e.target.value)} placeholder="Ex: Bradesco" />
                </div>
                <div className="form-group form-full" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <input type="checkbox" id="conciliado" checked={form.conciliado} onChange={e => setF('conciliado', e.target.checked)} style={{ width: 16, height: 16 }} />
                  <label htmlFor="conciliado" style={{ textTransform: 'none', fontSize: 14, fontWeight: 500 }}>Conciliado</label>
                </div>
                <div className="form-group form-full">
                  <label>Observações</label>
                  <textarea value={form.observacoes || ''} onChange={e => setF('observacoes', e.target.value)} />
                </div>

                {/* Busca de Membro para Baixa de Pagamento */}
                {editing && form.tipo === 'credito' && !form.conciliado && (
                  <div className="form-group form-full" style={{ marginTop: 15, paddingTop: 15, borderTop: '1px solid #e2e8f0' }}>
                    <label style={{ fontWeight: 600, color: '#2d3748', marginBottom: 10 }}>🔗 Dar Baixa em Pagamento de Membro</label>
                    
                    {!membroSelecionado ? (
                      <>
                        <input
                          type="text"
                          placeholder="Digite o nome do membro..."
                          value={membroSearchTerm}
                          onChange={e => buscarMembros(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            border: '1px solid #cbd5e0',
                            borderRadius: '4px',
                            fontSize: '14px',
                            marginBottom: '8px'
                          }}
                        />

                        {carregandoSugestaoMembro && (
                          <div className="feedback-message">
                            Procurando associado pelo nome do extrato...
                          </div>
                        )}
                        
                        {buscandoMembros && <div className="feedback-message">Buscando...</div>}
                        
                        {membroSearchResults.length > 0 && (
                          <div className="conciliacao-option-list conciliacao-option-list-compact">
                            {membroSearchResults.map(m => (
                              <div
                                key={m.membro_id}
                                onClick={() => carregarPagamentosMembro(m.membro_id)}
                                className="conciliacao-option-item"
                              >
                                <div>
                                  <div className="conciliacao-text-small-strong">{m.nome}</div>
                                  <div className="conciliacao-text-muted">
                                    {m.quantidade_pendente} {m.quantidade_pendente === 1 ? 'pagamento pendente' : 'pagamentos pendentes'}
                                    {typeof m.menor_diferenca === 'number' ? ` • dif. ${fmt(m.menor_diferenca)}` : ''}
                                  </div>
                                </div>
                                <div className="conciliacao-value-debito">{fmt(m.total_pendente)}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {membroSearchTerm && membroSearchResults.length === 0 && !buscandoMembros && !carregandoSugestaoMembro && (
                          <div className="conciliacao-empty-state-inline">
                            Nenhum membro com pagamentos pendentes encontrado
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="conciliacao-selected-member">
                          <div>
                            <div className="conciliacao-text-small-strong">{membroSelecionado.nome}</div>
                            <div className="conciliacao-text-muted">
                              {membroSelecionado.pagamentos.length} {membroSelecionado.pagamentos.length === 1 ? 'pagamento a vincular' : 'pagamentos a vincular'}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => {
                              setMembroSelecionado(null);
                              setMembroSearchTerm('');
                              setMembroSearchResults([]);
                              setSugestoes([]);
                            }}
                          >
                            ✕ Trocar
                          </button>
                        </div>

                        {carregandoSugestoes ? (
                          <div style={{ padding: 10, textAlign: 'center', fontSize: 14, color: '#718096' }}>Carregando pagamentos...</div>
                        ) : sugestoes.length > 0 ? (
                          <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 4 }}>
                            {sugestoes.map(s => (
                              <div
                                key={`${s.pagamento_id || s.membro_id}-${s.mes}`}
                                onClick={() => vincularPagamento(s)}
                                style={{
                                  padding: 12,
                                  borderBottom: '1px solid #e2e8f0',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  transition: 'background 0.2s',
                                  backgroundColor: 'transparent'
                                }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f0fff4'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                className="conciliacao-option-item conciliacao-option-item-success"
                              >
                                <div>
                                  <div className="conciliacao-text-small-strong">Mês: {s.mes}</div>
                                  <div className="conciliacao-text-muted">
                                    {s.status === 'nao_gerado' ? `Criar baixa para ${s.mes}` : `Diferença: ${fmt(s.diferenca)}`}
                                  </div>
                                </div>
                                <div className="conciliacao-value-credito">{fmt(s.valor)}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="conciliacao-empty-state-inline">
                            Nenhum pagamento com este valor encontrado
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline modal-btn-cancel" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary modal-btn-save" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {launchModal && launchItem && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <div className="modal-title">
                {launchItem.tipo === 'credito' ? 'Lançar em Outras Receitas' : 'Lançar em Despesas'}
              </div>
              <button className="btn btn-outline btn-sm modal-close-btn" onClick={() => setLaunchModal(false)}>✕</button>
            </div>
            <form onSubmit={handleLaunch}>
              <div className="form-grid">
                <div className="form-group form-full">
                  <label>Descrição do Extrato</label>
                  <input value={launchItem.descricao_extrato || ''} disabled />
                </div>
                <div className="form-group">
                  <label>Data</label>
                  <input value={launchItem.data_extrato ? format(new Date(launchItem.data_extrato), 'dd/MM/yyyy') : ''} disabled />
                </div>
                <div className="form-group">
                  <label>Valor</label>
                  <input value={fmt(launchItem.valor_extrato)} disabled />
                </div>
                <div className="form-group form-full">
                  <label>Conta {launchItem.tipo === 'credito' ? 'da Receita' : 'da Despesa'} *</label>
                  <select
                    required
                    value={launchForm.conta_id}
                    onChange={e => {
                      const contaId = e.target.value;
                      const conta = contasLancamento.find(c => c.id === contaId);
                      setLaunchForm(prev => ({
                        ...prev,
                        conta_id: contaId,
                        categoria: conta?.nome || prev.categoria
                      }));
                    }}
                  >
                    <option value="">Selecione...</option>
                    {contasLancamento.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.nome}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Categoria</label>
                  <input value={launchForm.categoria} onChange={e => setLaunchField('categoria', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>{launchItem.tipo === 'credito' ? 'Fonte' : 'Fornecedor'}</label>
                  <input value={launchForm.contraparte} onChange={e => setLaunchField('contraparte', e.target.value)} />
                </div>
                {launchItem.tipo === 'debito' && (
                  <div className="form-group form-full">
                    <label>Forma de Pagamento</label>
                    <input value={launchForm.forma_pagamento} onChange={e => setLaunchField('forma_pagamento', e.target.value)} />
                  </div>
                )}
                <div className="form-group form-full">
                  <label>Observações</label>
                  <textarea value={launchForm.observacoes} onChange={e => setLaunchField('observacoes', e.target.value)} />
                </div>
                {contaJaLancada && (
                  <div className="form-group form-full">
                    <div style={{ padding: 10, borderRadius: 8, background: '#fff7e6', color: '#8a5a00', fontSize: 13 }}>
                      Este lançamento já foi enviado para o módulo financeiro.
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline modal-btn-cancel" onClick={() => setLaunchModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary modal-btn-save" disabled={launchSaving || contaJaLancada}>
                  {launchSaving ? 'Lançando...' : 'Confirmar Lançamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
