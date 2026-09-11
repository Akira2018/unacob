"""Corrige dados ja gravados na tabela `pagamentos` afetados pelos bugs de
rateio multi-mes e de data no regime de caixa. NAO altera o codigo da
aplicacao - so os registros.

O que faz (cada bloco pode ser ligado/desligado):

  1. RATEIO INFLADO  (--rateio, ligado por padrao)
     Grupos de pagamento acumulado ("Pagamento acumulado de R$ X referente a
     N meses (...)") em que uma competencia ficou com um valor muito acima da
     mensalidade (ex.: R$ 980,00) e as demais com R$ 35,00. Redistribui o
     TOTAL do grupo por igual entre as competencias do grupo (centavos na
     ultima). O total que entrou no caixa nao muda - so deixa de ficar
     empilhado num mes so.

  2. CREDITO BANCARIO TARDIO  (--credito-tardio, ligado por padrao)
     Pagamentos feitos no fim de um mes cujo dinheiro so caiu no banco no mes
     seguinte. Preenche `data_credito_banco` para o balancete (regime de
     caixa) lancar o valor no mes certo. A lista de casos vem de
     CREDITOS_TARDIOS (revise antes de aplicar) e pode ser complementada com
     --caso "trecho_do_nome=YYYY-MM=YYYY-MM-DD".

  3. DATA DE PAGAMENTO IMPLAUSIVEL  (somente relatorio; --fix-datas para aplicar)
     Pagamentos `pago` com `data_pagamento` mais de 2 meses depois da
     competencia (tipicamente a data default do dia em que foi digitado).

Uso:
    python corrigir_pagamentos_2026.py --db data/associacao.db            # dry-run
    python corrigir_pagamentos_2026.py --db data/associacao.db --apply    # grava (faz backup antes)
"""
import argparse
import shutil
import sqlite3
import sys
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path

# trecho_do_nome  ->  (competencia YYYY-MM, data_credito YYYY-MM-DD)
CREDITOS_TARDIOS = {
    "Luiza Maria Santos": ("2026-02", "2026-03-02"),
}

MENSALIDADE_PADRAO = 35.0
# Acima disto, o numero de meses implicado (total / mensalidade) e tratado como
# provavel erro de digitacao: o grupo e apenas sinalizado, nunca alterado.
MAX_MESES_PLAUSIVEL = 15


def _fmt(v):
    return f"R$ {float(v or 0):.2f}"


def _ultimo_dia_competencia(mes_ref):
    ano, mes = (int(x) for x in mes_ref.split("-"))
    prox = date(ano + (mes == 12), (mes % 12) + 1, 1)
    return prox - timedelta(days=1)


def _add_mes(mes_ref, delta):
    ano, mes = (int(x) for x in mes_ref.split("-"))
    total = (ano * 12 + (mes - 1)) + delta
    return f"{total // 12:04d}-{total % 12 + 1:02d}"


def _meses_alvo(existentes, n_meses):
    """Meses que o pagamento deve cobrir: mantem os existentes, preenche buracos
    no intervalo e estende para tras (meses anteriores) e depois para frente ate
    somar n_meses. Se ha mais meses que o necessario, descarta os mais futuros
    (a regra e quitar atrasados primeiro)."""
    meses = set(existentes)
    ini, fim = min(existentes), max(existentes)
    cur = ini
    while cur <= fim:
        meses.add(cur)
        cur = _add_mes(cur, 1)
    while len(meses) < n_meses:  # atrasados primeiro
        ini = _add_mes(ini, -1)
        meses.add(ini)
    while len(meses) < n_meses:  # depois adiantados
        fim = _add_mes(fim, 1)
        meses.add(fim)
    ordenados = sorted(meses)
    if len(ordenados) > n_meses:
        ordenados = ordenados[:n_meses]
    return ordenados


