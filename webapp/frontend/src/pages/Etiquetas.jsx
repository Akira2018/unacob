import { useEffect, useState, useCallback, useMemo } from "react";
import api from "../api";
import { Printer } from "lucide-react";
import { getApiErrorMessage } from "../utils/apiError";

export default function Etiquetas() {
  const [membros, setMembros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [membrosSelecionados, setMembrosSelecionados] = useState([]);
  const [cidadeSelecao, setCidadeSelecao] = useState("");
  const [filtros, setFiltros] = useState({
    nome: "",
    cidade: "",
    sexo: "",
    categoria: "",
    semEmail: false,
    semWhatsapp: false
  });

  const buscarMembros = useCallback(async () => {
    setLoading(true);
    setErro("");

    try {
      const response = await api.get("/etiquetas/membros", {
        params: {
          nome: filtros.nome || undefined,
          cidade: filtros.cidade || undefined,
          sexo: filtros.sexo || undefined,
          categoria: filtros.categoria || undefined,
          sem_email: filtros.semEmail,
          sem_whatsapp: filtros.semWhatsapp
        }
      });

      const lista = response.data.membros || [];
      setMembros(lista);
      setMembrosSelecionados([]);
    } catch (error) {
      console.error("Erro completo:", error);
      console.error("Status:", error.response?.status);
      console.error("Dados:", error.response?.data);
      
      let mensagem = "Erro ao carregar membros. Tente novamente.";
      
      if (error.response?.status === 401) {
        mensagem = "Sessão expirada. Faça login novamente.";
      } else if (error.response?.status === 403) {
        mensagem = "Sem permissão para acessar este recurso.";
      } else if (error.response?.status === 500) {
        mensagem = getApiErrorMessage(error, "Erro no servidor");
      } else if (error.message === "Network Error") {
        mensagem = "Erro de conexão. Verifique a URL do servidor.";
      } else {
        mensagem = getApiErrorMessage(error, mensagem);
      }
      
      setErro(mensagem);
      setMembros([]);
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  useEffect(() => {
    buscarMembros();
  }, [buscarMembros]);

  const cidadesDisponiveis = useMemo(() => {
    const cidades = [...new Set(membros.map((m) => m.cidade).filter(Boolean))];
    return cidades.sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [membros]);

  useEffect(() => {
    if (!cidadeSelecao) {
      return;
    }

    if (!cidadesDisponiveis.includes(cidadeSelecao)) {
      setCidadeSelecao("");
    }
  }, [cidadeSelecao, cidadesDisponiveis]);

  const toggleMembro = (id) => {
    setMembrosSelecionados((prev) =>
      prev.includes(id)
        ? prev.filter((m) => m !== id)
        : [...prev, id]
    );
  };

  const toggleTodos = () => {
    if (membrosSelecionados.length === membros.length) {
      setMembrosSelecionados([]);
    } else {
      setMembrosSelecionados(membros.map((m) => m.id));
    }
  };

  const idsCidadeSelecionada = useMemo(() => {
    if (!cidadeSelecao) {
      return [];
    }

    return membros
      .filter((m) => m.cidade === cidadeSelecao)
      .map((m) => m.id);
  }, [membros, cidadeSelecao]);

  const quantidadeSelecionadaCidade = idsCidadeSelecionada.filter((id) =>
    membrosSelecionados.includes(id)
  ).length;

  const selecionarTodosDaCidade = () => {
    if (!idsCidadeSelecionada.length) {
      return;
    }

    setMembrosSelecionados((prev) => [
      ...new Set([...prev, ...idsCidadeSelecionada])
    ]);
  };

  const desmarcarTodosDaCidade = () => {
    if (!idsCidadeSelecionada.length) {
      return;
    }

    setMembrosSelecionados((prev) =>
      prev.filter((id) => !idsCidadeSelecionada.includes(id))
    );
  };

  const imprimirEtiquetas = () => {
    const lista = membros.filter((m) =>
      membrosSelecionados.includes(m.id)
    );

    if (lista.length === 0) {
      alert("Selecione pelo menos um membro");
      return;
    }

    const janela = window.open("", "_blank");

    janela.document.write(`
      <html>
      <head>
        <title>Etiquetas</title>
        <style>
          @page {
            size: A4;
            margin: 0.5cm;
          }

          body {
            font-family: Arial, sans-serif;
          }

          .etiqueta {
            width: 8.5cm;
            height: 3.5cm;
            border: 1px solid #ccc;
            padding: 10px;
            margin: 5px;
            display: inline-block;
            vertical-align: top;
            box-sizing: border-box;
          }

          strong {
            font-size: 12pt;
          }

          @media print {
            .etiqueta {
              border: none;
            }
          }
        </style>
      </head>
      <body>
        ${lista.map(m => `
          <div class="etiqueta">
            <strong>${m.nome_completo}</strong><br/>
            ${m.endereco || ""}<br/>
            ${m.bairro || ""}<br/>
            ${m.cidade} - ${m.estado || "SP"}<br/>
            ${m.cep ? "CEP: " + m.cep : ""}
          </div>
        `).join("")}
      </body>
      </html>
    `);

    janela.document.close();
    janela.print();
  };

  return (
  <div>

    <div className="section-header">
      <h2>Etiquetas Postais</h2>
      <button className="btn btn-primary" onClick={imprimirEtiquetas}>
        <Printer size={16} />
        Imprimir ({membrosSelecionados.length})
      </button>
    </div>

    <div className="card">

      <div className="filters">
        <div className="form-group" style={{ margin: 0, minWidth: 280, flex: '1 1 360px', maxWidth: 520 }}>
          <label>Nome</label>
          <input
            type="text"
            className="search-input"
            style={{ width: '100%', minHeight: 36, maxHeight: 36 }}
            value={filtros.nome}
            onChange={(e) =>
              setFiltros({ ...filtros, nome: e.target.value })
            }
          />
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label>Cidade</label>
          <input
            type="text"
            className="search-input"
            style={{ minHeight: 36, maxHeight: 36 }}
            value={filtros.cidade}
            onChange={(e) =>
              setFiltros({ ...filtros, cidade: e.target.value })
            }
          />
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label>Sexo</label>
          <select
            className="search-input"
            value={filtros.sexo}
            onChange={(e) =>
              setFiltros({ ...filtros, sexo: e.target.value })
            }
          >
            <option value="">Todos</option>
            <option value="masculino">Masculino</option>
            <option value="feminino">Feminino</option>
          </select>
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label>Categoria</label>
          <select
            className="search-input"
            value={filtros.categoria}
            onChange={(e) =>
              setFiltros({ ...filtros, categoria: e.target.value })
            }
          >
            <option value="">Todas</option>
            <option value="CLT">CLT</option>
            <option value="1711">1711</option>
            <option value="1712">1712</option>
            <option value="Outros">Outros</option>
          </select>
        </div>

        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-light)', alignSelf: 'flex-end', paddingBottom: 8, textTransform: 'uppercase', fontWeight: 600 }}>
          <input
            type="checkbox"
            checked={filtros.semEmail}
            onChange={(e) =>
              setFiltros({ ...filtros, semEmail: e.target.checked })
            }
          />
          Apenas sem Email
        </label>

        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-light)', alignSelf: 'flex-end', paddingBottom: 8, textTransform: 'uppercase', fontWeight: 600 }}>
          <input
            type="checkbox"
            checked={filtros.semWhatsapp}
            onChange={(e) =>
              setFiltros({ ...filtros, semWhatsapp: e.target.checked })
            }
          />
          Apenas sem WhatsApp
        </label>

        <button className="btn btn-primary" onClick={buscarMembros}>
          Buscar
        </button>

        {membros.length > 0 && (
          <button
            className="btn btn-outline btn-sm"
            onClick={toggleTodos}
          >
            {membrosSelecionados.length === membros.length
              ? "Desmarcar Todos"
              : "Selecionar Todos"}
          </button>
        )}
      </div>

      {cidadesDisponiveis.length > 0 && (
        <div className="filters" style={{ marginTop: 0 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Cidade para seleção em lote</label>
            <select
              className="search-input"
              value={cidadeSelecao}
              onChange={(e) => setCidadeSelecao(e.target.value)}
            >
              <option value="">Selecione</option>
              {cidadesDisponiveis.map((cidade) => (
                <option key={cidade} value={cidade}>
                  {cidade}
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn btn-outline btn-sm"
            onClick={selecionarTodosDaCidade}
            disabled={!cidadeSelecao}
          >
            Selecionar cidade
          </button>

          <button
            className="btn btn-outline btn-sm"
            onClick={desmarcarTodosDaCidade}
            disabled={!cidadeSelecao}
          >
            Desmarcar cidade
          </button>
        </div>
      )}
      
      {erro && (
        <div style={{ marginBottom: "12px", padding: "10px", backgroundColor: "#fee", border: "1px solid #fcc", borderRadius: "4px", color: "#c00" }}>
          {erro}
        </div>
      )}

      <div style={{ marginBottom: "12px", fontSize: "13px", color: "var(--text-light)" }}>
        {membros.length} membros encontrados
        {cidadeSelecao && (
          <> · {quantidadeSelecionadaCidade}/{idsCidadeSelecionada.length} selecionados em {cidadeSelecao}</>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "var(--text-light)" }}>
          <div className="spinner"></div>
          <p>Carregando membros...</p>
        </div>
      ) : membros.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px", color: "var(--text-light)" }}>
          Nenhum membro encontrado
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "12px",
            maxHeight: "500px",
            overflowY: "auto"
          }}
        >
          {membros.map((m) => {
            const selecionado = membrosSelecionados.includes(m.id);

            return (
            <div
              key={m.id}
              onClick={() => toggleMembro(m.id)}
              style={{
                border: selecionado
                  ? "2px solid var(--primary-light)"
                  : "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "12px",
                cursor: "pointer",
                background: "var(--card)",
                boxShadow: selecionado
                  ? "0 0 0 1px var(--primary-light), var(--shadow-md)"
                  : "none"
              }}
            >
              {selecionado && (
                <div
                  style={{
                    display: "inline-block",
                    marginBottom: "6px",
                    padding: "2px 8px",
                    borderRadius: "999px",
                    fontSize: "10px",
                    fontWeight: 700,
                    background: "var(--primary)",
                    color: "white",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em"
                  }}
                >
                  Selecionado
                </div>
              )}
              <div style={{ fontWeight: 600, marginBottom: "6px" }}>
                {m.nome_completo}
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-light)", marginBottom: "4px" }}>
                {m.cidade} - {m.estado}
              </div>
              {m.endereco && (
                <div style={{ fontSize: "11px", color: "var(--text-light)", marginBottom: "2px" }}>
                  {m.endereco}
                </div>
              )}
              {m.bairro && (
                <div style={{ fontSize: "11px", color: "var(--text-light)", marginBottom: "2px" }}>
                  {m.bairro}
                </div>
              )}
              <div style={{ fontSize: "11px", color: "var(--text-light)", marginTop: "6px", paddingTop: "6px", borderTop: "1px solid var(--border)" }}>
                {m.telefone && <div>Tel: {m.telefone}</div>}
                {m.celular && <div>Cel: {m.celular}</div>}
                {m.email && <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Email: {m.email}</div>}
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  </div>
);
}
