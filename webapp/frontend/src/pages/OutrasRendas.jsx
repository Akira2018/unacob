import { useCallback, useEffect, useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { format, subMonths } from 'date-fns';

const CATEGORIAS = ['Doação', 'Aluguel', 'Patrocínio', 'Evento', 'Convênio', 'Aplicação Financeira', 'Multa', 'Outros'];
const fmt = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const getMeses = () => { const r = []; for (let i = 0; i < 13; i++) r.push(format(subMonths(new Date(), i), 'yyyy-MM')); return r; };

const emptyForm = { descricao: '', categoria: 'Outros', valor: '', data_recebimento: format(new Date(), 'yyyy-MM-dd'), fonte: '', observacoes: '' };

export default function OutrasRendas() {
  const [rendas, setRendas] = useState([]);
  const [mes, setMes] = useState(format(new Date(), 'yyyy-MM'));
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/outras-rendas', { params: { mes_referencia: mes } })
      .then(r => setRendas(r.data))
      .catch(() => toast.error('Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [mes]);

  useEffect(() => {
    const timerId = setTimeout(load, 0);
    return () => clearTimeout(timerId);
  }, [load]);

  const openModal = (r = null) => {
    setEditing(r);
    setForm(r ? { ...emptyForm, ...r, valor: r.valor || '' } : emptyForm);
    setModal(true);
  };

  const handleSave = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, valor: parseFloat(form.valor) };
      if (editing) {
        await api.put(`/outras-rendas/${editing.id}`, payload);
        toast.success('Atualizado!');
      } else {
        await api.post('/outras-rendas', payload);
        toast.success('Registrado!');
      }
      setModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async id => {
    if (!confirm('Remover?')) return;
    try { await api.delete(`/outras-rendas/${id}`); toast.success('Removido'); load(); }
    catch { toast.error('Erro ao remover'); }
  };

  const termoBusca = busca.trim().toLowerCase();
  const rendasFiltradas = termoBusca
    ? rendas.filter(r => {
        const valorTexto = String(r.valor ?? '');
        return [r.descricao, r.categoria, r.fonte, r.data_recebimento, valorTexto]
          .filter(Boolean)
          .some(campo => String(campo).toLowerCase().includes(termoBusca));
      })
    : rendas;

  const total = rendasFiltradas.reduce((s, r) => s + (r.valor || 0), 0);
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div>
      <div className="topbar">
        <h2>Outras Fontes de Renda</h2>
        <button className="btn btn-primary" onClick={() => openModal()}><Plus size={15} /> Nova Renda</button>
      </div>

      <div className="filters">
        <div className="form-group" style={{ margin: 0 }}>
          <label>Mês</label>
          <select className="search-input" value={mes} onChange={e => setMes(e.target.value)}>
            {getMeses().map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0, minWidth: 240, flex: 1 }}>
          <label>Busca</label>
          <input
            className="search-input"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Descrição, categoria, fonte..."
          />
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#38a169', alignSelf: 'flex-end', padding: '8px 0' }}>
          Total: {fmt(total)}
        </div>
      </div>

      <div className="card">
        {loading ? <div className="spinner" /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Fonte</th>
                  <th>Valor</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {rendasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#718096' }}>
                      {termoBusca ? 'Nenhum resultado para a busca informada' : 'Sem registros neste mês'}
                    </td>
                  </tr>
                ) : rendasFiltradas.map(r => (
                  <tr key={r.id}>
                    <td>{r.data_recebimento || '-'}</td>
                    <td><strong>{r.descricao}</strong></td>
                    <td><span className="badge badge-success">{r.categoria}</span></td>
                    <td>{r.fonte || '-'}</td>
                    <td><strong style={{ color: '#38a169' }}>{fmt(r.valor)}</strong></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-outline btn-icon btn-sm" onClick={() => openModal(r)}><Edit size={13} /></button>
                        <button className="btn btn-danger btn-icon btn-sm" onClick={() => handleDelete(r.id)}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {rendasFiltradas.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={4} style={{ fontWeight: 700, textAlign: 'right', padding: '10px 12px' }}>Total</td>
                    <td style={{ fontWeight: 700, color: '#38a169', fontSize: 15 }}>{fmt(total)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {modal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <div className="modal-title">{editing ? 'Editar Renda' : 'Nova Renda'}</div>
              <button className="btn btn-outline btn-sm modal-close-btn" onClick={() => setModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-grid">
                <div className="form-group form-full">
                  <label>Descrição *</label>
                  <input required value={form.descricao} onChange={e => setF('descricao', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Categoria *</label>
                  <select required value={form.categoria} onChange={e => setF('categoria', e.target.value)}>
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Valor (R$) *</label>
                  <input type="number" step="0.01" required value={form.valor} onChange={e => setF('valor', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Data *</label>
                  <input type="date" required value={form.data_recebimento} onChange={e => setF('data_recebimento', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Fonte</label>
                  <input value={form.fonte} onChange={e => setF('fonte', e.target.value)} placeholder="Nome da fonte" />
                </div>
                <div className="form-group form-full">
                  <label>Observações</label>
                  <textarea value={form.observacoes} onChange={e => setF('observacoes', e.target.value)} />
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