def corrigir_rateio(cur, aplicar, valores_corrigidos=None):
    valores_corrigidos = valores_corrigidos or {}
    rows = cur.execute(
        "SELECT id, membro_id, mes_referencia, valor_pago, data_pagamento, "
        "data_credito_banco, forma_pagamento, observacoes "
        "FROM pagamentos WHERE observacoes LIKE '%Pagamento acumulado%'"
    ).fetchall()

    grupos = {}
    for pid, membro_id, mes_ref, valor, dpag, dcred, forma, obs in rows:
        linha = next((l for l in (obs or "").splitlines() if "Pagamento acumulado" in l), obs or "")
        g = grupos.setdefault((membro_id, linha.strip()), {"parcelas": [], "meta": None})
        g["parcelas"].append({"id": pid, "mes": mes_ref, "valor": float(valor or 0)})
        g["meta"] = {"membro_id": membro_id, "dpag": dpag, "dcred": dcred, "forma": forma, "obs": linha.strip()}

    ajustados = flags = 0
    for (membro_id, _chave), g in grupos.items():
        parcelas = sorted(g["parcelas"], key=lambda p: p["mes"])
        if len(parcelas) < 1:
            continue
        total = round(sum(p["valor"] for p in parcelas), 2)
        pico = max(p["valor"] for p in parcelas)
        if pico <= MENSALIDADE_PADRAO * 1.5 + 1:
            continue  # nenhuma parcela destoa da mensalidade

        info = cur.execute(
            "SELECT nome_completo, valor_mensalidade, dabb_valor_mensalidade FROM membros WHERE id = ?",
            (membro_id,),
        ).fetchone()
        nome = info[0] if info else membro_id
        mensalidade = MENSALIDADE_PADRAO
        for cand in (info[2] if info else None, info[1] if info else None):
            if cand and float(cand) > 0:
                mensalidade = round(float(cand), 2)
                break

        override = next((v for trecho, v in valores_corrigidos.items() if trecho.lower() in (nome or "").lower()), None)
        if override is not None:
            print(f"\n[RATEIO] {nome}  valor corrigido manualmente: {_fmt(total)} -> {_fmt(override)}")
            total = round(float(override), 2)
        n_meses = max(1, int(round(total / mensalidade)))

        if override is None and n_meses > MAX_MESES_PLAUSIVEL and n_meses > 1.5 * len(parcelas):
            flags += 1
            print(f"\n[RATEIO] {nome}  total {_fmt(total)} => {n_meses} meses de {_fmt(mensalidade)}")
            print(f"    provavel ERRO DE DIGITACAO no valor. Meses atuais: "
                  f"{', '.join(p['mes'] for p in parcelas)}. NAO alterado.")
            print(f"    confirme o valor certo e rode com --corrigir-valor \"{(nome or '').split()[0]}=<valor>\".")
            continue

        alvo = _meses_alvo([p["mes"] for p in parcelas], n_meses)

        # Parcelas fora do conjunto alvo (total corrigido cobre menos meses).
        sobras = [p for p in parcelas if p["mes"] not in alvo]
        for p in sobras:
            print(f"    - {p['mes']}: {_fmt(p['valor'])}  ->  REMOVIDO (fora do total corrigido)")
            if aplicar:
                cur.execute("DELETE FROM pagamentos WHERE id = ?", (p["id"],))
                cur.execute("DELETE FROM transacoes WHERE origem='mensalidade' AND membro_id=? AND categoria LIKE ?",
                            (membro_id, f"%{p['mes']}%"))
        parcelas = [p for p in parcelas if p["mes"] in alvo]

        # Distribuicao uniforme: total / n meses, centavos no ultimo. Assim
        # R$ 66 / 2 -> 33+33, R$ 198 / 6 -> 33x6, R$ 420 / 12 -> 35x12.
        cota = round(total / len(alvo), 2)
        valores = {m: cota for m in alvo}
        valores[alvo[-1]] = round(valores[alvo[-1]] + (total - cota * len(alvo)), 2)

        print(f"\n[RATEIO] {nome}  total {_fmt(total)} -> {len(alvo)} meses de {_fmt(cota)}")
        por_mes = {p["mes"]: p for p in parcelas}
        for m in alvo:
            atual = por_mes.get(m)
            marca = "=" if atual and abs(atual["valor"] - valores[m]) < 0.005 else ("~" if atual else "+")
            print(f"    {marca} {m}: {_fmt(atual['valor']) if atual else '(novo)'}  ->  {_fmt(valores[m])}")
            if not aplicar:
                continue
            ts = datetime.utcnow().isoformat(sep=" ")
            if atual:
                cur.execute("UPDATE pagamentos SET valor_pago=?, updated_at=? WHERE id=?", (valores[m], ts, atual["id"]))
                cur.execute("UPDATE transacoes SET valor=? WHERE origem='mensalidade' AND membro_id=? AND categoria LIKE ?",
                            (valores[m], membro_id, f"%{m}%"))
            else:
                meta = g["meta"]
                cur.execute(
                    "INSERT INTO pagamentos (id, membro_id, valor_pago, mes_referencia, data_pagamento, "
                    "data_credito_banco, status_pagamento, forma_pagamento, observacoes, created_at, updated_at) "
                    "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                    (str(uuid.uuid4()), membro_id, valores[m], m, meta["dpag"], meta["dcred"],
                     "pago", meta["forma"] or "transferencia", meta["obs"], ts, ts),
                )
        ajustados += 1
    print(f"\n[RATEIO] grupos ajustados: {ajustados}   |   sinalizados (nao alterados): {flags}")


