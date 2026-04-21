import { Suspense, lazy, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import Sidebar from './components/Sidebar';
import { Menu, X } from 'lucide-react';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Membros = lazy(() => import('./pages/Membros'));
const Pagamentos = lazy(() => import('./pages/Pagamentos'));
const Despesas = lazy(() => import('./pages/Despesas'));
const OutrasRendas = lazy(() => import('./pages/OutrasRendas'));
const FluxoCaixa = lazy(() => import('./pages/FluxoCaixa'));
const Festas = lazy(() => import('./pages/Festas'));
const Aniversariantes = lazy(() => import('./pages/Aniversariantes'));
const Conciliacao = lazy(() => import('./pages/Conciliacao'));
const Financeiro = lazy(() => import('./pages/Financeiro'));
const AplicacoesFinanceiras = lazy(() => import('./pages/AplicacoesFinanceiras'));
const PlanoContas = lazy(() => import('./pages/PlanoContas'));
const PrevisaoOrcamentaria = lazy(() => import('./pages/PrevisaoOrcamentaria'));
const Etiquetas = lazy(() => import('./pages/Etiquetas'));
const Relatorios = lazy(() => import('./pages/Relatorios'));
const Usuarios = lazy(() => import('./pages/Usuarios'));
const MeuCadastro = lazy(() => import('./pages/MeuCadastro'));
const AcessoNegado = lazy(() => import('./pages/AcessoNegado'));
const InscricaoFestaPublica = lazy(() => import('./pages/InscricaoFestaPublica'));
const Documentacao = lazy(() => import('./pages/Documentacao'));
const ApiInterna = lazy(() => import('./pages/ApiInterna'));
const ArquiteturaInterna = lazy(() => import('./pages/ArquiteturaInterna'));
const AmbienteInterno = lazy(() => import('./pages/AmbienteInterno'));
const ImportacoesInterno = lazy(() => import('./pages/ImportacoesInterno'));
const ManualInterno = lazy(() => import('./pages/ManualInterno'));
const TroubleshootingInterno = lazy(() => import('./pages/TroubleshootingInterno'));

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
        <Suspense fallback={<div className="page-loading">Carregando...</div>}>
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
            <Route path="/documentacao" element={<Documentacao />} />
            <Route path="/documentacao/api" element={<ApiInterna />} />
            <Route path="/documentacao/arquitetura" element={<ArquiteturaInterna />} />
            <Route path="/documentacao/ambiente" element={<AmbienteInterno />} />
            <Route path="/documentacao/importacoes" element={<ImportacoesInterno />} />
            <Route path="/documentacao/manual" element={<ManualInterno />} />
            <Route path="/documentacao/troubleshooting" element={<TroubleshootingInterno />} />
            <Route path="/meu-cadastro" element={<MeuCadastro />} />
            <Route path="/usuarios" element={<Usuarios />} />
            <Route path="/acesso-negado" element={<AcessoNegado />} />
          </Routes>
        </Suspense>
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
        <Suspense fallback={<div className="page-loading">Carregando...</div>}>
          <Routes>
            <Route path="/login" element={<LoginGuard />} />
            <Route path="/festa-inscricao/:festaId" element={<InscricaoFestaPublica />} />
            <Route path="/*" element={<ProtectedLayout />} />
          </Routes>
        </Suspense>
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
