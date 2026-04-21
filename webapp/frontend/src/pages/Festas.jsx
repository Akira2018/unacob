import { useEffect, useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, Users, PartyPopper, Download, Link, Mail } from 'lucide-react';
import { getApiErrorMessage } from '../utils/apiError';
import FilterBar from '../components/FilterBar';
import FestaLinkBar from '../components/FestaLinkBar';
import FestaSummaryStrip, { FestaSummaryItem } from '../components/FestaSummaryStrip';
import StatusCounter from '../components/StatusCounter';
import TableEmptyRow from '../components/TableEmptyRow';

const fmt = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtDataBR = (valor) => {
  if (!valor) return '-';
  const txt = String(valor);
  if (/^\d{4}-\d{2}-\d{2}$/.test(txt)) {
    const [ano, mes, dia] = txt.split('-');
    return `${dia}/${mes}/${ano}`;
  }
  const dt = new Date(txt);
  if (Number.isNaN(dt.getTime())) return txt;
  return dt.toLocaleDateString('pt-BR');
};
const defaultPricingRules = {
  cortesia_acompanhantes: 1,
  idade_gratis_ate: 5,
  idade_meia_de: 6,
  idade_meia_ate: 10,
  percentual_meia: 50,
};

const parsePricingRules = (politicaRaw) => {
  if (!politicaRaw) return { ...defaultPricingRules };
  try {
    const parsed = JSON.parse(politicaRaw);
    const src = parsed?.pricing_rules && typeof parsed.pricing_rules === 'object' ? parsed.pricing_rules : parsed;
    if (!src || typeof src !== 'object') return { ...defaultPricingRules };
    return {
      cortesia_acompanhantes: Number.isFinite(Number(src.cortesia_acompanhantes)) ? Math.max(0, Number(src.cortesia_acompanhantes)) : defaultPricingRules.cortesia_acompanhantes,
      idade_gratis_ate: Number.isFinite(Number(src.idade_gratis_ate)) ? Math.max(0, Number(src.idade_gratis_ate)) : defaultPricingRules.idade_gratis_ate,
      idade_meia_de: Number.isFinite(Number(src.idade_meia_de)) ? Math.max(0, Number(src.idade_meia_de)) : defaultPricingRules.idade_meia_de,
      idade_meia_ate: Number.isFinite(Number(src.idade_meia_ate)) ? Math.max(0, Number(src.idade_meia_ate)) : defaultPricingRules.idade_meia_ate,
      percentual_meia: Number.isFinite(Number(src.percentual_meia)) ? Math.min(100, Math.max(0, Number(src.percentual_meia))) : defaultPricingRules.percentual_meia,
    };
  } catch {
    return { ...defaultPricingRules };
  }
};

const parsePricingDescription = (politicaRaw) => {
  if (!politicaRaw) return '';
  try {
    const parsed = JSON.parse(politicaRaw);
    if (parsed && typeof parsed === 'object') return parsed.descricao || '';
    return '';
  } catch {
    return politicaRaw;
  }
};

const emptyFesta = {
  nome_festa: '', data_festa: '', local_festa: '', valor_convite: '', valor_convite_dependente: '',
  link_inscricao: '', descricao: '', observacoes: '', status: 'ativa', capacidade: '',
  cortesia_acompanhantes: String(defaultPricingRules.cortesia_acompanhantes),
  idade_gratis_ate: String(defaultPricingRules.idade_gratis_ate),
  idade_meia_de: String(defaultPricingRules.idade_meia_de),
  idade_meia_ate: String(defaultPricingRules.idade_meia_ate),
  percentual_meia: String(defaultPricingRules.percentual_meia),
  politica_preco_descricao: '',
};
const emptyPart = { nome_participante: '', tipo_participante: 'titular', custo_convite: '', pago: false, nome_dependente: '', parentesco: '', observacoes: '' };