def corrigir_credito_tardio(cur, aplicar, casos_extra):
    casos = dict(CREDITOS_TARDIOS)
    for item in casos_extra:
        try:
            nome, comp, dcred = item.split("=")
            casos[nome.strip()] = (comp.strip(), dcred.strip())
        except ValueError:
            print(f"[CREDITO] ignorado (formato invalido): {item}", file=sys.stderr)

    total = 0
    for trecho, (comp, dcred) in casos.items():
        alvos = cur.execute(
            "SELECT p.id, m.nome_completo, p.valor_pago, p.data_pagamento, p.data_credito_banco "
            "FROM pagamentos p JOIN membros m ON m.id = p.membro_id "
            "WHERE m.nome_completo LIKE ? AND p.mes_referencia = ? AND p.status_pagamento = 'pago'",
            (f"%{trecho}%", comp),
        ).fetchall()
        if not alvos:
            print(f"\n[CREDITO] nenhum pagamento encontrado para '{trecho}' competencia {comp}")
            continue
        for pid, nome, valor, dpag, dcred_atual in alvos:
            print(
                f"\n[CREDITO] {nome}  comp {comp}  {_fmt(valor)}  "
                f"pagamento={dpag}  credito_banco: {dcred_atual or '-'} -> {dcred}"
            )
            if dcred_atual == dcred:
                continue
            total += 1
            if aplicar:
                cur.execute(
                    "UPDATE pagamentos SET data_credito_banco = ?, updated_at = ? WHERE id = ?",
                    (dcred, datetime.utcnow().isoformat(sep=" "), pid),
                )
                cur.execute(
                    "UPDATE transacoes SET data_transacao = ? "
                    "WHERE origem = 'mensalidade' AND categoria LIKE ? "
                    "AND descricao LIKE ?",
                    (dcred, f"%{comp}%", f"%{nome}%"),
                )
    print(f"\n[CREDITO] registros {'ajustados' if aplicar else 'a ajustar'}: {total}")


