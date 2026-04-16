import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { Download, Save, Search, Trash2 } from 'lucide-react';
import { getApiErrorMessage } from '../utils/apiError';

const MESES = [
  { num: 1, label: 'Jan' }, { num: 2, label: 'Fev' }, { num: 3, label: 'Mar' }, { num: 4, label: 'Abr' },
  { num: 5, label: 'Mai' }, { num: 6, label: 'Jun' }, { num: 7, label: 'Jul' }, { num: 8, label: 'Ago' },
  { num: 9, label: 'Set' }, { num: 10, label: 'Out' }, { num: 11, label: 'Nov' }, { num: 12, label: 'Dez' },
];

const toCurrency = (value) => {
  const num = Number(value || 0);
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(num) ? num : 0);
};

const normalizeNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value || '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

const createEmptyCell = () => ({
  id: null,
  value: '0',
  originalValue: '0',
});

const isCellDirty = (cell) => normalizeNumber(cell?.value) !== normalizeNumber(cell?.originalValue);

const STATUS_LABELS = {
  acima_do_previsto: 'Acima do previsto',
  abaixo_do_previsto: 'Abaixo do previsto',
  no_previsto: 'Dentro do previsto',
  sem_previsao: 'Sem previsão',
  sem_movimento: 'Sem movimento',
};

const STATUS_BADGE_STYLES = {
  acima_do_previsto: { background: '#fed7d7', color: '#9b2c2c' },
  abaixo_do_previsto: { background: '#fef3c7', color: '#92400e' },
  no_previsto: { background: '#c6f6d5', color: '#276749' },
  sem_previsao: { background: '#bee3f8', color: '#2c5282' },
  sem_movimento: { background: '#e2e8f0', color: '#4a5568' },
};

