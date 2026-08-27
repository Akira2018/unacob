#!/usr/bin/env python3
# =============================================================================
# reprocessar_dabb_pendentes.py
# =============================================================================
# Retenta a baixa automatica das conciliacoes de credito DABB que ficaram
# pendentes (conciliado=0, sem pagamento) por causa do bug do
# `codigo_dabb_em_obs` (corrigido em main.py). Mesma logica do endpoint
# POST /api/pagamentos/reprocessar-dabb, porem para TODOS os meses de uma vez.
#
# Seguro: so age em conciliacoes tipo='credito', conciliado=0, cuja observacao
# comeca com "Arquivo DABB". Nao apaga nada. As funcoes de baixa gravam
# (commit) por conta propria; uma falha isolada nao interrompe o restante.
#
# Uso (em /opt/unacob, com o backend no ar):
#   docker compose exec -T backend python - < scripts/reprocessar_dabb_pendentes.py
# =============================================================================
import sys

import main
import models
from database import SessionLocal

FILTRO = (
    models.Conciliacao.tipo == "credito",
    models.Conciliacao.conciliado == False,  # noqa: E712
    models.Conciliacao.observacoes.isnot(None),
    models.Conciliacao.observacoes.like("Arquivo DABB%"),
)


def run() -> int:
    db = SessionLocal()
    try:
        user_id = "reprocessar-dabb-script"
        admin = (
            db.query(models.User)
            .filter(models.User.role == "administrador", models.User.ativo == True)  # noqa: E712
            .first()
        )
        if admin:
            user_id = admin.id

        meses = sorted(
            row[0]
            for row in db.query(models.Conciliacao.mes_referencia).filter(*FILTRO).distinct().all()
            if row[0]
        )
        if not meses:
            print("Nenhuma pendencia DABB de credito. Nada a fazer.")
            return 0
        print("meses com pendencia:", ", ".join(meses))

        indice = main._indexar_membros_por_codigo_dabb(db)
        tot = dict(analisados=0, baixados=0, sem_match=0, ambiguos=0, erros=0)

        for mes in meses:
            abertas = (
                db.query(models.Conciliacao)
                .filter(models.Conciliacao.mes_referencia == mes, *FILTRO)
                .order_by(models.Conciliacao.data_extrato.asc())
                .all()
            )
            m_baixados = m_sem = m_amb = m_err = 0

            for c in abertas:
                codigo = main._extrair_codigo_dabb_das_observacoes(c.observacoes)
                if not codigo:
                    m_sem += 1
                    continue

                match = {}
                for variante in main._variantes_codigo_dabb(codigo):
                    for membro in indice.get(variante, []):
                        match[membro.id] = membro

                if len(match) > 1:
                    m_amb += 1
                    continue
                if not match:
                    m_sem += 1
                    continue

                membro = next(iter(match.values()))
                origem = f"Baixa reprocessada (script) via codigo DABB ({mes}) - codigo_dabb {codigo}"
                try:
                    competencias = main._inferir_competencias_dabb_por_conciliacao(
                        db=db, conciliacao=c, membro=membro
                    )
                    if competencias:
                        main._baixar_pagamentos_dabb_por_competencias_inferidas(
                            db=db, conciliacao=c, membro=membro,
                            competencias=competencias, user_id=user_id,
                            observacao_origem=origem,
                        )
                    else:
                        main._baixar_pagamento_mensalidade_por_conciliacao(
                            db=db, conciliacao=c, membro=membro,
                            user_id=user_id, observacao_origem=origem,
                        )
                    m_baixados += 1
                except Exception as exc:  # noqa: BLE001
                    m_err += 1
                    db.rollback()
                    if m_err <= 5:
                        print(f"  [{mes}] ERRO conc={c.id} cod={codigo}: {type(exc).__name__}: {exc}")

            print(
                f"  {mes}: analisados={len(abertas)} baixados={m_baixados} "
                f"sem_match={m_sem} ambiguos={m_amb} erros={m_err}"
            )
            tot["analisados"] += len(abertas)
            tot["baixados"] += m_baixados
            tot["sem_match"] += m_sem
            tot["ambiguos"] += m_amb
            tot["erros"] += m_err

        print(
            f"\nTOTAL: analisados={tot['analisados']} baixados={tot['baixados']} "
            f"sem_match={tot['sem_match']} ambiguos={tot['ambiguos']} erros={tot['erros']}"
        )
        restantes = db.query(models.Conciliacao).filter(*FILTRO).count()
        print(f"pendencias DABB restantes (sem codigo_dabb de membro ativo): {restantes}")
        return 1 if tot["erros"] else 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(run())
