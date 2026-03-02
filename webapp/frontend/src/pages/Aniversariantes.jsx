import { useCallback, useEffect, useState } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { Cake, Download, Mail, MessageCircle } from 'lucide-react';
import { getApiErrorMessage } from '../utils/apiError';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function Aniversariantes() {
  const [aniversariantes, setAniversariantes] = useState([]);
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const [enviandoEmailId, setEnviandoEmailId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/aniversariantes', { params: { mes } })
      .then(r => setAniversariantes(r.data))
      .catch(error => toast.error(getApiErrorMessage(error, 'Erro ao carregar')))
      .finally(() => setLoading(false));
  }, [mes]);

  useEffect(() => {
    const timerId = setTimeout(load, 0);
    return () => clearTimeout(timerId);
  }, [load]);

  const exportar = async () => {
    const r = await api.get(`/relatorios/aniversariantes?mes=${mes}`, { responseType: 'blob' });
    const url = URL.createObjectURL(r.data);
    const a = document.createElement('a'); a.href = url; a.download = `aniversariantes_mes_${mes}.xlsx`; a.click();
  };

  const whatsappMsg = (aniv) => {
    const msg = `🎂 Parabéns ${aniv.nome}! A UNACOB - União dos aposentados dos correios em Bauru - SP deseja a você um feliz aniversário! Que seu dia seja repleto de alegrias! 🎉`;
    const num = (aniv.celular || '').replace(/\D/g, '');
    if (num) {
      window.open(`https://wa.me/55${num}?text=${encodeURIComponent(msg)}`, '_blank');
    } else {
      navigator.clipboard.writeText(msg);
      toast.success('Mensagem copiada!');
    }
  };

  const emailMsg = async (aniv) => {
    if (!aniv.email) {
      toast.error('Aniversariante sem e-mail cadastrado');
      return;
    }

    try {
      setEnviandoEmailId(aniv.id);
      await api.post('/aniversariantes/enviar-email', {
        email: aniv.email,
        nome: aniv.nome,
      });
      toast.success(`E-mail enviado para ${aniv.nome}`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Erro ao enviar e-mail'));
    } finally {
      setEnviandoEmailId(null);
    }
  };

  const hoje = aniversariantes.filter(a => a.aniversario_hoje);
  const labelAniversariantes = qtd => `${qtd} ${qtd === 1 ? 'aniversariante' : 'aniversariantes'}`;

  return (
    <div>
      <div className="topbar">
        <h2>Aniversariantes</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline btn-sm" onClick={exportar}><Download size={14} /> Excel</button>
        </div>
      </div>

      <div className="filters">
        <div className="form-group" style={{ margin: 0 }}>
          <label>Mês</label>
          <select className="search-input" value={mes} onChange={e => setMes(parseInt(e.target.value))}>
            {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div style={{ alignSelf: 'flex-end', padding: '8px 0', fontSize: 14, color: '#718096' }}>
          {labelAniversariantes(aniversariantes.length)} em {MESES[mes - 1]}
        </div>
      </div>

      {/* Today's birthdays */}
      {hoje.length > 0 && (
        <div className="card" style={{ marginBottom: 20, background: 'linear-gradient(135deg, #1e3a5f, #2d5282)', border: 'none' }}>
          <div className="card-title" style={{ color: '#c8a84b' }}><Cake size={18} /> 🎂 Aniversariantes de Hoje!</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {hoje.map(a => (
              <div key={a.id} style={{ background: 'rgba(255,255,255,.1)', borderRadius: 10, padding: '12px 16px', color: 'white', minWidth: 200 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>🎉 {a.nome}</div>
                <div style={{ fontSize: 13, opacity: .8, marginTop: 2 }}>{a.idade} anos</div>
                <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                  <button className="btn btn-sm" style={{ background: '#25D366', color: 'white', border: 'none' }} onClick={() => whatsappMsg(a)}>
                    <MessageCircle size={13} /> WhatsApp
                  </button>
                  <button className="btn btn-sm" style={{ background: '#1e3a5f', color: 'white', border: 'none' }} onClick={() => emailMsg(a)} disabled={enviandoEmailId === a.id}>
                    <Mail size={13} /> {enviandoEmailId === a.id ? 'Enviando...' : 'E-mail'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All month */}
      {loading ? <div className="spinner" /> : (
        <div className="card">
          <div className="card-title"><Cake size={16} /> {MESES[mes - 1]} — {labelAniversariantes(aniversariantes.length)}</div>
          {aniversariantes.length === 0 ? (
            <div className="empty-state"><Cake size={40} /><p>Sem aniversariantes neste mês</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Dia</th><th>Nome</th><th>Data Nasc.</th><th>Idade</th><th>Email</th><th>Celular</th><th>Ação</th></tr>
                </thead>
                <tbody>
                  {aniversariantes.map(a => (
                    <tr key={a.id} className={a.aniversario_hoje ? 'row-green' : ''}>
                      <td>
                        <span style={{ fontWeight: 700, fontSize: 18, color: '#1e3a5f' }}>
                          {String(a.dia).padStart(2, '0')}
                          {a.aniversario_hoje && ' 🎂'}
                        </span>
                      </td>
                      <td><strong>{a.nome}</strong></td>
                      <td>{a.data_nascimento}</td>
                      <td>{a.idade} anos</td>
                      <td>{a.email || '-'}</td>
                      <td>{a.celular || '-'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-sm" style={{ background: '#25D366', color: 'white', border: 'none' }} onClick={() => whatsappMsg(a)}>
                            <MessageCircle size={13} /> WhatsApp
                          </button>
                          <button className="btn btn-sm" style={{ background: '#1e3a5f', color: 'white', border: 'none' }} onClick={() => emailMsg(a)} disabled={enviandoEmailId === a.id}>
                            <Mail size={13} /> {enviandoEmailId === a.id ? 'Enviando...' : 'E-mail'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