export default function PrevisaoOrcamentaria() {
  const [anoInput, setAnoInput] = useState(new Date().getFullYear());
  const [tipoInput, setTipoInput] = useState('saida');
  const [buscaInput, setBuscaInput] = useState('');
  const [filtros, setFiltros] = useState({
    ano: new Date().getFullYear(),
    tipo: 'saida',
    busca: '',
  });
  const [mesSelecionado, setMesSelecionado] = useState(new Date().getMonth() + 1);
  const [contas, setContas] = useState([]);
  const [grid, setGrid] = useState({});
  const [saving, setSaving] = useState(false);
  const [savingRows, setSavingRows] = useState({});
  const [deletingRows, setDeletingRows] = useState({});
  const [loading, setLoading] = useState(true);
  const [analise, setAnalise] = useState({ resumo: null, itens: [] });
  const [loadingAnalise, setLoadingAnalise] = useState(true);
  const [exporting, setExporting] = useState(false);

  const anos = useMemo(() => {
    const y = new Date().getFullYear();
    return [y - 2, y - 1, y, y + 1, y + 2];
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [contasResp, previsoesResp] = await Promise.all([
        api.get('/contas', { params: { tipo: filtros.tipo, apenas_ativas: true } }),
        api.get('/previsoes-orcamentarias', { params: { ano: filtros.ano, tipo: filtros.tipo } }),
      ]);

      const contasData = Array.isArray(contasResp.data) ? contasResp.data : [];
      const previsoesData = Array.isArray(previsoesResp.data) ? previsoesResp.data : [];

      const nextGrid = {};
      contasData.forEach((conta) => {
        nextGrid[conta.id] = {};
        MESES.forEach((m) => {
          nextGrid[conta.id][m.num] = createEmptyCell();
        });
      });

      previsoesData.forEach((p) => {
        if (!nextGrid[p.conta_id]) return;
        nextGrid[p.conta_id][p.mes] = {
          id: p.id,
          value: String(Number(p.valor_previsto || 0)),
          originalValue: String(Number(p.valor_previsto || 0)),
        };
      });

      setContas(contasData);
      setGrid(nextGrid);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao carregar previsões orçamentárias'));
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const loadAnalise = useCallback(async () => {
    setLoadingAnalise(true);
    try {
      const { data } = await api.get('/previsoes-orcamentarias/analise', {
        params: { ano: filtros.ano, mes: mesSelecionado, tipo: filtros.tipo },
      });
      setAnalise({
        resumo: data?.resumo || null,
        itens: Array.isArray(data?.itens) ? data.itens : [],
      });
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao analisar orçamento do mês'));
      setAnalise({ resumo: null, itens: [] });
    } finally {
      setLoadingAnalise(false);
    }
  }, [filtros.ano, filtros.tipo, mesSelecionado]);

  useEffect(() => {
    const t = setTimeout(loadAnalise, 0);
    return () => clearTimeout(t);
  }, [loadAnalise]);

  const handleBuscar = () => {
    setFiltros((prev) => ({ ...prev, busca: buscaInput.trim().toLowerCase() }));
  };

  const handleLimpar = () => {
    const anoSelecionado = anoInput;
    setTipoInput('saida');
    setBuscaInput('');
    setFiltros({ ano: anoSelecionado, tipo: 'saida', busca: '' });
  };

  const setValor = (contaId, mes, value) => {
    setGrid((prev) => ({
      ...prev,
      [contaId]: {
        ...(prev[contaId] || {}),
        [mes]: {
          ...(prev?.[contaId]?.[mes] || createEmptyCell()),
          value,
        },
      },
    }));
  };

  const salvar = async () => {
    const upsertPayload = [];
    const deleteRequests = [];

    contas.forEach((conta) => {
      MESES.forEach((m) => {
        const cell = grid?.[conta.id]?.[m.num];
        if (!isCellDirty(cell)) return;

        const valor = normalizeNumber(cell?.value);
        if (valor === 0 && cell?.id) {
          deleteRequests.push(api.delete(`/previsoes-orcamentarias/${cell.id}`));
          return;
        }

        if (valor !== 0) {
          upsertPayload.push({
            conta_id: conta.id,
            ano: filtros.ano,
            mes: m.num,
            valor_previsto: valor,
          });
        }
      });
    });

    if (upsertPayload.length === 0 && deleteRequests.length === 0) {
      toast('Não há alterações pendentes para salvar.');
      return;
    }

    setSaving(true);
    try {
      if (upsertPayload.length > 0) {
        await api.post('/previsoes-orcamentarias/upsert-lote', upsertPayload);
      }
      if (deleteRequests.length > 0) {
        await Promise.all(deleteRequests);
      }
      toast.success('Previsões salvas com sucesso');
      load();
      loadAnalise();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao salvar previsões'));
    } finally {
      setSaving(false);
    }
  };

  const salvarLinha = async (contaId) => {
    const cell = grid?.[contaId]?.[mesSelecionado] || createEmptyCell();
    const rowKey = `${contaId}:${mesSelecionado}`;
    const valor = normalizeNumber(cell.value);

    if (!isCellDirty(cell)) {
      toast('Essa conta não tem alteração pendente neste mês.');
      return;
    }

    setSavingRows((prev) => ({ ...prev, [rowKey]: true }));
    try {
      if (valor === 0 && cell.id) {
        await api.delete(`/previsoes-orcamentarias/${cell.id}`);
        toast.success('Valor removido com sucesso.');
      } else if (valor !== 0) {
        await api.post('/previsoes-orcamentarias/upsert-lote', [{
          conta_id: contaId,
          ano: filtros.ano,
          mes: mesSelecionado,
          valor_previsto: valor,
        }]);
        toast.success('Valor salvo com sucesso.');
      }
      load();
      loadAnalise();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao salvar valor'));
    } finally {
      setSavingRows((prev) => ({ ...prev, [rowKey]: false }));
    }
  };

  const limparLinha = async (contaId) => {
    const cell = grid?.[contaId]?.[mesSelecionado] || createEmptyCell();
    const rowKey = `${contaId}:${mesSelecionado}`;

    if (!cell.id && normalizeNumber(cell.value) === 0) {
      setValor(contaId, mesSelecionado, '0');
      toast('Esse valor já está zerado.');
      return;
    }

    setDeletingRows((prev) => ({ ...prev, [rowKey]: true }));
    try {
      if (cell.id) {
        await api.delete(`/previsoes-orcamentarias/${cell.id}`);
        toast.success('Valor excluído com sucesso.');
        load();
        loadAnalise();
      } else {
        setValor(contaId, mesSelecionado, '0');
        toast.success('Valor zerado. Clique em Salvar para gravar.');
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao excluir valor'));
    } finally {
      setDeletingRows((prev) => ({ ...prev, [rowKey]: false }));
    }
  };

  const contasFiltradas = useMemo(() => {
    const termo = (filtros.busca || '').trim();
    if (!termo) return contas;
    return contas.filter((conta) =>
      [conta.codigo, conta.nome]
        .filter(Boolean)
        .some((valor) => String(valor).toLowerCase().includes(termo))
    );
  }, [contas, filtros.busca]);

  const totalMesSelecionado = useMemo(() => {
    return contasFiltradas.reduce((sum, c) => sum + normalizeNumber(grid?.[c.id]?.[mesSelecionado]?.value), 0);
  }, [contasFiltradas, grid, mesSelecionado]);

  const analiseMap = useMemo(() => {
    const map = {};
    (Array.isArray(analise.itens) ? analise.itens : []).forEach((item) => {
      map[item.conta_id] = item;
    });
    return map;
  }, [analise.itens]);

  const baixarRelatorio = async () => {
    setExporting(true);
    try {
      const response = await api.get('/relatorios/previsao-orcamentaria', {
        params: { ano: filtros.ano, mes: mesSelecionado, tipo: filtros.tipo },
        responseType: 'blob',
      });
      const blobUrl = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `previsao_orcamentaria_${filtros.ano}_${String(mesSelecionado).padStart(2, '0')}.xlsx`;
      a.click();
      URL.revokeObjectURL(blobUrl);
      toast.success('Relatório gerado com sucesso.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao gerar relatório da previsão orçamentária'));
    } finally {
      setExporting(false);
    }
  };

  const mesSelecionadoLabel = MESES.find((m) => m.num === mesSelecionado)?.label || '';
  const totalAlteracoesPendentes = useMemo(() => {
    let total = 0;
    Object.values(grid || {}).forEach((meses) => {
      Object.values(meses || {}).forEach((cell) => {
        if (isCellDirty(cell)) total += 1;
      });
    });
    return total;
  }, [grid]);

  return (
    <div>
      <div className="topbar">
        <div>
          <h2>Previsão Orçamentária</h2>
          <div style={{ fontSize: 13, color: '#718096', marginTop: 4 }}>
            {totalAlteracoesPendentes > 0
              ? `${totalAlteracoesPendentes} alteração(ões) pendente(s)`
              : 'Nenhuma alteração pendente'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={baixarRelatorio} disabled={exporting}>
            <Download size={15} /> {exporting ? 'Gerando...' : 'Baixar Relatório'}
          </button>
          <button className="btn btn-primary" onClick={salvar} disabled={saving || loading}>
            <Save size={15} /> {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>

      <div className="filters">
        <div className="form-group" style={{ margin: 0 }}>
          <label>Ano</label>
          <select
            className="search-input"
            value={anoInput}
            onChange={(e) => {
              const novoAno = parseInt(e.target.value, 10);
              setAnoInput(novoAno);
              setFiltros((prev) => ({ ...prev, ano: novoAno }));
            }}
          >
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label>Tipo de Conta</label>
          <select
            className="search-input"
            value={tipoInput}
            onChange={(e) => {
              const novoTipo = e.target.value;
              setTipoInput(novoTipo);
              setFiltros((prev) => ({ ...prev, tipo: novoTipo }));
            }}
          >
            <option value="saida">Saídas</option>
            <option value="entrada">Entradas</option>
          </select>
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label>Mês</label>
          <select className="search-input" value={mesSelecionado} onChange={(e) => setMesSelecionado(parseInt(e.target.value, 10))}>
            {MESES.map((m) => <option key={m.num} value={m.num}>{m.label}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0, minWidth: 240 }}>
          <label>Buscar conta</label>
          <input
            className="search-input"
            placeholder="Código ou nome da conta"
            value={buscaInput}
            onChange={(e) => setBuscaInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleBuscar();
              }
            }}
          />
        </div>
        <div style={{ alignSelf: 'flex-end' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline" onClick={handleBuscar}>
              <Search size={15} /> Buscar
            </button>
            <button className="btn btn-outline" onClick={handleLimpar}>
              Limpar
            </button>
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card blue">
          <div className="stat-label">Previsto no mês</div>
          <div className="stat-value stat-value-compact">{toCurrency(analise.resumo?.total_previsto || 0)}</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Realizado no mês</div>
          <div className="stat-value stat-value-compact">{toCurrency(analise.resumo?.total_realizado || 0)}</div>
        </div>
        <div className={`stat-card ${Number(analise.resumo?.total_desvio || 0) > 0 ? 'yellow' : 'purple'}`}>
          <div className="stat-label">Desvio consolidado</div>
          <div className="stat-value stat-value-compact">{toCurrency(analise.resumo?.total_desvio || 0)}</div>
        </div>
        <div className="stat-card red">
          <div className="stat-label">Itens com ação</div>
          <div className="stat-value">{loadingAnalise ? '...' : (analise.resumo?.quantidade_alertas || 0)}</div>
          <div className="stat-sub">{loadingAnalise ? '' : `${analise.resumo?.quantidade_sem_previsao || 0} sem previsão cadastrada`}</div>
        </div>
      </div>

      <div className="card">
        {loading || loadingAnalise ? <div className="spinner" /> : (
          <div className="table-wrap">
            <table style={{ width: 'auto', minWidth: 1380 }}>
              <colgroup>
                <col style={{ width: 360 }} />
                <col style={{ width: 140 }} />
                <col style={{ width: 160 }} />
                <col style={{ width: 160 }} />
                <col style={{ width: 160 }} />
                <col style={{ width: 170 }} />
                <col style={{ width: 420 }} />
                <col style={{ width: 220 }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Conta</th>
                  <th style={{ textAlign: 'left', paddingLeft: 12 }}>Previsto {mesSelecionadoLabel}</th>
                  <th>Realizado</th>
                  <th>Desvio</th>
                  <th>Execução</th>
                  <th>Status</th>
                  <th>Ação recomendada</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {contasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 30, color: '#718096' }}>
                      Nenhuma conta encontrada para o filtro informado
                    </td>
                  </tr>
                ) : contasFiltradas.map((conta) => {
                  const cell = grid?.[conta.id]?.[mesSelecionado] || createEmptyCell();
                  const itemAnalise = analiseMap[conta.id] || null;
                  const rowKey = `${conta.id}:${mesSelecionado}`;
                  const dirty = isCellDirty(cell);
                  const status = itemAnalise?.status || 'sem_movimento';
                  const statusStyle = STATUS_BADGE_STYLES[status] || STATUS_BADGE_STYLES.sem_movimento;
                  const percentual = itemAnalise?.percentual_execucao;

                  return (
                    <tr key={conta.id}>
                      <td><strong>{conta.codigo}</strong> - {conta.nome}</td>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="number"
                          step="0.01"
                          value={cell.value ?? '0'}
                          onChange={(e) => setValor(conta.id, mesSelecionado, e.target.value)}
                          style={{ width: 150, textAlign: 'center', borderColor: dirty ? '#d69e2e' : undefined, background: dirty ? '#fffaf0' : undefined }}
                        />
                      </td>
                      <td>{toCurrency(itemAnalise?.valor_realizado || 0)}</td>
                      <td style={{ color: Number(itemAnalise?.desvio || 0) > 0 ? '#c53030' : '#2f855a', fontWeight: 600 }}>
                        {toCurrency(itemAnalise?.desvio || 0)}
                      </td>
                      <td>{percentual == null ? '-' : `${percentual.toFixed(2)}%`}</td>
                      <td>
                        <span className="badge" style={statusStyle}>
                          {STATUS_LABELS[status] || STATUS_LABELS.sem_movimento}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: '#4a5568', lineHeight: 1.5 }}>
                        {itemAnalise?.acao_recomendada || 'Sem ação sugerida.'}
                      </td>
                      <td className="table-actions-cell">
                        <div className="table-actions">
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => salvarLinha(conta.id)}
                            disabled={savingRows[rowKey] || deletingRows[rowKey] || !dirty}
                          >
                            <Save size={13} /> {savingRows[rowKey] ? 'Salvando...' : 'Salvar'}
                          </button>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => limparLinha(conta.id)}
                            disabled={savingRows[rowKey] || deletingRows[rowKey]}
                            title={cell.id ? 'Excluir valor salvo' : 'Zerar valor digitado'}
                          >
                            <Trash2 size={13} /> {deletingRows[rowKey] ? 'Excluindo...' : (cell.id ? 'Excluir' : 'Limpar')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {contasFiltradas.length > 0 && (
                <tfoot>
                  <tr>
                    <td style={{ fontWeight: 700 }}>TOTAL {mesSelecionadoLabel.toUpperCase()}</td>
                    <td style={{ fontWeight: 700 }}>{toCurrency(totalMesSelecionado)}</td>
                    <td style={{ fontWeight: 700 }}>{toCurrency(analise.resumo?.total_realizado || 0)}</td>
                    <td style={{ fontWeight: 700 }}>{toCurrency(analise.resumo?.total_desvio || 0)}</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td className="table-actions-cell"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
