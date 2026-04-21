import { useCallback, useEffect, useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { format, subMonths } from 'date-fns';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download } from 'lucide-react';
import { getApiErrorMessage } from '../utils/apiError';
import InlineHelpCard from '../components/InlineHelpCard';

const HELP_BY_ROLE = {
  administrador: 'Priorize saldo inicial, integridade do balancete e consistência do ambiente antes de exportar ou ajustar valores manuais.',
  gerente: 'Use esta tela para validar entradas, despesas e saldo final antes de compartilhar o fechamento do mês.',
};

const HELP_LINKS = [
  { to: '/documentacao/manual', label: 'Abrir manual do usuário' },
  { to: '/documentacao/troubleshooting', label: 'Ver ajuda para problemas comuns' },
  { to: '/documentacao', label: 'Ir para a central de documentação' },
];

const fmt = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const getMeses = () => { const r = []; for (let i = 0; i < 13; i++) r.push(format(subMonths(new Date(), i), 'yyyy-MM')); return r; };
const COLORS = ['#1e3a5f', '#c8a84b', '#38a169', '#e53e3e', '#805ad5', '#dd6b20', '#2c7a7b', '#553c9a'];

export default function Financeiro() {
  const [mes, setMes] = useState(format(new Date(), 'yyyy-MM'));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saldoModal, setSaldoModal] = useState(false);
  const [saldoInput, setSaldoInput] = useState('');
  const [saldoObsInput, setSaldoObsInput] = useState('');
  const [savingSaldo, setSavingSaldo] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/financeiro/balancete', { params: { mes_referencia: mes } })
      .then(r => setData(r.data))
      .catch(err => toast.error(getApiErrorMessage(err, 'Erro ao carregar balancete')))
      .finally(() => setLoading(false));
  }, [mes]);

  useEffect(() => {
    const timerId = setTimeout(load, 0);
    return () => clearTimeout(timerId);
  }, [load]);

  const exportar = async () => {
    try {
      const r = await api.get(`/relatorios/balancete?mes_referencia=${mes}`, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `balancete_${mes}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao exportar balancete'));
    }
  };

  const openSaldoModal = async () => {
    try {
      const resp = await api.get('/saldo-inicial', { params: { mes_referencia: mes } });
      setSaldoInput(String(resp.data?.valor_saldo_inicial ?? 0));
      setSaldoObsInput(resp.data?.observacoes || '');
    } catch {
      setSaldoInput(String(data?.saldo_anterior ?? 0));
      setSaldoObsInput('');
    }
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
    if (data?.origem_saldo_anterior !== 'manual') return;
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

  const desspCatData = Object.entries(data?.despesas_por_categoria || {}).map(([name, value]) => ({ name, value }));
  const rendaCatData = Object.entries(data?.rendas_por_categoria || {}).map(([name, value]) => ({ name, value }));
  const entradasContaData = data?.entradas_por_conta?.length
    ? data.entradas_por_conta
    : rendaCatData.map(item => ({ codigo: '-', nome: item.name, valor: item.value }));
  const saidasContaData = data?.saidas_por_conta?.length
    ? data.saidas_por_conta
    : desspCatData.map(item => ({ codigo: '-', nome: item.name, valor: item.value }));

  return (
    <div>
      <div className="topbar">
        <h2>Balancete Mensal</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <select className="search-input" value={mes} onChange={e => setMes(e.target.value)}>
            {getMeses().map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <button className="btn btn-outline btn-sm" onClick={openSaldoModal}>Saldo Inicial</button>
          <button className="btn btn-outline btn-sm" onClick={exportar}><Download size={14} /> Excel</button>
        </div>
      </div>

      <InlineHelpCard
        defaultLabel="Financeiro"
        messagesByRole={HELP_BY_ROLE}
        fallbackMessage="Confirme o mês, o saldo inicial e os totais antes de exportar o balancete."
        links={HELP_LINKS}
      />

      {loading ? <div className="page-loading"><div className="spinner" /></div> : (
        <>
          {/* Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
            <SumCard
              label="Saldo Anterior"
              value={fmt(data?.saldo_anterior)}
              color="#1e3a5f"
              sub={data?.origem_saldo_anterior === 'manual' ? 'Saldo Manual Ativo' : 'Origem calculada'}
            />
            <SumCard label="Mensalidades" value={fmt(data?.total_mensalidades)} color="#38a169" sub={`${data?.qtd_pagantes} pagantes`} />
            <SumCard label="Outras Rendas" value={fmt(data?.total_outras_rendas)} color="#805ad5" />
            <SumCard label="Total Entradas" value={fmt(data?.total_entradas)} color="#1e3a5f" bold />
            <SumCard label="Total Despesas" value={fmt(data?.total_despesas)} color="#e53e3e" />
            <SumCard label="Saldo do Mês" value={fmt(data?.saldo)} color={data?.saldo >= 0 ? '#38a169' : '#e53e3e'} bold />
            <SumCard label="SALDO FINAL" value={fmt(data?.saldo_final)} color={data?.saldo_final >= 0 ? '#38a169' : '#e53e3e'} bold big />
          </div>

          {/* Balancete Table */}
          <div className="financeiro-balancete-grid">
            <div className="card">
              <div className="card-title financeiro-balancete-title-entrada">📥 ENTRADAS</div>
              <table className="financeiro-balancete-table">
                <tbody>
                  <tr className="financeiro-balancete-row-primary">
                    <td className="financeiro-balancete-cell"><strong>Saldo Anterior ({data?.mes_referencia_anterior || '-'})</strong></td>
                    <td className="financeiro-balancete-cell financeiro-balancete-value financeiro-balancete-value-strong">
                      {fmt(data?.saldo_anterior)}
                      {data?.origem_saldo_anterior === 'manual' && (
                        <span className="badge badge-warning" style={{ marginLeft: 8 }}>Saldo Manual Ativo</span>
                      )}
                    </td>
                  </tr>
                  {entradasContaData.map(r => (
                    <tr key={`${r.codigo}-${r.nome}`} className="financeiro-balancete-row-secondary">
                      <td className="financeiro-balancete-cell financeiro-balancete-cell-indent">{r.codigo} - {r.nome}</td>
                      <td className="financeiro-balancete-cell financeiro-balancete-value financeiro-balancete-value-entrada">{fmt(r.valor)}</td>
                    </tr>
                  ))}
                  <tr className="financeiro-balancete-total-entrada">
                    <td className="financeiro-balancete-cell">TOTAL ENTRADAS</td>
                    <td className="financeiro-balancete-cell financeiro-balancete-value financeiro-balancete-value-entrada financeiro-balancete-total-value">{fmt(data?.total_entradas)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="card">
              <div className="card-title financeiro-balancete-title-saida">📤 SAÍDAS</div>
              <table className="financeiro-balancete-table">
                <tbody>
                  {saidasContaData.map(d => (
                    <tr key={`${d.codigo}-${d.nome}`} className="financeiro-balancete-row-secondary">
                      <td className="financeiro-balancete-cell">{d.codigo} - {d.nome}</td>
                      <td className="financeiro-balancete-cell financeiro-balancete-value financeiro-balancete-value-saida">{fmt(d.valor)}</td>
                    </tr>
                  ))}
                  <tr className="financeiro-balancete-total-saida">
                    <td className="financeiro-balancete-cell">TOTAL SAÍDAS</td>
                    <td className="financeiro-balancete-cell financeiro-balancete-value financeiro-balancete-value-saida financeiro-balancete-total-value">{fmt(data?.total_despesas)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* SALDO */}
          <div className={`card financeiro-saldo-card ${data?.saldo >= 0 ? 'financeiro-saldo-card-positive' : 'financeiro-saldo-card-negative'}`}>
            <div className="financeiro-saldo-label">SALDO FINAL (COM SALDO ANTERIOR)</div>
            <div className={`financeiro-saldo-value ${data?.saldo_final >= 0 ? 'financeiro-saldo-value-positive' : 'financeiro-saldo-value-negative'}`}>
              {fmt(data?.saldo_final)}
            </div>
            <div className={`financeiro-saldo-status ${data?.saldo_final >= 0 ? 'financeiro-saldo-status-positive' : 'financeiro-saldo-status-negative'}`}>
              {data?.saldo_final >= 0 ? '✅ Saldo acumulado positivo' : '⚠️ Saldo acumulado negativo'}
            </div>
          </div>

          {/* Charts */}
          {(desspCatData.length > 0 || rendaCatData.length > 0) && (
            <div className="charts-grid">
              {desspCatData.length > 0 && (
                <div className="card">
                  <div className="card-title">Despesas por Categoria</div>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={desspCatData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ percent }) => `${(percent*100).toFixed(0)}%`}>
                        {desspCatData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={v => fmt(v)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="card">
                <div className="card-title">Visão Geral</div>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={[{ name: mes, Entradas: data?.total_entradas, Despesas: data?.total_despesas, 'Saldo Final': data?.saldo_final }]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={v => fmt(v)} />
                    <Legend />
                    <Bar dataKey="Entradas" fill="#38a169" radius={[4,4,0,0]} />
                    <Bar dataKey="Despesas" fill="#e53e3e" radius={[4,4,0,0]} />
                    <Bar dataKey="Saldo Final" fill="#1e3a5f" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Pagamentos do mês */}
          {data?.pagamentos?.length > 0 && (
            <div className="card" style={{ marginTop: 24 }}>
              <div className="card-title">Pagamentos Recebidos</div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Membro</th><th>Valor</th><th>Data</th><th>Forma</th></tr></thead>
                  <tbody>
                    {data.pagamentos.map((p, i) => (
                      <tr key={i}>
                        <td>{p.nome || p.membro_nome || p.membro_id}</td>
                        <td><strong style={{ color: '#38a169' }}>{fmt(p.valor_pago)}</strong></td>
                        <td>{p.data_pagamento || '-'}</td>
                        <td>{p.forma_pagamento || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
                    {data?.origem_saldo_anterior === 'manual' && (
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
        </>
      )}
    </div>
  );
}

function SumCard({ label, value, color, sub, bold, big }) {
  return (
    <div className="card financeiro-summary-card" style={{ borderLeftColor: color }}>
      <div className="financeiro-summary-label">{label}</div>
      <div className={`money-value financeiro-summary-value ${big ? 'money-value-big' : 'money-value-compact'}`} style={{ fontWeight: bold ? 800 : 600, color }}>{value}</div>
      {sub && <div className="financeiro-summary-sub">{sub}</div>}
    </div>
  );
}
