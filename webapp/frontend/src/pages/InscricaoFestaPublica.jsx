import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getPublicApiErrorMessage } from '../utils/apiError';

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
const defaultPoliticaPreco = {
  cortesia_acompanhantes: 1,
  idade_gratis_ate: 5,
  idade_meia_de: 6,
  idade_meia_ate: 10,
  percentual_meia: 50,
};

export default function InscricaoFestaPublica() {
  const { festaId } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [identificando, setIdentificando] = useState(false);
  const [festa, setFesta] = useState(null);
  const [dados, setDados] = useState(null);
  const [credenciais, setCredenciais] = useState({ matricula: '', cpf: '' });
  const [form, setForm] = useState({
    levar_dependente: false,
    nome_dependente: '',
    faixa_dependente: '',
    parentesco: '',
    levar_convidado: false,
    nome_convidado: '',
    faixa_convidado: '',
    observacoes: '',
  });

  const politicaPreco = useMemo(() => {
    const src = festa?.politica_preco || {};
    return {
      cortesia_acompanhantes: Number.isFinite(Number(src.cortesia_acompanhantes)) ? Math.max(0, Number(src.cortesia_acompanhantes)) : defaultPoliticaPreco.cortesia_acompanhantes,
      idade_gratis_ate: Number.isFinite(Number(src.idade_gratis_ate)) ? Math.max(0, Number(src.idade_gratis_ate)) : defaultPoliticaPreco.idade_gratis_ate,
      idade_meia_de: Number.isFinite(Number(src.idade_meia_de)) ? Math.max(0, Number(src.idade_meia_de)) : defaultPoliticaPreco.idade_meia_de,
      idade_meia_ate: Number.isFinite(Number(src.idade_meia_ate)) ? Math.max(0, Number(src.idade_meia_ate)) : defaultPoliticaPreco.idade_meia_ate,
      percentual_meia: Number.isFinite(Number(src.percentual_meia)) ? Math.min(100, Math.max(0, Number(src.percentual_meia))) : defaultPoliticaPreco.percentual_meia,
    };
  }, [festa]);

  const opcoesFaixaEtaria = useMemo(() => {
    return [
      { value: 'adulto', label: 'Adulto' },
      { value: 'crianca_gratis', label: `Criança até ${politicaPreco.idade_gratis_ate} anos` },
      { value: 'crianca_meia', label: `Criança de ${politicaPreco.idade_meia_de} a ${politicaPreco.idade_meia_ate} anos` },
      { value: 'crianca_acima_meia', label: `Acima de ${politicaPreco.idade_meia_ate} anos` },
    ];
  }, [politicaPreco]);

  const idadeRepresentativaPorFaixa = faixa => {
    if (!faixa) return null;
    if (faixa === 'crianca_gratis') return politicaPreco.idade_gratis_ate;
    if (faixa === 'crianca_meia') return politicaPreco.idade_meia_de;
    if (faixa === 'crianca_acima_meia') return politicaPreco.idade_meia_ate + 1;
    return 30;
  };

  const valorTotal = useMemo(() => {
    if (!festa) return 0;
    const valorBase = Number(festa?.valor_convite || 0);
    const valorPorFaixa = faixa => {
      if (!faixa) return valorBase;
      if (faixa === 'crianca_gratis') return 0;
      if (faixa === 'crianca_meia') return valorBase * (politicaPreco.percentual_meia / 100);
      return valorBase;
    };

    const levouDependente = !!form.levar_dependente;
    const levouConvidado = !!form.levar_convidado;
    let valorDependente = levouDependente ? valorPorFaixa(form.faixa_dependente) : 0;
    let valorConvidado = levouConvidado ? valorPorFaixa(form.faixa_convidado) : 0;

    let cortesias = politicaPreco.cortesia_acompanhantes;
    if (levouDependente && cortesias > 0) {
      valorDependente = 0;
      cortesias -= 1;
    }
    if (levouConvidado && cortesias > 0) {
      valorConvidado = 0;
      cortesias -= 1;
    }

    return valorDependente + valorConvidado;
  }, [festa, politicaPreco, form.levar_dependente, form.levar_convidado, form.faixa_dependente, form.faixa_convidado]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/public/festas/${festaId}`);
        const data = await r.json();
        if (!r.ok) throw new Error(getPublicApiErrorMessage(data, 'Link inválido ou festa não encontrada'));
        if (!active) return;
        setFesta(data?.festa || null);
      } catch (e) {
        toast.error(e?.message ? e.message : 'Não foi possível abrir o convite');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [festaId]);

  const preencherFormulario = (data) => {
    setDados(data);
    setFesta(data?.festa || null);
    setForm({
      levar_dependente: !!data?.inscricao?.dependente?.nome_dependente,
      nome_dependente: data?.inscricao?.dependente?.nome_dependente || '',
      faixa_dependente: '',
      parentesco: data?.inscricao?.dependente?.parentesco || '',
      levar_convidado: !!data?.inscricao?.convidado?.nome_convidado,
      nome_convidado: data?.inscricao?.convidado?.nome_convidado || '',
      faixa_convidado: '',
      observacoes: data?.inscricao?.titular?.observacoes || '',
    });
  };

  const identificarMembro = async (e) => {
    e?.preventDefault();
    if (!credenciais.matricula.trim() || !credenciais.cpf.trim()) {
      toast.error('Informe matrícula e CPF');
      return;
    }

    setIdentificando(true);
    try {
      const r = await fetch(`/api/public/festas/${festaId}/identificar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credenciais),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(getPublicApiErrorMessage(data, 'Dados inválidos'));
      preencherFormulario(data);
      toast.success('Membro identificado com sucesso');
    } catch (e) {
      toast.error(e?.message ? e.message : 'Não foi possível identificar o membro');
    } finally {
      setIdentificando(false);
    }
  };

  const setF = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const setC = (k, v) => setCredenciais(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async e => {
    e.preventDefault();
    if (!dados?.membro) {
      toast.error('Identifique-se com matrícula e CPF antes de confirmar');
      return;
    }

    if (form.levar_dependente && !form.nome_dependente.trim()) {
      toast.error('Informe o nome do dependente');
      return;
    }

    if (form.levar_dependente && !form.faixa_dependente) {
      toast.error('Selecione a faixa etária do dependente');
      return;
    }

    if (form.levar_convidado && !form.nome_convidado.trim()) {
      toast.error('Informe o nome do convidado');
      return;
    }

    if (form.levar_convidado && !form.faixa_convidado) {
      toast.error('Selecione a faixa etária do convidado');
      return;
    }

    setSaving(true);
    try {
      const r = await fetch(`/api/public/festas/${festaId}/confirmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          ...credenciais,
          idade_dependente: form.levar_dependente ? idadeRepresentativaPorFaixa(form.faixa_dependente) : null,
          idade_convidado: form.levar_convidado ? idadeRepresentativaPorFaixa(form.faixa_convidado) : null,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(getPublicApiErrorMessage(data, 'Erro ao confirmar participação'));
      toast.success('Participação confirmada com sucesso!');
      await identificarMembro();
    } catch (e) {
      toast.error(e?.message ? e.message : 'Erro ao confirmar participação');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="auth-page" style={{ minHeight: 'calc(100vh - 4rem)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
        <div className="auth-box"><div className="spinner" /></div>
      </div>
    );
  }

  if (!festa) {
    return (
      <div className="auth-page" style={{ minHeight: 'calc(100vh - 4rem)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
        <div className="auth-box">
          <h2 style={{ marginTop: 0 }}>Festa não encontrada</h2>
          <p style={{ color: '#718096' }}>Este link pode estar incorreto ou a festa pode ter sido removida.</p>
        </div>
      </div>
    );
  }

  const membro = dados?.membro;

  return (
    <div className="auth-page" style={{ minHeight: 'calc(100vh - 4rem)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div className="auth-box" style={{ maxWidth: 760, width: '100%', textAlign: 'left', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-lg)', background: 'var(--card)' }}>
        <img
          src="https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=1400&q=80"
          alt="Foto de confraternização"
          style={{ width: '100%', height: 220, objectFit: 'cover', display: 'block' }}
        />
        <div style={{ padding: 24 }}>
        <h2 style={{ marginTop: 0, marginBottom: 6, color: '#1e3a5f' }}>{festa.nome_festa}</h2>
        <p style={{ marginTop: 0, color: '#718096', marginBottom: 20 }}>
          {fmtDataBR(festa.data_festa)} • {festa.local_festa || '-'}
        </p>

        <div style={{ background: '#ecfdf3', border: '1px solid #bbf7d0', color: '#166534', borderRadius: 8, padding: 10, marginBottom: 14, fontSize: 13 }}>
          <div>• Membro + {politicaPreco.cortesia_acompanhantes} {politicaPreco.cortesia_acompanhantes === 1 ? 'acompanhante' : 'acompanhantes'}: GRATUITO;</div>
          <div>• Crianças até {politicaPreco.idade_gratis_ate} anos: GRATUITO;</div>
          <div>• Crianças de {politicaPreco.idade_meia_de} a {politicaPreco.idade_meia_ate} anos: {politicaPreco.percentual_meia}% do valor;</div>
          <div>• Acima de {politicaPreco.idade_meia_ate} anos: valor integral.</div>
        </div>

        {!membro ? (
          <form onSubmit={identificarMembro}>
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Identificação do membro</div>
              <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="form-group">
                  <label>Matrícula *</label>
                  <input value={credenciais.matricula} onChange={e => setC('matricula', e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>CPF *</label>
                  <input value={credenciais.cpf} onChange={e => setC('cpf', e.target.value)} required placeholder="Somente números ou formatado" />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={identificando}>
                {identificando ? 'Validando...' : 'Validar cadastro'}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Membro identificado</div>
              <div style={{ fontSize: 14 }}><strong>Nome:</strong> {membro.nome}</div>
              <div style={{ fontSize: 14 }}><strong>Matrícula:</strong> {membro.matricula || '-'}</div>
              <div style={{ fontSize: 14 }}><strong>E-mail:</strong> {membro.email || '-'}</div>
            </div>

        <form onSubmit={handleSubmit}>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="form-group">
              <label>Titular (grátis)</label>
              <input value={fmt(0)} disabled />
            </div>
            <div className="form-group">
              <label>1º acompanhante (grátis)</label>
              <input value={fmt(0)} disabled />
            </div>

            <div className="form-group form-full" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <input
                type="checkbox"
                id="levar_dependente"
                checked={form.levar_dependente}
                onChange={e => setF('levar_dependente', e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              <label htmlFor="levar_dependente" style={{ textTransform: 'none', fontWeight: 600 }}>Levar dependente</label>
            </div>

            {form.levar_dependente && (
              <>
                <div className="form-group">
                  <label>Nome do dependente *</label>
                  <input value={form.nome_dependente} onChange={e => setF('nome_dependente', e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Faixa etária do dependente *</label>
                  <select value={form.faixa_dependente} onChange={e => setF('faixa_dependente', e.target.value)} required>
                    <option value="">Selecione...</option>
                    {opcoesFaixaEtaria.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Parentesco</label>
                  <input value={form.parentesco} onChange={e => setF('parentesco', e.target.value)} placeholder="Ex: Cônjuge, Filho(a)" />
                </div>
              </>
            )}

            <div className="form-group form-full" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <input
                type="checkbox"
                id="levar_convidado"
                checked={form.levar_convidado}
                onChange={e => setF('levar_convidado', e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              <label htmlFor="levar_convidado" style={{ textTransform: 'none', fontWeight: 600 }}>
                Levar convidado (valor base {fmt(festa.valor_convite)})
              </label>
            </div>

            {form.levar_convidado && (
              <>
                <div className="form-group">
                  <label>Nome do convidado *</label>
                  <input value={form.nome_convidado} onChange={e => setF('nome_convidado', e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Faixa etária do convidado *</label>
                  <select value={form.faixa_convidado} onChange={e => setF('faixa_convidado', e.target.value)} required>
                    <option value="">Selecione...</option>
                    {opcoesFaixaEtaria.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                  </select>
                </div>
              </>
            )}

            <div className="form-group form-full">
              <label>Observações</label>
              <textarea value={form.observacoes} onChange={e => setF('observacoes', e.target.value)} />
            </div>
          </div>

          <div style={{ background: '#f7f8fc', borderRadius: 10, padding: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: '#718096' }}>Total estimado</div>
            <div className="money-value money-value-big" style={{ fontWeight: 700, color: '#1e3a5f' }}>{fmt(valorTotal)}</div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#718096', fontSize: 13 }}>
              {dados?.inscricao?.titular ? 'Você já possui uma inscrição; ao confirmar, ela será atualizada.' : 'Confirme para registrar sua participação.'}
            </span>
            <button type="submit" className="btn btn-primary" disabled={saving || identificando}>
              {saving ? 'Confirmando...' : 'Confirmar participação'}
            </button>
          </div>
        </form>
          </>
        )}
        </div>
      </div>
    </div>
  );
}
