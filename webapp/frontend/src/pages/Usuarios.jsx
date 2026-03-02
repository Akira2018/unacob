import { useEffect, useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, UserCog, Shield, User } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '../utils/apiError';

const emptyForm = { email: '', nome_completo: '', role: 'assistente', password: '' };
const ROLE_LABELS = { administrador: 'Administrador', gerente: 'Gerente', assistente: 'Assistente' };
const ROLE_COLORS = { administrador: 'badge-danger', gerente: 'badge-warning', assistente: 'badge-info' };

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

export default function Usuarios() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const isAdmin = currentUser?.role === 'administrador';

  const load = () => {
    setLoading(true);
    api.get('/users').then(r => setUsers(r.data)).catch(err => toast.error(getApiErrorMessage(err, 'Erro'))).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openModal = (u = null) => {
    setEditing(u);
    setForm(u ? { email: u.email || '', nome_completo: u.nome_completo || '', role: u.role || 'assistente', password: '' } : emptyForm);
    setModal(true);
  };

  const handleSave = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;

      if (editing) {
        if (!isAdmin) {
          toast('Use "Meu Cadastro" para alterar seus dados e senha');
          setSaving(false);
          return;
        }
        if (payload.password && !isStrongPassword(payload.password)) {
          toast.error('Use no mínimo 8 caracteres com maiúscula, minúscula, número e símbolo');
          setSaving(false);
          return;
        }
      } else {
        if (!form.password) {
          toast.error('Senha obrigatória para novo usuário');
          setSaving(false);
          return;
        }
        if (!isStrongPassword(form.password)) {
          toast.error('Use no mínimo 8 caracteres com maiúscula, minúscula, número e símbolo');
          setSaving(false);
          return;
        }
      }

      if (editing) {
        await api.put(`/users/${editing.id}`, payload);
        toast.success('Usuário atualizado!');
      } else {
        await api.post('/users', payload);
        toast.success('Usuário criado!');
      }
      setModal(false);
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao salvar'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, nome) => {
    if (id === currentUser?.id) { toast.error('Você não pode remover seu próprio usuário'); return; }
    if (!confirm(`Remover ${nome}?`)) return;
    try { await api.delete(`/users/${id}`); toast.success('Usuário removido'); load(); }
    catch (err) { toast.error(getApiErrorMessage(err, 'Erro ao remover')); }
  };

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const passwordChecks = getPasswordChecks(form.password || '');

  return (
    <div>
      <div className="topbar">
        <h2>Usuários do Sistema</h2>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => openModal()}><Plus size={15} /> Novo Usuário</button>
        )}
      </div>

      {!isAdmin && (
        <div className="card" style={{ marginBottom: 20, borderLeft: '4px solid #1e3a5f' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div style={{ color: '#4a5568' }}>Você está visualizando apenas o seu usuário.</div>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/meu-cadastro')}>Trocar Senha</button>
          </div>
        </div>
      )}

      {/* Permissions guide */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title"><Shield size={16} /> Níveis de Permissão</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {[
            { role: 'administrador', icon: <Shield size={20} />, desc: 'Acesso total ao sistema. Pode criar, editar e remover usuários e todos os registros.', color: '#e53e3e' },
            { role: 'gerente', icon: <UserCog size={20} />, desc: 'Acesso a todos os módulos financeiros e cadastros. Não pode gerenciar usuários.', color: '#d69e2e' },
            { role: 'assistente', icon: <User size={20} />, desc: 'Acesso básico a cadastros e consultas. Acesso limitado ao módulo financeiro.', color: '#2c7a7b' },
          ].map(p => (
            <div key={p.role} style={{ border: `1px solid ${p.color}30`, borderRadius: 8, padding: 12, background: p.color + '08' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                <span style={{ color: p.color }}>{p.icon}</span>
                <span style={{ fontWeight: 700, color: p.color, textTransform: 'capitalize' }}>{ROLE_LABELS[p.role]}</span>
              </div>
              <p style={{ fontSize: 12, color: '#718096', lineHeight: 1.5 }}>{p.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        {loading ? <div className="spinner" /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Nome</th><th>Email</th><th>Perfil</th><th>Status</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className={u.id === currentUser?.id ? 'row-green' : ''}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1e3a5f', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>
                          {u.nome_completo?.charAt(0) || 'U'}
                        </div>
                        <strong>{u.nome_completo}</strong>
                        {u.id === currentUser?.id && <span style={{ fontSize: 11, color: '#38a169', background: '#f0fff4', borderRadius: 4, padding: '1px 6px' }}>Você</span>}
                      </div>
                    </td>
                    <td>{u.email}</td>
                    <td><span className={`badge ${ROLE_COLORS[u.role] || 'badge-gray'}`}>{ROLE_LABELS[u.role] || u.role}</span></td>
                    <td><span className={`badge ${u.ativo ? 'badge-success' : 'badge-danger'}`}>{u.ativo ? 'Ativo' : 'Inativo'}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {isAdmin && <button className="btn btn-outline btn-icon btn-sm" onClick={() => openModal(u)}><Edit size={13} /></button>}
                        {isAdmin && u.id !== currentUser?.id && (
                          <button className="btn btn-danger btn-icon btn-sm" onClick={() => handleDelete(u.id, u.nome_completo)}><Trash2 size={13} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div className="modal-title">{editing ? 'Editar Usuário' : 'Novo Usuário'}</div>
              <button className="btn btn-outline btn-sm modal-close-btn" onClick={() => setModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="form-group">
                  <label>Nome Completo *</label>
                  <input required value={form.nome_completo} onChange={e => setF('nome_completo', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Email *</label>
                  <input type="email" required value={form.email} onChange={e => setF('email', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Perfil / Permissão *</label>
                  <select required value={form.role} onChange={e => setF('role', e.target.value)}>
                    <option value="administrador">Administrador</option>
                    <option value="gerente">Gerente</option>
                    <option value="assistente">Assistente</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Senha {editing ? '(deixe em branco para não alterar)' : '*'}</label>
                  <input type="password" value={form.password} onChange={e => setF('password', e.target.value)} placeholder={editing ? 'Nova senha (opcional): 8+ com maiúscula, minúscula, número e símbolo' : '8+ com maiúscula, minúscula, número e símbolo'} required={!editing} minLength={8} />
                  <div style={{ marginTop: 8, fontSize: 12 }}>
                    {passwordChecks.map((item) => (
                      <div key={item.label} style={{ color: item.ok ? '#2f855a' : '#e53e3e' }}>
                        {item.ok ? '✓' : '✗'} {item.label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline modal-btn-cancel" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary modal-btn-save" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
