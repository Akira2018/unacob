from __future__ import annotations

import argparse
from pathlib import Path

from verify_import_file import analisar_importacao, _inferir_banco


SUPPORTED_EXTENSIONS = {".ofx", ".ret", ".rem", ".pdf"}
PDF_HINTS = ("bb", "dabb", "remessa", "extrato")


def _arquivo_parece_importavel(path: Path, include_all_pdfs: bool) -> bool:
    ext = path.suffix.lower()
    if ext in {".ofx", ".ret", ".rem"}:
        return True
    if ext != ".pdf":
        return False
    if include_all_pdfs:
        return True
    nome = path.name.lower()
    return any(hint in nome for hint in PDF_HINTS)


def coletar_arquivos(folder: Path, include_all_pdfs: bool) -> list[Path]:
    arquivos = [
        path for path in folder.iterdir()
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS and _arquivo_parece_importavel(path, include_all_pdfs)
    ]
    return sorted(arquivos, key=lambda item: item.name.lower())


def main_cli() -> int:
    parser = argparse.ArgumentParser(
        description="Varre uma pasta e confere automaticamente arquivos OFX, RET, REM e PDF contra o banco."
    )
    parser.add_argument("folder", nargs="?", type=Path, default=Path.cwd(), help="Pasta com os arquivos a conferir")
    parser.add_argument("--banco", default=None, help="Forca um valor unico para o campo banco")
    parser.add_argument(
        "--include-all-pdfs",
        action="store_true",
        help="Inclui qualquer PDF da pasta, mesmo que o nome nao pareca arquivo bancario",
    )
    parser.add_argument(
        "--expect-imported",
        action="store_true",
        help="Falha se algum arquivo ainda tiver lancamentos novos para importar",
    )
    args = parser.parse_args()

    folder = args.folder.resolve()
    arquivos = coletar_arquivos(folder, include_all_pdfs=args.include_all_pdfs)
    if not arquivos:
        print(f"Nenhum arquivo suportado encontrado em {folder}")
        return 1

    falhas = 0
    total_arquivos = 0
    total_lancamentos = 0
    total_duplicadas = 0
    total_novas = 0

    for path in arquivos:
        total_arquivos += 1
        total, _, duplicadas, novas, _ = analisar_importacao(path, banco=_inferir_banco(path, args.banco))
        total_lancamentos += total
        total_duplicadas += duplicadas
        total_novas += novas
        if args.expect_imported and novas > 0:
            falhas += 1

    print("RESUMO")
    print(f"  pasta={folder}")
    print(f"  arquivos_processados={total_arquivos}")
    print(f"  total_lancamentos={total_lancamentos}")
    print(f"  total_duplicadas={total_duplicadas}")
    print(f"  total_novas={total_novas}")

    return 1 if falhas else 0


if __name__ == "__main__":
    raise SystemExit(main_cli())