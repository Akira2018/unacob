import { useCallback, useEffect, useState } from 'react';
import api from '../api';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Users, CreditCard, TrendingDown, TrendingUp, Cake, AlertCircle, CheckCircle, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiErrorMessage } from '../utils/apiError';
import { format, subMonths } from 'date-fns';

const COLORS = ['#1e3a5f', '#c8a84b', '#38a169', '#e53e3e', '#805ad5', '#dd6b20'];
const COMPACT_CURRENCY_THRESHOLD = 100000;
const fmt = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const getMeses = () => { const r = []; for (let i = 0; i < 13; i++) r.push(format(subMonths(new Date(), i), 'yyyy-MM')); return r; };
const fmtCompact = (v) => {
  const valor = Number(v || 0);
  const semCentavos = Math.abs(valor) >= COMPACT_CURRENCY_THRESHOLD;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: semCentavos ? 0 : 2,
    maximumFractionDigits: semCentavos ? 0 : 2,
  }).format(valor);
};
const fmtMes = m => { if (!m) return ''; const [y, mo] = m.split('-'); const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']; return `${months[parseInt(mo)-1]}/${y.slice(2)}`; };

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [mes, setMes] = useState(format(new Date(), 'yyyy-MM'));
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/dashboard', { params: { mes_referencia: mes } })
      .then(r => setData(r.data))
      .catch((err) => {
        if (err.response?.status !== 401) {
          toast.error(getApiErrorMessage(err, 'Erro ao carregar dashboard'));
        }
      })
      .finally(() => setLoading(false));
  }, [mes]);

  useEffect(() => {
    const timerId = setTimeout(load, 0);
    return () => clearTimeout(timerId);
  }, [load]);

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;
  if (!data) return null;

  return (
    <div>
      <div className="topbar">
        <h2>Painel Geral</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: '#718096' }}>Mês:</span>
          <select className="search-input" value={mes} onChange={e => setMes(e.target.value)} style={{ minWidth: 110 }}>
            {getMeses().map(m => <option key={m} value={m}>{fmtMes(m)}</option>)}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
        <StatCard icon={<Users size={22} />} label="Membros Ativos" value={data.total_membros} color="blue" />
        <StatCard icon={<CheckCircle size={22} />} label="Pagantes no Mês" value={data.total_pagantes} color="green" />
        <StatCard icon={<AlertCircle size={22} />} label="Inadimplentes" value={data.inadimplentes} color="red" />
        <StatCard icon={<TrendingUp size={22} />} label="Arrecadado" value={fmtCompact(data.total_arrecadado)} color="green" sub="mensalidades" compactValue />
        <StatCard icon={<DollarSign size={22} />} label="Outras Rendas" value={fmtCompact(data.total_outras_rendas)} color="purple" compactValue />
        <StatCard icon={<TrendingDown size={22} />} label="Despesas" value={fmtCompact(data.total_despesas)} color="red" compactValue />
        <StatCard icon={<CreditCard size={22} />} label="Saldo do Mês" value={fmtCompact(data.saldo_mes)} color={data.saldo_mes >= 0 ? "green" : "red"} compactValue />
        <StatCard icon={<Cake size={22} />} label="Aniversariantes" value={data.aniversariantes_mes} color="yellow" sub="neste mês" />
      </div>

      {/* Aniversariantes hoje */}
      {data.aniversariantes_hoje?.length > 0 && (
        <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(135deg, #1e3a5f, #2d5282)', color: 'white' }}>
          <div className="card-title" style={{ color: '#c8a84b' }}><Cake size={18} /> 🎂 Aniversariantes de Hoje!</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {data.aniversariantes_hoje.map(a => (
              <div key={a.id} style={{ background: 'rgba(255,255,255,.1)', borderRadius: 8, padding: '8px 14px', fontSize: 14 }}>
                🎉 <strong>{a.nome}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="charts-grid">
        <div className="card">
          <div className="card-title"><TrendingUp size={16} /> Evolução Financeira (6 meses)</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.evolucao_mensal?.map(d => ({ ...d, mes: fmtMes(d.mes) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={v => fmt(v)} />
              <Legend />
              <Bar dataKey="entradas" fill="#38a169" name="Entradas" radius={[4,4,0,0]} />
              <Bar dataKey="saidas" fill="#e53e3e" name="Saídas" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-title"><TrendingUp size={16} /> Saldo Mensal</div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.evolucao_mensal?.map(d => ({ ...d, mes: fmtMes(d.mes) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={v => fmt(v)} />
              <Line type="monotone" dataKey="saldo" stroke="#1e3a5f" strokeWidth={2.5} dot={{ r: 4 }} name="Saldo" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-title"><Users size={16} /> Status dos Membros</div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={data.status_membros} dataKey="total" nameKey="status" cx="50%" cy="50%" outerRadius={90} label={({ status, percent }) => `${status} ${(percent * 100).toFixed(0)}%`}>
                {data.status_membros?.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-title">📊 Resumo do Mês</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SummaryRow label="Mensalidades Recebidas" value={fmtCompact(data.total_arrecadado)} color="#38a169" />
            <SummaryRow label="Outras Rendas" value={fmtCompact(data.total_outras_rendas)} color="#805ad5" />
            <SummaryRow label="Total Entradas" value={fmtCompact(data.total_arrecadado + data.total_outras_rendas)} color="#1e3a5f" bold />
            <hr style={{ border: 'none', borderTop: '1px dashed #e2e8f0' }} />
            <SummaryRow label="Total Despesas" value={fmtCompact(data.total_despesas)} color="#e53e3e" />
            <hr style={{ border: 'none', borderTop: '1px dashed #e2e8f0' }} />
            <SummaryRow label="Saldo" value={fmtCompact(data.saldo_mes)} color={data.saldo_mes >= 0 ? "#38a169" : "#e53e3e"} bold />
            <div style={{ fontSize: 12, color: '#718096', marginTop: 4 }}>
              Taxa de adimplência: <strong>{data.total_membros > 0 ? ((data.total_pagantes / data.total_membros) * 100).toFixed(1) : 0}%</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color, sub, compactValue = false }) {
  const valorTexto = String(value ?? '');
  const compactTight = compactValue && valorTexto.length >= 11;

  return (
    <div className={`stat-card ${color}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="stat-label">{label}</div>
        <div style={{ color: `var(--${color === 'blue' ? 'primary' : color === 'green' ? 'success' : color === 'yellow' ? 'warning' : color === 'purple' ? 'secondary' : 'danger'})`, opacity: .7 }}>{icon}</div>
      </div>
      <div className={`stat-value${compactValue ? ' stat-value-compact' : ''}${compactTight ? ' stat-value-tight' : ''}`}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function SummaryRow({ label, value, color, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 13, color: '#4a5568', fontWeight: bold ? 600 : 400, minWidth: 0 }}>{label}</span>
      <span
        style={{
          fontSize: bold ? 14 : 13,
          fontWeight: bold ? 700 : 500,
          color,
          textAlign: 'right',
          lineHeight: 1.2,
          whiteSpace: 'nowrap'
        }}
      >
        {value}
      </span>
    </div>
  );
}
