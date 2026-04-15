import unicodedata
import sqlite3
import pdfplumber
import re
import os
import difflib
import argparse
from pathlib import Path

# Caminhos dos arquivos
BASE_DIR = Path(__file__).resolve().parent
PDF_PATH = BASE_DIR.parent.parent / "BB-DA-retorno-29-12-2025.pdf"
DB_PATH = BASE_DIR / "data" / "associacao.db"

# Função para extrair pares (nome, identificacao) do PDF

def extrair_pares_pdf(pdf_path):
    pares = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            texto = page.extract_text() or ""
            blocos = [bloco.strip() for bloco in re.split(r"_+", texto) if "Nome" in bloco]
            for bloco in blocos:
                nome_match = re.search(r"Nome[.\s]*:\s*(.+)", bloco, re.IGNORECASE)
                codigo_match = re.search(
                    r"Identifica(?:ç|c)(?:a|ã)o\s*P/D[ée]bito\s*:\s*(\d+)|"
                    r"Identificador\s*P/D[ée]bito(?:\s*Atual)?[.\s]*:\s*(\d+)",
                    bloco,
                    re.IGNORECASE,
                )
                if not nome_match or not codigo_match:
                    continue
                nome = (nome_match.group(1) or "").strip()
                codigo = (codigo_match.group(1) or codigo_match.group(2) or "").strip()
                if nome and codigo:
                    pares.append((nome, codigo))
    return pares

# Função para atualizar o banco de dados
def atualizar_codigos_dabb(db_path, pares, only_missing=False):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    not_found = []
    atualizados = 0
    pulados_com_codigo = 0
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
            cur.execute("SELECT codigo_dabb FROM membros WHERE nome_completo=?", (nome_banco,))
            row = cur.fetchone()
            codigo_atual = (row[0] or "").strip() if row else ""
            if only_missing and codigo_atual:
                pulados_com_codigo += 1
                continue

            print(f"Atualizando: '{nome_banco}' (banco) <- '{nome}' (pdf) com codigo_dabb={codigo}")
            cur.execute("UPDATE membros SET codigo_dabb=? WHERE nome_completo=?", (codigo, nome_banco))
            atualizados += 1
        else:
            not_found.append(nome)
    conn.commit()
    conn.close()
    print(f"Total de membros atualizados: {atualizados}")
    if only_missing:
        print(f"Total pulados por já possuírem codigo_dabb: {pulados_com_codigo}")
    return not_found

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Atualiza codigo_dabb na tabela membros a partir de PDF do BB.")
    parser.add_argument("--pdf", default=str(PDF_PATH), help="Caminho do PDF com Nome e Identificação P/débito")
    parser.add_argument("--db", default=str(DB_PATH), help="Caminho do banco SQLite")
    parser.add_argument("--only-missing", action="store_true", help="Atualiza apenas membros sem codigo_dabb preenchido")
    args = parser.parse_args()

    pdf_path = Path(args.pdf)
    db_path = Path(args.db)

    if not pdf_path.exists():
        print(f"Arquivo PDF '{pdf_path}' não encontrado.")
        exit(1)
    if not db_path.exists():
        print(f"Arquivo de banco '{db_path}' não encontrado.")
        exit(1)
    print("Extraindo dados do PDF...")
    pares = extrair_pares_pdf(str(pdf_path))
    print(f"Encontrados {len(pares)} registros no PDF.")
    print("Atualizando banco de dados...")
    not_found = atualizar_codigos_dabb(str(db_path), pares, only_missing=args.only_missing)
    print("Atualização concluída!")
    if not_found:
        print("Nomes não encontrados na tabela membros:")
        for nome in not_found:
            print("-", nome)
    else:
        print("Todos os nomes do PDF foram encontrados e atualizados.")
