import sqlite3
from pathlib import Path


DB_PATH = Path(__file__).resolve().parent / "data" / "associacao.db"


def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    consultas = {
        "conc_2026_02": "select count(*), coalesce(sum(valor_extrato),0) from conciliacoes where mes_referencia='2026-02'",
        "desp_2026_02": "select count(*), coalesce(sum(valor),0) from despesas where mes_referencia='2026-02'",
        "pag_2026_02_pago": "select count(*), coalesce(sum(valor_pago),0) from pagamentos where mes_referencia='2026-02' and status_pagamento='pago'",
        "pag_2026_02_total": "select count(*), coalesce(sum(valor_pago),0) from pagamentos where mes_referencia='2026-02'",
        "conc_credito_2026_02": "select count(*), coalesce(sum(valor_extrato),0) from conciliacoes where mes_referencia='2026-02' and tipo='credito'",
        "conc_debito_2026_02": "select count(*), coalesce(sum(valor_extrato),0) from conciliacoes where mes_referencia='2026-02' and tipo='debito'",
    }

    for nome, sql in consultas.items():
        cur.execute(sql)
        print(nome, cur.fetchone())

    print("--- exemplos conciliacao 2026-02 ---")
    cur.execute(
        """
        select data_extrato, descricao_extrato, tipo, valor_extrato, pagamento_id, despesa_id, outra_renda_id, conciliado
        from conciliacoes
        where mes_referencia='2026-02'
        order by data_extrato desc
        limit 12
        """
    )
    for row in cur.fetchall():
        print(row)

    print("--- debitos agrupados ---")
    cur.execute(
        """
        select descricao_extrato, count(*), sum(valor_extrato)
        from conciliacoes
        where mes_referencia='2026-02' and tipo='debito'
        group by descricao_extrato
        order by 2 desc, 1
        """
    )
    for row in cur.fetchall():
        print(row)

    print("--- creditos agrupados ---")
    cur.execute(
        """
        select descricao_extrato, count(*), sum(valor_extrato)
        from conciliacoes
        where mes_referencia='2026-02' and tipo='credito'
        group by descricao_extrato
        order by 2 desc, 1
        """
    )
    for row in cur.fetchall():
        print(row)

    conn.close()


if __name__ == "__main__":
    main()
