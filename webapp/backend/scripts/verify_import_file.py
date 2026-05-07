from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pdfplumber


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from database import SessionLocal  # noqa: E402
import main  # noqa: E402


def _extrair_texto_pdf(path: Path) -> str:
    with pdfplumber.open(path) as pdf:
        return "\n".join((page.extract_text() or "") for page in pdf.pages).strip()


def _inferir_banco(path: Path, banco: str | None) -> str:
    if banco:
        return banco
    return "DABB" if path.suffix.lower() in {".ret", ".rem", ".pdf"} else "Importado"


def _iterar_registros(path: Path):
    ext = path.suffix.lower()
    if ext == ".pdf":
        texto = _extrair_texto_pdf(path)
        for tx in main._iterar_transacoes_pdf_bb(texto):
            codigo_dabb = tx.get("codigo_dabb")
            data = tx.get("data")
            valor = tx.get("valor")
            if not codigo_dabb or not data or valor is None:
                continue
            yield tx
        return

    text = main._decode_uploaded_text(path.read_bytes()).strip()
    if ext == ".ofx":
        yield from main._iterar_transacoes_ofx(text)
        return

    if ext in {".ret", ".rem"}:
        data_header_dabb = main._extrair_data_header_dabb(text)
        for raw_line in text.splitlines():
            line_normalized = raw_line.rstrip("\r\n").lstrip("\ufeff ").rstrip()
            if line_normalized[:1] not in {"E", "F"}:
                continue
            try:
                yield main._parse_linha_dabb(line_normalized, data_fallback=data_header_dabb)
            except ValueError:
                continue
        return

    raise ValueError(f"Extensao nao suportada para conferencia: {ext or '<sem extensao>'}")


def analisar_importacao(path: Path, banco: str) -> tuple[int, int, int, int, set[str]]:
    total = 0
    saldo = 0
    duplicadas = 0
    novas = 0
    meses: set[str] = set()

    db = SessionLocal()
    try:
        for tx in _iterar_registros(path):
            total += 1
            data = tx["data"]
            valor = tx["valor"]
            tipo = tx["tipo"]
            descricao = tx["descricao"]
            numero_doc = tx["numero_documento"]
            meses.add(data.strftime("%Y-%m"))

            if main._descricao_indica_linha_saldo(descricao):
                saldo += 1
                continue

            existe = main._buscar_duplicado_conciliacao(
                db=db,
                data_extrato=data,
                valor_extrato=valor,
                banco=banco,
                tipo=tipo,
                numero_documento=numero_doc,
                descricao_extrato=descricao,
            )

            if existe:
                duplicadas += 1
            else:
                novas += 1
    finally:
        db.close()

    print(f"ARQUIVO={path.name}")
    print(f"  total_transacoes={total}")
    print(f"  linhas_saldo_ignoradas={saldo}")
    print(f"  duplicadas_no_banco={duplicadas}")
    print(f"  novas_para_importar={novas}")
    print(f"  meses_lidos={sorted(meses)}")
    print("-" * 80)
    return total, saldo, duplicadas, novas, meses


def main_cli() -> int:
    parser = argparse.ArgumentParser(
        description="Confere se os lancamentos de OFX, RET, REM ou PDF ja estao no banco ou ainda seriam importados."
    )
    parser.add_argument("files", nargs="+", type=Path, help="Arquivos OFX, RET, REM ou PDF a conferir")
    parser.add_argument("--banco", default=None, help="Valor do campo banco usado na importacao; se omitido, o script infere pelo tipo do arquivo")
    parser.add_argument(
        "--expect-imported",
        action="store_true",
        help="Falha se ainda houver lancamentos novos para importar",
    )
    args = parser.parse_args()

    falhas = 0
    for path in args.files:
        if not path.exists():
            print(f"Arquivo nao encontrado: {path}", file=sys.stderr)
            falhas += 1
            continue

        try:
            _, _, _, novas, _ = analisar_importacao(path, banco=_inferir_banco(path, args.banco))
        except Exception as exc:
            print(f"Falha ao analisar {path}: {exc}", file=sys.stderr)
            falhas += 1
            continue

        if args.expect_imported and novas > 0:
            falhas += 1

    return 1 if falhas else 0


if __name__ == "__main__":
    raise SystemExit(main_cli())