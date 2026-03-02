import { useEffect, useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { KeyRound, UserCog } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { getApiErrorMessage } from '../utils/apiError';

function isStrongPassword(password) {
  if (password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/\d/.test(password)) return false;
  if (!/[^A-Za-z0-9]/.test(password)) return false;
  return true;
}

function getPasswordChecks(password) {
  return [
    { label: 'Mínimo de 8 caracteres', ok: password.length >= 8 },
    { label: 'Pelo menos 1 letra maiúscula', ok: /[A-Z]/.test(password) },
    { label: 'Pelo menos 1 letra minúscula', ok: /[a-z]/.test(password) },
    { label: 'Pelo menos 1 número', ok: /\d/.test(password) },
    { label: 'Pelo menos 1 caractere especial', ok: /[^A-Za-z0-9]/.test(password) },
  ];
}

export default function MeuCadastro() {
  const { user, updateCurrentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nome_completo: '',
    email: '',
    role: '',
    currentPassword: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/users/me');
        if (!mounted) return;
        setForm(prev => ({
          ...prev,
          nome_completo: data.nome_completo || '',
          email: data.email || '',
          role: data.role || '',
        }));
      } catch (err) {
        toast.error(getApiErrorMessage(err, 'Erro ao carregar seu cadastro'));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, []);

  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async (e) => {
    e.preventDefault();

    const payload = {};
    const nome = form.nome_completo.trim();
    const nomeAtual = (user?.nome_completo || '').trim();

    if (nome && nome !== nomeAtual) payload.nome_completo = nome;

    if (form.password || form.confirmPassword) {
      if (!form.currentPassword) {
        toast.error('Informe a senha atual para alterar a senha');
        return;
      }
      if (form.currentPassword === form.password) {
        toast.error('A nova senha deve ser diferente da senha atual');
        return;
      }
      if (!isStrongPassword(form.password)) {
        toast.error('Use no mínimo 8 caracteres com maiúscula, minúscula, número e símbolo');
        return;
      }
      if (form.password !== form.confirmPassword) {
        toast.error('A confirmação da senha não confere');
        return;
      }
      payload.current_password = form.currentPassword;
      payload.password = form.password;
    }

    if (Object.keys(payload).length === 0) {
      toast('Nenhuma alteração para salvar');
      return;
    }

    setSaving(true);
    try {
      const { data } = await api.put('/users/me', payload);
      updateCurrentUser({ nome_completo: data.nome_completo, email: data.email, role: data.role, id: data.id });
      setForm(prev => ({ ...prev, currentPassword: '', password: '', confirmPassword: '' }));
      toast.success('Seu cadastro foi atualizado');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao atualizar cadastro'));
    } finally {
      setSaving(false);
    }
  };

  const roleLabel = {
    administrador: 'Administrador',
    gerente: 'Gerente',
    assistente: 'Assistente',
  };
  const passwordChecks = getPasswordChecks(form.password || '');

  return (
    <div>
      <div className="topbar">
        <h2>Meu Cadastro</h2>
      </div>

      <div className="card" style={{ maxWidth: 720 }}>
        {loading ? (
          <div className="spinner" />
        ) : (
          <form onSubmit={handleSave}>
            <div className="card-title"><UserCog size={16} /> Dados do Usuário</div>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Nome Completo</label>
                <input
                  value={form.nome_completo}
                  onChange={(e) => setField('nome_completo', e.target.value)}
                  maxLength={150}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input value={form.email} disabled />
              </div>
              <div className="form-group">
                <label>Perfil</label>
                <input value={roleLabel[form.role] || form.role || '-'} disabled />
              </div>
            </div>

            <div className="card-title" style={{ marginTop: 14 }}><KeyRound size={16} /> Trocar Senha</div>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Senha Atual</label>
                <input
                  type="password"
                  value={form.currentPassword}
                  onChange={(e) => setField('currentPassword', e.target.value)}
                  placeholder="Informe sua senha atual"
                />
              </div>
              <div className="form-group">
                <label>Nova Senha</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setField('password', e.target.value)}
                  minLength={8}
                  placeholder="8+ caracteres, com maiúscula, minúscula, número e símbolo"
                />
                <div style={{ marginTop: 8, fontSize: 12 }}>
                  {passwordChecks.map((item) => (
                    <div key={item.label} style={{ color: item.ok ? '#2f855a' : '#e53e3e' }}>
                      {item.ok ? '✓' : '✗'} {item.label}
                    </div>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>Confirmar Nova Senha</label>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => setField('confirmPassword', e.target.value)}
                  minLength={8}
                  placeholder="Repita a nova senha"
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