def relatar_datas_implausiveis(cur, aplicar_fix):
    # "Ancora": maior competencia registrada. Uma data_pagamento em mes POSTERIOR
    # a essa ancora e quase sempre a data default (dia em que foi digitado),
    # nao a data real do pagamento. Pagar meses atrasados (data > competencia,
    # mas <= ancora) e normal e NAO e sinalizado.
    ancora = cur.execute(
        "SELECT MAX(mes_referencia) FROM pagamentos WHERE mes_referencia IS NOT NULL"
    ).fetchone()[0] or date.today().strftime("%Y-%m")
    rows = cur.execute(
        "SELECT p.id, m.nome_completo, p.mes_referencia, p.valor_pago, p.data_pagamento "
        "FROM pagamentos p LEFT JOIN membros m ON m.id = p.membro_id "
        "WHERE p.status_pagamento = 'pago' AND p.data_pagamento IS NOT NULL "
        "AND p.data_credito_banco IS NULL AND p.mes_referencia IS NOT NULL"
    ).fetchall()
    achados = 0
    for pid, nome, mes_ref, valor, dpag in rows:
        if (dpag or "")[:7] <= ancora:
            continue
        achados += 1
        alvo = _ultimo_dia_competencia(mes_ref).isoformat()
        print(f"[DATA]  {nome or pid}  comp {mes_ref}  {_fmt(valor)}  data_pagamento={dpag}  (sugerido: {alvo})")
        if aplicar_fix:
            cur.execute(
                "UPDATE pagamentos SET data_pagamento = ?, updated_at = ? WHERE id = ?",
                (alvo, datetime.utcnow().isoformat(sep=" "), pid),
            )
    print(f"\n[DATA] datas posteriores a {ancora} (provavel data default): {achados}"
          + ("" if aplicar_fix else "  (use --fix-datas para ajustar para o fim da competencia)"))


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--db", required=True, help="Caminho do arquivo associacao.db")
    parser.add_argument("--apply", action="store_true", help="Grava as alteracoes (sem isso, dry-run)")
    parser.add_argument("--no-rateio", action="store_true", help="Nao corrige rateio inflado")
    parser.add_argument("--no-credito-tardio", action="store_true", help="Nao preenche data_credito_banco")
    parser.add_argument("--fix-datas", action="store_true", help="Ajusta datas de pagamento implausiveis")
    parser.add_argument("--caso", action="append", default=[], metavar="NOME=YYYY-MM=YYYY-MM-DD",
                        help="Credito tardio adicional (repetivel)")
    parser.add_argument("--corrigir-valor", action="append", default=[], metavar="NOME=VALOR",
                        help="Total correto de um pagamento acumulado sinalizado como erro de digitacao (repetivel). "
                             "Ex.: --corrigir-valor \"Fernando=105\"")
    args = parser.parse_args()

    valores_corrigidos = {}
    for item in args.corrigir_valor:
        try:
            nome, val = item.rsplit("=", 1)
            valores_corrigidos[nome.strip()] = float(val.replace(",", "."))
        except ValueError:
            print(f"--corrigir-valor ignorado (formato invalido): {item}", file=sys.stderr)

    db_path = Path(args.db)
    if not db_path.exists():
        print(f"Arquivo nao encontrado: {db_path}", file=sys.stderr)
        sys.exit(1)

    if args.apply:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_dir = db_path.parent / "backups"
        backup_dir.mkdir(exist_ok=True)
        backup = backup_dir / f"pre_correcao_pagamentos_{ts}.db"
        shutil.copy(db_path, backup)
        print(f"Backup: {backup}\n")

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cols = [c[1] for c in cur.execute("PRAGMA table_info(pagamentos)").fetchall()]
    if "data_credito_banco" not in cols:
        print("Coluna data_credito_banco ausente" + (" - criando." if args.apply else " (sera criada com --apply)."))
        if args.apply:
            cur.execute("ALTER TABLE pagamentos ADD COLUMN data_credito_banco DATE")

    print("=" * 70)
    print("MODO: " + ("APLICAR (grava)" if args.apply else "DRY-RUN (nada e gravado)"))
    print("=" * 70)

    try:
        if not args.no_rateio:
            corrigir_rateio(cur, args.apply, valores_corrigidos)
        if not args.no_credito_tardio:
            corrigir_credito_tardio(cur, args.apply, args.caso)
        relatar_datas_implausiveis(cur, args.apply and args.fix_datas)
        if args.apply:
            conn.commit()
            print("\nAlteracoes gravadas.")
        else:
            conn.rollback()
            print("\nDRY-RUN concluido. Rode de novo com --apply para gravar.")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
