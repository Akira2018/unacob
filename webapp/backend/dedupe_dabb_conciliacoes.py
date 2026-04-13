import sqlite3
from collections import defaultdict
from pathlib import Path


DB_PATH = Path(__file__).resolve().parent / "data" / "associacao.db"


def choose_keeper(rows):
    def rank(row):
        conc_id, pagamento_id, data_extrato, descricao, valor, tipo, conciliado, created_at = row
        return (
            1 if conciliado else 0,
            1 if pagamento_id else 0,
            created_at or "",
        )

    return sorted(rows, key=rank, reverse=True)[0]


def main() -> None:
    conn = sqlite3.connect(str(DB_PATH))
    cur = conn.cursor()

    cur.execute(
        """
        select id, pagamento_id, data_extrato, descricao_extrato, valor_extrato, tipo, conciliado, created_at
        from conciliacoes
        where descricao_extrato like 'Mensalidade DABB %'
        order by data_extrato asc, descricao_extrato asc, valor_extrato asc, created_at asc
        """
    )
    rows = cur.fetchall()

    groups = defaultdict(list)
    for row in rows:
        conc_id, pagamento_id, data_extrato, descricao, valor, tipo, conciliado, created_at = row
        key = (data_extrato, descricao, float(valor or 0), tipo)
        groups[key].append(row)

    removidos = 0
    pagamentos_removidos = 0
    for key, group in groups.items():
        if len(group) <= 1:
            continue

        keeper = choose_keeper(group)
        keeper_id = keeper[0]
        keeper_pagamento_id = keeper[1]

        for row in group:
            conc_id, pagamento_id, *_rest = row
            if conc_id == keeper_id:
                continue

            if pagamento_id and not keeper_pagamento_id:
                cur.execute(
                    "update conciliacoes set pagamento_id = ?, conciliado = 1 where id = ?",
                    (pagamento_id, keeper_id),
                )
                keeper_pagamento_id = pagamento_id

            if pagamento_id and pagamento_id != keeper_pagamento_id:
                cur.execute("delete from pagamentos where id = ?", (pagamento_id,))
                pagamentos_removidos += cur.rowcount or 0

            cur.execute("delete from conciliacoes where id = ?", (conc_id,))
            removidos += cur.rowcount or 0

    conn.commit()
    conn.close()
    print({"duplicados_removidos": removidos, "pagamentos_removidos": pagamentos_removidos, "db_path": str(DB_PATH)})


if __name__ == "__main__":
    main()
