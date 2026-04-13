import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, subMonths } from 'date-fns';
import { Download, Edit, Plus, Trash2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';
import { getApiErrorMessage } from '../utils/apiError';

const fmt = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtDataAplicacao = (dataAplicacao, mesReferencia) => {
  if (dataAplicacao && typeof dataAplicacao === 'string') {
    const [ano, mes, dia] = dataAplicacao.split('-');
    if (ano && mes && dia) return `${dia}/${mes}/${ano}`;
  }
  if (mesReferencia && typeof mesReferencia === 'string') {
    const [ano, mes] = mesReferencia.split('-');
    if (ano && mes) return `01/${mes}/${ano}`;
  }
  return '-';
};
const getMeses = () => {
  const r = [];
  for (let i = 0; i < 13; i++) r.push(format(subMonths(new Date(), i), 'yyyy-MM'));
  return r;
};

const emptyForm = {
  data_aplicacao: format(new Date(), 'yyyy-MM-dd'),
  instituicao: '',
  produto: '',
  saldo_anterior: '',
  aplicacoes: '',
  rendimento_bruto: '',
  imposto_renda: '',
  iof: '',
  impostos: '',
  rendimento_liquido: '',
  resgate: '',
  observacoes: ''
};

const toNumber = value => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toMesReferencia = value => {
  if (!value || typeof value !== 'string') return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return `${match[1]}-${match[2]}`;
};

export default function AplicacoesFinanceiras() {
  const [mes, setMes] = useState(format(new Date(), 'yyyy-MM'));
  const [busca, setBusca] = useState('');
  const [items, setItems] = useState([]);
  const [resumo, setResumo] = useState({
    total_registros: 0,
    totais: { saldo_anterior: 0, aplicacoes: 0, rendimento_bruto: 0, imposto_renda: 0, iof: 0, impostos: 0, rendimento_liquido: 0, resgate: 0, saldo_atual: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importingPdf, setImportingPdf] = useState(false);
  const [confirmingImport, setConfirmingImport] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/aplicacoes-financeiras', { params: { mes_referencia: mes } }),
      api.get('/aplicacoes-financeiras/resumo', { params: { mes_referencia: mes } })
    ])
      .then(([lista, resumoResp]) => {
        setItems(lista.data || []);
        setResumo(resumoResp.data || { total_registros: 0, totais: { saldo_anterior: 0, aplicacoes: 0, rendimento_bruto: 0, imposto_renda: 0, iof: 0, impostos: 0, rendimento_liquido: 0, resgate: 0, saldo_atual: 0 } });
      })
        .catch(err => toast.error(getApiErrorMessage(err, 'Erro ao carregar aplicações financeiras')))
      .finally(() => setLoading(false));
  }, [mes]);

  useEffect(() => {
    const timerId = setTimeout(load, 0);
    return () => clearTimeout(timerId);
  }, [load]);

  const openModal = (item = null) => {
    setEditing(item);
    setForm(item ? {
      data_aplicacao: item.data_aplicacao || (item.mes_referencia ? `${item.mes_referencia}-01` : format(new Date(), 'yyyy-MM-dd')),
      instituicao: item.instituicao || '',
      produto: item.produto || '',
      saldo_anterior: item.saldo_anterior ?? '',
      aplicacoes: item.aplicacoes ?? '',
      rendimento_bruto: item.rendimento_bruto ?? '',
      imposto_renda: item.imposto_renda ?? '',
      iof: item.iof ?? '',
      impostos: item.impostos ?? '',
      rendimento_liquido: item.rendimento_liquido ?? '',
      resgate: item.resgate ?? '',
      observacoes: item.observacoes || ''
    } : emptyForm);
    setModal(true);
  };

  const setF = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const saldoCalculado = useMemo(() => {
    const impostosTotais = toNumber(form.imposto_renda) + toNumber(form.iof);
    return (
      toNumber(form.saldo_anterior) +
      toNumber(form.aplicacoes) +
      toNumber(form.rendimento_bruto) -
      impostosTotais -
      toNumber(form.resgate)
    );
  }, [form]);

  const impostosCalculados = useMemo(() => toNumber(form.imposto_renda) + toNumber(form.iof), [form.imposto_renda, form.iof]);
  const rendimentoLiquidoCalculado = useMemo(() => toNumber(form.rendimento_bruto) - impostosCalculados, [form.rendimento_bruto, impostosCalculados]);

  const handleSave = async e => {
    e.preventDefault();
    const mesReferenciaForm = toMesReferencia(form.data_aplicacao);
    if (!mesReferenciaForm) {
      toast.error('Informe uma data válida para a aplicação');
      return;
    }
    setSaving(true);
    const payload = {
      instituicao: form.instituicao.trim(),
      produto: form.produto.trim(),
      saldo_anterior: toNumber(form.saldo_anterior),
      aplicacoes: toNumber(form.aplicacoes),
      rendimento_bruto: toNumber(form.rendimento_bruto),
      imposto_renda: toNumber(form.imposto_renda),
      iof: toNumber(form.iof),
      impostos: impostosCalculados,
      rendimento_liquido: rendimentoLiquidoCalculado,
      resgate: toNumber(form.resgate),
      observacoes: form.observacoes,
      data_aplicacao: form.data_aplicacao,
      mes_referencia: mesReferenciaForm
    };

    try {
      if (editing) {
        await api.put(`/aplicacoes-financeiras/${editing.id}`, payload);
        toast.success('Aplicação atualizada!');
      } else {
        await api.post('/aplicacoes-financeiras', payload);
        toast.success('Aplicação registrada!');
      }
      setMes(mesReferenciaForm);
      setModal(false);
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao salvar'));
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
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao remover'));
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
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao gerar relatório'));
    }
  };

  const handleImportPdf = async e => {
    const file = e.target.files?.[0];
    e.target.value = '';

    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Selecione um arquivo PDF válido');
      return;
    }

    setImportingPdf(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/aplicacoes-financeiras/importar-pdf-preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setImportPreview(data);
    } catch (err) {
      const message = getApiErrorMessage(err, 'Erro ao ler PDF do extrato');
      toast.error(`${message} Formatos aceitos: "Extratos - Investimentos Fundos - Mensal" e "Extratos - CDB / RDB e BB Reaplic".`);
    } finally {
      setImportingPdf(false);
    }
  };

  const handleConfirmImport = async overwriteExisting => {
    if (!importPreview) return;

    setConfirmingImport(true);
    try {
      const payload = {
        ...importPreview,
        overwrite_existing: overwriteExisting || importPreview.existing_match,
      };
      const { data } = await api.post('/aplicacoes-financeiras/importar-pdf-confirmar', payload);
      toast.success(importPreview.existing_match && overwriteExisting ? 'Aplicação atualizada via PDF!' : 'Aplicação importada via PDF!');
      setImportPreview(null);
      if (data?.mes_referencia) setMes(data.mes_referencia);
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao confirmar importação do PDF'));
    } finally {
      setConfirmingImport(false);
    }
  };

  const totais = resumo?.totais || {
    saldo_anterior: 0,
    aplicacoes: 0,
    rendimento_bruto: 0,
    imposto_renda: 0,
    iof: 0,
    impostos: 0,
    rendimento_liquido: 0,
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
          <label className="btn btn-outline" style={{ cursor: importingPdf ? 'wait' : 'pointer' }}>
            <Upload size={15} /> {importingPdf ? 'Lendo PDF...' : 'Importar PDF'}
            <input type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={handleImportPdf} disabled={importingPdf} />
          </label>
          <button className="btn btn-outline" onClick={handleDownloadExcel}>
            <Download size={15} /> Baixar Excel
          </button>
          <button className="btn btn-primary" onClick={() => openModal()}>
            <Plus size={15} /> Nova Aplicação
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid #2b6cb0' }}>
        <div style={{ color: '#4a5568', lineHeight: 1.6 }}>
          O botão <strong>Importar PDF</strong> aceita extratos do Banco do Brasil nos formatos:
          <strong> Fundos Mensal</strong> e <strong>CDB / RDB e BB Reaplic</strong>.
        </div>
        <div style={{ color: '#718096', lineHeight: 1.6, fontSize: 13, marginTop: 8 }}>
          Exemplos de layout reconhecido: <strong>"Extratos - Investimentos Fundos - Mensal"</strong> e
          <strong> "Extratos - CDB / RDB e BB Reaplic"</strong>.
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
                    <div className="table-actions">
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
                        <tr><td>SALDO ANTERIOR</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(item.saldo_anterior)}</td></tr>
                        <tr><td>DATA DO EXTRATO</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtDataAplicacao(item.data_aplicacao, item.mes_referencia)}</td></tr>
                        <tr><td>APLICAÇÕES (+)</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(item.aplicacoes)}</td></tr>
                        <tr><td>RENDIMENTO BRUTO (+)</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(item.rendimento_bruto)}</td></tr>
                        <tr><td>IMPOSTO DE RENDA (-)</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(item.imposto_renda)}</td></tr>
                        <tr><td>IOF (-)</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(item.iof)}</td></tr>
                        <tr><td>RENDIMENTO LÍQUIDO</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(item.rendimento_liquido)}</td></tr>
                        <tr><td>RESGATES (-)</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(item.resgate)}</td></tr>
                        <tr className="row-green"><td style={{ fontWeight: 700 }}>SALDO ATUAL</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(item.saldo_atual)}</td></tr>
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
                  <tr><td>APLICAÇÕES (+)</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(totais.aplicacoes)}</td></tr>
                  <tr><td>RENDIMENTO BRUTO (+)</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(totais.rendimento_bruto)}</td></tr>
                  <tr><td>IMPOSTO DE RENDA (-)</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(totais.imposto_renda)}</td></tr>
                  <tr><td>IOF (-)</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(totais.iof)}</td></tr>
                  <tr><td>RENDIMENTO LÍQUIDO</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(totais.rendimento_liquido)}</td></tr>
                  <tr><td>RESGATES (-)</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(totais.resgate)}</td></tr>
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
                  <label>Data do Extrato *</label>
                  <input
                    type="date"
                    required
                    value={form.data_aplicacao}
                    onChange={e => setF('data_aplicacao', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Instituição *</label>
                  <input required value={form.instituicao} onChange={e => setF('instituicao', e.target.value)} placeholder="Ex: BB" />
                </div>
                <div className="form-group">
                  <label>Produto *</label>
                  <input required value={form.produto} onChange={e => setF('produto', e.target.value)} placeholder="Ex: CDB DI" />
                </div>
                <div className="form-group">
                  <label>SALDO ANTERIOR (R$)</label>
                  <input type="number" step="0.01" value={form.saldo_anterior} onChange={e => setF('saldo_anterior', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>APLICAÇÕES (+) (R$)</label>
                  <input type="number" step="0.01" value={form.aplicacoes} onChange={e => setF('aplicacoes', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>RENDIMENTO BRUTO (+) (R$)</label>
                  <input type="number" step="0.01" value={form.rendimento_bruto} onChange={e => setF('rendimento_bruto', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>IMPOSTO DE RENDA (-) (R$)</label>
                  <input type="number" step="0.01" value={form.imposto_renda} onChange={e => setF('imposto_renda', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>IOF (-) (R$)</label>
                  <input type="number" step="0.01" value={form.iof} onChange={e => setF('iof', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>RENDIMENTO LÍQUIDO (calculado)</label>
                  <input value={fmt(rendimentoLiquidoCalculado)} readOnly style={{ fontWeight: 700, color: '#276749' }} />
                </div>
                <div className="form-group">
                  <label>RESGATES (-) (R$)</label>
                  <input type="number" step="0.01" value={form.resgate} onChange={e => setF('resgate', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>SALDO ATUAL (calculado)</label>
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

      {importPreview && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 760 }}>
            <div className="modal-header">
              <div className="modal-title">Prévia da Importação do PDF</div>
              <button className="btn btn-outline btn-sm modal-close-btn" onClick={() => setImportPreview(null)}>✕</button>
            </div>

            <div style={{ padding: 20 }}>
              <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid #2b6cb0' }}>
                <div style={{ color: '#4a5568', lineHeight: 1.6 }}>
                  <div><strong>Arquivo:</strong> {importPreview.arquivo || '-'}</div>
                  <div><strong>Instituição:</strong> {importPreview.instituicao}</div>
                  <div><strong>Produto:</strong> {importPreview.produto}</div>
                  <div><strong>Mês de referência:</strong> {importPreview.mes_referencia}</div>
                  <div><strong>Conta:</strong> {importPreview.conta || '-'}</div>
                  <div><strong>Data apurada:</strong> {fmtDataAplicacao(importPreview.data_aplicacao, importPreview.mes_referencia)}</div>
                </div>
              </div>

              {importPreview.existing_match && (
                <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid #d69e2e', color: '#744210' }}>
                  Já existe um registro deste mês para a mesma instituição/produto/conta. A confirmação vai atualizar o registro existente para evitar duplicidade.
                </div>
              )}

              <div className="table-wrap card" style={{ padding: 0 }}>
                <table>
                  <tbody>
                    <tr><td>SALDO ANTERIOR</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(importPreview.saldo_anterior)}</td></tr>
                    <tr><td>APLICAÇÕES (+)</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(importPreview.aplicacoes)}</td></tr>
                    <tr><td>RENDIMENTO BRUTO (+)</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(importPreview.rendimento_bruto)}</td></tr>
                    <tr><td>IMPOSTO DE RENDA (-)</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(importPreview.imposto_renda)}</td></tr>
                    <tr><td>IOF (-)</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(importPreview.iof)}</td></tr>
                    <tr><td>RENDIMENTO LÍQUIDO</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(importPreview.rendimento_liquido)}</td></tr>
                    <tr><td>RESGATES (-)</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(importPreview.resgate)}</td></tr>
                    <tr className="row-green"><td style={{ fontWeight: 700 }}>SALDO ATUAL</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(importPreview.saldo_atual)}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-outline modal-btn-cancel" onClick={() => setImportPreview(null)} disabled={confirmingImport}>Cancelar</button>
              <button type="button" className="btn btn-primary modal-btn-save" onClick={() => handleConfirmImport(importPreview.existing_match)} disabled={confirmingImport}>
                {confirmingImport ? 'Confirmando...' : importPreview.existing_match ? 'Atualizar Existente' : 'Confirmar Importação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
