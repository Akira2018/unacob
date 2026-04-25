from __future__ import annotations

import argparse
import csv
import shutil
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
DEFAULT_PROD = ROOT / "unacob_backup.db"
DEFAULT_DEV = ROOT / "webapp" / "backend" / "data" / "associacao.db"
DEFAULT_OUTPUT = ROOT / "webapp" / "backend" / "data" / "associacao_producao_com_previsao_2026.db"
DEFAULT_REPORT = ROOT / "webapp" / "backend" / "data" / "relatorio_conflitos_previsao_2026.csv"


def ensure_schema(con: sqlite3.Connection) -> None:
    con.execute(
        """
        CREATE TABLE IF NOT EXISTS previsoes_orcamentarias_anuais (
            id VARCHAR(36) NOT NULL PRIMARY KEY,
            user_id VARCHAR(36),
            conta_id VARCHAR(36) NOT NULL,
            ano INTEGER NOT NULL,
            valor_previsto_anual FLOAT NOT NULL,
            observacoes TEXT,
            created_at DATETIME,
            updated_at DATETIME,
            FOREIGN KEY(conta_id) REFERENCES plano_contas(id),
            CONSTRAINT uq_previsao_orcamentaria_anual_conta_ano UNIQUE(conta_id, ano)
        )
        """
    )
    con.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS ix_previsao_orcamentaria_anual_conta_ano
        ON previsoes_orcamentarias_anuais (conta_id, ano)
        """
    )


def copy_missing_accounts(con: sqlite3.Connection) -> int:
    inserted = 0
    for dev_account in con.execute("SELECT * FROM dev.plano_contas ORDER BY ordem, codigo"):
        existing = con.execute("SELECT id FROM plano_contas WHERE codigo = ?", (dev_account["codigo"],)).fetchone()
        if existing:
            continue

        values = dict(dev_account)
        values["id"] = str(uuid.uuid4())
        values["created_at"] = values.get("created_at") or datetime.utcnow().isoformat()
        values["updated_at"] = datetime.utcnow().isoformat()
        cols = list(values.keys())
        placeholders = ",".join(["?"] * len(cols))
        con.execute(
            f"INSERT INTO plano_contas ({','.join(cols)}) VALUES ({placeholders})",
            [values[c] for c in cols],
        )
        inserted += 1
    return inserted


def account_id_map(con: sqlite3.Connection) -> dict[str, str]:
    return {
        row["codigo"]: row["id"]
        for row in con.execute("SELECT id, codigo FROM plano_contas WHERE codigo IS NOT NULL")
    }


def import_annual_forecast(con: sqlite3.Connection) -> tuple[int, int]:
    ids_by_code = account_id_map(con)
    inserted = 0
    updated = 0
    now = datetime.utcnow().isoformat()

    for row in con.execute(
        """
        SELECT poa.*, pc.codigo AS conta_codigo
        FROM dev.previsoes_orcamentarias_anuais poa
        JOIN dev.plano_contas pc ON pc.id = poa.conta_id
        """
    ):
        conta_id = ids_by_code.get(row["conta_codigo"])
        if not conta_id:
            continue

        existing = con.execute(
            "SELECT id FROM previsoes_orcamentarias_anuais WHERE conta_id = ? AND ano = ?",
            (conta_id, row["ano"]),
        ).fetchone()
        observacoes = row["observacoes"] or "Migrado do banco de desenvolvimento"
        if existing:
            con.execute(
                """
                UPDATE previsoes_orcamentarias_anuais
                SET valor_previsto_anual = ?, observacoes = ?, updated_at = ?
                WHERE id = ?
                """,
                (row["valor_previsto_anual"], observacoes, now, existing["id"]),
            )
            updated += 1
        else:
            con.execute(
                """
                INSERT INTO previsoes_orcamentarias_anuais
                (id, user_id, conta_id, ano, valor_previsto_anual, observacoes, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(uuid.uuid4()),
                    row["user_id"],
                    conta_id,
                    row["ano"],
                    row["valor_previsto_anual"],
                    observacoes,
                    row["created_at"] or now,
                    now,
                ),
            )
            inserted += 1
    return inserted, updated


