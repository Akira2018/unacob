import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import Etiquetas from './pages/Etiquetas';
import Relatorios from './pages/Relatorios';
import Usuarios from './pages/Usuarios';
import InscricaoFestaPublica from './pages/InscricaoFestaPublica';
import { useState } from 'react';
import { Menu } from 'lucide-react';

function ProtectedLayout() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user) return <Navigate to="login" replace />;

  return (
    <div className="app-layout">
      <Sidebar open={sidebarOpen} />
      <div className="main-content">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button
            className="btn btn-outline btn-icon"
            style={{ display: 'none' }}
            id="menu-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu size={20} />
          </button>
        </div>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/membros" element={<Membros />} />
          <Route path="/pagamentos" element={<Pagamentos />} />
          <Route path="/despesas" element={<Despesas />} />
          <Route path="/outras-rendas" element={<OutrasRendas />} />
          <Route path="/fluxo-caixa" element={<FluxoCaixa />} />
          <Route path="/festas" element={<Festas />} />
          <Route path="/aniversariantes" element={<Aniversariantes />} />
          <Route path="/conciliacao" element={<Conciliacao />} />
          <Route path="/financeiro" element={<Financeiro />} />
          <Route path="/aplicacoes-financeiras" element={<AplicacoesFinanceiras />} />
          <Route path="/etiquetas" element={<Etiquetas />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/usuarios" element={<Usuarios />} />
          <Route path="login" element={<Login />} />
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
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        <Routes>
          <Route path="login" element={<LoginGuard />} />
          <Route path="/festa-inscricao/:festaId" element={<InscricaoFestaPublica />} />
          <Route path="/*" element={<ProtectedLayout />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

function LoginGuard() {
  const { user } = useAuth();
  if (user) return <Navigate to="/" replace />;
  return <Login />;
}
