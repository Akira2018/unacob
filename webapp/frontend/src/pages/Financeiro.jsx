import { useCallback, useEffect, useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { format, subMonths } from 'date-fns';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download } from 'lucide-react';
import { getApiErrorMessage } from '../utils/apiError';

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
    const r = await api.get(`/relatorios/balancete?mes_referencia=${mes}`, { responseType: 'blob' });
    const url = URL.createObjectURL(r.data);
    const a = document.createElement('a'); a.href = url; a.download = `balancete_${mes}.xlsx`; a.click();
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

  const desspCatData = data ? Object.entries(data.despesas_por_categoria).map(([name, value]) => ({ name, value })) : [];
  const rendaCatData = data ? Object.entries(data.rendas_por_categoria).map(([name, value]) => ({ name, value })) : [];
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            <div className="card">
              <div className="card-title" style={{ color: '#38a169' }}>📥 ENTRADAS</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px 4px' }}><strong>Saldo Anterior ({data?.mes_referencia_anterior || '-'})</strong></td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#1e3a5f' }}>
                      {fmt(data?.saldo_anterior)}
                      {data?.origem_saldo_anterior === 'manual' && (
                        <span className="badge badge-warning" style={{ marginLeft: 8 }}>Saldo Manual Ativo</span>
                      )}
                    </td>
                  </tr>
                  {entradasContaData.map(r => (
                    <tr key={`${r.codigo}-${r.nome}`} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '8px 4px', paddingLeft: 10 }}>{r.codigo} - {r.nome}</td>
                      <td style={{ textAlign: 'right', color: '#38a169' }}>{fmt(r.valor)}</td>
                    </tr>
                  ))}
                  <tr style={{ background: '#f0fff4', fontWeight: 700 }}>
                    <td style={{ padding: '10px 4px' }}>TOTAL ENTRADAS</td>
                    <td style={{ textAlign: 'right', color: '#38a169', fontSize: 15 }}>{fmt(data?.total_entradas)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="card">
              <div className="card-title" style={{ color: '#e53e3e' }}>📤 SAÍDAS</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <tbody>
                  {saidasContaData.map(d => (
                    <tr key={`${d.codigo}-${d.nome}`} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '8px 4px' }}>{d.codigo} - {d.nome}</td>
                      <td style={{ textAlign: 'right', color: '#e53e3e' }}>{fmt(d.valor)}</td>
                    </tr>
                  ))}
                  <tr style={{ background: '#fff5f5', fontWeight: 700 }}>
                    <td style={{ padding: '10px 4px' }}>TOTAL SAÍDAS</td>
                    <td style={{ textAlign: 'right', color: '#e53e3e', fontSize: 15 }}>{fmt(data?.total_despesas)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* SALDO */}
          <div className="card" style={{ marginBottom: 24, textAlign: 'center', background: data?.saldo >= 0 ? 'linear-gradient(135deg, #f0fff4, #c6f6d5)' : 'linear-gradient(135deg, #fff5f5, #fed7d7)' }}>
            <div style={{ fontSize: 14, color: '#4a5568', fontWeight: 500 }}>SALDO FINAL (COM SALDO ANTERIOR)</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: data?.saldo_final >= 0 ? '#276749' : '#9b2c2c', margin: '8px 0' }}>
              {fmt(data?.saldo_final)}
            </div>
            <div style={{ fontSize: 13, color: data?.saldo_final >= 0 ? '#276749' : '#9b2c2c' }}>
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
                        <td>{p.membro_id}</td>
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
    <div className="card" style={{ borderLeft: `4px solid ${color}`, padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#718096', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <div className={`money-value ${big ? 'money-value-big' : 'money-value-compact'}`} style={{ fontWeight: bold ? 800 : 600, color, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#718096', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
