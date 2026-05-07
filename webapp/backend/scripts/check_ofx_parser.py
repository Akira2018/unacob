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
                from check_import_parser import main_cli


                if __name__ == "__main__":
                    raise SystemExit(main_cli())