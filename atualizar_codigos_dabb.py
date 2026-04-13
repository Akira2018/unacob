import unicodedata
import sqlite3
import pdfplumber
import re
import os
import difflib

# Caminhos dos arquivos
PDF_PATH = "BB-DA-remessa-27-02-2026.pdf"
DB_PATH = "associacao.db"

# Função para extrair pares (nome, identificacao) do PDF

def extrair_pares_pdf(pdf_path):
    pares = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            texto = page.extract_text()
            # Regex para capturar Nome e Identificação P/débito
            padrao = re.compile(r"Nome[. ]*:\s*(.*?)\nIdentificação P/débito:\s*(\d+)", re.MULTILINE)
            for nome, identificacao in padrao.findall(texto):
                pares.append((nome.strip(), identificacao.strip()))
    return pares

# Função para atualizar o banco de dados
def atualizar_codigos_dabb(db_path, pares):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    not_found = []
    atualizados = 0
    # Função para padronizar nomes (remover acentos e deixar maiúsculo)
    def padroniza_nome(nome):
        if not nome:
            return ""
        return unicodedata.normalize('NFKD', nome).encode('ASCII', 'ignore').decode('ASCII').upper().strip()

    # Buscar todos os nomes do banco uma vez só
    cur.execute("SELECT nome_completo FROM membros")
    nomes_banco = [row[0] for row in cur.fetchall()]
    nomes_banco_padronizados = [padroniza_nome(n) for n in nomes_banco]

    for nome, codigo in pares:
        nome_pad = padroniza_nome(nome)
        melhor_match = difflib.get_close_matches(nome_pad, nomes_banco_padronizados, n=1, cutoff=0.7)
        if melhor_match:
            idx = nomes_banco_padronizados.index(melhor_match[0])
            nome_banco = nomes_banco[idx]
            print(f"Atualizando: '{nome_banco}' (banco) <- '{nome}' (pdf) com codigo_dabb={codigo}")
            cur.execute("UPDATE membros SET codigo_dabb=? WHERE nome_completo=?", (codigo, nome_banco))
            atualizados += 1
        else:
            not_found.append(nome)
    conn.commit()
    conn.close()
    print(f"Total de membros atualizados: {atualizados}")
    return not_found

if __name__ == "__main__":
    if not os.path.exists(PDF_PATH):
        print(f"Arquivo PDF '{PDF_PATH}' não encontrado.")
        exit(1)
    if not os.path.exists(DB_PATH):
        print(f"Arquivo de banco '{DB_PATH}' não encontrado.")
        exit(1)
    print("Extraindo dados do PDF...")
    pares = extrair_pares_pdf(PDF_PATH)
    print(f"Encontrados {len(pares)} registros no PDF.")
    print("Atualizando banco de dados...")
    not_found = atualizar_codigos_dabb(DB_PATH, pares)
    print("Atualização concluída!")
    if not_found:
        print("Nomes não encontrados na tabela membros:")
        for nome in not_found:
            print("-", nome)
    else:
        print("Todos os nomes do PDF foram encontrados e atualizados.")