def import_monthly_forecast(con: sqlite3.Connection) -> tuple[int, int, list[dict[str, object]]]:
    ids_by_code = account_id_map(con)
    inserted = 0
    updated = 0
    conflicts: list[dict[str, object]] = []
    now = datetime.utcnow().isoformat()

    for row in con.execute(
        """
        SELECT po.*, pc.codigo AS conta_codigo, pc.nome AS conta_nome
        FROM dev.previsoes_orcamentarias po
        JOIN dev.plano_contas pc ON pc.id = po.conta_id
        """
    ):
        conta_id = ids_by_code.get(row["conta_codigo"])
        if not conta_id:
            continue

        existing = con.execute(
            """
            SELECT po.*, pc.codigo AS conta_codigo, pc.nome AS conta_nome
            FROM previsoes_orcamentarias po
            JOIN plano_contas pc ON pc.id = po.conta_id
            WHERE po.conta_id = ? AND po.ano = ? AND po.mes = ?
            """,
            (conta_id, row["ano"], row["mes"]),
        ).fetchone()

        if existing and row["ano"] == 2026 and row["mes"] in {1, 2, 3}:
            con.execute(
                """
                UPDATE previsoes_orcamentarias
                SET valor_previsto = ?, observacoes = ?, updated_at = ?
                WHERE id = ?
                """,
                (row["valor_previsto"], row["observacoes"], now, existing["id"]),
            )
            updated += 1
            continue

        if existing:
            if round(float(existing["valor_previsto"] or 0), 2) != round(float(row["valor_previsto"] or 0), 2):
                conflicts.append(
                    {
                        "codigo": row["conta_codigo"],
                        "conta": row["conta_nome"],
                        "ano": row["ano"],
                        "mes": row["mes"],
                        "valor_producao_preservado": existing["valor_previsto"],
                        "valor_desenvolvimento_nao_aplicado": row["valor_previsto"],
                    }
                )
            continue

        con.execute(
            """
            INSERT INTO previsoes_orcamentarias
            (id, user_id, conta_id, ano, mes, valor_previsto, observacoes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                row["user_id"],
                conta_id,
                row["ano"],
                row["mes"],
                row["valor_previsto"],
                row["observacoes"],
                row["created_at"] or now,
                now,
            ),
        )
        inserted += 1
    return inserted, updated, conflicts


def write_conflicts(report_path: Path, conflicts: list[dict[str, object]]) -> None:
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with report_path.open("w", newline="", encoding="utf-8-sig") as f:
        fields = [
            "codigo",
            "conta",
            "ano",
            "mes",
            "valor_producao_preservado",
            "valor_desenvolvimento_nao_aplicado",
        ]
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(conflicts)


def merge(prod_path: Path, dev_path: Path, output_path: Path, report_path: Path) -> None:
    if not prod_path.exists():
        raise SystemExit(f"Banco de produção não encontrado: {prod_path}")
    if not dev_path.exists():
        raise SystemExit(f"Banco de desenvolvimento não encontrado: {dev_path}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(prod_path, output_path)

    con = sqlite3.connect(output_path)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    con.execute("ATTACH DATABASE ? AS dev", (str(dev_path),))
    try:
        ensure_schema(con)
        accounts_inserted = copy_missing_accounts(con)
        annual_inserted, annual_updated = import_annual_forecast(con)
        monthly_inserted, monthly_updated, conflicts = import_monthly_forecast(con)
        con.commit()
    finally:
        con.close()

    write_conflicts(report_path, conflicts)
    print(f"Arquivo gerado: {output_path}")
    print(f"Contas adicionadas: {accounts_inserted}")
    print(f"Previsões anuais inseridas: {annual_inserted} | atualizadas: {annual_updated}")
    print(f"Previsões mensais inseridas: {monthly_inserted} | atualizadas por desenvolvimento jan-mar/2026: {monthly_updated}")
    print(f"Conflitos mensais preservando produção: {len(conflicts)}")
    print(f"Relatório de conflitos: {report_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Gera banco candidato produção + previsões do desenvolvimento.")
    parser.add_argument("--prod", type=Path, default=DEFAULT_PROD)
    parser.add_argument("--dev", type=Path, default=DEFAULT_DEV)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    args = parser.parse_args()
    merge(args.prod, args.dev, args.output, args.report)


if __name__ == "__main__":
    main()
