import { useCallback, useEffect, useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, Download } from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getApiErrorMessage } from '../utils/apiError';

const CATEGORIAS = ['Aluguel', 'Energia', 'Água', 'Telefone/Internet', 'Material de Escritório', 'Serviços', 'Eventos', 'Manutenção', 'Salários', 'Impostos', 'Seguros', 'Transporte', 'Alimentação', 'Outros'];
const COLORS = ['#1e3a5f', '#c8a84b', '#38a169', '#e53e3e', '#805ad5', '#dd6b20', '#2c7a7b', '#553c9a', '#b7791f', '#2d3748'];
const fmt = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const getMeses = () => { const r = []; for (let i = 0; i < 13; i++) r.push(format(subMonths(new Date(), i), 'yyyy-MM')); return r; };
const toNumber = (value) => {
  const num = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value);
  return Number.isFinite(num) ? num : 0;
};

const emptyForm = { descricao: '', categoria: 'Outros', conta_id: '', valor: '', data_despesa: format(new Date(), 'yyyy-MM-dd'), forma_pagamento: 'dinheiro', fornecedor: '', nota_fiscal: '', observacoes: '' };

export default function Despesas() {
  const [despesas, setDespesas] = useState([]);
  const [mes, setMes] = useState(format(new Date(), 'yyyy-MM'));
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [contas, setContas] = useState([]);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/despesas', { params: { mes_referencia: mes } })
      .then(r => setDespesas(r.data))
      .catch(err => toast.error(getApiErrorMessage(err, 'Erro ao carregar despesas')))
      .finally(() => setLoading(false));
  }, [mes]);

  useEffect(() => {
    const timerId = setTimeout(load, 0);
    return () => clearTimeout(timerId);
  }, [load]);

  useEffect(() => {
    api.get('/contas', { params: { tipo: 'saida', apenas_ativas: true } })
      .then(r => setContas(Array.isArray(r.data) ? r.data : []))
      .catch(err => toast.error(getApiErrorMessage(err, 'Erro ao carregar plano de contas (saídas)')));
  }, []);

  const openModal = (d = null) => {
    setEditing(d);
    setForm(d ? { ...emptyForm, ...d, valor: d.valor || '' } : { ...emptyForm, conta_id: contas[0]?.id || '' });
    setModal(true);
  };

  const handleSave = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      if (!form.conta_id) {
        toast.error('Selecione a conta da despesa');
        setSaving(false);
        return;
      }
      const payload = { ...form, valor: parseFloat(form.valor) };
      if (editing) {
        await api.put(`/despesas/${editing.id}`, payload);
        toast.success('Despesa atualizada!');
      } else {
        await api.post('/despesas', payload);
        toast.success('Despesa registrada!');
      }
      setModal(false);
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao salvar'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remover despesa?')) return;
    try {
      await api.delete(`/despesas/${id}`);
      toast.success('Despesa removida');
      load();
    } catch (err) { toast.error(getApiErrorMessage(err, 'Erro ao remover')); }
  };

  const total = despesas.reduce((s, d) => s + toNumber(d.valor), 0);
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const searchTerm = search.trim().toLowerCase();
  const despesasFiltradas = despesas.filter((d) => {
    if (!searchTerm) return true;
    return [
      d.descricao,
      d.categoria,
      d.fornecedor,
      d.forma_pagamento,
      d.conta_codigo,
      d.conta_nome,
      d.data_despesa,
      String(d.valor ?? '')
    ]
      .filter(Boolean)
      .some(v => String(v).toLowerCase().includes(searchTerm));
  });
  const totalFiltrado = despesasFiltradas.reduce((s, d) => s + toNumber(d.valor), 0);
  const totalExibido = searchTerm ? totalFiltrado : total;

  // By category
  const porCategoria = despesas.reduce((acc, d) => {
    acc[d.categoria || 'Outros'] = (acc[d.categoria || 'Outros'] || 0) + (d.valor || 0);
    return acc;
  }, {});
  const chartData = Object.entries(porCategoria).map(([name, value]) => ({ name, value }));

  return (
    <div>
      <div className="topbar">
        <h2>Despesas</h2>
        <button className="btn btn-primary" onClick={() => openModal()}><Plus size={15} /> Nova Despesa</button>
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
            placeholder="Descrição, categoria, fornecedor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#e53e3e', alignSelf: 'flex-end', padding: '8px 0' }}>
          {searchTerm ? `Total da busca: ${fmt(totalFiltrado)}` : `Total: ${fmt(totalExibido)}`}
          {searchTerm && <span style={{ color: '#1e3a5f', fontSize: 14, marginLeft: 10 }}>Total geral: {fmt(total)}</span>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
        <div className="card">
          {loading ? <div className="spinner" /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Descrição</th>
                    <th>Categoria</th>
                    <th>Fornecedor</th>
                    <th>Forma</th>
                    <th>Conta</th>
                    <th>Valor</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {despesasFiltradas.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#718096' }}>{searchTerm ? 'Nenhuma despesa encontrada para a busca' : 'Sem despesas neste mês'}</td></tr>
                  ) : despesasFiltradas.map(d => (
                    <tr key={d.id}>
                      <td>{d.data_despesa || '-'}</td>
                      <td><strong>{d.descricao}</strong></td>
                      <td><span className="badge badge-info">{d.categoria}</span></td>
                      <td>{d.fornecedor || '-'}</td>
                      <td>{d.forma_pagamento || '-'}</td>
                      <td>{d.conta_codigo ? `${d.conta_codigo} - ${d.conta_nome || ''}` : '-'}</td>
                      <td><strong style={{ color: '#e53e3e' }}>{fmt(d.valor)}</strong></td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-outline btn-icon btn-sm" onClick={() => openModal(d)}><Edit size={13} /></button>
                          <button className="btn btn-danger btn-icon btn-sm" onClick={() => handleDelete(d.id)}><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {despesas.length > 0 && (
                  <tfoot>
                    <tr>
                      <td colSpan={6} style={{ fontWeight: 700, textAlign: 'right', padding: '10px 12px' }}>{searchTerm ? 'Total da busca' : 'Total'}</td>
                      <td style={{ fontWeight: 700, color: '#e53e3e', fontSize: 15 }}>{fmt(totalExibido)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>

        {chartData.length > 0 && (
          <div className="card">
            <div className="card-title">Por Categoria</div>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ percent }) => `${(percent*100).toFixed(0)}%`}>
                  {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => fmt(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ marginTop: 12 }}>
              {chartData.map((d, i) => (
                <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f0f0f0', fontSize: 13 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i % COLORS.length], display: 'inline-block' }} />
                    {d.name}
                  </span>
                  <strong>{fmt(d.value)}</strong>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {modal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <div className="modal-title">{editing ? 'Editar Despesa' : 'Nova Despesa'}</div>
              <button className="btn btn-outline btn-sm modal-close-btn" onClick={() => setModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-grid">
                <div className="form-group form-full">
                  <label>Descrição *</label>
                  <input
                    required
                    value={form.descricao}
                    onChange={e => setF('descricao', e.target.value)}
                    spellCheck={false}
                    autoCorrect="off"
                    autoCapitalize="none"
                    autoComplete="off"
                  />
                </div>
                <div className="form-group">
                  <label>Conta da Saída *</label>
                  <select
                    required
                    value={form.conta_id}
                    onChange={e => {
                      const contaId = e.target.value;
                      const contaSel = contas.find(c => c.id === contaId);
                      setForm(prev => ({
                        ...prev,
                        conta_id: contaId,
                        categoria: contaSel?.nome || prev.categoria
                      }));
                    }}
                  >
                    <option value="">Selecione...</option>
                    {contas.map(c => <option key={c.id} value={c.id}>{c.codigo} - {c.nome}</option>)}
                  </select>
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
                  <input type="date" required value={form.data_despesa} onChange={e => setF('data_despesa', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Forma de Pagamento</label>
                  <select value={form.forma_pagamento} onChange={e => setF('forma_pagamento', e.target.value)}>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="pix">PIX</option>
                    <option value="transferencia">Transferência</option>
                    <option value="boleto">Boleto</option>
                    <option value="cartao">Cartão</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Fornecedor</label>
                  <input value={form.fornecedor} onChange={e => setF('fornecedor', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Nota Fiscal</label>
                  <input value={form.nota_fiscal} onChange={e => setF('nota_fiscal', e.target.value)} />
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
