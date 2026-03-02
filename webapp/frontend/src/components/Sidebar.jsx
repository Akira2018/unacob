import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import {
  LayoutDashboard, Users, CreditCard, Receipt, TrendingUp,
  PartyPopper, FileSpreadsheet, GitMerge, Tag, Cake,
  UserCog, BarChart3, DollarSign, LogOut, Building2, Landmark, User
} from 'lucide-react';

const sections = [
  {
    label: 'Principal',
    items: [
      { to: '/', icon: <LayoutDashboard size={16} />, label: 'Painel' },
    ]
  },
  {
    label: 'Cadastros',
    items: [
      { to: '/membros', icon: <Users size={16} />, label: 'Membros' },
    ]
  },
  {
    label: 'Financeiro',
    items: [
      { to: '/pagamentos', icon: <CreditCard size={16} />, label: 'Pagamentos' },
      { to: '/despesas', icon: <Receipt size={16} />, label: 'Despesas' },
      { to: '/outras-rendas', icon: <DollarSign size={16} />, label: 'Outras Rendas' },
      { to: '/aplicacoes-financeiras', icon: <Landmark size={16} />, label: 'Aplicações Financeiras' },
      { to: '/plano-contas', icon: <FileSpreadsheet size={16} />, label: 'Código de Contas' },
      { to: '/previsao-orcamentaria', icon: <BarChart3 size={16} />, label: 'Previsão Orçamentária' },
      { to: '/fluxo-caixa', icon: <TrendingUp size={16} />, label: 'Fluxo de Caixa' },
      { to: '/financeiro', icon: <BarChart3 size={16} />, label: 'Balancete' },
      { to: '/conciliacao', icon: <GitMerge size={16} />, label: 'Conciliação' },
    ]
  },
  {
    label: 'Eventos',
    items: [
      { to: '/festas', icon: <PartyPopper size={16} />, label: 'Festas' },
    ]
  },
  {
    label: 'Utilitários',
    items: [
      { to: '/aniversariantes', icon: <Cake size={16} />, label: 'Aniversariantes' },
      { to: '/etiquetas', icon: <Tag size={16} />, label: 'Etiquetas' },
      { to: '/relatorios', icon: <FileSpreadsheet size={16} />, label: 'Relatórios' },
      { to: '/meu-cadastro', icon: <User size={16} />, label: 'Meu Cadastro' },
      { to: '/usuarios', icon: <UserCog size={16} />, label: 'Usuários' },
    ]
  },
];

export default function Sidebar({ open, onNavigate }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const role = user?.role;
  const isAssistant = role === 'assistente';

  const handleLogout = () => {
    logout();
    navigate('login');
  };

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-brand">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Building2 size={22} color="#c8a84b" />
          <div>
            <h1>UNACOB</h1>
            <span>União dos aposentados dos correios em Bauru - SP</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {sections.map(sec => {
          const visibleItems = sec.items.filter((item) => {
            const financePaths = new Set([
              '/pagamentos', '/despesas', '/outras-rendas', '/aplicacoes-financeiras',
              '/plano-contas', '/previsao-orcamentaria', '/fluxo-caixa', '/financeiro', '/conciliacao'
            ]);
            if (financePaths.has(item.to) && isAssistant) return false;
            return true;
          });

          if (visibleItems.length === 0) return null;

          return <div key={sec.label}>
            <div className="nav-section">{sec.label}</div>
            {visibleItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={onNavigate}
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </div>;
        })}
      </nav>

      <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,.1)' }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginBottom: 8 }}>
          {user?.nome_completo}
          <span style={{ display: 'block', color: 'rgba(255,255,255,.3)', fontSize: 11 }}>
            {user?.role}
          </span>
        </div>
        <button className="btn btn-outline btn-sm" style={{ color: 'rgba(255,255,255,.7)', borderColor: 'rgba(255,255,255,.2)', width: '100%' }} onClick={handleLogout}>
          <LogOut size={13} /> Sair
        </button>
      </div>
    </aside>
  );
}
