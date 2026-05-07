from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pdfplumber


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

import main  # noqa: E402


def _extrair_texto_pdf(path: Path) -> str:
    with pdfplumber.open(path) as pdf:
        return "\n".join((page.extract_text() or "") for page in pdf.pages).strip()


def _iterar_registros(path: Path):
    ext = path.suffix.lower()
    if ext == ".pdf":
        texto = _extrair_texto_pdf(path)
        for tx in main._iterar_transacoes_pdf_bb(texto):
            if tx.get("codigo_dabb") and tx.get("data") and tx.get("valor") is not None:
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


def analisar_arquivo(path: Path) -> tuple[int, set[str]]:
    total = 0
    meses: set[str] = set()

    for tx in _iterar_registros(path):
        total += 1
        meses.add(tx["data"].strftime("%Y-%m"))

    print(f"ARQUIVO={path.name}")
    print(f"  total_transacoes={total}")
    print(f"  meses_lidos={sorted(meses)}")
    print("-" * 80)
    return total, meses


def main_cli() -> int:
    parser = argparse.ArgumentParser(
        description="Valida rapidamente se arquivos OFX, RET, REM ou PDF estao sendo lidos pelo parser do sistema."
    )
    parser.add_argument("files", nargs="+", type=Path, help="Arquivos OFX, RET, REM ou PDF a validar")
    args = parser.parse_args()

    falhas = 0
    for path in args.files:
        if not path.exists():
            print(f"Arquivo nao encontrado: {path}", file=sys.stderr)
            falhas += 1
            continue

        try:
            total, _ = analisar_arquivo(path)
        except Exception as exc:
            print(f"Falha ao analisar {path}: {exc}", file=sys.stderr)
            falhas += 1
            continue

        if total <= 0:
            falhas += 1

    return 1 if falhas else 0


if __name__ == "__main__":
    raise SystemExit(main_cli())