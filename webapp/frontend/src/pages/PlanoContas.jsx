import { useCallback, useEffect, useState } from 'react';
import { Edit, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';
import { getApiErrorMessage } from '../utils/apiError';

const TIPOS = [
  { value: 'saida', label: 'Saídas' },
  { value: 'entrada', label: 'Entradas' },
];

const emptyForm = {
  codigo: '',
  nome: '',
  tipo: 'saida',
  ordem: 0,
  ativo: true,
};

export default function PlanoContas() {
  const [contas, setContas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [busca, setBusca] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = { apenas_ativas: false };
    if (filtroTipo) params.tipo = filtroTipo;

    api.get('/contas', { params })
      .then((r) => setContas(Array.isArray(r.data) ? r.data : []))
      .catch((err) => toast.error(getApiErrorMessage(err, 'Erro ao carregar contas')))
      .finally(() => setLoading(false));
  }, [filtroTipo]);

  useEffect(() => {
    const timerId = setTimeout(load, 0);
    return () => clearTimeout(timerId);
  }, [load]);

  const openModal = (conta = null) => {
    setEditing(conta);
    setForm(conta
      ? {
          codigo: conta.codigo || '',
          nome: conta.nome || '',
          tipo: conta.tipo || 'saida',
          ordem: Number(conta.ordem || 0),
          ativo: conta.ativo !== false,
        }
      : { ...emptyForm, tipo: filtroTipo || 'saida' });
    setModal(true);
  };

  const setF = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        codigo: String(form.codigo || '').trim(),
        nome: String(form.nome || '').trim(),
        tipo: form.tipo,
        ordem: Number(form.ordem || 0),
        ativo: Boolean(form.ativo),
      };

      if (editing) {
        await api.put(`/contas/${editing.id}`, payload);
        toast.success('Conta atualizada com sucesso');
      } else {
        await api.post('/contas', payload);
        toast.success('Conta criada com sucesso');
      }

      setModal(false);
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao salvar conta'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (conta) => {
    if (!confirm(`Excluir a conta ${conta.codigo} - ${conta.nome}?`)) return;
    try {
      await api.delete(`/contas/${conta.id}`);
      toast.success('Conta excluída com sucesso');
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao excluir conta'));
    }
  };

  const termo = busca.trim().toLowerCase();
  const contasFiltradas = termo
    ? contas.filter((c) =>
        [c.codigo, c.nome, c.tipo, c.ativo ? 'ativo' : 'inativo']
          .filter(Boolean)
          .some((valor) => String(valor).toLowerCase().includes(termo))
      )
    : contas;

  return (
    <div>
      <div className="topbar">
        <h2>Código de Contas</h2>
        <button className="btn btn-primary" onClick={() => openModal()}><Plus size={15} /> Nova Conta</button>
      </div>

      <div className="filters">
        <div className="form-group" style={{ margin: 0 }}>
          <label>Tipo</label>
          <select className="search-input" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
            <option value="">Todos</option>
            {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0, minWidth: 260, flex: 1 }}>
          <label>Busca</label>
          <input
            className="search-input"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Código, nome, tipo..."
          />
        </div>
        <div style={{ fontSize: 13, color: '#4a5568', alignSelf: 'flex-end', paddingBottom: 8 }}>
          {contasFiltradas.length} registro(s)
        </div>
      </div>

      <div className="card">
        {loading ? <div className="spinner" /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Ordem</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {contasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: '#718096' }}>
                      Nenhuma conta encontrada
                    </td>
                  </tr>
                ) : contasFiltradas.map((conta) => (
                  <tr key={conta.id}>
                    <td><strong>{conta.codigo}</strong></td>
                    <td>{conta.nome}</td>
                    <td>
                      <span className={`badge ${conta.tipo === 'entrada' ? 'badge-success' : 'badge-danger'}`}>
                        {conta.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                      </span>
                    </td>
                    <td>{conta.ordem ?? 0}</td>
                    <td>
                      <span className={`badge ${conta.ativo ? 'badge-success' : 'badge-warning'}`}>
                        {conta.ativo ? 'Ativa' : 'Inativa'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-outline btn-icon btn-sm" onClick={() => openModal(conta)}>
                          <Edit size={13} />
                        </button>
                        <button className="btn btn-danger btn-icon btn-sm" onClick={() => handleDelete(conta)}>
                          <Trash2 size={13} />
                        </button>
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
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <div className="modal-title">{editing ? 'Editar Conta' : 'Nova Conta'}</div>
              <button className="btn btn-outline btn-sm modal-close-btn" onClick={() => setModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Código *</label>
                  <input required value={form.codigo} onChange={(e) => setF('codigo', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Ordem</label>
                  <input type="number" value={form.ordem} onChange={(e) => setF('ordem', e.target.value)} />
                </div>
                <div className="form-group form-full">
                  <label>Nome *</label>
                  <input required value={form.nome} onChange={(e) => setF('nome', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Tipo *</label>
                  <select required value={form.tipo} onChange={(e) => setF('tipo', e.target.value)}>
                    {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select value={String(form.ativo)} onChange={(e) => setF('ativo', e.target.value === 'true')}>
                    <option value="true">Ativa</option>
                    <option value="false">Inativa</option>
                  </select>
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
