"""Apaga todos os lançamentos financeiros/eventos do ano 2025 do banco.

Mantém intactos: cadastro de associados (membros), usuários, festas e o
histórico de configuração DABB. Faça um backup do arquivo .db antes de rodar
(o app já cria backups em webapp/backend/backups/, mas confira antes).

Uso:
    python limpar_dados_2025.py --db caminho/para/associacao.db [--yes]

Sem --yes, o script só mostra quantos registros seriam apagados (dry-run).
"""
import argparse
import sqlite3
import sys
from pathlib import Path

# (nome_tabela, condição SQL que identifica registros de 2025)
TABELAS_ALVO = [
    ("pagamentos", "mes_referencia LIKE '2025-%' OR strftime('%Y', data_pagamento) = '2025'"),
    ("transacoes", "strftime('%Y', data_transacao) = '2025'"),
    ("despesas", "mes_referencia LIKE '2025-%' OR strftime('%Y', data_despesa) = '2025'"),
    ("outras_rendas", "mes_referencia LIKE '2025-%' OR strftime('%Y', data_recebimento) = '2025'"),
    ("aplicacoes_financeiras", "mes_referencia LIKE '2025-%' OR strftime('%Y', data_aplicacao) = '2025'"),
    ("saldos_mensais", "mes_referencia LIKE '2025-%'"),
    ("previsoes_orcamentarias", "ano = 2025"),
    ("previsoes_orcamentarias_anuais", "ano = 2025"),
    ("conciliacoes", "mes_referencia LIKE '2025-%' OR strftime('%Y', data_extrato) = '2025'"),
    # itens antes das remessas (FK dabb_remessa_itens.remessa_id -> dabb_remessas.id)
    (
        "dabb_remessa_itens",
        "remessa_id IN (SELECT id FROM dabb_remessas WHERE mes_inicio LIKE '2025-%' "
        "OR mes_fim LIKE '2025-%' OR strftime('%Y', data_debito) = '2025')",
    ),
    ("dabb_remessas", "mes_inicio LIKE '2025-%' OR mes_fim LIKE '2025-%' OR strftime('%Y', data_debito) = '2025'"),
]


def contar(cur, tabela, condicao):
    return cur.execute(f"SELECT COUNT(*) FROM {tabela} WHERE {condicao}").fetchone()[0]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", required=True, help="Caminho do arquivo associacao.db")
    parser.add_argument("--yes", action="store_true", help="Executa a exclusão (sem isso, roda em modo dry-run)")
    args = parser.parse_args()

    db_path = Path(args.db)
    if not db_path.exists():
        print(f"Arquivo não encontrado: {db_path}", file=sys.stderr)
        sys.exit(1)

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    print(f"Banco: {db_path}")
    total = 0
    contagens = {}
    for tabela, condicao in TABELAS_ALVO:
        qtd = contar(cur, tabela, condicao)
        contagens[tabela] = qtd
        total += qtd
        print(f"  {tabela}: {qtd} registro(s) de 2025")

    if total == 0:
        print("Nada a apagar.")
        conn.close()
        return

    if not args.yes:
        print(f"\nDRY-RUN: {total} registro(s) seriam apagados. Rode novamente com --yes para confirmar.")
        conn.close()
        return

    try:
        for tabela, condicao in TABELAS_ALVO:
            cur.execute(f"DELETE FROM {tabela} WHERE {condicao}")
        conn.commit()
        cur.execute("VACUUM")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    print(f"\nConcluído: {total} registro(s) de 2025 apagados. Cadastro de associados, festas e histórico DABB preservados.")


if __name__ == "__main__":
    main()
