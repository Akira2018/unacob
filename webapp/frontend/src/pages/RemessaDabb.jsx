import { useEffect, useMemo, useRef, useState } from 'react';
import { format, subMonths } from 'date-fns';
import toast from 'react-hot-toast';
import { BookText, Copy, CreditCard, Download, FileSpreadsheet, RefreshCcw, Trash2 } from 'lucide-react';
import api from '../api';
import { getApiErrorMessage } from '../utils/apiError';
import StatusCounter from '../components/StatusCounter';

const getMeses = () => {
  const r = [];
  for (let i = 0; i < 13; i += 1) r.push(format(subMonths(new Date(), i), 'yyyy-MM'));
  return r;
};

export default function RemessaDabb() {
  const [mes, setMes] = useState(format(new Date(), 'yyyy-MM'));
  const [dataDebitoDabb, setDataDebitoDabb] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [incluirAtrasadosDabb, setIncluirAtrasadosDabb] = useState(true);
  const [previaDabb, setPreviaDabb] = useState(null);
  const [edicoesDabb, setEdicoesDabb] = useState({});
  const [salvandoTodosDabb, setSalvandoTodosDabb] = useState(false);
  const [filtroAlteradosDabb, setFiltroAlteradosDabb] = useState(false);
  const [filtroHabilitadosDabb, setFiltroHabilitadosDabb] = useState(false);
  const [filtroAtrasoDabb, setFiltroAtrasoDabb] = useState(false);
  const [configDabb, setConfigDabb] = useState({ valor_mensal_padrao: '35.00', taxa_bancaria_bimestral: '1.00' });
  const [aplicarReajusteTodos, setAplicarReajusteTodos] = useState(false);
  const [somenteHabilitadosReajuste, setSomenteHabilitadosReajuste] = useState(true);
  const [historicoDabbConfig, setHistoricoDabbConfig] = useState([]);
  const [origemPreviaDabb, setOrigemPreviaDabb] = useState('aberto');
  const [remessasDabb, setRemessasDabb] = useState([]);
  const [remessaSelecionadaId, setRemessaSelecionadaId] = useState(null);
  const [loading, setLoading] = useState({});
  const previaDabbRef = useRef(null);

  const normalizarDataDabb = (valor) => {
    const txt = String(valor || '').trim();
    if (!txt) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(txt)) return txt;
    const br = txt.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (br) return `${br[3]}-${br[2]}-${br[1]}`;
    return txt;
  };

  const aplicarPreviaDabbNaTela = (data) => {
    setPreviaDabb(data);
    setOrigemPreviaDabb(data?.origem || 'aberto');
    setRemessaSelecionadaId(data?.remessa_id || null);
    const mapaEdicoes = {};
    (Array.isArray(data?.itens) ? data.itens : []).forEach((item) => {
      mapaEdicoes[item.membro_id] = {
        dabb_habilitado: item.dabb_habilitado !== false,
        dabb_valor_mensalidade: item.usa_valor_personalizado ? String(item.valor_mensalidade_dabb ?? '') : '',
      };
    });
    setEdicoesDabb(mapaEdicoes);
    setTimeout(() => {
      previaDabbRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const carregarArquivosRemessa = async (mesReferencia = mes) => {
    try {
      const r = await api.get('/relatorios/dabb-remessa-bimestral/remessas', { params: { mes_referencia: mesReferencia } });
      setRemessasDabb(Array.isArray(r.data) ? r.data : []);
    } catch {
      setRemessasDabb([]);
    }
  };

  useEffect(() => {
    api.get('/configuracoes/dabb')
      .then((r) => setConfigDabb({
        valor_mensal_padrao: String(r.data?.valor_mensal_padrao ?? '35.00'),
        taxa_bancaria_bimestral: String(r.data?.taxa_bancaria_bimestral ?? '1.00'),
      }))
      .catch(() => {});
    api.get('/configuracoes/dabb/historico')
      .then((r) => setHistoricoDabbConfig(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    carregarArquivosRemessa(mes);
  }, [mes]);

  const download = async (key, url, filename, params = {}, onSuccess = null) => {
    setLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const r = await api.get(url, { params, responseType: 'blob' });
      const blobUrl = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.click();
      if (typeof onSuccess === 'function') {
        onSuccess(r);
      } else {
        toast.success('Arquivo disponibilizado.');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao gerar arquivo'));
    } finally {
      setLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const carregarPreviaDabb = async () => {
    setLoading((prev) => ({ ...prev, previa_dabb: true }));
    try {
      const r = await api.get('/relatorios/dabb-remessa-bimestral/previa', {
        params: {
          mes_referencia: mes,
          data_debito: normalizarDataDabb(dataDebitoDabb),
          incluir_atrasados: incluirAtrasadosDabb,
        },
      });
      setRemessaSelecionadaId(null);
      aplicarPreviaDabbNaTela(r.data);
      if ((r.data?.quantidade_associados || 0) > 0) {
        toast.success(`Previa atualizada com ${r.data.quantidade_associados} associado(s).`);
      } else {
        toast('Nao ha associados elegiveis em aberto para esta remessa.');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao carregar previa'));
    } finally {
      setLoading((prev) => ({ ...prev, previa_dabb: false }));
    }
  };

  const carregarRemessaDabbPorId = async (remessaId) => {
    try {
      setLoading((prev) => ({ ...prev, [`remessa_preview_${remessaId}`]: true }));
      const r = await api.get(`/relatorios/dabb-remessa-bimestral/remessas/${remessaId}/previa`);
      aplicarPreviaDabbNaTela(r.data);
      toast.success(`Remessa ${r.data?.arquivo_nome || ''} carregada.`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao carregar remessa salva'));
    } finally {
      setLoading((prev) => ({ ...prev, [`remessa_preview_${remessaId}`]: false }));
    }
  };

  const baixarRemessaDabbPorId = async (remessa) => {
    await download(
      `remessa_arquivo_${remessa.id}`,
      `/relatorios/dabb-remessa-bimestral/remessas/${remessa.id}/arquivo`,
      remessa.arquivo_nome || `dabb_remessa_${mes}.rem`,
      {},
      () => {
        const data = remessa.created_at ? new Date(remessa.created_at).toLocaleString('pt-BR') : 'data nao informada';
        toast.success(`Arquivo ${remessa.arquivo_nome} disponibilizado. Geracao original: ${data}.`);
      },
    );
  };

  const baixarRemessaCorrigidaSelecionada = async () => {
    if (!remessaSelecionadaId) {
      toast.error('Selecione uma remessa salva primeiro.');
      return;
    }
    const remessa = remessasDabb.find((item) => item.id === remessaSelecionadaId);
    await download(
      `remessa_corrigida_${remessaSelecionadaId}`,
      `/relatorios/dabb-remessa-bimestral/remessas/${remessaSelecionadaId}/arquivo`,
      remessa?.arquivo_nome || `dabb_remessa_${mes}.rem`,
      { recalcular: true },
      () => {
        toast.success('Arquivo corrigido gerado a partir da remessa selecionada.');
      },
    );
  };

  const gerarOuRecuperarRemessa = async () => {
    await download(
      'dabb_remessa_bimestral',
      '/relatorios/dabb-remessa-bimestral',
      `dabb_remessa_${mes}.rem`,
      { mes_referencia: mes, data_debito: normalizarDataDabb(dataDebitoDabb), incluir_atrasados: incluirAtrasadosDabb },
      async (r) => {
        const recuperada = String(r.headers?.['x-remessa-recuperada'] || '').toLowerCase() === 'true';
        const geradaEm = r.headers?.['x-remessa-gerada-em'];
        if (recuperada && geradaEm) {
          toast.success(`Arquivo REM ja existia desde ${new Date(geradaEm).toLocaleString('pt-BR')} e foi disponibilizado novamente.`);
        } else if (recuperada) {
          toast.success('Arquivo REM ja existia e foi disponibilizado novamente.');
        } else {
          toast.success('Arquivo REM gerado com sucesso.');
        }
        await carregarArquivosRemessa();
      },
    );
  };

  const exportarPreviaDabbExcel = async () => {
    await download(
      'previa_dabb_excel',
      '/relatorios/dabb-remessa-bimestral/previa.xlsx',
      `previa_dabb_${mes}.xlsx`,
      { mes_referencia: mes, data_debito: normalizarDataDabb(dataDebitoDabb), incluir_atrasados: incluirAtrasadosDabb },
    );
  };

  const salvarPreviaDabbPdf = () => {
    if (!previaDabb) {
      toast.error('Carregue uma previa primeiro.');
      return;
    }

    const linhas = itensPreviaDabb.map((item) => `
      <tr>
        <td>${item.nome || ''}</td>
        <td>${item.matricula || ''}</td>
        <td>${item.codigo_dabb || ''}</td>
        <td>${(item.competencias || []).join(', ')}</td>
        <td>${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor_mensalidade_dabb || 0)}</td>
        <td>${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.taxa_bancaria || 0)}</td>
        <td>${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor_total || 0)}</td>
      </tr>
    `).join('');

    const popup = window.open('', '_blank', 'width=1200,height=900');
    if (!popup) {
      toast.error('O navegador bloqueou a janela de impressao.');
      return;
    }

    popup.document.write(`
      <html>
        <head>
          <title>Previa Remessa DABB</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #1f2937; }
            h1 { font-size: 20px; margin-bottom: 8px; }
            .meta { margin-bottom: 16px; font-size: 13px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; vertical-align: top; }
            th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <h1>Previa da Remessa DABB</h1>
          <div class="meta">
            <div><strong>Periodo:</strong> ${previaDabb.mes_inicio} a ${previaDabb.mes_fim}</div>
            <div><strong>Data debito:</strong> ${previaDabb.data_debito}</div>
            <div><strong>Associados:</strong> ${previaDabb.quantidade_associados}</div>
            <div><strong>Competencias:</strong> ${previaDabb.quantidade_competencias}</div>
            <div><strong>Valor total:</strong> ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(previaDabb.valor_total || 0)}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Matricula</th>
                <th>Codigo DABB</th>
                <th>Competencias</th>
                <th>Valor Mensal</th>
                <th>Taxa</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>${linhas}</tbody>
          </table>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const atualizarEdicaoDabb = (membroId, campo, valor) => {
    setEdicoesDabb((prev) => ({
      ...prev,
      [membroId]: {
        ...(prev[membroId] || {}),
        [campo]: valor,
      },
    }));
  };

  const salvarConfiguracaoDabb = async (item) => {
    const draft = edicoesDabb[item.membro_id] || {};
    try {
      await api.put(`/membros/${item.membro_id}`, {
        dabb_habilitado: draft.dabb_habilitado !== false,
        dabb_valor_mensalidade: draft.dabb_valor_mensalidade === '' || draft.dabb_valor_mensalidade == null
          ? null
          : Number(draft.dabb_valor_mensalidade),
      });
      toast.success(`Configuracao DABB salva para ${item.nome}.`);
      if (origemPreviaDabb === 'remessa_salva' && remessaSelecionadaId) {
        await carregarRemessaDabbPorId(remessaSelecionadaId);
      } else {
        await carregarPreviaDabb();
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao salvar configuracao DABB'));
    }
  };

  const salvarTodasConfiguracoesDabb = async () => {
    const itens = Array.isArray(previaDabb?.itens) ? previaDabb.itens : [];
    if (itens.length === 0) {
      toast.error('Nao ha itens na previa para salvar.');
      return;
    }

    setSalvandoTodosDabb(true);
    let sucesso = 0;
    try {
      for (const item of itens) {
        const draft = edicoesDabb[item.membro_id];
        if (!draft) continue;
        await api.put(`/membros/${item.membro_id}`, {
          dabb_habilitado: draft.dabb_habilitado !== false,
          dabb_valor_mensalidade: draft.dabb_valor_mensalidade === '' || draft.dabb_valor_mensalidade == null
            ? null
            : Number(draft.dabb_valor_mensalidade),
        });
        sucesso += 1;
      }
      toast.success(`${sucesso} configuracao(oes) DABB salvas.`);
      if (origemPreviaDabb === 'remessa_salva' && remessaSelecionadaId) {
        await carregarRemessaDabbPorId(remessaSelecionadaId);
      } else {
        await carregarPreviaDabb();
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao salvar configuracoes DABB'));
    } finally {
      setSalvandoTodosDabb(false);
    }
  };

  const salvarConfiguracoesDabb = async () => {
    try {
      await api.put('/configuracoes/dabb', {
        valor_mensal_padrao: Number(configDabb.valor_mensal_padrao),
        taxa_bancaria_bimestral: Number(configDabb.taxa_bancaria_bimestral),
        aplicar_reajuste_todos: aplicarReajusteTodos,
        somente_habilitados_dabb: somenteHabilitadosReajuste,
      });
      const hist = await api.get('/configuracoes/dabb/historico');
      setHistoricoDabbConfig(Array.isArray(hist.data) ? hist.data : []);
      toast.success(aplicarReajusteTodos ? 'Configuracao salva e reajuste aplicado.' : 'Configuracao DABB salva.');
      if (previaDabb) await carregarPreviaDabb();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao salvar configuracao DABB'));
    }
  };

  const limparHistoricoDabbConfig = async () => {
    if (!window.confirm('Deseja realmente limpar todo o historico de reajustes DABB?')) return;
    try {
      setLoading((prev) => ({ ...prev, limpar_historico_dabb: true }));
      await api.delete('/configuracoes/dabb/historico');
      setHistoricoDabbConfig([]);
      toast.success('Historico de reajustes DABB limpo.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao limpar historico DABB'));
    } finally {
      setLoading((prev) => ({ ...prev, limpar_historico_dabb: false }));
    }
  };

  const copiarTexto = async (texto, rotulo = 'Texto') => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success(`${rotulo} copiado.`);
    } catch {
      toast.error(`Nao foi possivel copiar ${rotulo.toLowerCase()}.`);
    }
  };

  const excluirRemessaDabb = async (remessa) => {
    const confirmar = window.confirm(`Deseja excluir a remessa ${remessa.arquivo_nome} da lista de arquivos gerados?`);
    if (!confirmar) return;

    try {
      setLoading((prev) => ({ ...prev, [`remessa_excluir_${remessa.id}`]: true }));
      await api.delete(`/relatorios/dabb-remessa-bimestral/remessas/${remessa.id}`);
      toast.success(`Remessa ${remessa.arquivo_nome} excluida.`);
      if (remessaSelecionadaId === remessa.id) {
        setPreviaDabb(null);
        setRemessaSelecionadaId(null);
        setOrigemPreviaDabb('aberto');
      }
      await carregarArquivosRemessa();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao excluir remessa'));
    } finally {
      setLoading((prev) => ({ ...prev, [`remessa_excluir_${remessa.id}`]: false }));
    }
  };

  const linhaDabbAlterada = (item) => {
    const draft = edicoesDabb[item.membro_id];
    if (!draft) return false;
    const habilitadoAtual = item.dabb_habilitado !== false;
    const valorAtual = item.usa_valor_personalizado ? String(item.valor_mensalidade_dabb ?? '') : '';
    const valorDraft = draft.dabb_valor_mensalidade ?? '';
    return draft.dabb_habilitado !== habilitadoAtual || String(valorDraft) !== String(valorAtual);
  };

  const itensPreviaDabb = useMemo(
    () => (Array.isArray(previaDabb?.itens) ? previaDabb.itens : []).filter((item) => {
      const draft = edicoesDabb[item.membro_id];
      const habilitado = draft ? draft.dabb_habilitado !== false : item.dabb_habilitado !== false;
      const possuiAtraso = Array.isArray(item.competencias)
        ? item.competencias.some((comp) => comp < (previaDabb?.mes_inicio || ''))
        : false;
      if (filtroAlteradosDabb && !linhaDabbAlterada(item)) return false;
      if (filtroHabilitadosDabb && !habilitado) return false;
      if (filtroAtrasoDabb && !possuiAtraso) return false;
      return true;
    }),
    [previaDabb, edicoesDabb, filtroAlteradosDabb, filtroHabilitadosDabb, filtroAtrasoDabb],
  );

  const remessasOrdenadas = useMemo(
    () => [...remessasDabb].sort((a, b) => (b.quantidade_registros || 0) - (a.quantidade_registros || 0) || String(b.created_at || '').localeCompare(String(a.created_at || ''))),
    [remessasDabb],
  );

  return (
    <div>
      <div className="topbar">
        <div className="topbar-title-block">
          <h2>Remessa DABB</h2>
          <span className="topbar-subtitle">Arquivos .rem do Banco do Brasil</span>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24, borderTop: '4px solid #b45309' }}>
        <div className="card-title"><CreditCard size={16} /> Geracao da remessa</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <select className="search-input" value={mes} onChange={(e) => setMes(e.target.value)} style={{ width: '100%' }}>
              {getMeses().map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <input className="search-input" type="date" value={dataDebitoDabb} onChange={(e) => setDataDebitoDabb(e.target.value)} />
            <input
              className="search-input"
              type="number"
              step="0.01"
              value={configDabb.valor_mensal_padrao}
              onChange={(e) => setConfigDabb((prev) => ({ ...prev, valor_mensal_padrao: e.target.value }))}
              placeholder="Mensalidade padrao DABB"
            />
            <input
              className="search-input"
              type="number"
              step="0.01"
              value={configDabb.taxa_bancaria_bimestral}
              onChange={(e) => setConfigDabb((prev) => ({ ...prev, taxa_bancaria_bimestral: e.target.value }))}
              placeholder="Taxa bancaria bimestral"
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#4a5568' }}>
              <input type="checkbox" checked={incluirAtrasadosDabb} onChange={(e) => setIncluirAtrasadosDabb(e.target.checked)} />
              Incluir mensalidades em atraso
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#4a5568' }}>
              <input type="checkbox" checked={aplicarReajusteTodos} onChange={(e) => setAplicarReajusteTodos(e.target.checked)} />
              Aplicar novo valor para todos os associados
            </label>
            {aplicarReajusteTodos && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#4a5568' }}>
                <input type="checkbox" checked={somenteHabilitadosReajuste} onChange={(e) => setSomenteHabilitadosReajuste(e.target.checked)} />
                Reajustar somente habilitados no DABB
              </label>
            )}
          </div>

          <div style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
            <button type="button" className="btn btn-outline" onClick={salvarConfiguracoesDabb}>
              Salvar configuracao
            </button>
            <button type="button" className="btn btn-outline" onClick={carregarPreviaDabb} disabled={loading.previa_dabb}>
              {loading.previa_dabb ? 'Carregando previa...' : 'Ver previa em aberto'}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => carregarArquivosRemessa()} disabled={loading.remessas_refresh}>
              <RefreshCcw size={14} /> Atualizar arquivos gerados
            </button>
            <button type="button" className="btn btn-primary" style={{ background: '#b45309', justifyContent: 'center' }} onClick={gerarOuRecuperarRemessa} disabled={loading.dabb_remessa_bimestral}>
              <Download size={15} />
              {loading.dabb_remessa_bimestral ? 'Processando REM...' : 'Baixar REM'}
            </button>
            <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.7 }}>
              Se um arquivo do bimestre ja existir, ele continuara disponivel na lista abaixo com nome, data e quantidade de registros.
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title"><FileSpreadsheet size={16} /> Arquivos REM ja gerados</div>
        {remessasOrdenadas.length === 0 ? (
          <div style={{ color: '#718096', fontSize: 14 }}>
            Nenhum arquivo REM foi encontrado para o bimestre selecionado.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {remessasOrdenadas.map((remessa, index) => (
              <div key={remessa.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', background: index === 0 ? '#fffaf0' : '#fff' }}>
                <div style={{ display: 'grid', gap: 4 }}>
                  <div style={{ fontWeight: 700, color: '#1e3a5f' }}>{remessa.arquivo_nome}</div>
                  <div style={{ fontSize: 13, color: '#475569' }}>
                    Gerado em {remessa.created_at ? new Date(remessa.created_at).toLocaleString('pt-BR') : '-'} · Debito {remessa.data_debito || '-'} · Registros {remessa.quantidade_registros} · Total {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(remessa.valor_total || 0)}
                  </div>
                  {index === 0 && (
                    <div style={{ fontSize: 12, color: '#9a3412', fontWeight: 600 }}>
                      Arquivo com maior quantidade de registros deste bimestre.
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => copiarTexto(remessa.arquivo_nome, 'Nome do arquivo')}>
                    <Copy size={13} /> Copiar nome
                  </button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => carregarRemessaDabbPorId(remessa.id)} disabled={loading[`remessa_preview_${remessa.id}`]}>
                    {loading[`remessa_preview_${remessa.id}`] ? 'Abrindo...' : 'Ver remessa'}
                  </button>
                  <button type="button" className="btn btn-primary btn-sm" style={{ background: '#1e3a5f' }} onClick={() => baixarRemessaDabbPorId(remessa)} disabled={loading[`remessa_arquivo_${remessa.id}`]}>
                    {loading[`remessa_arquivo_${remessa.id}`] ? 'Baixando...' : 'Baixar arquivo'}
                  </button>
                  <button type="button" className="btn btn-outline btn-sm" style={{ color: '#b91c1c', borderColor: '#fecaca' }} onClick={() => excluirRemessaDabb(remessa)} disabled={loading[`remessa_excluir_${remessa.id}`]}>
                    <Trash2 size={13} /> {loading[`remessa_excluir_${remessa.id}`] ? 'Excluindo...' : 'Excluir'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {historicoDabbConfig.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BookText size={16} /> Historico de reajustes DABB
            </span>
            <button type="button" className="btn btn-outline btn-sm" onClick={limparHistoricoDabbConfig} disabled={loading.limpar_historico_dabb}>
              {loading.limpar_historico_dabb ? 'Limpando...' : 'Limpar historico'}
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Evento</th>
                  <th>Mensalidade</th>
                  <th>Taxa</th>
                  <th>Qtd. afetados</th>
                </tr>
              </thead>
              <tbody>
                {historicoDabbConfig.map((item) => (
                  <tr key={item.id}>
                    <td>{item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : '-'}</td>
                    <td>{item.tipo_evento === 'reajuste_dabb' ? 'Reajuste em lote' : 'Configuracao'}</td>
                    <td>
                      {item.valor_mensal_anterior != null || item.valor_mensal_novo != null
                        ? `${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor_mensal_anterior || 0)} -> ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor_mensal_novo || 0)}`
                        : '-'}
                    </td>
                    <td>
                      {item.taxa_anterior != null || item.taxa_nova != null
                        ? `${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.taxa_anterior || 0)} -> ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.taxa_nova || 0)}`
                        : '-'}
                    </td>
                    <td>{item.quantidade_membros_afetados || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {previaDabb && (
        <div className="card" ref={previaDabbRef}>
          <div className="card-title"><CreditCard size={16} /> Previa da remessa DABB</div>
          {origemPreviaDabb === 'remessa_salva' ? (
            <div style={{ marginBottom: 12, padding: 12, borderRadius: 10, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8' }}>
              Exibindo a remessa salva selecionada.
              {previaDabb.arquivo_nome ? ` Arquivo: ${previaDabb.arquivo_nome}.` : ''}
              {previaDabb.created_at ? ` Gerada em ${new Date(previaDabb.created_at).toLocaleString('pt-BR')}.` : ''}
            </div>
          ) : (
            <div style={{ marginBottom: 12, padding: 12, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569' }}>
              Exibindo os associados com competencias em aberto neste momento.
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: 12, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={exportarPreviaDabbExcel} disabled={loading.previa_dabb_excel}>
              {loading.previa_dabb_excel ? 'Exportando Excel...' : 'Exportar Excel'}
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={salvarPreviaDabbPdf}>
              Salvar em PDF
            </button>
            {origemPreviaDabb === 'remessa_salva' && (
              <button type="button" className="btn btn-outline btn-sm" onClick={baixarRemessaCorrigidaSelecionada} disabled={loading[`remessa_corrigida_${remessaSelecionadaId}`]}>
                {loading[`remessa_corrigida_${remessaSelecionadaId}`] ? 'Gerando corrigido...' : 'Baixar REM corrigido'}
              </button>
            )}
            <button type="button" className="btn btn-primary btn-sm" onClick={salvarTodasConfiguracoesDabb} disabled={salvandoTodosDabb}>
              {salvandoTodosDabb ? 'Salvando tudo...' : 'Salvar todos'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#4a5568' }}>
              <input type="checkbox" checked={filtroAlteradosDabb} onChange={(e) => setFiltroAlteradosDabb(e.target.checked)} />
              So alterados
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#4a5568' }}>
              <input type="checkbox" checked={filtroHabilitadosDabb} onChange={(e) => setFiltroHabilitadosDabb(e.target.checked)} />
              So habilitados
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#4a5568' }}>
              <input type="checkbox" checked={filtroAtrasoDabb} onChange={(e) => setFiltroAtrasoDabb(e.target.checked)} />
              So com atraso
            </label>
            <StatusCounter count={itensPreviaDabb.length} singular="linha visivel" plural="linhas visiveis" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
            <div><strong>Periodo:</strong> {previaDabb.mes_inicio} a {previaDabb.mes_fim}</div>
            <div><strong>Debito:</strong> {previaDabb.data_debito}</div>
            <div><strong>Associados:</strong> {previaDabb.quantidade_associados}</div>
            <div><strong>Competencias:</strong> {previaDabb.quantidade_competencias}</div>
            <div><strong>Total:</strong> {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(previaDabb.valor_total || 0)}</div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Matricula</th>
                  <th>Codigo DABB</th>
                  <th>Competencias</th>
                  <th>Valor mensal</th>
                  <th>Taxa</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {itensPreviaDabb.map((item) => (
                  <tr key={item.membro_id} style={linhaDabbAlterada(item) ? { background: '#fffaf0' } : undefined}>
                    <td>
                      <strong>{item.nome}</strong>
                      <div style={{ fontSize: 12, color: '#718096' }}>
                        Matricula: {item.matricula || '-'} · {item.usa_valor_personalizado ? 'Valor DABB personalizado' : 'Valor padrao da mensalidade'}
                      </div>
                    </td>
                    <td>{item.matricula || '-'}</td>
                    <td>{item.codigo_dabb}</td>
                    <td>{(item.competencias || []).join(', ')}</td>
                    <td>
                      <div style={{ display: 'grid', gap: 6 }}>
                        <select
                          className="search-input"
                          value={(edicoesDabb[item.membro_id]?.dabb_habilitado ?? item.dabb_habilitado) ? 'true' : 'false'}
                          onChange={(e) => atualizarEdicaoDabb(item.membro_id, 'dabb_habilitado', e.target.value === 'true')}
                        >
                          <option value="true">Habilitado</option>
                          <option value="false">Desabilitado</option>
                        </select>
                        <input
                          className="search-input"
                          type="number"
                          step="0.01"
                          value={edicoesDabb[item.membro_id]?.dabb_valor_mensalidade ?? ''}
                          onChange={(e) => atualizarEdicaoDabb(item.membro_id, 'dabb_valor_mensalidade', e.target.value)}
                          placeholder="Usar valor padrao"
                        />
                        <div style={{ fontSize: 12, color: '#718096' }}>
                          Atual: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor_mensalidade_dabb || 0)}
                        </div>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => salvarConfiguracaoDabb(item)}>
                          Salvar
                        </button>
                      </div>
                    </td>
                    <td>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.taxa_bancaria || 0)}</td>
                    <td>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor_total || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
