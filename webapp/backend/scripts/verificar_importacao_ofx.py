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
            from verify_import_file import main_cli


            if __name__ == "__main__":
                raise SystemExit(main_cli())