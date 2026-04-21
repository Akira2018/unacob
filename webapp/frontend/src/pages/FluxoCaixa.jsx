import { useCallback, useEffect, useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { format, subMonths } from 'date-fns';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import FilterBar from '../components/FilterBar';
import { getApiErrorMessage } from '../utils/apiError';
import InlineHelpCard from '../components/InlineHelpCard';
import TableEmptyRow from '../components/TableEmptyRow';

const HELP_BY_ROLE = {
  administrador: 'Priorize saldo inicial, origem do saldo anterior e consistência das transações antes de ajustar dados manuais.',
  gerente: 'Use esta tela para acompanhar entradas, saídas e saldo final do mês antes de compartilhar indicadores.',
};

const HELP_LINKS = [
  { to: '/documentacao/manual', label: 'Abrir manual do usuário' },
  { to: '/documentacao/troubleshooting', label: 'Ver ajuda para problemas comuns' },
  { to: '/documentacao', label: 'Ir para a central de documentação' },
];

const fmt = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const getMeses = () => { const r = []; for (let i = 0; i < 13; i++) r.push(format(subMonths(new Date(), i), 'yyyy-MM')); return r; };
const fmtMes = m => { if (!m) return ''; const [y, mo] = m.split('-'); const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']; return `${months[parseInt(mo)-1]}/${y.slice(2)}`; };

export default function FluxoCaixa() {
  const [mes, setMes] = useState(format(new Date(), 'yyyy-MM'));
  const [busca, setBusca] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalSaldo, setModalSaldo] = useState(false);
  const [saldoInput, setSaldoInput] = useState('');
  const [saldoObs, setSaldoObs] = useState('');
  const [savingSaldo, setSavingSaldo] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.allSettled([
      api.get('/fluxo-caixa', { params: { mes_referencia: mes } }),
      api.get('/saldo-inicial', { params: { mes_referencia: mes } })
    ])
      .then(([fluxoResp, saldoResp]) => {
        if (fluxoResp.status !== 'fulfilled') {
          throw fluxoResp.reason;
        }

        if (saldoResp.status !== 'fulfilled') {
          toast.error('Saldo inicial indisponível no momento. Exibindo fluxo com dados principais.');
        }

        setData({
          ...fluxoResp.value.data,
          observacoes_saldo_inicial: saldoResp.status === 'fulfilled' ? saldoResp.value.data?.observacoes || '' : ''
        });
      })
      .catch(err => toast.error(getApiErrorMessage(err, 'Erro ao carregar fluxo de caixa')))
      .finally(() => setLoading(false));
  }, [mes]);

  useEffect(() => {
    const timerId = setTimeout(load, 0);
    return () => clearTimeout(timerId);
  }, [load]);

  const openSaldoModal = () => {
    setSaldoInput(String(data?.saldo_anterior ?? 0));
    setSaldoObs(data?.observacoes_saldo_inicial || '');
    setModalSaldo(true);
  };

  const salvarSaldoInicial = async e => {
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
        observacoes: saldoObs || null
      });
      toast.success('Saldo inicial salvo com sucesso');
      setModalSaldo(false);
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
      setModalSaldo(false);
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao remover saldo manual'));
    } finally {
      setSavingSaldo(false);
    }
  };

  const termoBusca = busca.trim().toLowerCase();
  const transacoes = data?.transacoes || [];
  const transacoesFiltradas = termoBusca
    ? transacoes.filter(t =>
        [t.descricao, t.categoria, t.origem, t.data_transacao, t.tipo, String(t.valor ?? '')]
          .filter(Boolean)
          .some(campo => String(campo).toLowerCase().includes(termoBusca))
      )
    : transacoes;
  const entradasFiltradas = transacoesFiltradas.filter(t => t.tipo === 'entrada');
  const saidasFiltradas = transacoesFiltradas.filter(t => t.tipo === 'saida');

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <div>
      <div className="topbar">
        <h2>Fluxo de Caixa</h2>
        <div className="fluxocaixa-topbar-actions">
          <button className="btn btn-outline btn-sm" onClick={openSaldoModal}>Saldo Inicial</button>
        </div>
      </div>

      <InlineHelpCard
        defaultLabel="Financeiro"
        messagesByRole={HELP_BY_ROLE}
        fallbackMessage="Confirme mês, saldo inicial e totais antes de interpretar o fluxo."
        links={HELP_LINKS}
      />

      <FilterBar style={{ marginBottom: 16 }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label>Mês</label>
          <select className="search-input" value={mes} onChange={e => setMes(e.target.value)}>
            {getMeses().map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0, minWidth: 260, flex: 1 }}>
          <label>Busca</label>
          <input
            className="search-input"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Descrição, categoria, origem..."
          />
        </div>
      </FilterBar>

      {/* Summary */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card blue">
          <div className="stat-label">Saldo Anterior</div>
          <div className="stat-value money-value money-value-regular">{fmt(data?.saldo_anterior)}</div>
          <div className="fluxocaixa-stat-meta">
            <div className="stat-sub">Origem: {data?.origem_saldo_anterior === 'manual' ? 'Manual' : 'Calculado'}</div>
            {data?.origem_saldo_anterior === 'manual' && (
              <span className="badge badge-warning">Saldo Manual Ativo</span>
            )}
          </div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Total Entradas</div>
          <div className="stat-value money-value money-value-regular">{fmt(data?.total_entradas)}</div>
        </div>
        <div className="stat-card red">
          <div className="stat-label">Total Saídas</div>
          <div className="stat-value money-value money-value-regular">{fmt(data?.total_saidas)}</div>
        </div>
        <div className={`stat-card ${(data?.saldo || 0) >= 0 ? 'green' : 'red'}`}>
          <div className="stat-label">Saldo do Mês</div>
          <div className={`stat-value money-value money-value-regular ${(data?.saldo || 0) >= 0 ? 'fluxocaixa-stat-value-positive' : 'fluxocaixa-stat-value-negative'}`}>
            {fmt(data?.saldo)}
          </div>
        </div>
        <div className={`stat-card ${(data?.saldo_final || 0) >= 0 ? 'green' : 'red'}`}>
          <div className="stat-label">Saldo Final</div>
          <div className={`stat-value money-value money-value-regular ${(data?.saldo_final || 0) >= 0 ? 'fluxocaixa-stat-value-positive' : 'fluxocaixa-stat-value-negative'}`}>
            {fmt(data?.saldo_final)}
          </div>
        </div>
      </div>

      {modalSaldo && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <div className="modal-title">Saldo Inicial ({mes})</div>
              <button className="btn btn-outline btn-sm modal-close-btn" onClick={() => setModalSaldo(false)}>✕</button>
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
                  <textarea value={saldoObs} onChange={e => setSaldoObs(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                {data?.origem_saldo_anterior === 'manual' && (
                  <button type="button" className="btn btn-danger btn-sm saldo-modal-btn-danger" onClick={removerSaldoManual} disabled={savingSaldo}>
                    Remover Saldo Manual
                  </button>
                )}
                <button type="button" className="btn btn-outline btn-sm saldo-modal-btn-cancel" onClick={() => setModalSaldo(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary btn-sm saldo-modal-btn-save" disabled={savingSaldo}>{savingSaldo ? 'Salvando...' : 'Salvar Saldo'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Evolution chart */}
      <div className="card fluxoCaixa-chart-card fluxocaixa-chart-card">
        <div className="card-title">Evolução dos Últimos 12 Meses</div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data?.evolucao_mensal?.map(d => ({ ...d, mes: fmtMes(d.mes) }))}>
            <defs>
              <linearGradient id="green" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#38a169" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#38a169" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="red" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#e53e3e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#e53e3e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
            <Tooltip formatter={v => fmt(v)} />
            <Legend />
            <Area type="monotone" dataKey="entradas" stroke="#38a169" fill="url(#green)" name="Entradas" strokeWidth={2} />
            <Area type="monotone" dataKey="saidas" stroke="#e53e3e" fill="url(#red)" name="Saídas" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Transactions */}
      <div className="fluxocaixa-transactions-grid">
        <div className="card">
          <div className="card-title fluxocaixa-card-title-entrada"><TrendingUp size={16} /> Entradas do Mês</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Valor</th></tr>
              </thead>
              <tbody>
                {entradasFiltradas.length === 0 ? (
                  <TableEmptyRow colSpan={4} message={termoBusca ? 'Nenhuma entrada encontrada para a busca' : 'Sem entradas'} />
                ) : entradasFiltradas.map(t => (
                  <tr key={t.id}>
                    <td>{t.data_transacao}</td>
                    <td>{t.descricao}</td>
                    <td><span className="badge badge-success">{t.categoria || t.origem}</span></td>
                    <td><strong className="fluxocaixa-value-entrada">{fmt(t.valor)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-title fluxocaixa-card-title-saida"><TrendingDown size={16} /> Saídas do Mês</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Valor</th></tr>
              </thead>
              <tbody>
                {saidasFiltradas.length === 0 ? (
                  <TableEmptyRow colSpan={4} message={termoBusca ? 'Nenhuma saída encontrada para a busca' : 'Sem saídas'} />
                ) : saidasFiltradas.map(t => (
                  <tr key={t.id}>
                    <td>{t.data_transacao}</td>
                    <td>{t.descricao}</td>
                    <td><span className="badge badge-danger">{t.categoria || t.origem}</span></td>
                    <td><strong className="fluxocaixa-value-saida">{fmt(t.valor)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
