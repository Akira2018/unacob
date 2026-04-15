import { useEffect, useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { Download, FileSpreadsheet, Users, CreditCard, Cake, BarChart3, PartyPopper, GitMerge, PiggyBank, BookText } from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { useAuth } from '../context/useAuth';
import { getApiErrorMessage } from '../utils/apiError';

const getMeses = () => {
  const r = [];
  for (let i = 0; i < 13; i += 1) r.push(format(subMonths(new Date(), i), 'yyyy-MM'));
  return r;
};

const getAnos = () => {
  const anoAtual = new Date().getFullYear();
  return [anoAtual - 2, anoAtual - 1, anoAtual, anoAtual + 1];
};

const MESES = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function Relatorios() {
  const { user } = useAuth();
  const role = user?.role;
  const isAssistant = role === 'assistente';

  const [busca, setBusca] = useState('');
  const [mes, setMes] = useState(format(new Date(), 'yyyy-MM'));
  const [mesAniv, setMesAniv] = useState(new Date().getMonth() + 1);
  const [statusMembro, setStatusMembro] = useState('');
  const [festas, setFestas] = useState([]);
  const [festaId, setFestaId] = useState('');
  const [loading, setLoading] = useState({});
  const [anoConsolidado, setAnoConsolidado] = useState(new Date().getFullYear());

  useEffect(() => {
    api.get('/festas')
      .then((r) => setFestas(r.data))
      .catch((err) => toast.error(getApiErrorMessage(err, 'Erro ao carregar festas')));
  }, []);

  const download = async (key, url, filename, params = {}) => {
    setLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const r = await api.get(url, { params, responseType: 'blob' });
      const blobUrl = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.click();
      toast.success('Relatorio gerado!');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao gerar relatorio'));
    } finally {
      setLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const reports = [
    {
      key: 'membros',
      icon: <Users size={24} />,
      title: 'Relatorio de Membros',
      desc: 'Lista completa com todos os dados cadastrais dos membros',
      color: '#1e3a5f',
      isFinance: false,
      action: () => download('membros', '/relatorios/membros', `membros${statusMembro ? `_${statusMembro}` : ''}.xlsx`, statusMembro ? { status: statusMembro } : {}),
      extra: (
        <select className="search-input" value={statusMembro} onChange={(e) => setStatusMembro(e.target.value)} style={{ width: '100%' }}>
          <option value="">Todos os status</option>
          <option value="ativo">Apenas Ativos</option>
          <option value="inativo">Apenas Inativos</option>
        </select>
      ),
    },
    {
      key: 'pagamentos',
      icon: <CreditCard size={24} />,
      title: 'Recebimento de Mensalidades',
      desc: 'Situacao de pagamentos dos membros com destaque para inadimplentes',
      color: '#38a169',
      isFinance: true,
      action: () => download('pagamentos', '/relatorios/pagamentos', `recebimento_mensalidades_${mes}.xlsx`, { mes_referencia: mes }),
      extra: (
        <select className="search-input" value={mes} onChange={(e) => setMes(e.target.value)} style={{ width: '100%' }}>
          {getMeses().map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      ),
    },
    {
      key: 'aniversariantes',
      icon: <Cake size={24} />,
      title: 'Relatorio de Aniversariantes',
      desc: 'Lista de aniversariantes do mes selecionado',
      color: '#c8a84b',
      isFinance: false,
      action: () => download('aniversariantes', '/relatorios/aniversariantes', `aniversariantes_mes_${mesAniv}.xlsx`, { mes: mesAniv }),
      extra: (
        <select className="search-input" value={mesAniv} onChange={(e) => setMesAniv(parseInt(e.target.value, 10))} style={{ width: '100%' }}>
          {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
      ),
    },
    {
      key: 'balancete',
      icon: <BarChart3 size={24} />,
      title: 'Balancete Mensal',
      desc: 'Resumo financeiro completo: saldo anterior, entradas, saidas e saldo final',
      color: '#805ad5',
      isFinance: true,
      action: () => download('balancete', '/relatorios/balancete', `balancete_${mes}.xlsx`, { mes_referencia: mes }),
      extra: (
        <select className="search-input" value={mes} onChange={(e) => setMes(e.target.value)} style={{ width: '100%' }}>
          {getMeses().map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      ),
    },
    {
      key: 'livro_diario',
      icon: <BookText size={24} />,
      title: 'Livro Diario Mensal',
      desc: 'Lancamentos cronologicos com conta, historico, entradas, saidas e saldo acumulado',
      color: '#6b46c1',
      isFinance: true,
      action: () => download('livro_diario', '/relatorios/livro-diario', `livro_diario_${mes}.xlsx`, { mes_referencia: mes }),
      extra: (
        <select className="search-input" value={mes} onChange={(e) => setMes(e.target.value)} style={{ width: '100%' }}>
          {getMeses().map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      ),
    },
    {
      key: 'conciliacao',
      icon: <GitMerge size={24} />,
      title: 'Relatorio de Conciliacao',
      desc: 'Detalhamento de lancamentos bancarios com saldo anterior e saldo final',
      color: '#0891b2',
      isFinance: true,
      action: () => download('conciliacao', '/relatorios/conciliacao', `conciliacao_${mes}.xlsx`, { mes_referencia: mes }),
      extra: (
        <select className="search-input" value={mes} onChange={(e) => setMes(e.target.value)} style={{ width: '100%' }}>
          {getMeses().map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      ),
    },
    {
      key: 'aplicacoes_financeiras',
      icon: <PiggyBank size={24} />,
      title: 'Relatorio de Aplicacoes Financeiras',
      desc: 'Extrato consolidado por instituicao/produto com totais e saldo atual',
      color: '#2f855a',
      isFinance: true,
      action: () => download('aplicacoes_financeiras', '/relatorios/aplicacoes-financeiras', `aplicacoes_financeiras_${mes}.xlsx`, { mes_referencia: mes }),
      extra: (
        <select className="search-input" value={mes} onChange={(e) => setMes(e.target.value)} style={{ width: '100%' }}>
          {getMeses().map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      ),
    },
    {
      key: 'consolidado_financeiro',
      icon: <BarChart3 size={24} />,
      title: 'Consolidado Entradas/Saidas/Aplicacoes',
      desc: 'Relatorio anual mes a mes com totais de entradas, saidas, aplicacoes e saldo liquido',
      color: '#2b6cb0',
      isFinance: true,
      action: () => download('consolidado_financeiro', '/relatorios/consolidado-financeiro', `consolidado_financeiro_${anoConsolidado}.xlsx`, { ano: anoConsolidado }),
      extra: (
        <select className="search-input" value={anoConsolidado} onChange={(e) => setAnoConsolidado(parseInt(e.target.value, 10))} style={{ width: '100%' }}>
          {getAnos().map((ano) => <option key={ano} value={ano}>{ano}</option>)}
        </select>
      ),
    },
  ];

  if (festas.length > 0) {
    reports.push({
      key: 'festa',
      icon: <PartyPopper size={24} />,
      title: 'Lista de Participantes de Festa',
      desc: 'Relacao de participantes e dependentes de uma festa',
      color: '#dd6b20',
      isFinance: false,
      action: () => {
        if (!festaId) {
          toast.error('Selecione uma festa');
          return;
        }
        const festa = festas.find((f) => f.id === festaId);
        download('festa', `/relatorios/festas/${festaId}`, `participantes_${festa?.nome_festa || festaId}.xlsx`);
      },
      extra: (
        <select className="search-input" value={festaId} onChange={(e) => setFestaId(e.target.value)} style={{ width: '100%' }}>
          <option value="">Selecione uma festa...</option>
          {festas.map((f) => <option key={f.id} value={f.id}>{f.nome_festa} - {f.data_festa}</option>)}
        </select>
      ),
    });
  }

  const reportsByRole = isAssistant ? reports.filter((r) => !r.isFinance) : reports;
  const termoBusca = busca.trim().toLowerCase();
  const reportsFiltrados = termoBusca
    ? reportsByRole.filter((r) => [r.title, r.desc].some((campo) => String(campo).toLowerCase().includes(termoBusca)))
    : reportsByRole;

  const labelRelatorio = (qtd) => `${qtd} ${qtd === 1 ? 'relatorio' : 'relatorios'}`;

  return (
    <div>
      <div className="topbar">
        <h2>Relatorios</h2>
        <span style={{ fontSize: 13, color: '#718096' }}>Exportacao em Excel (.xlsx)</span>
      </div>

      <div className="filters" style={{ marginBottom: 16 }}>
        <div className="form-group" style={{ margin: 0, minWidth: 280, flex: 1 }}>
          <label>Busca</label>
          <input
            className="search-input"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome ou descricao do relatorio..."
          />
        </div>
        <div style={{ fontSize: 13, color: '#4a5568', alignSelf: 'flex-end', paddingBottom: 8 }}>
          {termoBusca
            ? `${labelRelatorio(reportsFiltrados.length)} de ${labelRelatorio(reportsByRole.length)}`
            : labelRelatorio(reportsByRole.length)}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20, borderLeft: '4px solid #b45309', background: '#fffaf0' }}>
        <div className="card-title"><FileSpreadsheet size={16} /> Remessa DABB</div>
        <div style={{ fontSize: 14, color: '#7c2d12', lineHeight: 1.7 }}>
          A geracao e o historico dos arquivos <code>.rem</code> do Banco do Brasil agora ficam em uma pagina propria.
        </div>
        <div style={{ marginTop: 12 }}>
          <a href="#/remessa-dabb" className="btn btn-primary" style={{ background: '#b45309' }}>
            <CreditCard size={15} /> Abrir Remessa DABB
          </a>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
        {reportsFiltrados.map((r) => (
          <div key={r.key} className="card" style={{ borderTop: `4px solid ${r.color}` }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: `${r.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: r.color, flexShrink: 0 }}>
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
          Nenhum relatorio encontrado para a busca informada.
        </div>
      )}
    </div>
  );
}
