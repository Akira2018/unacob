import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Membros from './pages/Membros';
import Pagamentos from './pages/Pagamentos';
import Despesas from './pages/Despesas';
import OutrasRendas from './pages/OutrasRendas';
import FluxoCaixa from './pages/FluxoCaixa';
import Festas from './pages/Festas';
import Aniversariantes from './pages/Aniversariantes';
import Conciliacao from './pages/Conciliacao';
import Financeiro from './pages/Financeiro';
import AplicacoesFinanceiras from './pages/AplicacoesFinanceiras';
import PlanoContas from './pages/PlanoContas';
import PrevisaoOrcamentaria from './pages/PrevisaoOrcamentaria';
import Etiquetas from './pages/Etiquetas';
import Relatorios from './pages/Relatorios';
import Usuarios from './pages/Usuarios';
import MeuCadastro from './pages/MeuCadastro';
import AcessoNegado from './pages/AcessoNegado';
import InscricaoFestaPublica from './pages/InscricaoFestaPublica';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

function ProtectedLayout() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const token = localStorage.getItem('token');
  const role = user?.role;
  const canAccessFinance = role === 'administrador' || role === 'gerente';

  if (!user || !token) return <Navigate to="/login" replace />;

  return (
    <div className="app-layout">
      <Sidebar open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />
      <button
        className="btn btn-outline btn-icon menu-toggle-btn"
        id="menu-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label={sidebarOpen ? 'Fechar menu' : 'Abrir menu'}
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
      <div className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/membros" element={<Membros />} />
          <Route path="/pagamentos" element={canAccessFinance ? <Pagamentos /> : <Navigate to="/acesso-negado" replace />} />
          <Route path="/despesas" element={canAccessFinance ? <Despesas /> : <Navigate to="/acesso-negado" replace />} />
          <Route path="/outras-rendas" element={canAccessFinance ? <OutrasRendas /> : <Navigate to="/acesso-negado" replace />} />
          <Route path="/fluxo-caixa" element={canAccessFinance ? <FluxoCaixa /> : <Navigate to="/acesso-negado" replace />} />
          <Route path="/festas" element={<Festas />} />
          <Route path="/aniversariantes" element={<Aniversariantes />} />
          <Route path="/conciliacao" element={canAccessFinance ? <Conciliacao /> : <Navigate to="/acesso-negado" replace />} />
          <Route path="/financeiro" element={canAccessFinance ? <Financeiro /> : <Navigate to="/acesso-negado" replace />} />
          <Route path="/aplicacoes-financeiras" element={canAccessFinance ? <AplicacoesFinanceiras /> : <Navigate to="/acesso-negado" replace />} />
          <Route path="/plano-contas" element={canAccessFinance ? <PlanoContas /> : <Navigate to="/acesso-negado" replace />} />
          <Route path="/previsao-orcamentaria" element={canAccessFinance ? <PrevisaoOrcamentaria /> : <Navigate to="/acesso-negado" replace />} />
          <Route path="/etiquetas" element={<Etiquetas />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/meu-cadastro" element={<MeuCadastro />} />
          <Route path="/usuarios" element={<Usuarios />} />
          <Route path="/acesso-negado" element={<AcessoNegado />} />
        </Routes>
      </div>
      {sidebarOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 99 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        <Routes>
          <Route path="/login" element={<LoginGuard />} />
          <Route path="/festa-inscricao/:festaId" element={<InscricaoFestaPublica />} />
          <Route path="/*" element={<ProtectedLayout />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}

function LoginGuard() {
  const { user } = useAuth();
  const token = localStorage.getItem('token');
  if (user && token) return <Navigate to="/" replace />;
  return <Login />;
}
