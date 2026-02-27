import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, subMonths } from 'date-fns';
import { Download, Edit, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';

const fmt = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const getMeses = () => {
  const r = [];
  for (let i = 0; i < 13; i++) r.push(format(subMonths(new Date(), i), 'yyyy-MM'));
  return r;
};

const emptyForm = {
  instituicao: '',
  produto: '',
  saldo_anterior: '',
  aplicacoes: '',
  rendimento_bruto: '',
  impostos: '',
  resgate: '',
  observacoes: ''
};

const toNumber = value => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function AplicacoesFinanceiras() {
  const [mes, setMes] = useState(format(new Date(), 'yyyy-MM'));
  const [busca, setBusca] = useState('');
  const [items, setItems] = useState([]);
  const [resumo, setResumo] = useState({
    total_registros: 0,
    totais: { saldo_anterior: 0, aplicacoes: 0, rendimento_bruto: 0, impostos: 0, resgate: 0, saldo_atual: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/aplicacoes-financeiras', { params: { mes_referencia: mes } }),
      api.get('/aplicacoes-financeiras/resumo', { params: { mes_referencia: mes } })
    ])
      .then(([lista, resumoResp]) => {
        setItems(lista.data || []);
        setResumo(resumoResp.data || { total_registros: 0, totais: { saldo_anterior: 0, aplicacoes: 0, rendimento_bruto: 0, impostos: 0, resgate: 0, saldo_atual: 0 } });
      })
      .catch(() => toast.error('Erro ao carregar aplicações financeiras'))
      .finally(() => setLoading(false));
  }, [mes]);

  useEffect(() => {
    const timerId = setTimeout(load, 0);
    return () => clearTimeout(timerId);
  }, [load]);

  const openModal = (item = null) => {
    setEditing(item);
    setForm(item ? {
      instituicao: item.instituicao || '',
      produto: item.produto || '',
      saldo_anterior: item.saldo_anterior ?? '',
      aplicacoes: item.aplicacoes ?? '',
      rendimento_bruto: item.rendimento_bruto ?? '',
      impostos: item.impostos ?? '',
      resgate: item.resgate ?? '',
      observacoes: item.observacoes || ''
    } : emptyForm);
    setModal(true);
  };

  const setF = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const saldoCalculado = useMemo(() => {
    return (
      toNumber(form.saldo_anterior) +
      toNumber(form.aplicacoes) +
      toNumber(form.rendimento_bruto) -
      toNumber(form.impostos) -
      toNumber(form.resgate)
    );
  }, [form]);

  const handleSave = async e => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      instituicao: form.instituicao.trim(),
      produto: form.produto.trim(),
      saldo_anterior: toNumber(form.saldo_anterior),
      aplicacoes: toNumber(form.aplicacoes),
      rendimento_bruto: toNumber(form.rendimento_bruto),
      impostos: toNumber(form.impostos),
      resgate: toNumber(form.resgate),
      observacoes: form.observacoes,
      mes_referencia: mes
    };

    try {
      if (editing) {
        await api.put(`/aplicacoes-financeiras/${editing.id}`, payload);
        toast.success('Aplicação atualizada!');
      } else {
        await api.post('/aplicacoes-financeiras', payload);
        toast.success('Aplicação registrada!');
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
    if (!confirm('Remover esta aplicação financeira?')) return;
    try {
      await api.delete(`/aplicacoes-financeiras/${id}`);
      toast.success('Aplicação removida');
      load();
    } catch {
      toast.error('Erro ao remover');
    }
  };

  const handleDownloadExcel = async () => {
    try {
      const r = await api.get('/relatorios/aplicacoes-financeiras', {
        params: { mes_referencia: mes },
        responseType: 'blob'
      });
      const blobUrl = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `aplicacoes_financeiras_${mes}.xlsx`;
      a.click();
      toast.success('Relatório gerado!');
    } catch {
      toast.error('Erro ao gerar relatório');
    }
  };

  const totais = resumo?.totais || {
    saldo_anterior: 0,
    aplicacoes: 0,
    rendimento_bruto: 0,
    impostos: 0,
    resgate: 0,
    saldo_atual: 0
  };

  const termoBusca = busca.trim().toLowerCase();
  const itemsFiltrados = termoBusca
    ? items.filter(item =>
        [item.instituicao, item.produto, item.observacoes]
          .filter(Boolean)
          .some(campo => String(campo).toLowerCase().includes(termoBusca))
      )
    : items;
  const labelRegistros = qtd => `${qtd} ${qtd === 1 ? 'registro' : 'registros'}`;

  return (
    <div>
      <div className="topbar">
        <h2>Aplicações Financeiras</h2>
        <div className="topbar-right">
          <button className="btn btn-outline" onClick={handleDownloadExcel}>
            <Download size={15} /> Baixar Excel
          </button>
          <button className="btn btn-primary" onClick={() => openModal()}>
            <Plus size={15} /> Nova Aplicação
          </button>
        </div>
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
            placeholder="Instituição, produto..."
          />
        </div>
        <div style={{ fontSize: 13, color: '#4a5568', alignSelf: 'flex-end', paddingBottom: 8 }}>
          {termoBusca
            ? `${labelRegistros(itemsFiltrados.length)} de ${labelRegistros(resumo.total_registros)}`
            : `${labelRegistros(resumo.total_registros)} no mês`}
        </div>
      </div>

      {loading ? <div className="spinner" /> : (
        <>
          {itemsFiltrados.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', color: '#718096' }}>
              {termoBusca
                ? 'Nenhum resultado encontrado para a busca informada.'
                : 'Sem aplicações financeiras cadastradas para este mês.'}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 16, marginBottom: 20 }}>
              {itemsFiltrados.map(item => (
                <div key={item.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{
                    background: 'var(--primary)',
                    color: '#fff',
                    padding: '10px 14px',
                    fontWeight: 700,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span>{`${item.instituicao} ${item.produto}`.trim().toUpperCase()}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-outline btn-icon btn-sm" onClick={() => openModal(item)} title="Editar" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.5)' }}>
                        <Edit size={13} />
                      </button>
                      <button className="btn btn-danger btn-icon btn-sm" onClick={() => handleDelete(item.id)} title="Remover">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <tbody>
                        <tr><td>Saldo Anterior</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(item.saldo_anterior)}</td></tr>
                        <tr><td>Aplicações</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(item.aplicacoes)}</td></tr>
                        <tr><td>Renda Bruta</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(item.rendimento_bruto)}</td></tr>
                        <tr><td>IR/IOF</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(item.impostos)}</td></tr>
                        <tr><td>Resgate</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(item.resgate)}</td></tr>
                        <tr className="row-green"><td style={{ fontWeight: 700 }}>Saldo p/mês seguinte</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(item.saldo_atual)}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ background: 'var(--primary-dark)', color: '#fff', padding: '10px 14px', fontWeight: 700 }}>
              INVESTIMENTOS TOTAIS
            </div>
            <div className="table-wrap">
              <table>
                <tbody>
                  <tr><td>SALDO ANTERIOR</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(totais.saldo_anterior)}</td></tr>
                  <tr><td>APLICAÇÕES</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(totais.aplicacoes)}</td></tr>
                  <tr><td>RENDIMENTO BRUTO</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(totais.rendimento_bruto)}</td></tr>
                  <tr><td>IMPOSTOS (IR + IOF)</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(totais.impostos)}</td></tr>
                  <tr><td>RESGATE</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(totais.resgate)}</td></tr>
                  <tr className="row-green"><td style={{ fontWeight: 700 }}>SALDO ATUAL</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(totais.saldo_atual)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {modal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 700 }}>
            <div className="modal-header">
              <div className="modal-title">{editing ? 'Editar Aplicação' : 'Nova Aplicação'}</div>
              <button className="btn btn-outline btn-sm modal-close-btn" onClick={() => setModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSave}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Instituição *</label>
                  <input required value={form.instituicao} onChange={e => setF('instituicao', e.target.value)} placeholder="Ex: BB" />
                </div>
                <div className="form-group">
                  <label>Produto *</label>
                  <input required value={form.produto} onChange={e => setF('produto', e.target.value)} placeholder="Ex: CDB DI" />
                </div>
                <div className="form-group">
                  <label>Saldo Anterior (R$)</label>
                  <input type="number" step="0.01" value={form.saldo_anterior} onChange={e => setF('saldo_anterior', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Aplicações (R$)</label>
                  <input type="number" step="0.01" value={form.aplicacoes} onChange={e => setF('aplicacoes', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Rendimento Bruto (R$)</label>
                  <input type="number" step="0.01" value={form.rendimento_bruto} onChange={e => setF('rendimento_bruto', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Impostos IR/IOF (R$)</label>
                  <input type="number" step="0.01" value={form.impostos} onChange={e => setF('impostos', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Resgate (R$)</label>
                  <input type="number" step="0.01" value={form.resgate} onChange={e => setF('resgate', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Saldo Atual (calculado)</label>
                  <input value={fmt(saldoCalculado)} readOnly style={{ fontWeight: 700, color: '#276749' }} />
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
