"""Apaga TODOS os pagamentos de mensalidade (tabela pagamentos) e as
transacoes de origem 'mensalidade' vinculadas - usado para zerar dados de
teste antes de iniciar a producao. Mantém intactos: associados, despesas,
outras receitas, conciliações (apenas desvincula pagamento_id), festas e
histórico de configuração DABB.

Uso:
    python limpar_pagamentos_mensalidade.py --db caminho/para/associacao.db [--yes]
"""
import argparse
import sqlite3
import sys
from pathlib import Path


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
    conn.execute("PRAGMA foreign_keys = ON")
    cur = conn.cursor()

    qtd_pagamentos = cur.execute("SELECT COUNT(*) FROM pagamentos").fetchone()[0]
    qtd_transacoes = cur.execute("SELECT COUNT(*) FROM transacoes WHERE origem = 'mensalidade'").fetchone()[0]
    qtd_conciliacoes_vinculadas = cur.execute(
        "SELECT COUNT(*) FROM conciliacoes WHERE pagamento_id IS NOT NULL"
    ).fetchone()[0]

    print(f"Banco: {db_path}")
    print(f"  pagamentos: {qtd_pagamentos} registro(s)")
    print(f"  transacoes (origem=mensalidade): {qtd_transacoes} registro(s)")
    print(f"  conciliacoes com pagamento_id vinculado (serão apenas desvinculadas): {qtd_conciliacoes_vinculadas}")

    if qtd_pagamentos == 0 and qtd_transacoes == 0:
        print("Nada a apagar.")
        conn.close()
        return

    if not args.yes:
        print("\nDRY-RUN: nada foi apagado. Rode novamente com --yes para confirmar.")
        conn.close()
        return

    try:
        cur.execute("UPDATE conciliacoes SET pagamento_id = NULL WHERE pagamento_id IS NOT NULL")
        cur.execute("DELETE FROM transacoes WHERE origem = 'mensalidade'")
        cur.execute("DELETE FROM pagamentos")
        conn.commit()
        cur.execute("VACUUM")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    print(f"\nConcluído: {qtd_pagamentos} pagamento(s) e {qtd_transacoes} transacao(oes) de mensalidade apagados.")
    print("Associados, despesas, outras receitas, conciliações, festas e histórico DABB preservados.")


if __name__ == "__main__":
    main()
