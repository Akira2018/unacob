import re
import sqlite3
from datetime import datetime
from pathlib import Path


DB_PATH = Path(__file__).resolve().parent / "data" / "associacao.db"


def parse_correct_value_from_line(line: str) -> float | None:
    match = re.match(r"^(?P<tipo>[EF])(?P<codigo>\d{8,20})\s+(?P<payload>\d+)\s*(?P<status>\d)?$", line.strip())
    if not match:
        return None

    payload = match.group("payload") or ""
    data_token = None
    if len(payload) >= 26:
        fixed_candidate = payload[18:26]
        for fmt in ("%Y%m%d", "%d%m%Y"):
            try:
                datetime.strptime(fixed_candidate, fmt)
                data_token = fixed_candidate
                break
            except ValueError:
                continue

    if not data_token:
        for candidate in re.findall(r"20\d{6}", payload):
            try:
                datetime.strptime(candidate, "%Y%m%d")
                data_token = candidate
                break
            except ValueError:
                continue

    if not data_token:
        return None

    data_idx = payload.find(data_token)
    if data_idx < 0:
        return None

    after_date = payload[data_idx + len(data_token):]
    if len(after_date) < 16:
        return None

    return round(int(re.sub(r"\D", "", after_date[:16])) / 1000, 2)


def main() -> None:
    conn = sqlite3.connect(str(DB_PATH))
    cur = conn.cursor()

    cur.execute(
        """
        select id, pagamento_id, valor_extrato, mes_referencia, observacoes
        from conciliacoes
        where descricao_extrato like 'Mensalidade DABB %'
          and observacoes like '%linha=%'
        """
    )
    rows = cur.fetchall()

    corrigidos = 0
    for conc_id, pagamento_id, valor_atual, mes_ref, observacoes in rows:
        observacoes = observacoes or ""
        line_match = re.search(r"linha=([EF].*)", observacoes)
        if not line_match:
            continue

        raw_line = line_match.group(1).split("\n", 1)[0].strip()
        valor_corrigido = parse_correct_value_from_line(raw_line)
        if valor_corrigido is None:
            continue

        if abs(float(valor_atual or 0) - valor_corrigido) < 0.009:
            continue

        cur.execute("update conciliacoes set valor_extrato = ? where id = ?", (valor_corrigido, conc_id))

        if pagamento_id:
            cur.execute("update pagamentos set valor_pago = ? where id = ?", (valor_corrigido, pagamento_id))
            cur.execute("select membro_id from pagamentos where id = ?", (pagamento_id,))
            pagamento_row = cur.fetchone()
            if pagamento_row and pagamento_row[0] and mes_ref:
                cur.execute(
                    "update transacoes set valor = ? where origem = 'mensalidade' and membro_id = ? and categoria like ?",
                    (valor_corrigido, pagamento_row[0], f"%{mes_ref}%"),
                )

        corrigidos += 1

    conn.commit()
    conn.close()
    print({"corrigidos": corrigidos, "total_analisados": len(rows), "db_path": str(DB_PATH)})


if __name__ == "__main__":
    main()
