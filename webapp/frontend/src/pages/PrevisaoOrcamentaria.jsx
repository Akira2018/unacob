import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { Save, Search } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);

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
          nextGrid[conta.id][m.num] = '0';
        });
      });

      previsoesData.forEach((p) => {
        if (!nextGrid[p.conta_id]) return;
        nextGrid[p.conta_id][p.mes] = String(Number(p.valor_previsto || 0));
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
        [mes]: value,
      },
    }));
  };

  const salvar = async () => {
    setSaving(true);
    try {
      const payload = [];
      contas.forEach((conta) => {
        MESES.forEach((m) => {
          payload.push({
            conta_id: conta.id,
            ano: filtros.ano,
            mes: m.num,
            valor_previsto: normalizeNumber(grid?.[conta.id]?.[m.num]),
          });
        });
      });

      await api.post('/previsoes-orcamentarias/upsert-lote', payload);
      toast.success('Previsões salvas com sucesso');
      load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Erro ao salvar previsões'));
    } finally {
      setSaving(false);
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
    return contasFiltradas.reduce((sum, c) => sum + normalizeNumber(grid?.[c.id]?.[mesSelecionado]), 0);
  }, [contasFiltradas, grid, mesSelecionado]);

  const mesSelecionadoLabel = MESES.find((m) => m.num === mesSelecionado)?.label || '';

  return (
    <div>
      <div className="topbar">
        <h2>Previsão Orçamentária</h2>
        <button className="btn btn-primary" onClick={salvar} disabled={saving || loading}>
          <Save size={15} /> {saving ? 'Salvando...' : 'Salvar Previsões'}
        </button>
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

      <div className="card">
        {loading ? <div className="spinner" /> : (
          <div className="table-wrap">
            <table style={{ width: 'auto', minWidth: 740 }}>
              <colgroup>
                <col style={{ width: 500 }} />
                <col style={{ width: 220 }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Conta</th>
                  <th style={{ textAlign: 'left', paddingLeft: 12 }}>{mesSelecionadoLabel}</th>
                </tr>
              </thead>
              <tbody>
                {contasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={2} style={{ textAlign: 'center', padding: 30, color: '#718096' }}>
                      Nenhuma conta encontrada para o filtro informado
                    </td>
                  </tr>
                ) : contasFiltradas.map((conta) => (
                  <tr key={conta.id}>
                    <td><strong>{conta.codigo}</strong> - {conta.nome}</td>
                    <td style={{ textAlign: 'left', paddingLeft: 12 }}>
                      <input
                        type="number"
                        step="0.01"
                        value={grid?.[conta.id]?.[mesSelecionado] ?? '0'}
                        onChange={(e) => setValor(conta.id, mesSelecionado, e.target.value)}
                        style={{ width: 150 }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              {contasFiltradas.length > 0 && (
                <tfoot>
                  <tr>
                    <td style={{ fontWeight: 700 }}>TOTAL {mesSelecionadoLabel.toUpperCase()}</td>
                    <td style={{ fontWeight: 700 }}>{toCurrency(totalMesSelecionado)}</td>
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
