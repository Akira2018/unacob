import { useCallback, useEffect, useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { Download, CreditCard, CheckCircle, XCircle, Clock } from 'lucide-react';
import { format, subMonths } from 'date-fns';

const fmt = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

function getMeses() {
  const result = [];
  for (let i = 0; i < 13; i++) {
    const d = subMonths(new Date(), i);
    result.push(format(d, 'yyyy-MM'));
  }
  return result;
}

export default function Pagamentos() {
  const [mes, setMes] = useState(format(new Date(), 'yyyy-MM'));
  const [search, setSearch] = useState('');
  const [painel, setPainel] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ valor_pago: '', data_pagamento: format(new Date(), 'yyyy-MM-dd'), status_pagamento: 'pago', forma_pagamento: 'dinheiro', observacoes: '' });
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState('cards'); // cards | table
  const [verificandoBanco, setVerificandoBanco] = useState(false);
  const [pendenciasConcil, setPendenciasConcil] = useState([]);
  const [carregandoPendencias, setCarregandoPendencias] = useState(false);
  const [confirmandoPendencia, setConfirmandoPendencia] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/pagamentos/painel', { params: { mes_referencia: mes, search } })
      .then(r => setPainel(r.data))
      .catch(() => toast.error('Erro ao carregar painel'))
      .finally(() => setLoading(false));
  }, [mes, search]);

  const loadPendenciasConcil = useCallback(() => {
    setCarregandoPendencias(true);
    api.get('/pagamentos/pendencias-conciliacao-manual', { params: { mes_referencia: mes } })
      .then(r => setPendenciasConcil(r.data?.pendencias || []))
      .catch(() => setPendenciasConcil([]))
      .finally(() => setCarregandoPendencias(false));
  }, [mes]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadPendenciasConcil(); }, [loadPendenciasConcil]);

  const openPagamento = (item) => {
    setSelected(item);
    setForm({
      valor_pago: item.valor_pago || item.valor_mensalidade || '',
      data_pagamento: item.data_pagamento || format(new Date(), 'yyyy-MM-dd'),
      status_pagamento: item.status === 'pago' ? 'pago' : 'pago',
      forma_pagamento: item.forma_pagamento || 'dinheiro',
      observacoes: ''
    });
    setModal(true);
  };

  const handleSave = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/pagamentos', {
        membro_id: selected.membro_id,
        mes_referencia: mes,
        ...form,
        valor_pago: parseFloat(form.valor_pago)
      });
      toast.success('Pagamento registrado!');
      setModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao salvar pagamento');
    } finally {
      setSaving(false);
    }
  };

  const exportar = async () => {
    const r = await api.get(`/relatorios/pagamentos?mes_referencia=${mes}`, { responseType: 'blob' });
    const url = URL.createObjectURL(r.data);
    const a = document.createElement('a'); a.href = url; a.download = `pagamentos_${mes}.xlsx`; a.click();
  };

  const verificarPagamentosBanco = async () => {
    setVerificandoBanco(true);
    try {
      const { data } = await api.post('/pagamentos/baixa-automatica-banco', null, {
        params: { mes_referencia: mes }
      });

      const totalBaixados = data?.total_baixados || 0;
      const totalAnalisados = data?.total_analisados || 0;

      if (totalBaixados > 0) {
        const pagamentosAtualizados = `${totalBaixados} ${totalBaixados === 1 ? 'pagamento atualizado' : 'pagamentos atualizados'}`;
        const lancamentosAnalisados = `${totalAnalisados} ${totalAnalisados === 1 ? 'lançamento' : 'lançamentos'}`;
        toast.success(`Baixa automática concluída: ${pagamentosAtualizados} de ${lancamentosAnalisados}.`);
      } else {
        toast('Nenhum pagamento compatível foi encontrado no extrato para baixa automática.', {
          icon: 'ℹ️'
        });
      }

      load();
      loadPendenciasConcil();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao verificar pagamentos no banco');
    } finally {
      setVerificandoBanco(false);
    }
  };

  const confirmarPendenciaManual = async (conciliacaoId, membroId) => {
    const opId = `${conciliacaoId}:${membroId}`;
    setConfirmandoPendencia(opId);

    try {
      const { data } = await api.post('/pagamentos/pendencias-conciliacao-manual/confirmar', {
        conciliacao_id: conciliacaoId,
        membro_id: membroId
      });

      toast.success(`Baixa manual confirmada${data?.membro_nome ? ` para ${data.membro_nome}` : ''}.`);
      load();
      loadPendenciasConcil();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao confirmar baixa manual');
    } finally {
      setConfirmandoPendencia('');
    }
  };

  const pagos = painel.filter(p => p.status === 'pago');
  const pendentes = painel.filter(p => p.status !== 'pago');
  const totalArrecadado = pagos.reduce((s, p) => s + (p.valor_pago || 0), 0);
  const searchTerm = search.trim();

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div>
      <div className="topbar">
        <h2>Pagamentos Mensais</h2>
        <div className="topbar-right">
          <button
            className="btn btn-primary btn-sm"
            onClick={verificarPagamentosBanco}
            disabled={verificandoBanco}
          >
            <Clock size={14} /> {verificandoBanco ? 'Verificando...' : 'Verificar banco'}
          </button>
          <button className="btn btn-outline btn-sm" onClick={exportar}><Download size={14} /> Excel</button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters" style={{ marginBottom: 16 }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label>Mês de Referência</label>
          <select className="search-input" value={mes} onChange={e => setMes(e.target.value)}>
            {getMeses().map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0, minWidth: 280, flex: 1 }}>
          <label>Busca</label>
          <input
            className="search-input"
            placeholder="Nome, CPF, email, cidade..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`btn btn-sm ${viewMode === 'cards' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setViewMode('cards')}>Cartões</button>
          <button className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setViewMode('table')}>Tabela</button>
        </div>
      </div>

      {/* Summary */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card green">
          <div className="stat-label">Pagantes</div>
          <div className="stat-value">{pagos.length}</div>
        </div>
        <div className="stat-card red">
          <div className="stat-label">Inadimplentes</div>
          <div className="stat-value">{pendentes.length}</div>
        </div>
        <div className="stat-card blue">
          <div className="stat-label">Total Arrecadado</div>
          <div className="stat-value money-value money-value-compact">{fmt(totalArrecadado)}</div>
        </div>
        <div className="stat-card yellow">
          <div className="stat-label">Taxa de Adimplência</div>
          <div className="stat-value">{painel.length > 0 ? ((pagos.length / painel.length) * 100).toFixed(0) : 0}%</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title" style={{ color: 'var(--warning)', marginBottom: 12 }}>
          Pendências da Conciliação Automática ({pendenciasConcil.length})
        </div>
        {carregandoPendencias ? (
          <div style={{ padding: 12, color: 'var(--text-light)' }}>Carregando pendências...</div>
        ) : pendenciasConcil.length === 0 ? (
          <div style={{ padding: 12, color: 'var(--text-light)' }}>
            Nenhuma pendência com sugestão encontrada para este mês.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {pendenciasConcil.map((p) => (
              <div key={p.conciliacao_id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12 }}>
                <div style={{ fontSize: 13, marginBottom: 8 }}>
                  <strong>{p.data_extrato}</strong> · {fmt(p.valor_extrato)} · {p.descricao_extrato || 'Sem descrição'}
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {(p.candidatos || []).map((c) => {
                    const opId = `${p.conciliacao_id}:${c.membro_id}`;
                    const emProcesso = confirmandoPendencia === opId;
                    return (
                      <div key={c.membro_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'var(--bg)', borderRadius: 6 }}>
                        <div style={{ fontSize: 12 }}>
                          <strong>{c.nome}</strong> {c.matricula ? `· Matrícula ${c.matricula}` : ''} · Confiança {c.confianca}
                        </div>
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => confirmarPendenciaManual(p.conciliacao_id, c.membro_id)}
                          disabled={emProcesso}
                        >
                          <CheckCircle size={12} /> {emProcesso ? 'Confirmando...' : 'Dar baixa'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading ? <div className="spinner" /> : (
        <>
          {viewMode === 'cards' ? (
            <>
              {painel.length === 0 && (
                <div className="card" style={{ marginBottom: 20, color: '#718096', textAlign: 'center', padding: 28 }}>
                  {searchTerm ? 'Nenhum resultado encontrado para a busca informada' : 'Nenhum pagamento encontrado para este mês'}
                </div>
              )}
              {pendentes.length > 0 && (
                <div className="card" style={{ marginBottom: 20 }}>
                  <div className="card-title" style={{ color: '#e53e3e' }}><XCircle size={16} /> Inadimplentes ({pendentes.length})</div>
                  <div className="payment-grid">
                    {pendentes.map(item => (
                      <div key={item.membro_id} className="payment-card pending" onClick={() => openPagamento(item)}>
                        <div className="member-name">{item.nome}</div>
                        <div className="member-info">Matrícula: {item.matricula || '-'}</div>
                        <div className="member-info" style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                          <span>Mensalidade: <strong>{fmt(item.valor_mensalidade)}</strong></span>
                          <span className="badge badge-danger">Pendente</span>
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <button className="btn btn-success btn-sm" style={{ width: '100%' }}>
                            <CreditCard size={12} /> Registrar Pagamento
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {pagos.length > 0 && (
                <div className="card">
                  <div className="card-title" style={{ color: '#38a169' }}><CheckCircle size={16} /> Adimplentes ({pagos.length})</div>
                  <div className="payment-grid">
                    {pagos.map(item => (
                      <div key={item.membro_id} className="payment-card paid" onClick={() => openPagamento(item)}>
                        <div className="member-name">{item.nome}</div>
                        <div className="member-info">Matrícula: {item.matricula || '-'}</div>
                        <div className="member-info" style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                          <span>Pago: <strong>{fmt(item.valor_pago)}</strong></span>
                          <span className="badge badge-success">Pago</span>
                        </div>
                        {item.data_pagamento && <div className="member-info">Data: {item.data_pagamento}</div>}
                        {item.forma_pagamento && <div className="member-info">Forma: {item.forma_pagamento}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Matrícula</th>
                      <th>Nome</th>
                      <th>Mensalidade</th>
                      <th>Valor Pago</th>
                      <th>Data</th>
                      <th>Forma</th>
                      <th>Status</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {painel.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: 36, color: '#718096' }}>
                          {searchTerm ? 'Nenhum resultado encontrado para a busca informada' : 'Nenhum pagamento encontrado para este mês'}
                        </td>
                      </tr>
                    ) : painel.map(item => (
                      <tr key={item.membro_id} className={item.status !== 'pago' ? 'row-red' : 'row-green'}>
                        <td>{item.matricula || '-'}</td>
                        <td><strong>{item.nome}</strong></td>
                        <td>{fmt(item.valor_mensalidade)}</td>
                        <td>{item.valor_pago > 0 ? fmt(item.valor_pago) : '-'}</td>
                        <td>{item.data_pagamento || '-'}</td>
                        <td>{item.forma_pagamento || '-'}</td>
                        <td>
                          <span className={`badge ${item.status === 'pago' ? 'badge-success' : 'badge-danger'}`}>
                            {item.status}
                          </span>
                        </td>
                        <td>
                          <button className="btn btn-primary btn-sm" onClick={() => openPagamento(item)}>
                            <CreditCard size={12} /> {item.status === 'pago' ? 'Editar' : 'Pagar'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Payment Modal */}
      {modal && selected && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div className="modal-title">Registrar Pagamento</div>
              <button className="btn btn-outline btn-sm modal-close-btn" onClick={() => setModal(false)}>✕</button>
            </div>
            <div style={{ background: '#f7f8fc', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{selected.nome}</div>
              <div style={{ fontSize: 12, color: '#718096' }}>Matrícula: {selected.matricula} | Mês: {mes}</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Mensalidade: <strong>{fmt(selected.valor_mensalidade)}</strong></div>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="form-group">
                  <label>Valor Pago *</label>
                  <input type="number" step="0.01" required value={form.valor_pago} onChange={e => setF('valor_pago', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Data Pagamento</label>
                  <input type="date" value={form.data_pagamento} onChange={e => setF('data_pagamento', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select value={form.status_pagamento} onChange={e => setF('status_pagamento', e.target.value)}>
                    <option value="pago">Pago</option>
                    <option value="pendente">Pendente</option>
                    <option value="atrasado">Atrasado</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Forma de Pagamento</label>
                  <select value={form.forma_pagamento} onChange={e => setF('forma_pagamento', e.target.value)}>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="pix">PIX</option>
                    <option value="transferencia">Transferência</option>
                    <option value="boleto">Boleto</option>
                    <option value="cartao">Cartão</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
                <div className="form-group form-full">
                  <label>Observações</label>
                  <textarea value={form.observacoes} onChange={e => setF('observacoes', e.target.value)} style={{ minHeight: 60 }} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline modal-btn-cancel" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-success modal-btn-save" disabled={saving}>
                  <CheckCircle size={14} /> {saving ? 'Salvando...' : 'Confirmar Pagamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
