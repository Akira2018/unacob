import { useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { Download, FileSpreadsheet, Users, CreditCard, Cake, BarChart3, PartyPopper, GitMerge, PiggyBank } from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { useEffect } from 'react';

const getMeses = () => { const r = []; for (let i = 0; i < 13; i++) r.push(format(subMonths(new Date(), i), 'yyyy-MM')); return r; };
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function Relatorios() {
  const [busca, setBusca] = useState('');
  const [mes, setMes] = useState(format(new Date(), 'yyyy-MM'));
  const [mesAniv, setMesAniv] = useState(new Date().getMonth() + 1);
  const [statusMembro, setStatusMembro] = useState('');
  const [festas, setFestas] = useState([]);
  const [festaId, setFestaId] = useState('');
  const [loading, setLoading] = useState({});

  useEffect(() => {
    api.get('/festas').then(r => setFestas(r.data));
  }, []);

  const download = async (key, url, filename, params = {}) => {
    setLoading(prev => ({ ...prev, [key]: true }));
    try {
      const r = await api.get(url, { params, responseType: 'blob' });
      const blobUrl = URL.createObjectURL(r.data);
      const a = document.createElement('a'); a.href = blobUrl; a.download = filename; a.click();
      toast.success('Relatório gerado!');
    } catch { toast.error('Erro ao gerar relatório'); }
    finally { setLoading(prev => ({ ...prev, [key]: false })); }
  };

  const reports = [
    {
      key: 'membros',
      icon: <Users size={24} />,
      title: 'Relatório de Membros',
      desc: 'Lista completa com todos os dados cadastrais dos membros',
      color: '#1e3a5f',
      action: () => download('membros', '/relatorios/membros', `membros${statusMembro ? '_' + statusMembro : ''}.xlsx`, statusMembro ? { status: statusMembro } : {}),
      extra: (
        <select className="search-input" value={statusMembro} onChange={e => setStatusMembro(e.target.value)} style={{ width: '100%' }}>
          <option value="">Todos os status</option>
          <option value="ativo">Apenas Ativos</option>
          <option value="inativo">Apenas Inativos</option>
        </select>
      )
    },
    {
      key: 'pagamentos',
      icon: <CreditCard size={24} />,
      title: 'Relatório de Pagamentos',
      desc: 'Situação de pagamentos dos membros com destaque para inadimplentes',
      color: '#38a169',
      action: () => download('pagamentos', '/relatorios/pagamentos', `pagamentos_${mes}.xlsx`, { mes_referencia: mes }),
      extra: (
        <select className="search-input" value={mes} onChange={e => setMes(e.target.value)} style={{ width: '100%' }}>
          {getMeses().map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      )
    },
    {
      key: 'aniversariantes',
      icon: <Cake size={24} />,
      title: 'Relatório de Aniversariantes',
      desc: 'Lista de aniversariantes do mês selecionado',
      color: '#c8a84b',
      action: () => download('aniversariantes', '/relatorios/aniversariantes', `aniversariantes_mes_${mesAniv}.xlsx`, { mes: mesAniv }),
      extra: (
        <select className="search-input" value={mesAniv} onChange={e => setMesAniv(parseInt(e.target.value))} style={{ width: '100%' }}>
          {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
      )
    },
    {
      key: 'balancete',
      icon: <BarChart3 size={24} />,
      title: 'Balancete Mensal',
      desc: 'Resumo financeiro completo: saldo anterior, entradas, saídas e saldo final',
      color: '#805ad5',
      action: () => download('balancete', '/relatorios/balancete', `balancete_${mes}.xlsx`, { mes_referencia: mes }),
      extra: (
        <select className="search-input" value={mes} onChange={e => setMes(e.target.value)} style={{ width: '100%' }}>
          {getMeses().map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      )
    },
    {
      key: 'conciliacao',
      icon: <GitMerge size={24} />,
      title: 'Relatório de Conciliação',
      desc: 'Detalhamento de lançamentos bancários com saldo anterior e saldo final',
      color: '#0891b2',
      action: () => download('conciliacao', '/relatorios/conciliacao', `conciliacao_${mes}.xlsx`, { mes_referencia: mes }),
      extra: (
        <select className="search-input" value={mes} onChange={e => setMes(e.target.value)} style={{ width: '100%' }}>
          {getMeses().map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      )
    },
    {
      key: 'aplicacoes_financeiras',
      icon: <PiggyBank size={24} />,
      title: 'Relatório de Aplicações Financeiras',
      desc: 'Extrato consolidado por instituição/produto com totais e saldo atual',
      color: '#2f855a',
      action: () => download('aplicacoes_financeiras', '/relatorios/aplicacoes-financeiras', `aplicacoes_financeiras_${mes}.xlsx`, { mes_referencia: mes }),
      extra: (
        <select className="search-input" value={mes} onChange={e => setMes(e.target.value)} style={{ width: '100%' }}>
          {getMeses().map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      )
    },
  ];

  if (festas.length > 0) {
    reports.push({
      key: 'festa',
      icon: <PartyPopper size={24} />,
      title: 'Lista de Participantes de Festa',
      desc: 'Relação de participantes e dependentes de uma festa',
      color: '#dd6b20',
      action: () => {
        if (!festaId) { toast.error('Selecione uma festa'); return; }
        const festa = festas.find(f => f.id === festaId);
        download('festa', `/relatorios/festas/${festaId}`, `participantes_${festa?.nome_festa || festaId}.xlsx`);
      },
      extra: (
        <select className="search-input" value={festaId} onChange={e => setFestaId(e.target.value)} style={{ width: '100%' }}>
          <option value="">Selecione uma festa...</option>
          {festas.map(f => <option key={f.id} value={f.id}>{f.nome_festa} — {f.data_festa}</option>)}
        </select>
      )
    });
  }

  const termoBusca = busca.trim().toLowerCase();
  const reportsFiltrados = termoBusca
    ? reports.filter(r => [r.title, r.desc].some(campo => String(campo).toLowerCase().includes(termoBusca)))
    : reports;
  const labelRelatorio = (qtd) => `${qtd} ${qtd === 1 ? 'relatório' : 'relatórios'}`;

  return (
    <div>
      <div className="topbar">
        <h2>Relatórios</h2>
        <span style={{ fontSize: 13, color: '#718096' }}>Exportação em Excel (.xlsx)</span>
      </div>

      <div className="filters" style={{ marginBottom: 16 }}>
        <div className="form-group" style={{ margin: 0, minWidth: 280, flex: 1 }}>
          <label>Busca</label>
          <input
            className="search-input"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Nome ou descrição do relatório..."
          />
        </div>
        <div style={{ fontSize: 13, color: '#4a5568', alignSelf: 'flex-end', paddingBottom: 8 }}>
          {termoBusca
            ? `${labelRelatorio(reportsFiltrados.length)} de ${labelRelatorio(reports.length)}`
            : labelRelatorio(reports.length)}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
        {reportsFiltrados.map(r => (
          <div key={r.key} className="card" style={{ borderTop: `4px solid ${r.color}` }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: r.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', color: r.color, flexShrink: 0 }}>
                {r.icon}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#2d3748' }}>{r.title}</div>
                <div style={{ fontSize: 13, color: '#718096', marginTop: 2 }}>{r.desc}</div>
              </div>
            </div>
            {r.extra && <div style={{ marginBottom: 12 }}>{r.extra}</div>}
            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', background: r.color }}
              onClick={r.action}
              disabled={loading[r.key]}
            >
              <Download size={15} />
              {loading[r.key] ? 'Gerando...' : 'Baixar Excel'}
            </button>
          </div>
        ))}
      </div>

      {reportsFiltrados.length === 0 && (
        <div className="card" style={{ marginTop: 16, textAlign: 'center', color: '#718096' }}>
          Nenhum relatório encontrado para a busca informada.
        </div>
      )}

      <div className="card" style={{ marginTop: 24, background: 'linear-gradient(135deg, #f7f8fc, #edf2f7)' }}>
        <div className="card-title"><FileSpreadsheet size={16} /> Sobre os Relatórios</div>
        <ul style={{ fontSize: 13, color: '#718096', paddingLeft: 16, lineHeight: 2 }}>
          <li>Todos os relatórios são gerados no formato Excel (.xlsx)</li>
          <li>Os relatórios de pagamentos destacam inadimplentes em vermelho e adimplentes em verde</li>
          <li>O balancete inclui saldo anterior, saldo do mês e saldo final</li>
          <li>Os relatórios são gerados com dados em tempo real do banco de dados</li>
        </ul>
      </div>
    </div>
  );
}
