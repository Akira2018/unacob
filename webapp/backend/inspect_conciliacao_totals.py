import sqlite3
from pathlib import Path


DB_PATH = Path(__file__).resolve().parent / "data" / "associacao.db"


def main() -> None:
    conn = sqlite3.connect(str(DB_PATH))
    cur = conn.cursor()

    cur.execute(
        """
        select count(*), min(valor_extrato), max(valor_extrato), sum(valor_extrato)
        from conciliacoes
        where mes_referencia = '2025-12' and tipo = 'credito'
        """
    )
    print("agg", cur.fetchone())

    cur.execute(
        """
        select id, descricao_extrato, valor_extrato
        from conciliacoes
        where mes_referencia = '2025-12' and tipo = 'credito' and valor_extrato > 1000
        order by valor_extrato desc
        """
    )
    rows = cur.fetchall()
    print("acima_1000", len(rows))
    for row in rows[:50]:
        print(row)

    cur.execute(
        """
        select id, observacoes
        from conciliacoes
        where descricao_extrato = 'Mensalidade DABB 29800170' and valor_extrato > 1000
        """
    )
    for row in cur.fetchall():
        print("obs_id", row[0])
        print(row[1])
        print("-" * 80)

    conn.close()


if __name__ == "__main__":
    main()
