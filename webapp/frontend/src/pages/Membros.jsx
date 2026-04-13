import { useEffect, useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, Search, Download, UserCheck, UserX } from 'lucide-react';
import { getApiErrorMessage } from '../utils/apiError';

const ESTADOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

const emptyForm = {
  matricula: '', inscricao: '', nome_completo: '', cpf: '', cpf2: '', codigo_dabb: '', email: '', telefone: '', celular: '', ddd: '',
  endereco: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', cep: '', ect: '',
  data_nascimento: '', data_filiacao: '', status: 'ativo', sexo: '', cat: '', beneficio: '',
  valor_mensalidade: '', observacoes: ''
};

const fmt = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export default function Membros() {
  const [membros, setMembros] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/membros', { params: { limit: 1000 } })
      .then(r => {
        const data = Array.isArray(r.data) ? r.data : [];
        setMembros(data);
        setFiltered(data);
        if (!Array.isArray(r.data)) toast.error('Resposta inválida ao carregar membros');
      })
      .catch(err => toast.error(getApiErrorMessage(err, 'Erro ao carregar membros')))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    let list = membros;
    if (search) list = list.filter(m => m.nome_completo?.toLowerCase().includes(search.toLowerCase()) || m.cpf?.includes(search) || m.matricula?.includes(search));
    if (statusFilter) list = list.filter(m => m.status === statusFilter);
    setFiltered(list);
  }, [search, statusFilter, membros]);

  const openModal = (m = null) => {
    setEditing(m);
    let estado = m?.estado;
    if (estado && !ESTADOS.includes(estado)) estado = '';
    setForm(m ? {
      ...emptyForm, ...m,
      estado,
      data_nascimento: m.data_nascimento || '',
      data_filiacao: m.data_filiacao || '',
      valor_mensalidade: m.valor_mensalidade || '',
      codigo_dabb: m.codigo_dabb || '',
      cpf2: m.cpf2 || ''
    } : emptyForm);
    setModal(true);
  };

  const handleSave = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      // Validação de estado
      if (!ESTADOS.includes(payload.estado)) payload.estado = '';
      if (!payload.data_nascimento) delete payload.data_nascimento;
      if (!payload.data_filiacao) delete payload.data_filiacao;
      if (payload.valor_mensalidade === '') payload.valor_mensalidade = 0;
      if (editing) {
        await api.put(`/membros/${editing.id}`, payload);
        toast.success('Membro atualizado!');
      } else {
        await api.post('/membros', payload);
        toast.success('Membro cadastrado!');
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
    if (!confirm(`Remover ${nome}?`)) return;
    try {
      await api.delete(`/membros/${id}`);
      toast.success('Membro removido');
      load();
    } catch (err) { toast.error(getApiErrorMessage(err, 'Erro ao remover')); }
  };

  const exportar = async () => {
    const params = statusFilter ? `?status=${statusFilter}` : '';
    const r = await api.get(`/relatorios/membros${params}`, { responseType: 'blob' });
    const url = URL.createObjectURL(r.data);
    const a = document.createElement('a'); a.href = url; a.download = 'membros.xlsx'; a.click();
  };

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div>
      <div className="topbar">
        <h2>Cadastro de Associados</h2>
        <div className="topbar-right">
          <button className="btn btn-outline btn-sm" onClick={exportar}><Download size={14} /> Excel</button>
          <button className="btn btn-primary" onClick={() => openModal()}><Plus size={15} /> Novo Associado</button>
        </div>
      </div>

      <div className="card">
        <div className="filters">
          <div className="search-input-wide" style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#718096' }} />
            <input className="search-input" style={{ paddingLeft: 32, width: '100%' }} placeholder="Buscar por nome, CPF, matrícula..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="search-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ minWidth: 140 }}>
            <option value="">Todos os status</option>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
            <option value="suspenso">Suspenso</option>
          </select>
          <span style={{ fontSize: 13, color: '#718096' }}>{filtered.length} {filtered.length === 1 ? 'membro' : 'membros'}</span>
        </div>

        {loading ? <div className="spinner" /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Matrícula</th>
                  <th>Nome</th>
                  <th>CPF</th>
                  <th>Email</th>
                  <th>Celular</th>
                  <th>Cidade</th>
                  <th>Mensalidade</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: '#718096' }}>Nenhum membro encontrado</td></tr>
                ) : filtered.map(m => (
                  <tr key={m.id} className={m.status !== 'ativo' ? 'row-red' : ''}>
                    <td>{m.matricula || '-'}</td>
                    <td><strong>{m.nome_completo}</strong></td>
                    <td>{m.cpf || '-'}</td>
                    <td>{m.email || '-'}</td>
                    <td>{m.celular || m.telefone || '-'}</td>
                    <td>{m.cidade || '-'}</td>
                    <td>{fmt(m.valor_mensalidade)}</td>
                    <td>
                      <span className={`badge ${m.status === 'ativo' ? 'badge-success' : m.status === 'inativo' ? 'badge-danger' : 'badge-warning'}`}>
                        {m.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-outline btn-icon btn-sm" onClick={() => openModal(m)} title="Editar"><Edit size={13} /></button>
                        <button className="btn btn-danger btn-icon btn-sm" onClick={() => handleDelete(m.id, m.nome_completo)} title="Remover"><Trash2 size={13} /></button>
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
          <div className="modal" style={{ maxWidth: 800 }}>
            <div className="modal-header">
              <div className="modal-title">{editing ? 'Editar Membro' : 'Novo Membro'}</div>
              <button className="btn btn-outline btn-sm modal-close-btn" onClick={() => setModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 12, marginBottom: 16, fontWeight: 600, fontSize: 13, color: '#1e3a5f' }}>Dados Pessoais</div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Nome Completo *</label>
                  <input required value={form.nome_completo} onChange={e => setF('nome_completo', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>CPF</label>
                  <input value={form.cpf} onChange={e => setF('cpf', e.target.value)} placeholder="000.000.000-00" />
                </div>
                <div className="form-group">
                  <label>Matrícula</label>
                  <input value={form.matricula} onChange={e => setF('matricula', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Código DABB</label>
                  <input value={form.codigo_dabb} onChange={e => setF('codigo_dabb', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>CPF2</label>
                  <input value={form.cpf2} onChange={e => setF('cpf2', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Inscrição</label>
                  <input value={form.inscricao} onChange={e => setF('inscricao', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Data de Nascimento</label>
                  <input type="date" value={form.data_nascimento} onChange={e => setF('data_nascimento', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Data de Filiação</label>
                  <input type="date" value={form.data_filiacao} onChange={e => setF('data_filiacao', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Sexo</label>
                  <select value={form.sexo} onChange={e => setF('sexo', e.target.value)}>
                    <option value="">Selecione</option>
                    <option value="M">Masculino</option>
                    <option value="F">Feminino</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select value={form.status} onChange={e => setF('status', e.target.value)}>
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                    <option value="suspenso">Suspenso</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Categoria</label>
                  <select value={form.cat} onChange={e => setF('cat', e.target.value)}>
                    <option value="">Selecione</option>
                    <option value="CLT">CLT</option>
                    <option value="1711">1711</option>
                    <option value="1712">1712</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Benefício</label>
                  <input value={form.beneficio} onChange={e => setF('beneficio', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Valor Mensalidade (R$)</label>
                  <input type="number" step="0.01" value={form.valor_mensalidade} onChange={e => setF('valor_mensalidade', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>ECT</label>
                  <input value={form.ect} onChange={e => setF('ect', e.target.value)} />
                </div>
              </div>

              <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 12, marginBottom: 16, marginTop: 20, fontWeight: 600, fontSize: 13, color: '#1e3a5f' }}>Contato</div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={form.email} onChange={e => setF('email', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>DDD</label>
                  <input value={form.ddd} onChange={e => setF('ddd', e.target.value)} style={{ maxWidth: 80 }} />
                </div>
                <div className="form-group">
                  <label>Telefone</label>
                  <input value={form.telefone} onChange={e => setF('telefone', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Celular</label>
                  <input value={form.celular} onChange={e => setF('celular', e.target.value)} />
                </div>
              </div>

              {/* Removido título e campo duplicado de Endereço */}
              <div className="form-grid">
                <div className="form-group">
                  <label>Endereço</label>
                  <input value={form.endereco} onChange={e => setF('endereco', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Número</label>
                  <input value={form.numero} onChange={e => setF('numero', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Complemento</label>
                  <input value={form.complemento} onChange={e => setF('complemento', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Bairro</label>
                  <input value={form.bairro} onChange={e => setF('bairro', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Cidade</label>
                  <input value={form.cidade} onChange={e => setF('cidade', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Estado</label>
                  <select value={form.estado} onChange={e => setF('estado', e.target.value)}>
                    <option value="">UF</option>
                    {ESTADOS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>CEP</label>
                  <input value={form.cep} onChange={e => setF('cep', e.target.value)} placeholder="00000-000" />
                </div>
              </div>

              <div className="form-group" style={{ marginTop: 14 }}>
                <label>Observações</label>
                <textarea value={form.observacoes} onChange={e => setF('observacoes', e.target.value)} />
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