export default function Festas() {
  const [festas, setFestas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalFesta, setModalFesta] = useState(false);
  const [editingFesta, setEditingFesta] = useState(null);
  const [formFesta, setFormFesta] = useState(emptyFesta);
  const [saving, setSaving] = useState(false);

  // Participantes modal
  const [festaSel, setFestaSel] = useState(null);
  const [modalParts, setModalParts] = useState(false);
  const [participantes, setParticipantes] = useState([]);
  const [loadingParts, setLoadingParts] = useState(false);
  const [filtroCondicao, setFiltroCondicao] = useState('todos');
  const [modalPart, setModalPart] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [formPart, setFormPart] = useState(emptyPart);
  const [membros, setMembros] = useState([]);
  const [modalConvites, setModalConvites] = useState(false);
  const [festaConvite, setFestaConvite] = useState(null);
  const [loadingConvites, setLoadingConvites] = useState(false);
  const [destinatarios, setDestinatarios] = useState([]);
  const [selecionados, setSelecionados] = useState(new Set());
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroMatricula, setFiltroMatricula] = useState('');
  const [filtroCidade, setFiltroCidade] = useState('');
  const [filtroSexo, setFiltroSexo] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('ativo');
  const [somenteEmailValido, setSomenteEmailValido] = useState(true);

  const load = () => {
    setLoading(true);
    api.get('/festas').then(r => setFestas(r.data)).catch(err => toast.error(getApiErrorMessage(err, 'Erro'))).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    api.get('/membros', { params: { limit: 1000 } })
      .then(r => setMembros(r.data))
      .catch(err => toast.error(getApiErrorMessage(err, 'Erro ao carregar membros')));
  }, []);

  const openModalFesta = (f = null) => {
    setEditingFesta(f);
    if (!f) {
      setFormFesta(emptyFesta);
      setModalFesta(true);
      return;
    }

    const regras = parsePricingRules(f.politica_precos);
    setFormFesta({
      ...emptyFesta,
      ...f,
      valor_convite: f.valor_convite || '',
      valor_convite_dependente: f.valor_convite_dependente || '',
      capacidade: f.capacidade || '',
      cortesia_acompanhantes: String(regras.cortesia_acompanhantes),
      idade_gratis_ate: String(regras.idade_gratis_ate),
      idade_meia_de: String(regras.idade_meia_de),
      idade_meia_ate: String(regras.idade_meia_ate),
      percentual_meia: String(regras.percentual_meia),
      politica_preco_descricao: parsePricingDescription(f.politica_precos),
    });
    setModalFesta(true);
  };

  const handleSaveFesta = async e => {
    e.preventDefault();

    const idadeGratisAte = parseInt(formFesta.idade_gratis_ate || '0');
    const idadeMeiaDe = parseInt(formFesta.idade_meia_de || '0');
    const idadeMeiaAte = parseInt(formFesta.idade_meia_ate || '0');
    if (idadeMeiaDe > idadeMeiaAte) {
      toast.error('Faixa de meia-entrada inválida: idade inicial maior que final');
      return;
    }

    setSaving(true);
    try {
      const pricingRules = {
        cortesia_acompanhantes: Math.max(0, parseInt(formFesta.cortesia_acompanhantes || '0') || 0),
        idade_gratis_ate: Math.max(0, idadeGratisAte || 0),
        idade_meia_de: Math.max(0, idadeMeiaDe || 0),
        idade_meia_ate: Math.max(0, idadeMeiaAte || 0),
        percentual_meia: Math.min(100, Math.max(0, parseInt(formFesta.percentual_meia || '0') || 0)),
      };

      const payload = {
        ...formFesta,
        valor_convite: parseFloat(formFesta.valor_convite) || 0,
        valor_convite_dependente: parseFloat(formFesta.valor_convite_dependente) || 0,
        capacidade: formFesta.capacidade ? parseInt(formFesta.capacidade) : null,
        politica_precos: JSON.stringify({
          pricing_rules: pricingRules,
          descricao: (formFesta.politica_preco_descricao || '').trim() || null,
        }),
      };
      if (editingFesta) {
        await api.put(`/festas/${editingFesta.id}`, payload);
        toast.success('Festa atualizada!');
      } else {
        await api.post('/festas', payload);
        toast.success('Festa criada!');
      }
      setModalFesta(false);
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao salvar'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFesta = async (id) => {
    if (!confirm('Remover festa?')) return;
    try { await api.delete(`/festas/${id}`); toast.success('Removida'); load(); }
    catch (err) { toast.error(getApiErrorMessage(err, 'Erro ao remover')); }
  };

  const openParticipantes = async (festa) => {
    setFestaSel(festa);
    setModalParts(true);
    setLoadingParts(true);
    try {
      const r = await api.get(`/festas/${festa.id}/participantes`);
      setParticipantes(r.data);
    } catch (err) { toast.error(getApiErrorMessage(err, 'Erro ao carregar participantes')); }
    finally { setLoadingParts(false); }
  };

  const openModalPart = (p = null) => {
    setEditingPart(p);
    const festaValor = festaSel?.valor_convite || 0;
    setFormPart(p ? { ...emptyPart, ...p } : { ...emptyPart, custo_convite: festaValor });
    setModalPart(true);
  };

  const handleSavePart = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...formPart, festa_id: festaSel.id, custo_convite: parseFloat(formPart.custo_convite) || 0 };
      if (editingPart) {
        await api.put(`/participantes/${editingPart.id}`, payload);
        toast.success('Atualizado!');
      } else {
        await api.post(`/festas/${festaSel.id}/participantes`, payload);
        toast.success('Participante adicionado!');
      }
      setModalPart(false);
      const r = await api.get(`/festas/${festaSel.id}/participantes`);
      setParticipantes(r.data);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao salvar'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePart = async (id) => {
    if (!confirm('Remover participante?')) return;
    try {
      await api.delete(`/participantes/${id}`);
      toast.success('Removido');
      const r = await api.get(`/festas/${festaSel.id}/participantes`);
      setParticipantes(r.data);
    } catch (err) { toast.error(getApiErrorMessage(err, 'Erro ao remover')); }
  };

  const exportarFesta = async (festaId, nomeFesta) => {
    const r = await api.get(`/relatorios/festas/${festaId}`, { responseType: 'blob' });
    const url = URL.createObjectURL(r.data);
    const a = document.createElement('a'); a.href = url; a.download = `festa_${nomeFesta}.xlsx`; a.click();
  };

  const isFestaPassada = (dataFesta) => {
    if (!dataFesta) return false;
    const hoje = new Date();
    const hojeLocal = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    return dataFesta <= hojeLocal;
  };

  const abrirModalConvites = async (festa) => {
    if (isFestaPassada(festa?.data_festa)) {
      toast.error('Envio de link permitido apenas para festa com data futura');
      return;
    }
    setFestaConvite(festa);
    setModalConvites(true);
    setLoadingConvites(true);
    setSelecionados(new Set());
    try {
      const r = await api.get('/membros', { params: { limit: 2000 } });
      const lista = (r.data || []).filter(m => m.email && `${m.email}`.trim() !== '');
      setDestinatarios(lista);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao carregar membros para convite'));
    } finally {
      setLoadingConvites(false);
    }
  };

  const enviarConvites = async (festa, somentePendentes = false) => {
    const ids = Array.from(selecionados);
    if (!somentePendentes && ids.length === 0) {
      toast.error('Selecione pelo menos um membro');
      return;
    }
    try {
      const r = await api.post(`/festas/${festa.id}/enviar-convites`, {
        somente_pendentes: somentePendentes,
        membro_ids: ids,
        filtro_nome: filtroNome || undefined,
        filtro_matricula: filtroMatricula || undefined,
        filtro_cidade: filtroCidade || undefined,
        filtro_sexo: filtroSexo || undefined,
        filtro_status: filtroStatus || undefined,
        somente_email_valido: somenteEmailValido,
      });
      const { emails_enviados, emails_com_falha, total_membros_com_email } = r.data || {};
      if (emails_com_falha > 0) {
        toast.success(`Convites enviados: ${emails_enviados}/${total_membros_com_email}. Falhas: ${emails_com_falha}`);
      } else {
        toast.success(`Convites enviados com sucesso para ${emails_enviados} membros!`);
      }
      setModalConvites(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao enviar convites'));
    }
  };

  const copyLink = (link) => { navigator.clipboard.writeText(link); toast.success('Link copiado!'); };
  const getLinkTemplate = (festa) => {
    const fallback = `${window.location.origin}/#/festa-inscricao/${festa?.id || ''}`;

    if (festa?.link_inscricao) {
      let link = festa.link_inscricao;

      if (festa.link_inscricao.includes('{festa_id}')) {
        link = festa.link_inscricao.replace('{festa_id}', festa.id || '');
      }
      if (festa.link_inscricao.includes('{token}')) {
        link = festa.link_inscricao.replace('{token}', festa.id || '');
      }

      if (link.includes('localhost') || link.includes('127.0.0.1')) return fallback;
      if (link.includes('/festa-inscricao/') && !link.includes('/#/')) {
        return link.replace('/festa-inscricao/', '/#/festa-inscricao/');
      }
      return link;
    }
    return fallback;
  };

  const setFF = (k, v) => setFormFesta(f => ({ ...f, [k]: v }));
  const setFP = (k, v) => setFormPart(f => ({ ...f, [k]: v }));
  const totalParts = participantes.length;
  const totalArrecadado = participantes.reduce((s, p) => s + (p.pago ? (p.custo_convite || 0) : 0), 0);
  const totalGratuitos = participantes.filter(p => Number(p.custo_convite || 0) === 0).length;
  const totalPagos = participantes.filter(p => Number(p.custo_convite || 0) > 0).length;
  const participantesFiltradosCondicao = participantes.filter(p => {
    const isGratis = Number(p.custo_convite || 0) === 0;
    if (filtroCondicao === 'gratis') return isGratis;
    if (filtroCondicao === 'pagos') return !isGratis;
    return true;
  });

  const destinatariosFiltrados = destinatarios.filter(m => {
    if (filtroNome && !`${m.nome_completo || ''}`.toLowerCase().includes(filtroNome.toLowerCase())) return false;
    if (filtroMatricula && !`${m.matricula || ''}`.toLowerCase().includes(filtroMatricula.toLowerCase())) return false;
    if (filtroCidade && !`${m.cidade || ''}`.toLowerCase().includes(filtroCidade.toLowerCase())) return false;
    if (filtroStatus && `${m.status || ''}` !== filtroStatus) return false;
    if (filtroSexo && `${m.sexo || ''}`.toLowerCase() !== filtroSexo.toLowerCase()) return false;
    if (somenteEmailValido) {
      const email = `${m.email || ''}`.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
    }
    return true;
  });

  const toggleSelecionado = (id) => {
    setSelecionados(prev => {
      const prox = new Set(prev);
      if (prox.has(id)) prox.delete(id);
      else prox.add(id);
      return prox;
    });
  };

  const selecionarFiltrados = () => {
    setSelecionados(new Set(destinatariosFiltrados.map(m => m.id)));
  };

  const limparSelecao = () => setSelecionados(new Set());

  return (
    <div>
      <div className="topbar">
        <h2>Festas e Eventos</h2>
        <button className="btn btn-primary" onClick={() => openModalFesta()}><Plus size={15} /> Nova Festa</button>
      </div>

      {loading ? <div className="spinner" /> : (
        <div className="festas-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 20 }}>
          {festas.length === 0 ? (
            <div className="empty-state"><PartyPopper size={48} /><p>Nenhuma festa cadastrada</p></div>
          ) : festas.map(f => {
            const festaPassada = isFestaPassada(f.data_festa);
            const regrasFesta = parsePricingRules(f.politica_precos);
            const descricaoPolitica = parsePricingDescription(f.politica_precos);
            return (
            <div key={f.id} className="card festa-card" style={{ borderTop: `4px solid ${f.status === 'ativa' ? '#c8a84b' : '#718096'}` }}>
              <div className="festa-card-header">
                <div>
                  <div className="title-inline festa-card-title">
                    <PartyPopper size={16} style={{ color: '#c8a84b' }} />
                    {f.nome_festa}
                  </div>
                  <div className="festa-card-meta">{fmtDataBR(f.data_festa)} | {f.local_festa}</div>
                </div>
                <span className={`badge ${f.status === 'ativa' ? 'badge-success' : f.status === 'encerrada' ? 'badge-gray' : 'badge-danger'}`}>{f.status}</span>
              </div>
              <div className="festa-card-details">
                <div>Convite: <strong>{fmt(f.valor_convite)}</strong></div>
                <div>Dependente: <strong>{fmt(f.valor_convite_dependente)}</strong></div>
                {f.capacidade && <div>Capacidade: <strong>{f.capacidade}</strong></div>}
              </div>
              <div className="festa-card-note">
                <div className="festa-card-note-title">Política da festa</div>
                <div>• Cortesia: membro + {regrasFesta.cortesia_acompanhantes} {regrasFesta.cortesia_acompanhantes === 1 ? 'acompanhante' : 'acompanhantes'}</div>
                <div>• Criança grátis até {regrasFesta.idade_gratis_ate} anos</div>
                <div>• {regrasFesta.idade_meia_de} a {regrasFesta.idade_meia_ate} anos: {regrasFesta.percentual_meia}%</div>
                {!!descricaoPolitica && (
                  <div className="festa-card-note-muted">{descricaoPolitica}</div>
                )}
              </div>
              <FestaLinkBar
                text={getLinkTemplate(f)}
                onCopy={() => copyLink(getLinkTemplate(f))}
                disabled={festaPassada}
                title={festaPassada ? 'Link indisponível para festa passada' : ''}
              />
              {festaPassada && (
                <div className="festa-link-warning">
                  Link de inscrição disponível apenas para festa com data futura.
                </div>
              )}
              <div className="festa-card-actions" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button className="btn btn-primary btn-sm" onClick={() => openParticipantes(f)}>
                  <Users size={13} /> Participantes
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => abrirModalConvites(f)}
                  disabled={festaPassada}
                  title={festaPassada ? 'Convites indisponíveis para festa passada' : ''}
                >
                  <Mail size={13} /> Enviar Convites
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => exportarFesta(f.id, f.nome_festa)}>
                  <Download size={13} /> Excel
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => openModalFesta(f)}><Edit size={13} /></button>
                <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDeleteFesta(f.id)}><Trash2 size={13} /></button>
              </div>
            </div>
          )})}
        </div>
      )}

      {/* Festa Modal */}
      {modalFesta && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <div className="modal-title">{editingFesta ? 'Editar Festa' : 'Nova Festa'}</div>
              <button className="btn btn-outline btn-sm modal-close-btn" onClick={() => setModalFesta(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveFesta}>
              <div className="form-grid">
                <div className="form-group form-full">
                  <label>Nome da Festa *</label>
                  <input required value={formFesta.nome_festa} onChange={e => setFF('nome_festa', e.target.value)} placeholder="Ex: Festa de Natal 2025" />
                </div>
                <div className="form-group">
                  <label>Data *</label>
                  <input type="date" required value={formFesta.data_festa} onChange={e => setFF('data_festa', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select value={formFesta.status} onChange={e => setFF('status', e.target.value)}>
                    <option value="ativa">Ativa</option>
                    <option value="encerrada">Encerrada</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </div>
                <div className="form-group form-full">
                  <label>Local</label>
                  <input value={formFesta.local_festa} onChange={e => setFF('local_festa', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Valor Convite (R$)</label>
                  <input type="number" step="0.01" value={formFesta.valor_convite} onChange={e => setFF('valor_convite', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Valor Dependente (R$)</label>
                  <input type="number" step="0.01" value={formFesta.valor_convite_dependente} onChange={e => setFF('valor_convite_dependente', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Capacidade</label>
                  <input type="number" value={formFesta.capacidade} onChange={e => setFF('capacidade', e.target.value)} placeholder="Máx. participantes" />
                </div>
                <div className="form-group form-full">
                  <label>Link de Inscrição</label>
                  <input type="url" value={formFesta.link_inscricao} onChange={e => setFF('link_inscricao', e.target.value)} placeholder="https://..." />
                </div>
                <div className="form-group form-full">
                  <label>Descrição</label>
                  <textarea value={formFesta.descricao} onChange={e => setFF('descricao', e.target.value)} />
                </div>
                <div className="form-group form-full">
                  <label>Política de Preços (por festa)</label>
                </div>
                <div className="form-group">
                  <label>Qtd. acompanhantes grátis</label>
                  <input type="number" min="0" value={formFesta.cortesia_acompanhantes} onChange={e => setFF('cortesia_acompanhantes', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Criança grátis até</label>
                  <input type="number" min="0" value={formFesta.idade_gratis_ate} onChange={e => setFF('idade_gratis_ate', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Meia de (idade)</label>
                  <input type="number" min="0" value={formFesta.idade_meia_de} onChange={e => setFF('idade_meia_de', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Meia até (idade)</label>
                  <input type="number" min="0" value={formFesta.idade_meia_ate} onChange={e => setFF('idade_meia_ate', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Percentual meia (%)</label>
                  <input type="number" min="0" max="100" value={formFesta.percentual_meia} onChange={e => setFF('percentual_meia', e.target.value)} />
                </div>
                <div className="form-group form-full">
                  <label>Descrição da política</label>
                  <textarea value={formFesta.politica_preco_descricao} onChange={e => setFF('politica_preco_descricao', e.target.value)} placeholder="Ex: Membro + 1 acompanhante grátis; crianças até 5 anos grátis..." />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline modal-btn-cancel" onClick={() => setModalFesta(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary modal-btn-save" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Participantes Modal */}
      {modalParts && festaSel && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 900 }}>
            <div className="modal-header">
              <div>
                <div className="modal-title title-inline"><PartyPopper size={18} />{festaSel.nome_festa}</div>
                <div className="festa-modal-subtitle">{fmtDataBR(festaSel.data_festa)} | {festaSel.local_festa}</div>
              </div>
              <button className="btn btn-outline btn-sm modal-close-btn" onClick={() => setModalParts(false)}>✕</button>
            </div>

            <FestaSummaryStrip>
              <FestaSummaryItem label="Total Participantes" value={totalParts} />
              <FestaSummaryItem label="Convites Grátis" value={totalGratuitos} valueClassName="festa-summary-item-value-success" />
              <FestaSummaryItem label="Convites Pagos" value={totalPagos} valueClassName="festa-summary-item-value-warning" />
              <FestaSummaryItem label="Arrecadado">
                <strong className="money-value money-value-compact" style={{ color: '#38a169' }}>{fmt(totalArrecadado)}</strong>
              </FestaSummaryItem>
              <FestaSummaryItem label="Filtro">
                <select className="search-input" style={{ minWidth: 150, height: 34 }} value={filtroCondicao} onChange={e => setFiltroCondicao(e.target.value)}>
                  <option value="todos">Todos</option>
                  <option value="gratis">Somente grátis</option>
                  <option value="pagos">Somente pagos</option>
                </select>
              </FestaSummaryItem>
              <div style={{ marginLeft: 'auto' }}>
                <button className="btn btn-primary" onClick={() => openModalPart()}><Plus size={14} /> Adicionar Participante</button>
              </div>
            </FestaSummaryStrip>

            {loadingParts ? <div className="spinner" /> : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Nome</th><th>Tipo</th><th>Dependente</th><th>Condição</th><th>Custo</th><th>Pago</th><th>Ações</th></tr>
                  </thead>
                  <tbody>
                    {participantesFiltradosCondicao.length === 0 ? (
                      <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#718096' }}>Nenhum participante cadastrado</td></tr>
                    ) : participantesFiltradosCondicao.map(p => (
                      <tr key={p.id} className={p.pago ? 'row-green' : ''}>
                        <td><strong>{p.nome_participante}</strong></td>
                        <td><span className={`badge ${p.tipo_participante === 'titular' ? 'badge-info' : p.tipo_participante === 'dependente' ? 'badge-warning' : 'badge-gray'}`}>{p.tipo_participante}</span></td>
                        <td>{p.nome_dependente ? `${p.nome_dependente} (${p.parentesco})` : '-'}</td>
                        <td>
                          <span className={`badge ${Number(p.custo_convite || 0) === 0 ? 'badge-success' : 'badge-warning'}`}>
                            {Number(p.custo_convite || 0) === 0 ? 'Grátis' : 'Pago'}
                          </span>
                        </td>
                        <td>{fmt(p.custo_convite)}</td>
                        <td><span className={`badge ${p.pago ? 'badge-success' : 'badge-danger'}`}>{p.pago ? 'Sim' : 'Não'}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-outline btn-icon btn-sm" onClick={() => openModalPart(p)}><Edit size={12} /></button>
                            <button className="btn btn-danger btn-icon btn-sm" onClick={() => handleDeletePart(p.id)}><Trash2 size={12} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Convites Modal */}
      {modalConvites && festaConvite && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 980 }}>
            <div className="modal-header">
              <div>
                <div className="modal-title">Enviar Convites • {festaConvite.nome_festa}</div>
                <div className="festa-convite-subtitle">Filtre e selecione os membros que receberão o mesmo link da festa</div>
              </div>
              <button className="btn btn-outline btn-sm modal-close-btn" onClick={() => setModalConvites(false)}>✕</button>
            </div>

            <FestaLinkBar text={getLinkTemplate(festaConvite)} onCopy={() => copyLink(getLinkTemplate(festaConvite))} marginBottom={10} />

            <FilterBar style={{ marginBottom: 12 }}>
              <input className="search-input search-input-wide" placeholder="Nome" value={filtroNome} onChange={e => setFiltroNome(e.target.value)} />
              <input className="search-input" placeholder="Matrícula" value={filtroMatricula} onChange={e => setFiltroMatricula(e.target.value)} />
              <input className="search-input" placeholder="Cidade" value={filtroCidade} onChange={e => setFiltroCidade(e.target.value)} />
              <select className="search-input" value={filtroSexo} onChange={e => setFiltroSexo(e.target.value)}>
                <option value="">Sexo (todos)</option>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
              </select>
              <select className="search-input" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
                <option value="">Status (todos)</option>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
                <option value="suspenso">Suspenso</option>
              </select>
              <label className="festa-filter-checkbox">
                <input type="checkbox" checked={somenteEmailValido} onChange={e => setSomenteEmailValido(e.target.checked)} />
                Somente e-mail válido
              </label>
              <button className="btn btn-outline btn-sm" onClick={selecionarFiltrados}>Selecionar filtrados</button>
              <button className="btn btn-outline btn-sm" onClick={limparSelecao}>Limpar seleção</button>
            </FilterBar>

            {loadingConvites ? <div className="spinner" /> : (
              <div className="table-wrap" style={{ maxHeight: 360, overflow: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 44 }}></th>
                      <th>Nome</th>
                      <th>Cidade</th>
                      <th>Sexo</th>
                      <th>Status</th>
                      <th>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {destinatariosFiltrados.length === 0 ? (
                      <TableEmptyRow colSpan={6} message="Nenhum membro encontrado" />
                    ) : destinatariosFiltrados.map(m => (
                      <tr key={m.id}>
                        <td>
                          <input type="checkbox" checked={selecionados.has(m.id)} onChange={() => toggleSelecionado(m.id)} />
                        </td>
                        <td><strong>{m.nome_completo}</strong></td>
                        <td>{m.cidade || '-'}</td>
                        <td>{m.sexo || '-'}</td>
                        <td>{m.status || '-'}</td>
                        <td>{m.email || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <StatusCounter count={selecionados.size} singular="membro selecionado" plural="membros selecionados" />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-outline" onClick={() => enviarConvites(festaConvite, true)}>Reenviar Pendentes</button>
                <button className="btn btn-primary" onClick={() => enviarConvites(festaConvite)}>Enviar Selecionados</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Participante Form Modal */}
      {modalPart && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div className="modal-title">{editingPart ? 'Editar Participante' : 'Novo Participante'}</div>
              <button className="btn btn-outline btn-sm modal-close-btn" onClick={() => setModalPart(false)}>✕</button>
            </div>
            <form onSubmit={handleSavePart}>
              <div className="form-grid">
                <div className="form-group form-full">
                  <label>Membro (opcional)</label>
                  <select value={formPart.membro_id || ''} onChange={e => {
                    const m = membros.find(m => m.id === e.target.value);
                    setFP('membro_id', e.target.value);
                    if (m) setFP('nome_participante', m.nome_completo);
                  }}>
                    <option value="">Selecione um membro...</option>
                    {membros.map(m => <option key={m.id} value={m.id}>{m.nome_completo} ({m.matricula})</option>)}
                  </select>
                </div>
                <div className="form-group form-full">
                  <label>Nome do Participante *</label>
                  <input required value={formPart.nome_participante} onChange={e => setFP('nome_participante', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Tipo *</label>
                  <select value={formPart.tipo_participante} onChange={e => setFP('tipo_participante', e.target.value)}>
                    <option value="titular">Titular</option>
                    <option value="dependente">Dependente</option>
                    <option value="convidado">Convidado</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Custo do Convite (R$)</label>
                  <input type="number" step="0.01" value={formPart.custo_convite} onChange={e => setFP('custo_convite', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Nome do Dependente</label>
                  <input value={formPart.nome_dependente} onChange={e => setFP('nome_dependente', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Parentesco</label>
                  <input value={formPart.parentesco} onChange={e => setFP('parentesco', e.target.value)} placeholder="Ex: Cônjuge, Filho(a)" />
                </div>
                <div className="form-group form-full" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <input type="checkbox" id="pago" checked={formPart.pago} onChange={e => setFP('pago', e.target.checked)} style={{ width: 16, height: 16 }} />
                  <label htmlFor="pago" style={{ textTransform: 'none', fontSize: 14, fontWeight: 500 }}>Convite pago</label>
                </div>
                <div className="form-group form-full">
                  <label>Observações</label>
                  <textarea value={formPart.observacoes} onChange={e => setFP('observacoes', e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline modal-btn-cancel" onClick={() => setModalPart(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary modal-btn-save" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
