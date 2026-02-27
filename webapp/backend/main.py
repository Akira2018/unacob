from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Body
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

import models
import schemas

from database import engine, get_db, Base
from auth import get_current_user, verify_password, get_password_hash, create_access_token
from typing import Optional, List
import os
import io
import re
import json
import unicodedata
import smtplib
from pathlib import Path
from datetime import date, datetime, timedelta
from email.message import EmailMessage
from dotenv import load_dotenv
from sqlalchemy import or_, cast, String
from sqlalchemy import func as sql_func
from collections import defaultdict
import calendar
import uuid
import openpyxl

load_dotenv(Path(__file__).resolve().parent / ".env")

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="UNACOB - União dos aposentados dos correios em Bauru - SP API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Seed initial admin user ───────────────────────────────────────────────────
def seed_admin():
    from database import SessionLocal
    db = SessionLocal()
    try:
        admin = db.query(models.User).filter(models.User.email == "admin@associacao.com").first()
        if not admin:
            admin = models.User(
                id=str(uuid.uuid4()),
                email="admin@associacao.com",
                nome_completo="Administrador",
                role="administrador",
                password=get_password_hash("admin123"),
                ativo=True,
                created_at=datetime.utcnow()
            )
            db.add(admin)
            db.commit()
    finally:
        db.close()

seed_admin()


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "unacob-backend"}

# ════════════════════════════════════════════════════════════════════════════════
# AUTH
# ════════════════════════════════════════════════════════════════════════════════
@app.post("/api/auth/login", response_model=schemas.TokenResponse)
def login(req: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == req.email).first()
    if not user or not verify_password(req.password, user.password):
        raise HTTPException(status_code=401, detail="Email ou senha incorretos")
    token = create_access_token({"sub": user.id})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email, "nome_completo": user.nome_completo, "role": user.role}
    }

@app.get("/api/auth/me")
def me(current_user: models.User = Depends(get_current_user)):
    return {"id": current_user.id, "email": current_user.email,
            "nome_completo": current_user.nome_completo, "role": current_user.role}


# ════════════════════════════════════════════════════════════════════════════════
# USERS
# ════════════════════════════════════════════════════════════════════════════════
@app.get("/api/users", response_model=List[schemas.UserResponse])
def list_users(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(models.User).all()

@app.post("/api/users", response_model=schemas.UserResponse)
def create_user(req: schemas.UserCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role != "administrador":
        raise HTTPException(status_code=403, detail="Apenas administradores podem criar usuários")
    existing = db.query(models.User).filter(models.User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email já cadastrado")
    user = models.User(
        id=str(uuid.uuid4()),
        email=req.email,
        nome_completo=req.nome_completo,
        role=req.role,
        password=get_password_hash(req.password),
        ativo=True,
        created_at=datetime.utcnow()
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@app.put("/api/users/{user_id}", response_model=schemas.UserResponse)
def update_user(user_id: str, req: schemas.UserUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    for k, v in req.dict(exclude_none=True).items():
        if k == "password":
            setattr(user, k, get_password_hash(v))
        else:
            setattr(user, k, v)
    db.commit()
    db.refresh(user)
    return user

@app.delete("/api/users/{user_id}")
def delete_user(user_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    db.delete(user)
    db.commit()
    return {"ok": True}


# ════════════════════════════════════════════════════════════════════════════════
# MEMBROS
# ════════════════════════════════════════════════════════════════════════════════
@app.get("/api/membros", response_model=List[schemas.MembroResponse])
def list_membros(
    skip: int = 0, limit: int = 500,
    search: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    q = db.query(models.Membro)
    if search:
        q = q.filter(or_(
            models.Membro.nome_completo.ilike(f"%{search}%"),
            models.Membro.cpf.ilike(f"%{search}%"),
            models.Membro.matricula.ilike(f"%{search}%"),
            models.Membro.email.ilike(f"%{search}%"),
        ))
    if status:
        q = q.filter(models.Membro.status == status)
    return q.order_by(models.Membro.nome_completo).offset(skip).limit(limit).all()

@app.post("/api/membros", response_model=schemas.MembroResponse)
def create_membro(req: schemas.MembroCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    membro = models.Membro(id=str(uuid.uuid4()), **req.dict(), created_at=datetime.utcnow(), updated_at=datetime.utcnow())
    db.add(membro)
    db.commit()
    db.refresh(membro)
    return membro

@app.get("/api/membros/{membro_id}", response_model=schemas.MembroResponse)
def get_membro(membro_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    m = db.query(models.Membro).filter(models.Membro.id == membro_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Membro não encontrado")
    return m

@app.put("/api/membros/{membro_id}", response_model=schemas.MembroResponse)
def update_membro(membro_id: str, req: schemas.MembroUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    m = db.query(models.Membro).filter(models.Membro.id == membro_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Membro não encontrado")
    for k, v in req.dict(exclude_none=True).items():
        setattr(m, k, v)
    m.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(m)
    return m

@app.delete("/api/membros/{membro_id}")
def delete_membro(membro_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    m = db.query(models.Membro).filter(models.Membro.id == membro_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Membro não encontrado")
    db.delete(m)
    db.commit()
    return {"ok": True}


# ════════════════════════════════════════════════════════════════════════════════
# PAGAMENTOS
# ════════════════════════════════════════════════════════════════════════════════
def _pagamentos_por_membro_no_mes(db: Session, mes_referencia: str):
    pagamentos = db.query(models.Pagamento).filter(
        models.Pagamento.mes_referencia == mes_referencia
    ).all()

    ultimo_por_membro = {}
    for pagamento in pagamentos:
        if not pagamento.membro_id:
            continue

        atual = ultimo_por_membro.get(pagamento.membro_id)
        if not atual:
            ultimo_por_membro[pagamento.membro_id] = pagamento
            continue

        dt_pagamento = pagamento.updated_at or pagamento.created_at or datetime.min
        dt_atual = atual.updated_at or atual.created_at or datetime.min
        if dt_pagamento >= dt_atual:
            ultimo_por_membro[pagamento.membro_id] = pagamento

    return ultimo_por_membro


def _pagamentos_pagos_membros_ativos_no_mes(db: Session, mes_referencia: str):
    membros_ativos_ids = {
        mid for (mid,) in db.query(models.Membro.id).filter(models.Membro.status == 'ativo').all()
    }
    pagamentos_mes = _pagamentos_por_membro_no_mes(db, mes_referencia)
    return [
        pagamento
        for membro_id, pagamento in pagamentos_mes.items()
        if membro_id in membros_ativos_ids and pagamento.status_pagamento == 'pago'
    ]


def _normalizar_texto(texto: Optional[str]) -> str:
    if not texto:
        return ""

    sem_acentos = "".join(
        c for c in unicodedata.normalize("NFKD", str(texto)) if not unicodedata.combining(c)
    )
    return re.sub(r"\s+", " ", sem_acentos).strip().lower()


def _pontuacao_nome_no_extrato(nome: Optional[str], descricao_extrato: Optional[str]) -> int:
    nome_norm = _normalizar_texto(nome)
    desc_norm = _normalizar_texto(descricao_extrato)
    if not nome_norm or not desc_norm:
        return 0

    tokens = [token for token in re.split(r"\W+", nome_norm) if len(token) >= 3]
    if not tokens:
        return 0

    return sum(1 for token in tokens if token in desc_norm)


def _somente_digitos(texto: Optional[str]) -> str:
    if not texto:
        return ""
    return "".join(ch for ch in str(texto) if ch.isdigit())


def _pontuacao_match_membro_extrato(
    membro_nome: Optional[str],
    membro_cpf: Optional[str],
    membro_matricula: Optional[str],
    descricao_extrato: Optional[str]
) -> dict:
    descricao_norm = _normalizar_texto(descricao_extrato)
    descricao_digitos = _somente_digitos(descricao_extrato)

    cpf_digitos = _somente_digitos(membro_cpf)
    matricula_digitos = _somente_digitos(membro_matricula)

    score_nome_tokens = _pontuacao_nome_no_extrato(membro_nome, descricao_extrato)
    nome_norm = _normalizar_texto(membro_nome)
    nome_completo_match = bool(nome_norm and descricao_norm and nome_norm in descricao_norm)

    cpf_match = bool(cpf_digitos and len(cpf_digitos) >= 6 and cpf_digitos in descricao_digitos)
    matricula_match = bool(matricula_digitos and len(matricula_digitos) >= 4 and matricula_digitos in descricao_digitos)

    score = 0
    if cpf_match:
        score += 100
    if matricula_match:
        score += 80
    if nome_completo_match:
        score += 40
    score += min(score_nome_tokens, 4) * 10

    if cpf_match or matricula_match or (nome_completo_match and score_nome_tokens >= 2):
        confianca = "alta"
    elif score_nome_tokens >= 2:
        confianca = "media"
    else:
        confianca = "baixa"

    return {
        "score": score,
        "confianca": confianca,
        "score_nome_tokens": score_nome_tokens,
        "nome_completo_match": nome_completo_match,
        "cpf_match": cpf_match,
        "matricula_match": matricula_match
    }


def _status_pagamento_pendente_ou_atrasado(status_pagamento: Optional[str]) -> bool:
    return status_pagamento in (None, "", "pendente", "atrasado")


@app.get("/api/pagamentos")
def list_pagamentos(
    mes_referencia: Optional[str] = None,
    membro_id: Optional[str] = None,
    status_pagamento: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    q = db.query(models.Pagamento)
    if mes_referencia:
        q = q.filter(models.Pagamento.mes_referencia == mes_referencia)
    if membro_id:
        q = q.filter(models.Pagamento.membro_id == membro_id)
    if status_pagamento:
        q = q.filter(models.Pagamento.status_pagamento == status_pagamento)
    pagamentos = q.all()
    result = []
    for p in pagamentos:
        pd = {
            "id": p.id, "membro_id": p.membro_id, "valor_pago": float(p.valor_pago) if p.valor_pago else 0,
            "mes_referencia": p.mes_referencia, "data_pagamento": str(p.data_pagamento) if p.data_pagamento else None,
            "status_pagamento": p.status_pagamento, "forma_pagamento": p.forma_pagamento,
            "observacoes": p.observacoes, "created_at": str(p.created_at) if p.created_at else None,
            "membro_nome": None
        }
        if p.membro_id:
            m = db.query(models.Membro).filter(models.Membro.id == p.membro_id).first()
            if m:
                pd["membro_nome"] = m.nome_completo
        result.append(pd)
    return result

@app.get("/api/pagamentos/painel")
def painel_pagamentos(
    mes_referencia: str,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    q = db.query(models.Membro).filter(models.Membro.status == 'ativo')

    if search:
        q = q.filter(
            or_(
                models.Membro.nome_completo.ilike(f"%{search}%"),
                models.Membro.cpf.ilike(f"%{search}%"),
                models.Membro.email.ilike(f"%{search}%"),
                models.Membro.cidade.ilike(f"%{search}%"),
                models.Membro.matricula.ilike(f"%{search}%"),
            )
        )

    membros = q.all()
    pagamentos = _pagamentos_por_membro_no_mes(db, mes_referencia)
    result = []
    for m in membros:
        p = pagamentos.get(m.id)
        result.append({
            "membro_id": m.id,
            "nome": m.nome_completo,
            "matricula": m.matricula,
            "valor_mensalidade": float(m.valor_mensalidade) if m.valor_mensalidade else 0,
            "pagamento_id": p.id if p else None,
            "valor_pago": float(p.valor_pago) if p and p.valor_pago else 0,
            "data_pagamento": str(p.data_pagamento) if p and p.data_pagamento else None,
            "status": p.status_pagamento if p else "pendente",
            "forma_pagamento": p.forma_pagamento if p else None,
        })
    return result


@app.post("/api/pagamentos/baixa-automatica-banco")
def baixa_automatica_pagamentos_banco(
    mes_referencia: str,
    tolerancia_valor: float = 0.01,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    if not mes_referencia or not re.match(r"^\d{4}-\d{2}$", mes_referencia):
        raise HTTPException(status_code=400, detail="mes_referencia deve estar no formato YYYY-MM")

    pagamentos_mes = _pagamentos_por_membro_no_mes(db, mes_referencia)

    membros_ativos = db.query(models.Membro).filter(models.Membro.status == "ativo").all()
    membros_disponiveis = []
    for membro in membros_ativos:
        valor_mensalidade = float(membro.valor_mensalidade or 0)
        if valor_mensalidade <= 0:
            continue

        pagamento_atual = pagamentos_mes.get(membro.id)
        if pagamento_atual and pagamento_atual.status_pagamento == "pago":
            continue

        membros_disponiveis.append({
            "id": membro.id,
            "nome": membro.nome_completo,
            "cpf": membro.cpf,
            "matricula": membro.matricula,
            "valor_mensalidade": valor_mensalidade,
            "pagamento_atual": pagamento_atual
        })

    conciliacoes_abertas = db.query(models.Conciliacao).filter(
        models.Conciliacao.mes_referencia == mes_referencia,
        models.Conciliacao.tipo == "credito",
        models.Conciliacao.conciliado == False
    ).order_by(models.Conciliacao.data_extrato.asc()).all()

    total_analisados = len(conciliacoes_abertas)
    total_baixados = 0
    total_sem_match = 0
    total_ambiguos = 0
    detalhes = []
    membros_ja_baixados = set()

    for conciliacao in conciliacoes_abertas:
        valor_extrato = float(conciliacao.valor_extrato or 0)
        descricao_extrato = conciliacao.descricao_extrato or ""

        candidatos = []
        for membro in membros_disponiveis:
            if membro["id"] in membros_ja_baixados:
                continue

            if abs(valor_extrato - membro["valor_mensalidade"]) > tolerancia_valor:
                continue

            metrica = _pontuacao_match_membro_extrato(
                membro_nome=membro["nome"],
                membro_cpf=membro.get("cpf"),
                membro_matricula=membro.get("matricula"),
                descricao_extrato=descricao_extrato
            )

            if metrica["confianca"] == "baixa":
                continue

            candidatos.append((membro, metrica))

        if not candidatos:
            total_sem_match += 1
            continue

        candidatos.sort(key=lambda item: item[1]["score"], reverse=True)
        melhor_score = candidatos[0][1]["score"]
        melhores = [item for item in candidatos if item[1]["score"] == melhor_score]

        if len(melhores) != 1:
            total_sem_match += 1
            total_ambiguos += 1
            continue

        if len(candidatos) > 1:
            segundo_score = candidatos[1][1]["score"]
            gap = melhor_score - segundo_score
            if gap < 15 and not (
                melhores[0][1]["cpf_match"] or melhores[0][1]["matricula_match"]
            ):
                total_sem_match += 1
                total_ambiguos += 1
                continue

        if melhor_score < 20:
            total_sem_match += 1
            continue

        membro_match = melhores[0][0]
        metrica_match = melhores[0][1]
        pagamento = membro_match["pagamento_atual"]

        if pagamento:
            pagamento.valor_pago = valor_extrato
            pagamento.status_pagamento = "pago"
            pagamento.data_pagamento = conciliacao.data_extrato
            pagamento.forma_pagamento = "transferencia"
            pagamento.observacoes = (
                (pagamento.observacoes + "\n") if pagamento.observacoes else ""
            ) + f"Baixa automática via extrato bancário ({mes_referencia}) - confiança {metrica_match['confianca']}"
            pagamento.updated_at = datetime.utcnow()
        else:
            pagamento = models.Pagamento(
                id=str(uuid.uuid4()),
                membro_id=membro_match["id"],
                valor_pago=valor_extrato,
                mes_referencia=mes_referencia,
                data_pagamento=conciliacao.data_extrato,
                status_pagamento="pago",
                forma_pagamento="transferencia",
                observacoes=f"Baixa automática via extrato bancário ({mes_referencia}) - confiança {metrica_match['confianca']}",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(pagamento)
            db.flush()

        conciliacao.pagamento_id = pagamento.id
        conciliacao.conciliado = True
        conciliacao.updated_at = datetime.utcnow()

        _register_transaction(db, pagamento, current_user.id)

        membros_ja_baixados.add(membro_match["id"])
        total_baixados += 1
        detalhes.append({
            "conciliacao_id": conciliacao.id,
            "membro_id": membro_match["id"],
            "membro_nome": membro_match["nome"],
            "valor": valor_extrato,
            "data_extrato": str(conciliacao.data_extrato),
            "confianca": metrica_match["confianca"],
            "criterios": {
                "cpf_match": metrica_match["cpf_match"],
                "matricula_match": metrica_match["matricula_match"],
                "nome_completo_match": metrica_match["nome_completo_match"],
                "score_nome_tokens": metrica_match["score_nome_tokens"],
                "score_total": metrica_match["score"]
            }
        })

    db.commit()

    return {
        "ok": True,
        "mes_referencia": mes_referencia,
        "total_analisados": total_analisados,
        "total_baixados": total_baixados,
        "total_sem_match": total_sem_match,
        "total_ambiguos": total_ambiguos,
        "detalhes": detalhes
    }


@app.get("/api/pagamentos/pendencias-conciliacao-manual")
def listar_pendencias_conciliacao_manual(
    mes_referencia: str,
    tolerancia_valor: float = 0.01,
    limite_candidatos: int = 3,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    if not mes_referencia or not re.match(r"^\d{4}-\d{2}$", mes_referencia):
        raise HTTPException(status_code=400, detail="mes_referencia deve estar no formato YYYY-MM")

    pagamentos_mes = _pagamentos_por_membro_no_mes(db, mes_referencia)
    membros_ativos = db.query(models.Membro).filter(models.Membro.status == "ativo").all()

    membros_disponiveis = []
    for membro in membros_ativos:
        valor_mensalidade = float(membro.valor_mensalidade or 0)
        if valor_mensalidade <= 0:
            continue

        pagamento_atual = pagamentos_mes.get(membro.id)
        if pagamento_atual and pagamento_atual.status_pagamento == "pago":
            continue

        membros_disponiveis.append({
            "id": membro.id,
            "nome": membro.nome_completo,
            "cpf": membro.cpf,
            "matricula": membro.matricula,
            "valor_mensalidade": valor_mensalidade,
            "pagamento_atual": pagamento_atual
        })

    conciliacoes_abertas = db.query(models.Conciliacao).filter(
        models.Conciliacao.mes_referencia == mes_referencia,
        models.Conciliacao.tipo == "credito",
        models.Conciliacao.conciliado == False
    ).order_by(models.Conciliacao.data_extrato.asc()).all()

    pendencias = []

    for conciliacao in conciliacoes_abertas:
        valor_extrato = float(conciliacao.valor_extrato or 0)
        descricao_extrato = conciliacao.descricao_extrato or ""

        candidatos = []
        for membro in membros_disponiveis:
            if abs(valor_extrato - membro["valor_mensalidade"]) > tolerancia_valor:
                continue

            metrica = _pontuacao_match_membro_extrato(
                membro_nome=membro["nome"],
                membro_cpf=membro.get("cpf"),
                membro_matricula=membro.get("matricula"),
                descricao_extrato=descricao_extrato
            )

            pagamento_atual = membro.get("pagamento_atual")
            candidatos.append({
                "membro_id": membro["id"],
                "nome": membro["nome"],
                "matricula": membro.get("matricula"),
                "valor_mensalidade": membro["valor_mensalidade"],
                "pagamento_id": pagamento_atual.id if pagamento_atual else None,
                "status_pagamento": pagamento_atual.status_pagamento if pagamento_atual else "pendente",
                "score": metrica["score"],
                "confianca": metrica["confianca"],
                "cpf_match": metrica["cpf_match"],
                "matricula_match": metrica["matricula_match"],
                "nome_match": metrica["nome_completo_match"]
            })

        if not candidatos:
            continue

        candidatos.sort(
            key=lambda c: (
                c["score"],
                1 if c["cpf_match"] else 0,
                1 if c["matricula_match"] else 0,
                1 if c["nome_match"] else 0
            ),
            reverse=True
        )

        melhores = candidatos[:max(1, min(limite_candidatos, 10))]

        pendencias.append({
            "conciliacao_id": conciliacao.id,
            "data_extrato": str(conciliacao.data_extrato) if conciliacao.data_extrato else None,
            "descricao_extrato": conciliacao.descricao_extrato,
            "valor_extrato": valor_extrato,
            "banco": conciliacao.banco,
            "numero_documento": conciliacao.numero_documento,
            "candidatos": melhores
        })

    return {
        "ok": True,
        "mes_referencia": mes_referencia,
        "total_pendencias": len(pendencias),
        "pendencias": pendencias
    }


@app.post("/api/pagamentos/pendencias-conciliacao-manual/confirmar")
def confirmar_pendencia_conciliacao_manual(
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    conciliacao_id = payload.get("conciliacao_id")
    membro_id = payload.get("membro_id")

    if not conciliacao_id or not membro_id:
        raise HTTPException(status_code=400, detail="conciliacao_id e membro_id são obrigatórios")

    conciliacao = db.query(models.Conciliacao).filter(models.Conciliacao.id == conciliacao_id).first()
    if not conciliacao:
        raise HTTPException(status_code=404, detail="Lançamento de conciliação não encontrado")

    if conciliacao.conciliado:
        raise HTTPException(status_code=400, detail="Este lançamento já está conciliado")

    if conciliacao.tipo != "credito":
        raise HTTPException(status_code=400, detail="Apenas lançamentos de crédito podem dar baixa em mensalidade")

    mes_ref = conciliacao.mes_referencia or (
        conciliacao.data_extrato.strftime("%Y-%m") if conciliacao.data_extrato else None
    )
    if not mes_ref:
        raise HTTPException(status_code=400, detail="Não foi possível identificar o mês de referência")

    pagamento = db.query(models.Pagamento).filter(
        models.Pagamento.membro_id == membro_id,
        models.Pagamento.mes_referencia == mes_ref
    ).first()

    valor_extrato = float(conciliacao.valor_extrato or 0)

    if pagamento:
        pagamento.valor_pago = valor_extrato
        pagamento.status_pagamento = "pago"
        pagamento.data_pagamento = conciliacao.data_extrato
        pagamento.forma_pagamento = "transferencia"
        pagamento.observacoes = (
            (pagamento.observacoes + "\n") if pagamento.observacoes else ""
        ) + f"Baixa manual via pendência de conciliação ({mes_ref})"
        pagamento.updated_at = datetime.utcnow()
    else:
        pagamento = models.Pagamento(
            id=str(uuid.uuid4()),
            membro_id=membro_id,
            valor_pago=valor_extrato,
            mes_referencia=mes_ref,
            data_pagamento=conciliacao.data_extrato,
            status_pagamento="pago",
            forma_pagamento="transferencia",
            observacoes=f"Baixa manual via pendência de conciliação ({mes_ref})",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(pagamento)
        db.flush()

    conciliacao.pagamento_id = pagamento.id
    conciliacao.conciliado = True
    conciliacao.updated_at = datetime.utcnow()

    _register_transaction(db, pagamento, current_user.id)

    db.commit()

    membro = db.query(models.Membro).filter(models.Membro.id == membro_id).first()

    return {
        "ok": True,
        "detail": "Baixa manual realizada com sucesso",
        "conciliacao_id": conciliacao.id,
        "pagamento_id": pagamento.id,
        "membro_nome": membro.nome_completo if membro else None,
        "mes_referencia": mes_ref
    }

@app.post("/api/pagamentos", response_model=schemas.PagamentoResponse)
def create_pagamento(req: schemas.PagamentoCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    # Check if payment already exists
    existing = db.query(models.Pagamento).filter(
        models.Pagamento.membro_id == req.membro_id,
        models.Pagamento.mes_referencia == req.mes_referencia
    ).first()
    if existing:
        for k, v in req.dict(exclude_none=True).items():
            setattr(existing, k, v)
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        # Register transaction
        _register_transaction(db, existing, current_user.id)
        return existing
    
    p = models.Pagamento(
        id=str(uuid.uuid4()),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        **req.dict()
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    _register_transaction(db, p, current_user.id)
    return p

def _register_transaction(db, pagamento, user_id):
    m = db.query(models.Membro).filter(models.Membro.id == pagamento.membro_id).first()
    nome = m.nome_completo if m else "Membro"
    # Check if transaction exists for this pagamento
    existing = db.query(models.Transacao).filter(
        models.Transacao.origem == "mensalidade",
        models.Transacao.membro_id == pagamento.membro_id,
        cast(models.Transacao.categoria, String).ilike(f"%{pagamento.mes_referencia}%")
    ).first()
    if not existing:
        t = models.Transacao(
            id=str(uuid.uuid4()),
            user_id=user_id,
            descricao=f"Mensalidade {nome} - {pagamento.mes_referencia}",
            valor=pagamento.valor_pago,
            tipo="entrada",
            categoria=f"Mensalidade {pagamento.mes_referencia}",
            data_transacao=pagamento.data_pagamento or date.today(),
            origem="mensalidade",
            membro_id=pagamento.membro_id,
            created_at=datetime.utcnow()
        )
        db.add(t)
        db.commit()


def _delete_transacoes_despesa_por_payload(db: Session, payload: dict):
    transacoes = db.query(models.Transacao).filter(
        models.Transacao.tipo == "saida",
        models.Transacao.descricao == payload.get("descricao"),
        models.Transacao.categoria == payload.get("categoria"),
        models.Transacao.data_transacao == payload.get("data_despesa"),
        models.Transacao.valor == payload.get("valor"),
        models.Transacao.origem == "despesa"
    ).all()
    for t in transacoes:
        db.delete(t)


def _sync_transacao_despesa(db: Session, despesa, user_id: str):
    transacoes = db.query(models.Transacao).filter(
        models.Transacao.tipo == "saida",
        models.Transacao.descricao == despesa.descricao,
        models.Transacao.categoria == despesa.categoria,
        models.Transacao.data_transacao == despesa.data_despesa,
        models.Transacao.valor == despesa.valor,
        models.Transacao.origem == "despesa"
    ).all()

    if transacoes:
        principal = transacoes[0]
        principal.user_id = user_id
        principal.descricao = despesa.descricao
        principal.valor = despesa.valor
        principal.tipo = "saida"
        principal.categoria = despesa.categoria
        principal.data_transacao = despesa.data_despesa
        principal.origem = "despesa"
        principal.updated_at = datetime.utcnow()
        for duplicada in transacoes[1:]:
            db.delete(duplicada)
        return

    db.add(models.Transacao(
        id=str(uuid.uuid4()),
        user_id=user_id,
        descricao=despesa.descricao,
        valor=despesa.valor,
        tipo="saida",
        categoria=despesa.categoria,
        data_transacao=despesa.data_despesa,
        origem="despesa",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    ))


def _delete_transacoes_outra_renda_por_payload(db: Session, payload: dict):
    origens_possiveis = ["outra_renda"]
    if payload.get("categoria"):
        origens_possiveis.append(payload["categoria"])

    transacoes = db.query(models.Transacao).filter(
        models.Transacao.tipo == "entrada",
        models.Transacao.descricao == payload.get("descricao"),
        models.Transacao.categoria == payload.get("categoria"),
        models.Transacao.data_transacao == payload.get("data_recebimento"),
        models.Transacao.valor == payload.get("valor"),
        models.Transacao.origem.in_(origens_possiveis)
    ).all()
    for t in transacoes:
        db.delete(t)


def _sync_transacao_outra_renda(db: Session, renda, user_id: str):
    origens_possiveis = ["outra_renda"]
    if renda.categoria:
        origens_possiveis.append(renda.categoria)

    transacoes = db.query(models.Transacao).filter(
        models.Transacao.tipo == "entrada",
        models.Transacao.descricao == renda.descricao,
        models.Transacao.categoria == renda.categoria,
        models.Transacao.data_transacao == renda.data_recebimento,
        models.Transacao.valor == renda.valor,
        models.Transacao.origem.in_(origens_possiveis)
    ).all()

    if transacoes:
        principal = transacoes[0]
        principal.user_id = user_id
        principal.descricao = renda.descricao
        principal.valor = renda.valor
        principal.tipo = "entrada"
        principal.categoria = renda.categoria
        principal.data_transacao = renda.data_recebimento
        principal.origem = "outra_renda"
        principal.updated_at = datetime.utcnow()
        for duplicada in transacoes[1:]:
            db.delete(duplicada)
        return

    db.add(models.Transacao(
        id=str(uuid.uuid4()),
        user_id=user_id,
        descricao=renda.descricao,
        valor=renda.valor,
        tipo="entrada",
        categoria=renda.categoria,
        data_transacao=renda.data_recebimento,
        origem="outra_renda",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    ))

@app.put("/api/pagamentos/{pagamento_id}", response_model=schemas.PagamentoResponse)
def update_pagamento(pagamento_id: str, req: schemas.PagamentoUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    p = db.query(models.Pagamento).filter(models.Pagamento.id == pagamento_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado")
    for k, v in req.dict(exclude_none=True).items():
        setattr(p, k, v)
    p.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(p)
    return p

@app.delete("/api/pagamentos/{pagamento_id}")
def delete_pagamento(pagamento_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    p = db.query(models.Pagamento).filter(models.Pagamento.id == pagamento_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado")
    db.delete(p)
    db.commit()
    return {"ok": True}


# ════════════════════════════════════════════════════════════════════════════════
# DESPESAS
# ════════════════════════════════════════════════════════════════════════════════
@app.get("/api/despesas", response_model=List[schemas.DespesaResponse])
def list_despesas(
    mes_referencia: Optional[str] = None,
    categoria: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    q = db.query(models.Despesa)
    if mes_referencia:
        q = q.filter(models.Despesa.mes_referencia == mes_referencia)
    if categoria:
        q = q.filter(models.Despesa.categoria == categoria)
    return q.order_by(models.Despesa.data_despesa.desc()).all()

@app.post("/api/despesas", response_model=schemas.DespesaResponse)
def create_despesa(req: schemas.DespesaCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    mes_ref = req.mes_referencia or req.data_despesa.strftime("%Y-%m")
    descricao = (req.descricao or "").strip()
    d = models.Despesa(id=str(uuid.uuid4()), user_id=current_user.id, mes_referencia=mes_ref,
                        created_at=datetime.utcnow(), **req.dict(exclude={"mes_referencia", "descricao"}), descricao=descricao)
    d.mes_referencia = mes_ref
    db.add(d)
    _sync_transacao_despesa(db, d, current_user.id)
    db.commit()
    db.refresh(d)
    return d

@app.put("/api/despesas/{despesa_id}", response_model=schemas.DespesaResponse)
def update_despesa(despesa_id: str, req: schemas.DespesaUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    d = db.query(models.Despesa).filter(models.Despesa.id == despesa_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Despesa não encontrada")
    payload_antigo = {
        "descricao": d.descricao,
        "categoria": d.categoria,
        "data_despesa": d.data_despesa,
        "valor": d.valor,
    }
    for k, v in req.dict(exclude_none=True).items():
        if k == "descricao" and isinstance(v, str):
            v = v.strip()
        setattr(d, k, v)
    _delete_transacoes_despesa_por_payload(db, payload_antigo)
    _sync_transacao_despesa(db, d, current_user.id)
    db.commit()
    db.refresh(d)
    return d

@app.delete("/api/despesas/{despesa_id}")
def delete_despesa(despesa_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    d = db.query(models.Despesa).filter(models.Despesa.id == despesa_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Despesa não encontrada")
    _delete_transacoes_despesa_por_payload(db, {
        "descricao": d.descricao,
        "categoria": d.categoria,
        "data_despesa": d.data_despesa,
        "valor": d.valor,
    })
    db.delete(d)
    db.commit()
    return {"ok": True}


# ════════════════════════════════════════════════════════════════════════════════
# OUTRAS RENDAS
# ════════════════════════════════════════════════════════════════════════════════
@app.get("/api/outras-rendas", response_model=List[schemas.OutraRendaResponse])
def list_outras_rendas(
    mes_referencia: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    q = db.query(models.OutraRenda)
    if mes_referencia:
        q = q.filter(models.OutraRenda.mes_referencia == mes_referencia)
    return q.order_by(models.OutraRenda.data_recebimento.desc()).all()

@app.post("/api/outras-rendas", response_model=schemas.OutraRendaResponse)
def create_outra_renda(req: schemas.OutraRendaCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    mes_ref = req.mes_referencia or req.data_recebimento.strftime("%Y-%m")
    r = models.OutraRenda(id=str(uuid.uuid4()), user_id=current_user.id, mes_referencia=mes_ref,
                           created_at=datetime.utcnow(), **req.dict(exclude={"mes_referencia"}))
    r.mes_referencia = mes_ref
    db.add(r)
    _sync_transacao_outra_renda(db, r, current_user.id)
    db.commit()
    db.refresh(r)
    return r

@app.put("/api/outras-rendas/{renda_id}", response_model=schemas.OutraRendaResponse)
def update_outra_renda(renda_id: str, req: schemas.OutraRendaUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    r = db.query(models.OutraRenda).filter(models.OutraRenda.id == renda_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Renda não encontrada")
    payload_antigo = {
        "descricao": r.descricao,
        "categoria": r.categoria,
        "data_recebimento": r.data_recebimento,
        "valor": r.valor,
    }
    for k, v in req.dict(exclude_none=True).items():
        setattr(r, k, v)
    _delete_transacoes_outra_renda_por_payload(db, payload_antigo)
    _sync_transacao_outra_renda(db, r, current_user.id)
    db.commit()
    db.refresh(r)
    return r

@app.delete("/api/outras-rendas/{renda_id}")
def delete_outra_renda(renda_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    r = db.query(models.OutraRenda).filter(models.OutraRenda.id == renda_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Renda não encontrada")
    _delete_transacoes_outra_renda_por_payload(db, {
        "descricao": r.descricao,
        "categoria": r.categoria,
        "data_recebimento": r.data_recebimento,
        "valor": r.valor,
    })
    db.delete(r)
    db.commit()
    return {"ok": True}


# ════════════════════════════════════════════════════════════════════════════════
# APLICAÇÕES FINANCEIRAS
# ════════════════════════════════════════════════════════════════════════════════
def _calc_saldo_atual_aplicacao(
    saldo_anterior: Optional[float],
    aplicacoes: Optional[float],
    rendimento_bruto: Optional[float],
    impostos: Optional[float],
    resgate: Optional[float]
) -> float:
    saldo_anterior = float(saldo_anterior or 0)
    aplicacoes = float(aplicacoes or 0)
    rendimento_bruto = float(rendimento_bruto or 0)
    impostos = float(impostos or 0)
    resgate = float(resgate or 0)
    return round(saldo_anterior + aplicacoes + rendimento_bruto - impostos - resgate, 2)


@app.get("/api/aplicacoes-financeiras", response_model=List[schemas.AplicacaoFinanceiraResponse])
def list_aplicacoes_financeiras(
    mes_referencia: Optional[str] = None,
    instituicao: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    q = db.query(models.AplicacaoFinanceira)
    if mes_referencia:
        q = q.filter(models.AplicacaoFinanceira.mes_referencia == mes_referencia)
    if instituicao:
        q = q.filter(models.AplicacaoFinanceira.instituicao.ilike(f"%{instituicao}%"))
    return q.order_by(models.AplicacaoFinanceira.instituicao.asc(), models.AplicacaoFinanceira.produto.asc()).all()


@app.get("/api/aplicacoes-financeiras/resumo", response_model=schemas.AplicacaoFinanceiraResumoResponse)
def resumo_aplicacoes_financeiras(
    mes_referencia: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    mes_ref = mes_referencia or date.today().strftime("%Y-%m")
    registros = db.query(models.AplicacaoFinanceira).filter(
        models.AplicacaoFinanceira.mes_referencia == mes_ref
    ).all()

    totais = {
        "saldo_anterior": round(sum(float(r.saldo_anterior or 0) for r in registros), 2),
        "aplicacoes": round(sum(float(r.aplicacoes or 0) for r in registros), 2),
        "rendimento_bruto": round(sum(float(r.rendimento_bruto or 0) for r in registros), 2),
        "impostos": round(sum(float(r.impostos or 0) for r in registros), 2),
        "resgate": round(sum(float(r.resgate or 0) for r in registros), 2),
        "saldo_atual": round(sum(float(r.saldo_atual or 0) for r in registros), 2),
    }

    return {
        "mes_referencia": mes_ref,
        "total_registros": len(registros),
        "totais": totais
    }


@app.post("/api/aplicacoes-financeiras", response_model=schemas.AplicacaoFinanceiraResponse)
def create_aplicacao_financeira(
    req: schemas.AplicacaoFinanceiraCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    mes_ref = req.mes_referencia or date.today().strftime("%Y-%m")
    saldo_atual = _calc_saldo_atual_aplicacao(
        req.saldo_anterior,
        req.aplicacoes,
        req.rendimento_bruto,
        req.impostos,
        req.resgate
    )
    registro = models.AplicacaoFinanceira(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        mes_referencia=mes_ref,
        instituicao=(req.instituicao or "").strip(),
        produto=(req.produto or "").strip(),
        saldo_anterior=float(req.saldo_anterior or 0),
        aplicacoes=float(req.aplicacoes or 0),
        rendimento_bruto=float(req.rendimento_bruto or 0),
        impostos=float(req.impostos or 0),
        resgate=float(req.resgate or 0),
        saldo_atual=saldo_atual,
        observacoes=req.observacoes,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(registro)
    db.commit()
    db.refresh(registro)
    return registro


@app.put("/api/aplicacoes-financeiras/{aplicacao_id}", response_model=schemas.AplicacaoFinanceiraResponse)
def update_aplicacao_financeira(
    aplicacao_id: str,
    req: schemas.AplicacaoFinanceiraUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    registro = db.query(models.AplicacaoFinanceira).filter(models.AplicacaoFinanceira.id == aplicacao_id).first()
    if not registro:
        raise HTTPException(status_code=404, detail="Aplicação financeira não encontrada")

    for k, v in req.dict(exclude_none=True).items():
        if k in ("instituicao", "produto") and isinstance(v, str):
            v = v.strip()
        setattr(registro, k, v)

    registro.saldo_atual = _calc_saldo_atual_aplicacao(
        registro.saldo_anterior,
        registro.aplicacoes,
        registro.rendimento_bruto,
        registro.impostos,
        registro.resgate
    )
    registro.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(registro)
    return registro


@app.delete("/api/aplicacoes-financeiras/{aplicacao_id}")
def delete_aplicacao_financeira(
    aplicacao_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    registro = db.query(models.AplicacaoFinanceira).filter(models.AplicacaoFinanceira.id == aplicacao_id).first()
    if not registro:
        raise HTTPException(status_code=404, detail="Aplicação financeira não encontrada")

    db.delete(registro)
    db.commit()
    return {"ok": True}


# ════════════════════════════════════════════════════════════════════════════════
# TRANSAÇÕES / FLUXO DE CAIXA
# ════════════════════════════════════════════════════════════════════════════════
@app.get("/api/transacoes")
def list_transacoes(
    mes_referencia: Optional[str] = None,
    tipo: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    q = db.query(models.Transacao)
    if mes_referencia:
        ano, mes = mes_referencia.split("-")
        inicio = date(int(ano), int(mes), 1)
        ultimo_dia = calendar.monthrange(int(ano), int(mes))[1]
        fim = date(int(ano), int(mes), ultimo_dia)
        q = q.filter(models.Transacao.data_transacao.between(inicio, fim))
    if tipo:
        q = q.filter(models.Transacao.tipo == tipo)
    return q.order_by(models.Transacao.data_transacao.desc()).all()


def _mes_anterior(mes_ref: str) -> str:
    ano, mes = mes_ref.split("-")
    ano_i = int(ano)
    mes_i = int(mes)
    if mes_i == 1:
        return f"{ano_i - 1}-12"
    return f"{ano_i}-{str(mes_i - 1).zfill(2)}"


def _saldo_anterior_mes(db: Session, mes_ref: str) -> float:
    saldo_manual = db.query(models.SaldoMensal).filter(models.SaldoMensal.mes_referencia == mes_ref).first()
    if saldo_manual:
        return round(float(saldo_manual.valor_saldo_inicial or 0), 2)

    total_pagamentos_anteriores = db.query(sql_func.coalesce(sql_func.sum(models.Pagamento.valor_pago), 0)).filter(
        models.Pagamento.status_pagamento == "pago",
        models.Pagamento.mes_referencia.isnot(None),
        models.Pagamento.mes_referencia < mes_ref
    ).scalar()

    total_outras_rendas_anteriores = db.query(sql_func.coalesce(sql_func.sum(models.OutraRenda.valor), 0)).filter(
        models.OutraRenda.mes_referencia.isnot(None),
        models.OutraRenda.mes_referencia < mes_ref
    ).scalar()

    total_despesas_anteriores = db.query(sql_func.coalesce(sql_func.sum(models.Despesa.valor), 0)).filter(
        models.Despesa.mes_referencia.isnot(None),
        models.Despesa.mes_referencia < mes_ref
    ).scalar()

    return round(
        float(total_pagamentos_anteriores or 0) + float(total_outras_rendas_anteriores or 0) - float(total_despesas_anteriores or 0),
        2
    )


@app.get("/api/saldo-inicial", response_model=schemas.SaldoMensalResponse)
def get_saldo_inicial(
    mes_referencia: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    mes_ref = mes_referencia or date.today().strftime("%Y-%m")
    saldo_manual = db.query(models.SaldoMensal).filter(models.SaldoMensal.mes_referencia == mes_ref).first()

    if saldo_manual:
        return {
            "mes_referencia": mes_ref,
            "valor_saldo_inicial": round(float(saldo_manual.valor_saldo_inicial or 0), 2),
            "origem": "manual",
            "observacoes": saldo_manual.observacoes
        }

    return {
        "mes_referencia": mes_ref,
        "valor_saldo_inicial": _saldo_anterior_mes(db, mes_ref),
        "origem": "calculado",
        "observacoes": None
    }


@app.put("/api/saldo-inicial", response_model=schemas.SaldoMensalResponse)
def upsert_saldo_inicial(
    req: schemas.SaldoMensalUpsert,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    registro = db.query(models.SaldoMensal).filter(models.SaldoMensal.mes_referencia == req.mes_referencia).first()

    if registro:
        registro.valor_saldo_inicial = float(req.valor_saldo_inicial)
        registro.observacoes = req.observacoes
        registro.user_id = current_user.id
        registro.updated_at = datetime.utcnow()
    else:
        registro = models.SaldoMensal(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            mes_referencia=req.mes_referencia,
            valor_saldo_inicial=float(req.valor_saldo_inicial),
            observacoes=req.observacoes,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(registro)

    db.commit()
    db.refresh(registro)

    return {
        "mes_referencia": registro.mes_referencia,
        "valor_saldo_inicial": round(float(registro.valor_saldo_inicial or 0), 2),
        "origem": "manual",
        "observacoes": registro.observacoes
    }


@app.delete("/api/saldo-inicial")
def delete_saldo_inicial(
    mes_referencia: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    mes_ref = mes_referencia or date.today().strftime("%Y-%m")
    registro = db.query(models.SaldoMensal).filter(models.SaldoMensal.mes_referencia == mes_ref).first()

    if not registro:
        return {"ok": True, "deleted": False, "detail": "Saldo manual não encontrado para este mês"}

    db.delete(registro)
    db.commit()
    return {"ok": True, "deleted": True, "detail": "Saldo manual removido; cálculo automático reativado"}

@app.get("/api/fluxo-caixa")
def fluxo_caixa(
    mes_referencia: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    today = date.today()
    mes_ref = mes_referencia or today.strftime("%Y-%m")
    pags_mes = _pagamentos_pagos_membros_ativos_no_mes(db, mes_ref)
    rendas_mes = db.query(models.OutraRenda).filter(models.OutraRenda.mes_referencia == mes_ref).all()
    despesas_mes = db.query(models.Despesa).filter(models.Despesa.mes_referencia == mes_ref).all()

    membros_ids = [p.membro_id for p in pags_mes if p.membro_id]
    nomes_membros = {}
    if membros_ids:
        nomes_membros = {
            m.id: m.nome_completo
            for m in db.query(models.Membro).filter(models.Membro.id.in_(membros_ids)).all()
        }

    transacoes = []

    for p in pags_mes:
        nome = nomes_membros.get(p.membro_id, "Membro")
        transacoes.append({
            "id": f"pag-{p.id}",
            "descricao": f"Mensalidade {nome} - {mes_ref}",
            "valor": float(p.valor_pago) if p.valor_pago else 0,
            "tipo": "entrada",
            "categoria": f"Mensalidade {mes_ref}",
            "data_transacao": p.data_pagamento,
            "origem": "mensalidade"
        })

    for r in rendas_mes:
        transacoes.append({
            "id": f"renda-{r.id}",
            "descricao": r.descricao,
            "valor": float(r.valor) if r.valor else 0,
            "tipo": "entrada",
            "categoria": r.categoria,
            "data_transacao": r.data_recebimento,
            "origem": r.categoria
        })

    for d in despesas_mes:
        transacoes.append({
            "id": f"desp-{d.id}",
            "descricao": d.descricao,
            "valor": float(d.valor) if d.valor else 0,
            "tipo": "saida",
            "categoria": d.categoria,
            "data_transacao": d.data_despesa,
            "origem": "despesa"
        })

    transacoes.sort(key=lambda t: t["data_transacao"] or date.min)

    total_entradas = sum(t["valor"] for t in transacoes if t["tipo"] == "entrada" and t["valor"])
    total_saidas = sum(t["valor"] for t in transacoes if t["tipo"] == "saida" and t["valor"])
    saldo = total_entradas - total_saidas
    saldo_manual_registrado = db.query(models.SaldoMensal).filter(models.SaldoMensal.mes_referencia == mes_ref).first()
    saldo_anterior = _saldo_anterior_mes(db, mes_ref)
    saldo_final = round(saldo_anterior + saldo, 2)

    # Monthly evolution (last 12 months)
    evolucao = []
    for i in range(11, -1, -1):
        ref_date = today - timedelta(days=i * 30)
        mes_iter = ref_date.strftime("%Y-%m")
        pags_i = _pagamentos_pagos_membros_ativos_no_mes(db, mes_iter)
        rendas_i = db.query(models.OutraRenda).filter(models.OutraRenda.mes_referencia == mes_iter).all()
        despesas_i = db.query(models.Despesa).filter(models.Despesa.mes_referencia == mes_iter).all()
        ent = sum(float(p.valor_pago) for p in pags_i if p.valor_pago) + sum(float(r.valor) for r in rendas_i if r.valor)
        sai = sum(float(d.valor) for d in despesas_i if d.valor)
        evolucao.append({"mes": mes_iter, "entradas": ent, "saidas": sai, "saldo": ent - sai})

    return {
        "mes_referencia": mes_ref,
        "mes_referencia_anterior": _mes_anterior(mes_ref),
        "saldo_anterior": saldo_anterior,
        "origem_saldo_anterior": "manual" if saldo_manual_registrado else "calculado",
        "total_entradas": total_entradas,
        "total_saidas": total_saidas,
        "saldo": saldo,
        "saldo_final": saldo_final,
        "transacoes": [{
            "id": t["id"], "descricao": t["descricao"], "valor": t["valor"],
            "tipo": t["tipo"], "categoria": t["categoria"],
            "data_transacao": str(t["data_transacao"]) if t["data_transacao"] else None,
            "origem": t["origem"]
        } for t in transacoes],
        "evolucao_mensal": evolucao
    }

@app.post("/api/transacoes", response_model=schemas.TransacaoResponse)
def create_transacao(req: schemas.TransacaoCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    t = models.Transacao(id=str(uuid.uuid4()), user_id=current_user.id, created_at=datetime.utcnow(), **req.dict())
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


# ════════════════════════════════════════════════════════════════════════════════
# DASHBOARD
# ════════════════════════════════════════════════════════════════════════════════
@app.get("/api/dashboard")
def dashboard(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    today = date.today()
    mes_atual = today.strftime("%Y-%m")
    ano, mes = mes_atual.split("-")

    total_membros = db.query(models.Membro).filter(models.Membro.status == 'ativo').count()
    total_inativos = db.query(models.Membro).filter(models.Membro.status == 'inativo').count()

    # Pagamentos do mês (por membro ativo, evitando duplicidade no mesmo mês)
    pags_mes = _pagamentos_pagos_membros_ativos_no_mes(db, mes_atual)
    total_arrecadado = sum(float(p.valor_pago) for p in pags_mes if p.valor_pago)
    total_pagantes = len(pags_mes)
    inadimplentes = total_membros - total_pagantes

    # Despesas do mês
    despesas_mes = db.query(models.Despesa).filter(models.Despesa.mes_referencia == mes_atual).all()
    total_despesas = sum(d.valor for d in despesas_mes if d.valor)

    # Outras rendas do mês
    rendas_mes = db.query(models.OutraRenda).filter(models.OutraRenda.mes_referencia == mes_atual).all()
    total_outras_rendas = sum(r.valor for r in rendas_mes if r.valor)

    saldo_mes = total_arrecadado + total_outras_rendas - total_despesas

    # Aniversariantes do mês
    aniv_mes = db.query(models.Membro).filter(
        sql_func.strftime('%m', models.Membro.data_nascimento) == str(int(mes)).zfill(2)
    ).count()

    # Aniversariantes do dia
    aniv_hoje = db.query(models.Membro).filter(
        sql_func.strftime('%m-%d', models.Membro.data_nascimento) == today.strftime('%m-%d')
    ).all()

    # Evolução últimos 6 meses
    evolucao = []
    for i in range(5, -1, -1):
        ref_date = today.replace(day=1) - timedelta(days=i * 28)
        mes_iter = ref_date.strftime("%Y-%m")
        pags_i = db.query(models.Pagamento).filter(
            models.Pagamento.mes_referencia == mes_iter,
            models.Pagamento.status_pagamento == 'pago'
        ).all()
        desp_i = db.query(models.Despesa).filter(models.Despesa.mes_referencia == mes_iter).all()
        rend_i = db.query(models.OutraRenda).filter(models.OutraRenda.mes_referencia == mes_iter).all()
        ent_i = sum(float(p.valor_pago) for p in pags_i if p.valor_pago) + sum(r.valor for r in rend_i if r.valor)
        sai_i = sum(d.valor for d in desp_i if d.valor)
        evolucao.append({"mes": mes_iter, "entradas": ent_i, "saidas": sai_i, "saldo": ent_i - sai_i})

    # Por status
    status_membros = db.query(models.Membro.status, sql_func.count(models.Membro.id)).group_by(models.Membro.status).all()

    return {
        "total_membros": total_membros,
        "total_inativos": total_inativos,
        "total_pagantes": total_pagantes,
        "inadimplentes": inadimplentes,
        "total_arrecadado": total_arrecadado,
        "total_despesas": total_despesas,
        "total_outras_rendas": total_outras_rendas,
        "saldo_mes": saldo_mes,
        "aniversariantes_mes": aniv_mes,
        "aniversariantes_hoje": [{"id": m.id, "nome": m.nome_completo, "data_nascimento": str(m.data_nascimento)} for m in aniv_hoje],
        "evolucao_mensal": evolucao,
        "status_membros": [{"status": s, "total": c} for s, c in status_membros],
        "mes_atual": mes_atual,
    }


# ════════════════════════════════════════════════════════════════════════════════
# FESTAS
# ════════════════════════════════════════════════════════════════════════════════
def _get_frontend_base_url() -> str:
    return os.getenv("FRONTEND_BASE_URL", "http://localhost:5173").rstrip("/")


def _get_festa_link_template() -> str:
    return f"{_get_frontend_base_url()}/festa-inscricao/{{festa_id}}"


def _build_festa_public_link(festa_id: str) -> str:
    return f"{_get_frontend_base_url()}/festa-inscricao/{festa_id}"


def _somente_numeros(valor: Optional[str]) -> str:
    return re.sub(r"\D", "", (valor or "").strip())


def _politica_preco_default() -> dict:
    return {
        "cortesia_acompanhantes": 1,
        "idade_gratis_ate": 5,
        "idade_meia_de": 6,
        "idade_meia_ate": 10,
        "percentual_meia": 50,
    }


def _safe_int(valor, default: int, min_value: Optional[int] = None, max_value: Optional[int] = None) -> int:
    try:
        parsed = int(valor)
    except (TypeError, ValueError):
        parsed = default
    if min_value is not None:
        parsed = max(min_value, parsed)
    if max_value is not None:
        parsed = min(max_value, parsed)
    return parsed


def _obter_politica_preco_festa(festa: models.Festa) -> dict:
    politica = _politica_preco_default()
    raw = (festa.politica_precos or "").strip() if festa else ""
    if not raw:
        return politica

    try:
        data = json.loads(raw)
    except Exception:
        return politica

    if isinstance(data, dict):
        src = data.get("pricing_rules") if isinstance(data.get("pricing_rules"), dict) else data
        if isinstance(src, dict):
            if src.get("cortesia_acompanhantes") is not None:
                politica["cortesia_acompanhantes"] = _safe_int(src.get("cortesia_acompanhantes"), 1, 0)
            if src.get("idade_gratis_ate") is not None:
                politica["idade_gratis_ate"] = _safe_int(src.get("idade_gratis_ate"), 5, 0)
            if src.get("idade_meia_de") is not None:
                politica["idade_meia_de"] = _safe_int(src.get("idade_meia_de"), 6, 0)
            if src.get("idade_meia_ate") is not None:
                politica["idade_meia_ate"] = _safe_int(src.get("idade_meia_ate"), 10, 0)
            if src.get("percentual_meia") is not None:
                politica["percentual_meia"] = _safe_int(src.get("percentual_meia"), 50, 0, 100)

    return politica


def _normalizar_idade(valor: Optional[int], campo: str) -> Optional[int]:
    if valor is None:
        return None
    try:
        idade = int(valor)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail=f"{campo} inválida")
    if idade < 0 or idade > 120:
        raise HTTPException(status_code=400, detail=f"{campo} deve estar entre 0 e 120")
    return idade


def _calcular_custo_participante_por_idade(idade: Optional[int], valor_integral: float, politica: dict) -> float:
    valor_base = float(valor_integral or 0)
    if idade is None:
        return valor_base
    idade_gratis_ate = int(politica.get("idade_gratis_ate", 5) or 5)
    idade_meia_de = int(politica.get("idade_meia_de", 6) or 6)
    idade_meia_ate = int(politica.get("idade_meia_ate", 10) or 10)
    percentual_meia = int(politica.get("percentual_meia", 50) or 50)

    if idade <= idade_gratis_ate:
        return 0.0
    if idade_meia_de <= idade <= idade_meia_ate:
        return round(valor_base * (percentual_meia / 100), 2)
    return valor_base


def _validar_membro_por_matricula_cpf(db: Session, matricula: str, cpf: str):
    matricula_limpa = (matricula or "").strip()
    cpf_limpo = _somente_numeros(cpf)

    if not matricula_limpa or not cpf_limpo:
        raise HTTPException(status_code=400, detail="Informe matrícula e CPF")

    membro = db.query(models.Membro).filter(models.Membro.matricula == matricula_limpa).first()
    if not membro:
        raise HTTPException(status_code=401, detail="Matrícula ou CPF inválidos")

    cpf_cadastrado = _somente_numeros(membro.cpf)
    if not cpf_cadastrado or cpf_cadastrado != cpf_limpo:
        raise HTTPException(status_code=401, detail="Matrícula ou CPF inválidos")

    return membro


def _normalizar_filtro_sexo(valor: Optional[str]) -> Optional[List[str]]:
    if not valor:
        return None
    sexo = valor.strip().lower()
    if sexo in ("masculino", "m"):
        return ["masculino", "m"]
    if sexo in ("feminino", "f"):
        return ["feminino", "f"]
    return [sexo]


def _email_valido(email: Optional[str]) -> bool:
    if not email:
        return False
    return re.fullmatch(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email.strip()) is not None


def _montar_payload_inscricao_publica(db: Session, festa: models.Festa, membro: models.Membro):
    politica_preco = _obter_politica_preco_festa(festa)
    titular = db.query(models.ParticipacaoFesta).filter(
        models.ParticipacaoFesta.festa_id == festa.id,
        models.ParticipacaoFesta.membro_id == membro.id,
        models.ParticipacaoFesta.tipo_participante == "titular"
    ).first()

    dependente = db.query(models.ParticipacaoFesta).filter(
        models.ParticipacaoFesta.festa_id == festa.id,
        models.ParticipacaoFesta.membro_id == membro.id,
        models.ParticipacaoFesta.tipo_participante == "dependente"
    ).first()

    convidado = db.query(models.ParticipacaoFesta).filter(
        models.ParticipacaoFesta.festa_id == festa.id,
        models.ParticipacaoFesta.membro_id == membro.id,
        models.ParticipacaoFesta.tipo_participante == "convidado"
    ).first()

    return {
        "ok": True,
        "festa": {
            "id": festa.id,
            "nome_festa": festa.nome_festa,
            "data_festa": str(festa.data_festa) if festa.data_festa else None,
            "local_festa": festa.local_festa,
            "beneficio_titular_dependente_gratis": True,
            "valor_convite": float(festa.valor_convite) if festa.valor_convite else 0,
            "valor_convite_dependente": float(festa.valor_convite_dependente) if festa.valor_convite_dependente else 0,
            "politica_preco": politica_preco,
            "descricao": festa.descricao,
            "status": festa.status,
            "capacidade": festa.capacidade,
        },
        "membro": {
            "id": membro.id,
            "nome": membro.nome_completo,
            "email": membro.email,
            "matricula": membro.matricula,
            "cpf": membro.cpf,
        },
        "inscricao": {
            "titular": {
                "id": titular.id,
                "nome_participante": titular.nome_participante,
                "pago": titular.pago,
                "observacoes": titular.observacoes,
            } if titular else None,
            "dependente": {
                "id": dependente.id,
                "nome_dependente": dependente.nome_dependente,
                "parentesco": dependente.parentesco,
                "pago": dependente.pago,
                "observacoes": dependente.observacoes,
            } if dependente else None,
            "convidado": {
                "id": convidado.id,
                "nome_convidado": convidado.nome_participante,
                "custo_convite": float(convidado.custo_convite) if convidado.custo_convite else 0,
                "pago": convidado.pago,
                "observacoes": convidado.observacoes,
            } if convidado else None,
        }
    }


def _validar_festa_link_disponivel(festa: models.Festa):
    if festa.data_festa and festa.data_festa <= date.today():
        raise HTTPException(status_code=400, detail="Link disponível apenas para festas com data futura")


def _send_html_email(to_email: str, subject: str, html_body: str, plain_text_body: str):
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_from_name = os.getenv("SMTP_FROM_NAME", "UNACOB")
    smtp_from_email = os.getenv("SMTP_FROM_EMAIL", smtp_user or "")
    smtp_starttls = os.getenv("SMTP_STARTTLS", "true").lower() in ("1", "true", "yes", "on")

    if not smtp_host or not smtp_from_email:
        raise HTTPException(status_code=500, detail="Configuração de e-mail incompleta no servidor")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{smtp_from_name} <{smtp_from_email}>"
    msg["To"] = to_email
    msg.set_content(plain_text_body)
    msg.add_alternative(html_body, subtype="html")

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as smtp:
            smtp.ehlo()
            if smtp_starttls:
                smtp.starttls()
                smtp.ehlo()
            if smtp_user and smtp_password:
                smtp.login(smtp_user, smtp_password)
            smtp.send_message(msg)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Falha ao enviar e-mail: {str(exc)}")


@app.get("/api/festas", response_model=List[schemas.FestaResponse])
def list_festas(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return db.query(models.Festa).order_by(models.Festa.data_festa.desc()).all()

@app.post("/api/festas", response_model=schemas.FestaResponse)
def create_festa(req: schemas.FestaCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    payload = req.dict()
    if not payload.get("link_inscricao"):
        payload["link_inscricao"] = _get_festa_link_template()
    f = models.Festa(id=str(uuid.uuid4()), user_id=current_user.id, created_at=datetime.utcnow(), updated_at=datetime.utcnow(), **payload)
    db.add(f)
    db.commit()
    db.refresh(f)
    return f

@app.get("/api/festas/{festa_id}", response_model=schemas.FestaResponse)
def get_festa(festa_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    f = db.query(models.Festa).filter(models.Festa.id == festa_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Festa não encontrada")
    return f

@app.put("/api/festas/{festa_id}", response_model=schemas.FestaResponse)
def update_festa(festa_id: str, req: schemas.FestaUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    f = db.query(models.Festa).filter(models.Festa.id == festa_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Festa não encontrada")
    for k, v in req.dict(exclude_none=True).items():
        setattr(f, k, v)
    if not f.link_inscricao:
        f.link_inscricao = _get_festa_link_template()
    f.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(f)
    return f


@app.post("/api/festas/{festa_id}/enviar-convites")
def enviar_convites_festa(
    festa_id: str,
    req: schemas.FestaConviteEmailRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    festa = db.query(models.Festa).filter(models.Festa.id == festa_id).first()
    if not festa:
        raise HTTPException(status_code=404, detail="Festa não encontrada")
    _validar_festa_link_disponivel(festa)

    q_membros = db.query(models.Membro).filter(
        models.Membro.email.isnot(None),
        models.Membro.email != ""
    )

    if req.filtro_status:
        q_membros = q_membros.filter(models.Membro.status == req.filtro_status)

    if req.filtro_nome:
        q_membros = q_membros.filter(models.Membro.nome_completo.ilike(f"%{req.filtro_nome}%"))

    if req.filtro_matricula:
        q_membros = q_membros.filter(models.Membro.matricula.ilike(f"%{req.filtro_matricula}%"))

    if req.filtro_cidade:
        q_membros = q_membros.filter(models.Membro.cidade.ilike(f"%{req.filtro_cidade}%"))

    sexos = _normalizar_filtro_sexo(req.filtro_sexo)
    if sexos:
        q_membros = q_membros.filter(sql_func.lower(models.Membro.sexo).in_(sexos))

    if req.membro_ids:
        q_membros = q_membros.filter(models.Membro.id.in_(req.membro_ids))

    membros = q_membros.order_by(models.Membro.nome_completo).all()

    if req.somente_email_valido:
        membros = [m for m in membros if _email_valido(m.email)]

    if req.somente_pendentes:
        membros_ja_confirmados = {
            mid for (mid,) in db.query(models.ParticipacaoFesta.membro_id).filter(
                models.ParticipacaoFesta.festa_id == festa.id,
                models.ParticipacaoFesta.tipo_participante == "titular",
                models.ParticipacaoFesta.membro_id.isnot(None)
            ).all()
        }
        membros = [m for m in membros if m.id not in membros_ja_confirmados]

    enviados = 0
    falhas = []

    convite_link = _build_festa_public_link(festa.id)

    for membro in membros:
        assunto = req.assunto or f"Convite: {festa.nome_festa}"

        mensagem_extra = ""
        if req.mensagem:
            mensagem_extra = f"<p style='margin:16px 0;color:#334155'>{req.mensagem}</p>"

        html = f"""
        <html>
            <body style=\"font-family:Arial,sans-serif;background:#f5f7fb;padding:24px;\">
                <div style=\"max-width:640px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;border:1px solid #e5e7eb;\">
                    <h2 style=\"margin:0 0 8px;color:#1e3a5f\">{festa.nome_festa}</h2>
                    <p style=\"margin:0 0 4px;color:#475569\"><strong>Data:</strong> {festa.data_festa}</p>
                    <p style=\"margin:0 0 4px;color:#475569\"><strong>Local:</strong> {festa.local_festa or '-'} </p>
                    <p style=\"margin:0 0 16px;color:#475569\"><strong>Convite:</strong> R$ {float(festa.valor_convite or 0):.2f}</p>
                    {mensagem_extra}
                    <p style=\"margin:0 0 18px;color:#0f172a\">Olá, {membro.nome_completo}. Clique no botão abaixo para confirmar sua participação:</p>
                    <p>
                        <a href=\"{convite_link}\" style=\"display:inline-block;background:#1e3a5f;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600\">Confirmar participação</a>
                    </p>
                    <p style=\"margin-top:18px;color:#64748b;font-size:12px\">Se o botão não abrir, use este link:<br>{convite_link}</p>
                </div>
            </body>
        </html>
        """

        plain = (
            f"{festa.nome_festa}\n"
            f"Data: {festa.data_festa}\n"
            f"Local: {festa.local_festa or '-'}\n\n"
            f"Olá, {membro.nome_completo}.\n"
            "Use o link para confirmar sua participação:\n"
            f"{convite_link}\n"
        )

        try:
            _send_html_email(membro.email, assunto, html, plain)
            enviados += 1
        except Exception as exc:
            falhas.append({"membro": membro.nome_completo, "email": membro.email, "erro": str(exc)})

    return {
        "ok": True,
        "festa_id": festa.id,
        "somente_pendentes": bool(req.somente_pendentes),
        "total_membros_com_email": len(membros),
        "emails_enviados": enviados,
        "emails_com_falha": len(falhas),
        "falhas": falhas[:20]
    }


@app.get("/api/festas/{festa_id}/convite-link/{membro_id}")
def get_convite_link_individual(
    festa_id: str,
    membro_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    festa = db.query(models.Festa).filter(models.Festa.id == festa_id).first()
    if not festa:
        raise HTTPException(status_code=404, detail="Festa não encontrada")
    _validar_festa_link_disponivel(festa)

    membro = db.query(models.Membro).filter(models.Membro.id == membro_id).first()
    if not membro:
        raise HTTPException(status_code=404, detail="Membro não encontrado")

    return {
        "ok": True,
        "festa_id": festa_id,
        "membro_id": membro_id,
        "link": _build_festa_public_link(festa_id)
    }

@app.delete("/api/festas/{festa_id}")
def delete_festa(festa_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    f = db.query(models.Festa).filter(models.Festa.id == festa_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Festa não encontrada")
    db.delete(f)
    db.commit()
    return {"ok": True}

@app.get("/api/festas/{festa_id}/participantes")
def get_participantes(festa_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    parts = db.query(models.ParticipacaoFesta).filter(models.ParticipacaoFesta.festa_id == festa_id).all()
    result = []
    for p in parts:
        pd = {
            "id": p.id, "festa_id": p.festa_id, "membro_id": p.membro_id,
            "nome_participante": p.nome_participante, "tipo_participante": p.tipo_participante,
            "custo_convite": float(p.custo_convite) if p.custo_convite else 0,
            "pago": p.pago, "data_pagamento": str(p.data_pagamento) if p.data_pagamento else None,
            "nome_dependente": p.nome_dependente, "parentesco": p.parentesco,
            "observacoes": p.observacoes, "membro_nome": None
        }
        if p.membro_id:
            m = db.query(models.Membro).filter(models.Membro.id == p.membro_id).first()
            if m:
                pd["membro_nome"] = m.nome_completo
        result.append(pd)
    return result

@app.post("/api/festas/{festa_id}/participantes", response_model=schemas.ParticipacaoResponse)
def add_participante(festa_id: str, req: schemas.ParticipacaoCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    req.festa_id = festa_id
    p = models.ParticipacaoFesta(id=str(uuid.uuid4()), created_at=datetime.utcnow(), updated_at=datetime.utcnow(), **req.dict())
    db.add(p)
    db.commit()
    db.refresh(p)
    return p

@app.put("/api/participantes/{part_id}", response_model=schemas.ParticipacaoResponse)
def update_participante(part_id: str, req: schemas.ParticipacaoUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    p = db.query(models.ParticipacaoFesta).filter(models.ParticipacaoFesta.id == part_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Participante não encontrado")
    for k, v in req.dict(exclude_none=True).items():
        setattr(p, k, v)
    p.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(p)
    return p

@app.delete("/api/participantes/{part_id}")
def delete_participante(part_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    p = db.query(models.ParticipacaoFesta).filter(models.ParticipacaoFesta.id == part_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Participante não encontrado")
    db.delete(p)
    db.commit()
    return {"ok": True}


@app.get("/api/public/festas/{festa_id}")
def get_festa_publica(festa_id: str, db: Session = Depends(get_db)):
    festa = db.query(models.Festa).filter(models.Festa.id == festa_id).first()
    if not festa:
        raise HTTPException(status_code=404, detail="Festa não encontrada")
    _validar_festa_link_disponivel(festa)

    return {
        "ok": True,
        "festa": {
            "id": festa.id,
            "nome_festa": festa.nome_festa,
            "data_festa": str(festa.data_festa) if festa.data_festa else None,
            "local_festa": festa.local_festa,
            "beneficio_titular_dependente_gratis": True,
            "valor_convite": float(festa.valor_convite) if festa.valor_convite else 0,
            "valor_convite_dependente": float(festa.valor_convite_dependente) if festa.valor_convite_dependente else 0,
            "descricao": festa.descricao,
            "status": festa.status,
            "capacidade": festa.capacidade,
        },
    }


@app.post("/api/public/festas/{festa_id}/identificar")
def identificar_membro_festa_publica(
    festa_id: str,
    req: schemas.ParticipacaoPublicaAuthRequest,
    db: Session = Depends(get_db)
):
    festa = db.query(models.Festa).filter(models.Festa.id == festa_id).first()
    if not festa:
        raise HTTPException(status_code=404, detail="Festa não encontrada")
    _validar_festa_link_disponivel(festa)

    membro = _validar_membro_por_matricula_cpf(db, req.matricula, req.cpf)
    return _montar_payload_inscricao_publica(db, festa, membro)


@app.post("/api/public/festas/{festa_id}/confirmar", response_model=schemas.ParticipacaoPublicaResponse)
def confirmar_participacao_publica(
    festa_id: str,
    req: schemas.ParticipacaoPublicaConfirmRequest,
    db: Session = Depends(get_db)
):
    festa = db.query(models.Festa).filter(models.Festa.id == festa_id).first()
    if not festa:
        raise HTTPException(status_code=404, detail="Festa não encontrada")
    _validar_festa_link_disponivel(festa)

    membro = _validar_membro_por_matricula_cpf(db, req.matricula, req.cpf)

    if req.levar_dependente and not req.nome_dependente:
        raise HTTPException(status_code=400, detail="Informe o nome do dependente")

    if req.levar_convidado and not req.nome_convidado:
        raise HTTPException(status_code=400, detail="Informe o nome do convidado")

    idade_dependente = _normalizar_idade(req.idade_dependente, "Idade do dependente")
    idade_convidado = _normalizar_idade(req.idade_convidado, "Idade do convidado")

    valor_integral = float(festa.valor_convite or 0)
    politica_preco = _obter_politica_preco_festa(festa)
    custo_dependente = _calcular_custo_participante_por_idade(idade_dependente, valor_integral, politica_preco)
    custo_convidado = _calcular_custo_participante_por_idade(idade_convidado, valor_integral, politica_preco)

    cortesias = int(politica_preco.get("cortesia_acompanhantes", 1) or 0)
    if req.levar_dependente and cortesias > 0:
        custo_dependente = 0.0
        cortesias -= 1
    if req.levar_convidado and cortesias > 0:
        custo_convidado = 0.0

    titular = db.query(models.ParticipacaoFesta).filter(
        models.ParticipacaoFesta.festa_id == festa.id,
        models.ParticipacaoFesta.membro_id == membro.id,
        models.ParticipacaoFesta.tipo_participante == "titular"
    ).first()

    if not titular:
        titular = models.ParticipacaoFesta(
            id=str(uuid.uuid4()),
            festa_id=festa.id,
            membro_id=membro.id,
            nome_participante=membro.nome_completo,
            tipo_participante="titular",
            custo_convite=0,
            pago=False,
            observacoes=req.observacoes,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(titular)
    else:
        titular.nome_participante = membro.nome_completo
        titular.custo_convite = 0
        titular.observacoes = req.observacoes
        titular.updated_at = datetime.utcnow()

    dependente_id = None
    if req.levar_dependente and req.nome_dependente:
        dependente = db.query(models.ParticipacaoFesta).filter(
            models.ParticipacaoFesta.festa_id == festa.id,
            models.ParticipacaoFesta.membro_id == membro.id,
            models.ParticipacaoFesta.tipo_participante == "dependente"
        ).first()
        if not dependente:
            dependente = models.ParticipacaoFesta(
                id=str(uuid.uuid4()),
                festa_id=festa.id,
                membro_id=membro.id,
                nome_participante=membro.nome_completo,
                tipo_participante="dependente",
                custo_convite=custo_dependente,
                pago=False,
                nome_dependente=req.nome_dependente,
                parentesco=req.parentesco,
                observacoes=req.observacoes,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(dependente)
        else:
            dependente.nome_participante = membro.nome_completo
            dependente.custo_convite = custo_dependente
            dependente.nome_dependente = req.nome_dependente
            dependente.parentesco = req.parentesco
            dependente.observacoes = req.observacoes
            dependente.updated_at = datetime.utcnow()
        dependente_id = dependente.id
    else:
        dependentes = db.query(models.ParticipacaoFesta).filter(
            models.ParticipacaoFesta.festa_id == festa.id,
            models.ParticipacaoFesta.membro_id == membro.id,
            models.ParticipacaoFesta.tipo_participante == "dependente"
        ).all()
        for dep in dependentes:
            db.delete(dep)

    convidado_id = None
    if req.levar_convidado and req.nome_convidado:
        convidado = db.query(models.ParticipacaoFesta).filter(
            models.ParticipacaoFesta.festa_id == festa.id,
            models.ParticipacaoFesta.membro_id == membro.id,
            models.ParticipacaoFesta.tipo_participante == "convidado"
        ).first()
        if not convidado:
            convidado = models.ParticipacaoFesta(
                id=str(uuid.uuid4()),
                festa_id=festa.id,
                membro_id=membro.id,
                nome_participante=req.nome_convidado,
                tipo_participante="convidado",
                custo_convite=custo_convidado,
                pago=False,
                observacoes=req.observacoes,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(convidado)
        else:
            convidado.nome_participante = req.nome_convidado
            convidado.custo_convite = custo_convidado
            convidado.observacoes = req.observacoes
            convidado.updated_at = datetime.utcnow()
        convidado_id = convidado.id
    else:
        convidados = db.query(models.ParticipacaoFesta).filter(
            models.ParticipacaoFesta.festa_id == festa.id,
            models.ParticipacaoFesta.membro_id == membro.id,
            models.ParticipacaoFesta.tipo_participante == "convidado"
        ).all()
        for convidado in convidados:
            db.delete(convidado)

    db.commit()
    db.refresh(titular)

    return {
        "ok": True,
        "detail": "Participação confirmada com sucesso",
        "festa_id": festa.id,
        "membro_id": membro.id,
        "titular_participacao_id": titular.id,
        "dependente_participacao_id": dependente_id,
        "convidado_participacao_id": convidado_id,
    }


# ════════════════════════════════════════════════════════════════════════════════
# ANIVERSARIANTES
# ════════════════════════════════════════════════════════════════════════════════
@app.get("/api/aniversariantes")
def aniversariantes(
    mes: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    today = date.today()
    mes_filtro = mes or today.month

    membros = db.query(models.Membro).filter(
        models.Membro.data_nascimento.isnot(None),
        sql_func.strftime('%m', models.Membro.data_nascimento) == str(mes_filtro).zfill(2)
    ).order_by(sql_func.strftime('%d', models.Membro.data_nascimento)).all()

    result = []   # 🔥 ESTA LINHA ESTAVA FALTANDO

    for m in membros:
        nascimento = m.data_nascimento
        idade = today.year - nascimento.year if nascimento else None
        is_hoje = (
            nascimento.month == today.month and nascimento.day == today.day
        ) if nascimento else False

        result.append({
            "id": m.id,
            "nome": m.nome_completo,
            "data_nascimento": str(nascimento),
            "dia": nascimento.day if nascimento else None,
            "mes": nascimento.month if nascimento else None,
            "idade": idade,
            "email": m.email,
            "celular": m.celular,
            "aniversario_hoje": is_hoje
        })

    return result


@app.post("/api/aniversariantes/enviar-email")
def enviar_email_aniversario(
    req: schemas.AniversarioEmailRequest,
    current_user=Depends(get_current_user)
):
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_from_name = os.getenv("SMTP_FROM_NAME", "UNACOB")
    smtp_from_email = os.getenv("SMTP_FROM_EMAIL", smtp_user or "")
    smtp_starttls = os.getenv("SMTP_STARTTLS", "true").lower() in ("1", "true", "yes", "on")

    if not smtp_host or not smtp_from_email:
        raise HTTPException(status_code=500, detail="Configuração de e-mail incompleta no servidor")

    subject = f"🎂 Feliz Aniversário, {req.nome}!"
    
    html_body = f"""
    <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 0; }}
                .container {{ max-width: 600px; margin: 20px auto; background-color: #fef8f3; border-radius: 10px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }}
                .header {{ text-align: center; color: #d4844a; margin-bottom: 30px; }}
                .title {{ font-size: 36px; font-weight: bold; margin: 10px 0; color: #cc7a3a; }}
                .subtitle {{ font-size: 14px; color: #888; margin-top: 5px; }}
                .content {{ color: #333; line-height: 1.8; font-size: 15px; }}
                .paragraph {{ margin-bottom: 15px; text-align: justify; }}
                .highlight {{ font-weight: bold; color: #cc7a3a; }}
                .signature {{ margin-top: 30px; text-align: center; color: #cc7a3a; font-style: italic; font-weight: bold; }}
                .footer {{ text-align: center; margin-top: 20px; font-size: 12px; color: #999; border-top: 1px solid #e0d5c7; padding-top: 15px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div style="font-size: 48px;">🎂</div>
                    <div class="title">Feliz Aniversário, {req.nome}!</div>
                    <div class="subtitle">Que sua data seja repleta de alegria e celebração</div>
                </div>
                
                <div class="content">
                    <div class="paragraph">
                        Em nome da diretoria da UNACOB, celebramos com alegria o seu aniversário! ✨
                    </div>
                    
                    <div class="paragraph">
                        Que esta data especial traga ainda mais <span class="highlight">saúde, paz</span> e momentos felizes ao lado de quem você ama.
                    </div>
                    
                    <div class="paragraph">
                        Sua trajetória é motivo de <span class="highlight">inspiração e orgulho</span> para todos nós. Aproveite cada instante deste novo ciclo e conte sempre com nossa amizade e apoio.
                    </div>
                    
                    <div class="signature">
                        Com carinho e celebração,<br>
                        <strong>Diretoria da UNACOB</strong>
                    </div>
                </div>
                
                <div class="footer">
                    © UNACOB - União dos aposentados dos correios em Bauru - SP | Celebrando momentos especiais
                </div>
            </div>
        </body>
    </html>
    """
    
    plain_text_body = (
        f"🎂 Feliz Aniversário, {req.nome}!\n\n"
        "Em nome da diretoria da UNACOB, celebramos com alegria o seu aniversário! ✨\n\n"
        "Que esta data especial traga ainda mais saúde, paz e momentos felizes ao lado de quem você ama.\n\n"
        "Sua trajetória é motivo de inspiração e orgulho para todos nós. Aproveite cada instante deste novo ciclo e "
        "conte sempre com nossa amizade e apoio.\n\n"
        "Com carinho,\n"
        "Diretoria da UNACOB"
    )

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{smtp_from_name} <{smtp_from_email}>"
    msg["To"] = req.email
    msg.set_content(plain_text_body)
    msg.add_alternative(html_body, subtype='html')

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as smtp:
            smtp.ehlo()
            if smtp_starttls:
                smtp.starttls()
                smtp.ehlo()

            if smtp_user and smtp_password:
                smtp.login(smtp_user, smtp_password)

            smtp.send_message(msg)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Falha ao enviar e-mail: {str(exc)}")

    return {"ok": True, "detail": "E-mail enviado com sucesso"}

# CONCILIAÇÃO
# ════════════════════════════════════════════════════════════════════════════════
@app.get("/api/conciliacao", response_model=List[schemas.ConciliacaoResponse])
def list_conciliacao(
    mes_referencia: Optional[str] = None,
    conciliado: Optional[bool] = None,
    tipo: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Lista lançamentos bancários com opção de filtro por mês, status e tipo"""
    q = db.query(models.Conciliacao)
    if mes_referencia:
        q = q.filter(models.Conciliacao.mes_referencia == mes_referencia)
    if conciliado is not None:
        q = q.filter(models.Conciliacao.conciliado == conciliado)
    if tipo:
        q = q.filter(models.Conciliacao.tipo == tipo)
    return q.order_by(models.Conciliacao.data_extrato.desc()).all()


@app.get("/api/conciliacao/resumo")
def resumo_conciliacao(
    mes_referencia: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    mes_ref = mes_referencia or date.today().strftime("%Y-%m")
    saldo_anterior = _saldo_anterior_mes(db, mes_ref)

    conciliacoes = db.query(models.Conciliacao).filter(
        models.Conciliacao.mes_referencia == mes_ref
    ).all()

    total_creditos = round(sum(float(c.valor_extrato or 0) for c in conciliacoes if c.tipo == "credito"), 2)
    total_debitos = round(sum(float(c.valor_extrato or 0) for c in conciliacoes if c.tipo == "debito"), 2)
    saldo_extrato = round(total_creditos - total_debitos, 2)
    saldo_final = round(saldo_anterior + saldo_extrato, 2)
    total_conciliados = len([c for c in conciliacoes if c.conciliado])

    return {
        "mes_referencia": mes_ref,
        "mes_referencia_anterior": _mes_anterior(mes_ref),
        "saldo_anterior": saldo_anterior,
        "total_creditos": total_creditos,
        "total_debitos": total_debitos,
        "saldo_extrato": saldo_extrato,
        "saldo_final": saldo_final,
        "total_lancamentos": len(conciliacoes),
        "total_conciliados": total_conciliados,
        "total_pendentes": len(conciliacoes) - total_conciliados
    }


@app.post("/api/conciliacao", response_model=schemas.ConciliacaoResponse)
def create_conciliacao(
    req: schemas.ConciliacaoCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Cria novo lançamento bancário manual"""
    mes_ref = req.mes_referencia or req.data_extrato.strftime("%Y-%m")
    c = models.Conciliacao(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        mes_referencia=mes_ref,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        **req.dict(exclude={"mes_referencia"})
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


# ⭐ ENDPOINTS ESPECÍFICOS (devem vir antes de /{conc_id})
@app.get("/api/conciliacao/membros/buscar")
def buscar_membros_com_pagamentos(
    q: str = "",
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Busca membros com pagamentos pendentes/atrasados"""
    try:
        query = db.query(models.Membro).filter(
            models.Membro.nome_completo.ilike(f"%{q}%")
        ).all()

        resultado = []
        for membro in query:
            # Busca pagamentos pendentes/atrasados
            pagamentos_pendentes = db.query(models.Pagamento).filter(
                models.Pagamento.membro_id == membro.id,
                models.Pagamento.status_pagamento.in_(["pendente", "atrasado"])
            ).all()

            if pagamentos_pendentes:
                resultado.append({
                    "membro_id": membro.id,
                    "nome": membro.nome_completo,
                    "email": membro.email,
                    "cpf": membro.cpf,
                    "total_pendente": sum(float(p.valor_pago or 0) for p in pagamentos_pendentes),
                    "quantidade_pendente": len(pagamentos_pendentes)
                })

        return resultado[:20]  # Limita a 20 resultados
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar membros: {str(e)}")


@app.get("/api/conciliacao/membro/{membro_id}/pagamentos-pendentes")
def listar_pagamentos_pendentes_membro(
    membro_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Lista todos os pagamentos pendentes/atrasados de um membro"""
    try:
        membro = db.query(models.Membro).filter(models.Membro.id == membro_id).first()
        if not membro:
            raise HTTPException(status_code=404, detail="Membro não encontrado")

        pagamentos = db.query(models.Pagamento).filter(
            models.Pagamento.membro_id == membro_id,
            models.Pagamento.status_pagamento.in_(["pendente", "atrasado"])
        ).order_by(models.Pagamento.mes_referencia.asc()).all()

        return {
            "membro_id": membro.id,
            "nome": membro.nome_completo,
            "email": membro.email,
            "pagamentos": [
                {
                    "pagamento_id": p.id,
                    "mes": p.mes_referencia,
                    "valor": float(p.valor_pago or 0),
                    "status": p.status_pagamento,
                    "data_previsto": str(p.data_pagamento) if p.data_pagamento else None
                }
                for p in pagamentos
            ]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao listar pagamentos: {str(e)}")


# ⭐ ENDPOINTS COM PARÂMETRO {conc_id}
@app.get("/api/conciliacao/{conc_id}/sugestoes")
def sugerir_matching_pagamentos(
    conc_id: str,
    tolerance: float = 0.01,  # tolerância de R$ 0,01
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Sugere pagamentos para matching baseado no valor do extrato"""
    c = db.query(models.Conciliacao).filter(models.Conciliacao.id == conc_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")

    # Se é débito (saída), procura por pagamentos devidos (pendentes/atrasados)
    if c.tipo == "debito":
        valor_min = float(c.valor_extrato) - tolerance
        valor_max = float(c.valor_extrato) + tolerance

        pagamentos = db.query(models.Pagamento).join(
            models.Membro, models.Pagamento.membro_id == models.Membro.id
        ).filter(
            models.Pagamento.status_pagamento.in_(["pendente", "atrasado"]),
            models.Pagamento.valor_pago >= valor_min,
            models.Pagamento.valor_pago <= valor_max
        ).all()

        sugestoes = []
        for p in pagamentos:
            membro = db.query(models.Membro).filter(models.Membro.id == p.membro_id).first()
            sugestoes.append({
                "pagamento_id": p.id,
                "membro_nome": membro.nome_completo if membro else "?",
                "mes": p.mes_referencia,
                "valor": float(p.valor_pago),
                "diferenca": abs(float(c.valor_extrato) - float(p.valor_pago))
            })

        return {"total": len(sugestoes), "sugestoes": sugestoes}
    
    return {"total": 0, "sugestoes": []}


@app.post("/api/conciliacao/{conc_id}/reconciliar")
def reconciliar_pagamento(
    conc_id: str,
    req: schemas.ConciliacaoImportRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Vincula extrato bancário a um pagamento e marca como conciliado"""
    c = db.query(models.Conciliacao).filter(models.Conciliacao.id == conc_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")

    if not req.pagamento_id:
        raise HTTPException(status_code=400, detail="pagamento_id obrigatório")

    pag = db.query(models.Pagamento).filter(models.Pagamento.id == req.pagamento_id).first()
    if not pag:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado")

    # Vincula e marca como conciliado
    c.pagamento_id = req.pagamento_id
    c.conciliado = True
    c.updated_at = datetime.utcnow()

    # Atualiza pagamento
    pag.status_pagamento = "pago"
    pag.data_pagamento = c.data_extrato
    pag.forma_pagamento = "transferencia"
    pag.updated_at = datetime.utcnow()

    db.commit()
    return {"ok": True, "detail": "Pagamento reconciliado com sucesso"}


@app.put("/api/conciliacao/{conc_id}", response_model=schemas.ConciliacaoResponse)
def update_conciliacao(
    conc_id: str,
    req: schemas.ConciliacaoUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Atualiza lançamento: vincula pagamento ou altera status"""
    c = db.query(models.Conciliacao).filter(models.Conciliacao.id == conc_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")

    nova_data_extrato = req.data_extrato or c.data_extrato

    # Se vincular um pagamento e marcar como conciliado, atualiza o pagamento
    if req.pagamento_id and req.conciliado:
        pag = db.query(models.Pagamento).filter(models.Pagamento.id == req.pagamento_id).first()
        if pag:
            pag.status_pagamento = "pago"
            pag.data_pagamento = nova_data_extrato
            pag.forma_pagamento = "transferencia"  # default para extrato bancário
            pag.updated_at = datetime.utcnow()

    for k, v in req.dict(exclude_none=True).items():
        setattr(c, k, v)
    c.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(c)
    return c


@app.delete("/api/conciliacao/{conc_id}")
def delete_conciliacao(
    conc_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Remove lançamento bancário"""
    c = db.query(models.Conciliacao).filter(models.Conciliacao.id == conc_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")
    db.delete(c)
    db.commit()
    return {"ok": True}


@app.get("/api/conciliacao/{conc_id}/sugestoes")
def sugerir_matching_pagamentos(
    conc_id: str,
    tolerance: float = 0.01,  # tolerância de R$ 0,01
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Sugere pagamentos para matching baseado no valor do extrato"""
    c = db.query(models.Conciliacao).filter(models.Conciliacao.id == conc_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")

    # Se é débito (saída), procura por pagamentos devidos (pendentes/atrasados)
    if c.tipo == "debito":
        valor_min = float(c.valor_extrato) - tolerance
        valor_max = float(c.valor_extrato) + tolerance

        pagamentos = db.query(models.Pagamento).join(
            models.Membro, models.Pagamento.membro_id == models.Membro.id
        ).filter(
            models.Pagamento.status_pagamento.in_(["pendente", "atrasado"]),
            models.Pagamento.valor_pago >= valor_min,
            models.Pagamento.valor_pago <= valor_max
        ).all()

        sugestoes = []
        for p in pagamentos:
            membro = db.query(models.Membro).filter(models.Membro.id == p.membro_id).first()
            sugestoes.append({
                "pagamento_id": p.id,
                "membro_nome": membro.nome_completo if membro else "?",
                "mes": p.mes_referencia,
                "valor": float(p.valor_pago),
                "diferenca": abs(float(c.valor_extrato) - float(p.valor_pago))
            })

        return {"total": len(sugestoes), "sugestoes": sugestoes}
    
    return {"total": 0, "sugestoes": []}


@app.post("/api/conciliacao/{conc_id}/reconciliar")
def reconciliar_pagamento(
    conc_id: str,
    req: schemas.ConciliacaoImportRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Vincula extrato bancário a um pagamento e marca como conciliado"""
    c = db.query(models.Conciliacao).filter(models.Conciliacao.id == conc_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")

    if not req.pagamento_id:
        raise HTTPException(status_code=400, detail="pagamento_id obrigatório")

    pag = db.query(models.Pagamento).filter(models.Pagamento.id == req.pagamento_id).first()
    if not pag:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado")

    # Vincula e marca como conciliado
    c.pagamento_id = req.pagamento_id
    c.conciliado = True
    c.updated_at = datetime.utcnow()

    # Atualiza pagamento
    pag.status_pagamento = "pago"
    pag.data_pagamento = c.data_extrato
    pag.forma_pagamento = "transferencia"
    pag.updated_at = datetime.utcnow()

    db.commit()
    return {"ok": True, "detail": "Pagamento reconciliado com sucesso"}


@app.get("/api/conciliacao/membros/buscar")
def buscar_membros_com_pagamentos(
    q: str = "",
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Busca membros com pagamentos pendentes/atrasados"""
    try:
        query = db.query(models.Membro).filter(
            models.Membro.nome_completo.ilike(f"%{q}%")
        ).all()

        resultado = []
        for membro in query:
            # Busca pagamentos pendentes/atrasados
            pagamentos_pendentes = db.query(models.Pagamento).filter(
                models.Pagamento.membro_id == membro.id,
                models.Pagamento.status_pagamento.in_(["pendente", "atrasado"])
            ).all()

            if pagamentos_pendentes:
                resultado.append({
                    "membro_id": membro.id,
                    "nome": membro.nome_completo,
                    "email": membro.email,
                    "cpf": membro.cpf,
                    "total_pendente": sum(float(p.valor_pago or 0) for p in pagamentos_pendentes),
                    "quantidade_pendente": len(pagamentos_pendentes)
                })

        return resultado[:20]  # Limita a 20 resultados
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar membros: {str(e)}")


@app.get("/api/conciliacao/membro/{membro_id}/pagamentos-pendentes")
def listar_pagamentos_pendentes_membro(
    membro_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Lista todos os pagamentos pendentes/atrasados de um membro"""
    try:
        membro = db.query(models.Membro).filter(models.Membro.id == membro_id).first()
        if not membro:
            raise HTTPException(status_code=404, detail="Membro não encontrado")

        pagamentos = db.query(models.Pagamento).filter(
            models.Pagamento.membro_id == membro_id,
            models.Pagamento.status_pagamento.in_(["pendente", "atrasado"])
        ).order_by(models.Pagamento.mes_referencia.asc()).all()

        return {
            "membro_id": membro.id,
            "nome": membro.nome_completo,
            "email": membro.email,
            "pagamentos": [
                {
                    "pagamento_id": p.id,
                    "mes": p.mes_referencia,
                    "valor": float(p.valor_pago or 0),
                    "status": p.status_pagamento,
                    "data_previsto": str(p.data_pagamento) if p.data_pagamento else None
                }
                for p in pagamentos
            ]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao listar pagamentos: {str(e)}")



@app.post("/api/conciliacao/importar/csv")
async def importar_extrato_csv(
    file: UploadFile = File(...),
    banco: str = "Importado",
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Importa extrato bancário em formato CSV.
    Suporta formatos:
    1. Simples: data, descricao, tipo (credito|debito), valor
    2. Banco Real: Data, Lançamento, Detalhes, Nº documento, Valor, Tipo Lançamento
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Arquivo deve ser CSV")

    try:
        import csv
        import io
        
        contents = await file.read()
        # Tenta UTF-8, se falhar tenta Latin-1
        try:
            text = contents.decode('utf-8')
        except:
            text = contents.decode('latin-1')
        
        lines = text.strip().split('\n')
        if not lines:
            raise HTTPException(status_code=400, detail="Arquivo vazio")
        
        # Detecta o formato baseado no header
        header = lines[0].lower()
        
        importados = []
        
        if any(x in header for x in ['data', 'lançamento', 'detalhes', 'valor', 'tipo']):
            # Formato de banco real
            reader = csv.DictReader(lines)
            for row in reader:
                try:
                    # Mapeia os nomes de coluna (caseless)
                    row_lower = {k.lower().strip(): v for k, v in row.items()}
                    
                    data_str = row_lower.get('data', '').strip()
                    lancamento = row_lower.get('lançamento', '').strip()
                    detalhes = row_lower.get('detalhes', '').strip()
                    numero_doc = row_lower.get('nº documento', row_lower.get('n° documento', '')).strip()
                    valor_str = row_lower.get('valor', '0').strip()
                    tipo_lance = row_lower.get('tipo lançamento', '').strip().lower()

                    if not data_str or not valor_str:
                        continue

                    # Parse da data (formato DD/MM/YYYY)
                    if '/' in data_str:
                        data = datetime.strptime(data_str, "%d/%m/%Y").date()
                    else:
                        data = datetime.strptime(data_str, "%Y-%m-%d").date()

                    # Parse do valor (pode ter R$ na frente e usar , como decimal)
                    valor_str = valor_str.replace('R$', '').replace(',', '.').strip()
                    valor = float(valor_str)

                    # Determina tipo (entrada/crédito ou saída/débito)
                    if tipo_lance.lower() in ['entrada', 'crédito', 'credito', 'credit']:
                        tipo = 'credito'
                    elif tipo_lance.lower() in ['saída', 'débito', 'debito', 'debit']:
                        tipo = 'debito'
                    else:
                        tipo = 'credito' if valor > 0 else 'debito'

                    # Monta descrição
                    descricao = detalhes or lancamento or tipo_lance
                    if not descricao or descricao == '':
                        descricao = f"Lançamento {tipo}"

                    mes_ref = data.strftime("%Y-%m")

                    # Verifica duplicate
                    existe = db.query(models.Conciliacao).filter(
                        models.Conciliacao.data_extrato == data,
                        models.Conciliacao.valor_extrato == abs(valor),
                        models.Conciliacao.numero_documento == numero_doc or numero_doc == '',
                        models.Conciliacao.banco == banco
                    ).first()

                    if existe:
                        continue

                    c = models.Conciliacao(
                        id=str(uuid.uuid4()),
                        user_id=current_user.id,
                        data_extrato=data,
                        descricao_extrato=descricao,
                        valor_extrato=abs(valor),
                        tipo=tipo,
                        mes_referencia=mes_ref,
                        banco=banco,
                        numero_documento=numero_doc if numero_doc else None,
                        conciliado=False,
                        created_at=datetime.utcnow(),
                        updated_at=datetime.utcnow()
                    )
                    db.add(c)
                    importados.append({
                        "data": data.strftime("%Y-%m-%d"),
                        "descricao": descricao,
                        "valor": abs(valor),
                        "tipo": tipo,
                        "numero_doc": numero_doc
                    })

                except Exception as e:
                    continue

        else:
            # Formato simples: data, descricao, tipo, valor
            reader = csv.DictReader(lines)
            for row in reader:
                try:
                    data_str = row.get('data', '').strip()
                    descricao = row.get('descricao', row.get('descrição', '')).strip()
                    tipo = row.get('tipo', 'credito').strip().lower()
                    valor_str = row.get('valor', '0').replace(',', '.').strip()

                    if not data_str or not valor_str:
                        continue

                    data = datetime.strptime(data_str, "%Y-%m-%d").date()
                    valor = float(valor_str)
                    mes_ref = data.strftime("%Y-%m")

                    # Verifica duplicate
                    existe = db.query(models.Conciliacao).filter(
                        models.Conciliacao.data_extrato == data,
                        models.Conciliacao.descricao_extrato == descricao,
                        models.Conciliacao.valor_extrato == valor,
                        models.Conciliacao.banco == banco
                    ).first()

                    if existe:
                        continue

                    c = models.Conciliacao(
                        id=str(uuid.uuid4()),
                        user_id=current_user.id,
                        data_extrato=data,
                        descricao_extrato=descricao,
                        valor_extrato=valor,
                        tipo=tipo if tipo in ("credito", "debito") else "credito",
                        mes_referencia=mes_ref,
                        banco=banco,
                        conciliado=False,
                        created_at=datetime.utcnow(),
                        updated_at=datetime.utcnow()
                    )
                    db.add(c)
                    importados.append({
                        "data": data,
                        "descricao": descricao,
                        "valor": valor,
                        "tipo": tipo
                    })

                except Exception as e:
                    continue

        db.commit()
        return {
            "ok": True,
            "total_importados": len(importados),
            "registros": importados
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao importar: {str(e)}")


# ════════════════════════════════════════════════════════════════════════════════
# FINANCEIRO / BALANCETE
# ════════════════════════════════════════════════════════════════════════════════
@app.get("/api/financeiro/balancete")
def balancete(
    mes_referencia: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    today = date.today()
    mes_ref = mes_referencia or today.strftime("%Y-%m")

    pags = _pagamentos_pagos_membros_ativos_no_mes(db, mes_ref)
    desp = db.query(models.Despesa).filter(models.Despesa.mes_referencia == mes_ref).all()
    rendas = db.query(models.OutraRenda).filter(models.OutraRenda.mes_referencia == mes_ref).all()

    total_mensalidades = sum(float(p.valor_pago) for p in pags if p.valor_pago)
    total_outras = sum(r.valor for r in rendas if r.valor)
    total_entradas = total_mensalidades + total_outras
    total_saidas = sum(d.valor for d in desp if d.valor)
    saldo = total_entradas - total_saidas
    saldo_manual_registrado = db.query(models.SaldoMensal).filter(models.SaldoMensal.mes_referencia == mes_ref).first()
    saldo_anterior = _saldo_anterior_mes(db, mes_ref)
    saldo_final = round(saldo_anterior + saldo, 2)

    # Por categoria de despesa
    desp_por_cat = defaultdict(float)
    for d in desp:
        if d.valor:
            desp_por_cat[d.categoria or "Outros"] += d.valor

    # Por categoria de renda
    renda_por_cat = defaultdict(float)
    for r in rendas:
        if r.valor:
            renda_por_cat[r.categoria or "Outros"] += r.valor

    return {
        "mes_referencia": mes_ref,
        "mes_referencia_anterior": _mes_anterior(mes_ref),
        "saldo_anterior": saldo_anterior,
        "origem_saldo_anterior": "manual" if saldo_manual_registrado else "calculado",
        "total_mensalidades": total_mensalidades,
        "total_outras_rendas": total_outras,
        "total_entradas": total_entradas,
        "total_despesas": total_saidas,
        "saldo": saldo,
        "saldo_final": saldo_final,
        "qtd_pagantes": len(pags),
        "despesas_por_categoria": dict(desp_por_cat),
        "rendas_por_categoria": dict(renda_por_cat),
        "pagamentos": [{
            "membro_id": p.membro_id, "valor_pago": float(p.valor_pago) if p.valor_pago else 0,
            "data_pagamento": str(p.data_pagamento) if p.data_pagamento else None,
            "forma_pagamento": p.forma_pagamento
        } for p in pags],
        "despesas": [{
            "id": d.id, "descricao": d.descricao, "categoria": d.categoria,
            "valor": d.valor, "data_despesa": str(d.data_despesa) if d.data_despesa else None
        } for d in desp],
    }


# ════════════════════════════════════════════════════════════════════════════════
# RELATÓRIOS / EXPORTAÇÃO EXCEL
# ════════════════════════════════════════════════════════════════════════════════
@app.get("/api/relatorios/membros")
def exportar_membros(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment

    q = db.query(models.Membro)
    if status:
        q = q.filter(models.Membro.status == status)
    membros = q.order_by(models.Membro.nome_completo).all()

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Membros"

    headers = ["Matrícula", "Nome", "CPF", "Email", "Telefone", "Celular",
               "Endereço", "Bairro", "Cidade", "Estado", "CEP",
               "Data Nascimento", "Data Associação", "Status", "Benefício", "Valor Mensalidade"]

    header_fill = PatternFill("solid", fgColor="1e3a5f")
    header_font = Font(color="FFFFFF", bold=True)

    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center")

    for row, m in enumerate(membros, 2):
        ws.cell(row=row, column=1, value=m.matricula)
        ws.cell(row=row, column=2, value=m.nome_completo)
        ws.cell(row=row, column=3, value=m.cpf)
        ws.cell(row=row, column=4, value=m.email)
        ws.cell(row=row, column=5, value=m.telefone)
        ws.cell(row=row, column=6, value=m.celular)
        ws.cell(row=row, column=7, value=m.endereco)
        ws.cell(row=row, column=8, value=m.bairro)
        ws.cell(row=row, column=9, value=m.cidade)
        ws.cell(row=row, column=10, value=m.estado)
        ws.cell(row=row, column=11, value=m.cep)
        ws.cell(row=row, column=12, value=str(m.data_nascimento) if m.data_nascimento else "")
        ws.cell(row=row, column=13, value=str(m.data_associacao) if m.data_associacao else "")
        ws.cell(row=row, column=14, value=m.status)
        ws.cell(row=row, column=15, value=m.beneficio)
        ws.cell(row=row, column=16, value=float(m.valor_mensalidade) if m.valor_mensalidade else 0)

    for col in ws.columns:
        max_length = max((len(str(cell.value)) if cell.value else 0) for cell in col)
        ws.column_dimensions[col[0].column_letter].width = max(max_length + 2, 12)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=membros.xlsx"}
    )

@app.get("/api/relatorios/pagamentos")
def exportar_pagamentos(
    mes_referencia: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, numbers

    today = date.today()
    mes_ref = mes_referencia or today.strftime("%Y-%m")

    membros = db.query(models.Membro).filter(models.Membro.status == 'ativo').order_by(models.Membro.nome_completo).all()
    pagamentos = {p.membro_id: p for p in db.query(models.Pagamento).filter(models.Pagamento.mes_referencia == mes_ref).all()}

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = f"Pagamentos {mes_ref}"

    headers = ["Matrícula", "Nome", "Valor Mensalidade", "Valor Pago", "Data Pagamento", "Status", "Forma Pagamento"]
    header_fill = PatternFill("solid", fgColor="1e3a5f")
    header_font = Font(color="FFFFFF", bold=True)

    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center")

    red_fill = PatternFill("solid", fgColor="FFB3B3")
    green_fill = PatternFill("solid", fgColor="B3FFB3")

    for row, m in enumerate(membros, 2):
        p = pagamentos.get(m.id)
        status = p.status_pagamento if p else "pendente"
        fill = green_fill if status == "pago" else red_fill
        
        values = [
            m.matricula, m.nome_completo,
            float(m.valor_mensalidade) if m.valor_mensalidade else 0,
            float(p.valor_pago) if p and p.valor_pago else 0,
            str(p.data_pagamento) if p and p.data_pagamento else "",
            status,
            p.forma_pagamento if p else ""
        ]
        for col, val in enumerate(values, 1):
            cell = ws.cell(row=row, column=col, value=val)
            cell.fill = fill

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=pagamentos_{mes_ref}.xlsx"}
    )

@app.get("/api/relatorios/aniversariantes")
def exportar_aniversariantes(
    mes: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment

    today = date.today()
    mes_filtro = mes or today.month
    membros = db.query(models.Membro).filter(
        models.Membro.data_nascimento.isnot(None),
        sql_func.strftime('%m', models.Membro.data_nascimento) == str(mes_filtro).zfill(2)
    ).order_by(sql_func.strftime('%d', models.Membro.data_nascimento)).all()

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = f"Aniversariantes Mês {mes_filtro}"
    headers = ["Nome", "Data Nascimento", "Dia", "Idade", "Email", "Celular", "Telefone"]
    header_fill = PatternFill("solid", fgColor="1e3a5f")
    header_font = Font(color="FFFFFF", bold=True)
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.fill = header_fill
        cell.font = header_font
    for row, m in enumerate(membros, 2):
        idade = today.year - m.data_nascimento.year
        ws.cell(row=row, column=1, value=m.nome_completo)
        ws.cell(row=row, column=2, value=str(m.data_nascimento))
        ws.cell(row=row, column=3, value=m.data_nascimento.day)
        ws.cell(row=row, column=4, value=idade)
        ws.cell(row=row, column=5, value=m.email)
        ws.cell(row=row, column=6, value=m.celular)
        ws.cell(row=row, column=7, value=m.telefone)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=aniversariantes_mes_{mes_filtro}.xlsx"}
    )

@app.get("/api/relatorios/balancete")
def exportar_balancete(
    mes_referencia: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment

    today = date.today()
    mes_ref = mes_referencia or today.strftime("%Y-%m")
    pags = _pagamentos_pagos_membros_ativos_no_mes(db, mes_ref)
    desp = db.query(models.Despesa).filter(models.Despesa.mes_referencia == mes_ref).all()
    rendas = db.query(models.OutraRenda).filter(models.OutraRenda.mes_referencia == mes_ref).all()
    saldo_anterior = _saldo_anterior_mes(db, mes_ref)

    wb = openpyxl.Workbook()
    
    # Sheet 1: Resumo
    ws1 = wb.active
    ws1.title = "Resumo"
    ws1["A1"] = f"BALANCETE MENSAL - {mes_ref}"
    ws1["A1"].font = Font(bold=True, size=14)
    ws1["A3"] = "ENTRADAS"
    ws1["A3"].font = Font(bold=True)
    ws1["A4"] = "Saldo Anterior"
    ws1["B4"] = saldo_anterior
    ws1["A5"] = "Mensalidades"
    ws1["B5"] = sum(float(p.valor_pago) for p in pags if p.valor_pago)
    ws1["A6"] = "Outras Rendas"
    ws1["B6"] = sum(r.valor for r in rendas if r.valor)
    ws1["A7"] = "TOTAL ENTRADAS"
    ws1["A7"].font = Font(bold=True)
    ws1["B7"] = ws1["B5"].value + ws1["B6"].value
    ws1["B7"].font = Font(bold=True)
    ws1["A9"] = "SAÍDAS"
    ws1["A9"].font = Font(bold=True)
    ws1["A10"] = "Despesas"
    ws1["B10"] = sum(d.valor for d in desp if d.valor)
    ws1["A11"] = "TOTAL SAÍDAS"
    ws1["A11"].font = Font(bold=True)
    ws1["B11"] = ws1["B10"].value
    ws1["B11"].font = Font(bold=True)
    ws1["A13"] = "SALDO DO MÊS"
    ws1["A13"].font = Font(bold=True, size=12)
    ws1["B13"] = ws1["B7"].value - ws1["B11"].value
    ws1["B13"].font = Font(bold=True, size=12)
    ws1["A14"] = "SALDO FINAL"
    ws1["A14"].font = Font(bold=True, size=12)
    ws1["B14"] = ws1["B4"].value + ws1["B13"].value
    ws1["B14"].font = Font(bold=True, size=12)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=balancete_{mes_ref}.xlsx"}
    )


@app.get("/api/relatorios/conciliacao")
def exportar_conciliacao(
    mes_referencia: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment

    today = date.today()
    mes_ref = mes_referencia or today.strftime("%Y-%m")
    saldo_anterior = _saldo_anterior_mes(db, mes_ref)

    conciliacoes = db.query(models.Conciliacao).filter(
        models.Conciliacao.mes_referencia == mes_ref
    ).order_by(models.Conciliacao.data_extrato.desc()).all()

    total_creditos = round(sum(float(c.valor_extrato or 0) for c in conciliacoes if c.tipo == "credito"), 2)
    total_debitos = round(sum(float(c.valor_extrato or 0) for c in conciliacoes if c.tipo == "debito"), 2)
    saldo_mes = round(total_creditos - total_debitos, 2)
    saldo_final = round(saldo_anterior + saldo_mes, 2)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = f"Conciliação {mes_ref}"

    ws["A1"] = f"CONCILIAÇÃO BANCÁRIA - {mes_ref}"
    ws["A1"].font = Font(bold=True, size=14)

    ws["A3"] = "RESUMO"
    ws["A3"].font = Font(bold=True)
    ws["A4"] = "Saldo Anterior"
    ws["B4"] = saldo_anterior
    ws["A5"] = "Total Créditos"
    ws["B5"] = total_creditos
    ws["A6"] = "Total Débitos"
    ws["B6"] = total_debitos
    ws["A7"] = "Saldo do Extrato"
    ws["A7"].font = Font(bold=True)
    ws["B7"] = saldo_mes
    ws["B7"].font = Font(bold=True)
    ws["A8"] = "Saldo Final"
    ws["A8"].font = Font(bold=True)
    ws["B8"] = saldo_final
    ws["B8"].font = Font(bold=True)

    headers = [
        "Data", "Descrição", "Valor", "Tipo", "Conciliado",
        "Mês Referência", "Banco", "Documento", "Pagamento ID", "Observações"
    ]

    header_fill = PatternFill("solid", fgColor="1e3a5f")
    header_font = Font(color="FFFFFF", bold=True)

    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=10, column=col, value=header)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center")

    for row, c in enumerate(conciliacoes, 11):
        ws.cell(row=row, column=1, value=str(c.data_extrato) if c.data_extrato else "")
        ws.cell(row=row, column=2, value=c.descricao_extrato)
        ws.cell(row=row, column=3, value=float(c.valor_extrato) if c.valor_extrato else 0)
        ws.cell(row=row, column=4, value=c.tipo)
        ws.cell(row=row, column=5, value="Sim" if c.conciliado else "Não")
        ws.cell(row=row, column=6, value=c.mes_referencia)
        ws.cell(row=row, column=7, value=c.banco)
        ws.cell(row=row, column=8, value=c.numero_documento)
        ws.cell(row=row, column=9, value=c.pagamento_id)
        ws.cell(row=row, column=10, value=c.observacoes)

    for col in ws.columns:
        max_length = max((len(str(cell.value)) if cell.value else 0) for cell in col)
        ws.column_dimensions[col[0].column_letter].width = max(max_length + 2, 14)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=conciliacao_{mes_ref}.xlsx"}
    )


@app.get("/api/relatorios/aplicacoes-financeiras")
def exportar_aplicacoes_financeiras(
    mes_referencia: Optional[str] = None,
    instituicao: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

    today = date.today()
    mes_ref = mes_referencia or today.strftime("%Y-%m")

    q = db.query(models.AplicacaoFinanceira).filter(
        models.AplicacaoFinanceira.mes_referencia == mes_ref
    )
    if instituicao:
        q = q.filter(models.AplicacaoFinanceira.instituicao.ilike(f"%{instituicao}%"))
    registros = q.order_by(models.AplicacaoFinanceira.instituicao.asc(), models.AplicacaoFinanceira.produto.asc()).all()

    totais = {
        "saldo_anterior": round(sum(float(r.saldo_anterior or 0) for r in registros), 2),
        "aplicacoes": round(sum(float(r.aplicacoes or 0) for r in registros), 2),
        "rendimento_bruto": round(sum(float(r.rendimento_bruto or 0) for r in registros), 2),
        "impostos": round(sum(float(r.impostos or 0) for r in registros), 2),
        "resgate": round(sum(float(r.resgate or 0) for r in registros), 2),
        "saldo_atual": round(sum(float(r.saldo_atual or 0) for r in registros), 2),
    }

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = f"Aplicações {mes_ref}"

    title_fill = PatternFill("solid", fgColor="1e3a5f")
    header_fill = PatternFill("solid", fgColor="1e3a5f")
    total_fill = PatternFill("solid", fgColor="E6F4EA")
    header_font = Font(color="FFFFFF", bold=True)
    title_font = Font(color="FFFFFF", bold=True, size=14)
    bold_font = Font(bold=True)
    thin_border = Border(
        left=Side(style="thin", color="D1D5DB"),
        right=Side(style="thin", color="D1D5DB"),
        top=Side(style="thin", color="D1D5DB"),
        bottom=Side(style="thin", color="D1D5DB")
    )
    money_fmt = 'R$ #,##0.00'

    ws.merge_cells("A1:I1")
    ws["A1"] = f"RELATÓRIO DE APLICAÇÕES FINANCEIRAS - {mes_ref}"
    ws["A1"].fill = title_fill
    ws["A1"].font = title_font
    ws["A1"].alignment = Alignment(horizontal="center", vertical="center")

    ws["A3"] = "Mês Referência"
    ws["B3"] = mes_ref
    ws["A4"] = "Total de Registros"
    ws["B4"] = len(registros)

    ws["A6"] = "Resumo Financeiro"
    ws["A6"].font = bold_font
    ws["A7"] = "Saldo Anterior"
    ws["B7"] = totais["saldo_anterior"]
    ws["A8"] = "Aplicações"
    ws["B8"] = totais["aplicacoes"]
    ws["A9"] = "Rendimento Bruto"
    ws["B9"] = totais["rendimento_bruto"]
    ws["A10"] = "Impostos (IR/IOF)"
    ws["B10"] = totais["impostos"]
    ws["A11"] = "Resgate"
    ws["B11"] = totais["resgate"]
    ws["A12"] = "Saldo Atual"
    ws["B12"] = totais["saldo_atual"]

    for row in range(7, 13):
        ws.cell(row=row, column=2).number_format = money_fmt

    headers = [
        "Instituição",
        "Produto",
        "Saldo Anterior",
        "Aplicações",
        "Rendimento Bruto",
        "Impostos (IR/IOF)",
        "Resgate",
        "Saldo Atual",
        "Observações"
    ]

    header_row = 14
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=header_row, column=col, value=header)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin_border

    first_data_row = header_row + 1
    for row_idx, reg in enumerate(registros, first_data_row):
        ws.cell(row=row_idx, column=1, value=reg.instituicao or "")
        ws.cell(row=row_idx, column=2, value=reg.produto or "")
        ws.cell(row=row_idx, column=3, value=float(reg.saldo_anterior or 0))
        ws.cell(row=row_idx, column=4, value=float(reg.aplicacoes or 0))
        ws.cell(row=row_idx, column=5, value=float(reg.rendimento_bruto or 0))
        ws.cell(row=row_idx, column=6, value=float(reg.impostos or 0))
        ws.cell(row=row_idx, column=7, value=float(reg.resgate or 0))
        ws.cell(row=row_idx, column=8, value=float(reg.saldo_atual or 0))
        ws.cell(row=row_idx, column=9, value=reg.observacoes or "")

        for col in range(1, 10):
            cell = ws.cell(row=row_idx, column=col)
            cell.border = thin_border
            if col in [3, 4, 5, 6, 7, 8]:
                cell.number_format = money_fmt
                cell.alignment = Alignment(horizontal="right", vertical="center")

    total_row = first_data_row + len(registros)
    ws.cell(row=total_row, column=1, value="TOTAIS").font = bold_font
    ws.merge_cells(start_row=total_row, start_column=1, end_row=total_row, end_column=2)
    for col, key in zip([3, 4, 5, 6, 7, 8], ["saldo_anterior", "aplicacoes", "rendimento_bruto", "impostos", "resgate", "saldo_atual"]):
        cell = ws.cell(row=total_row, column=col, value=totais[key])
        cell.font = bold_font
        cell.number_format = money_fmt
        cell.alignment = Alignment(horizontal="right", vertical="center")

    for col in range(1, 10):
        cell = ws.cell(row=total_row, column=col)
        cell.fill = total_fill
        cell.border = thin_border

    ws.freeze_panes = f"A{first_data_row}"
    ws.auto_filter.ref = f"A{header_row}:I{max(total_row, header_row + 1)}"

    ws.column_dimensions["A"].width = 26
    ws.column_dimensions["B"].width = 24
    ws.column_dimensions["C"].width = 16
    ws.column_dimensions["D"].width = 14
    ws.column_dimensions["E"].width = 18
    ws.column_dimensions["F"].width = 18
    ws.column_dimensions["G"].width = 14
    ws.column_dimensions["H"].width = 16
    ws.column_dimensions["I"].width = 38

    for row in [3, 4, 6, 7, 8, 9, 10, 11, 12]:
        ws.cell(row=row, column=1).font = bold_font

    ws["A6"].fill = PatternFill("solid", fgColor="E2E8F0")
    ws["B6"].fill = PatternFill("solid", fgColor="E2E8F0")

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=aplicacoes_financeiras_{mes_ref}.xlsx"}
    )

@app.get("/api/relatorios/festas/{festa_id}")
def exportar_festa(
    festa_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment

    festa = db.query(models.Festa).filter(models.Festa.id == festa_id).first()
    if not festa:
        raise HTTPException(status_code=404, detail="Festa não encontrada")
    
    parts = db.query(models.ParticipacaoFesta).filter(models.ParticipacaoFesta.festa_id == festa_id).all()
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Participantes"
    ws["A1"] = f"LISTA DE PARTICIPANTES - {festa.nome_festa}"
    ws["A1"].font = Font(bold=True, size=14)
    ws["A2"] = f"Data: {festa.data_festa} | Local: {festa.local_festa}"
    
    headers = ["Nome Participante", "Tipo", "Membro Titular", "Dependente/Convidado", "Custo Convite", "Pago"]
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=4, column=col, value=h)
        cell.font = Font(bold=True)
        cell.fill = PatternFill("solid", fgColor="1e3a5f")
        cell.font = Font(color="FFFFFF", bold=True)
    
    for row, p in enumerate(parts, 5):
        membro_nome = ""
        if p.membro_id:
            m = db.query(models.Membro).filter(models.Membro.id == p.membro_id).first()
            if m:
                membro_nome = m.nome_completo
        ws.cell(row=row, column=1, value=p.nome_participante)
        ws.cell(row=row, column=2, value=p.tipo_participante)
        ws.cell(row=row, column=3, value=membro_nome)
        ws.cell(row=row, column=4, value=p.nome_dependente or "")
        ws.cell(row=row, column=5, value=float(p.custo_convite) if p.custo_convite else 0)
        ws.cell(row=row, column=6, value="Sim" if p.pago else "Não")

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=festa_{festa_id}.xlsx"}
    )

# ════════════════════════════════════════════════════════════════════════════════
# ETIQUETAS
# ════════════════════════════════════════════════════════════════════════════════
# ════════════════════════════════════════════════════════════════════════════════
# ETIQUETAS - LISTAR MEMBROS (JSON PARA FRONTEND)
# ════════════════════════════════════════════════════════════════════════════════

@app.get("/api/etiquetas/membros")
def listar_membros(
    status: Optional[str] = "ativo",
    nome: Optional[str] = None,
    cidade: Optional[str] = None,
    sexo: Optional[str] = None,
    sem_email: Optional[bool] = False,
    sem_whatsapp: Optional[bool] = False,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    q = db.query(models.Membro)

    if status:
        q = q.filter(models.Membro.status == status)

    if nome:
        q = q.filter(models.Membro.nome_completo.ilike(f"%{nome}%"))

    if cidade:
        q = q.filter(models.Membro.cidade.ilike(f"%{cidade}%"))

    if sexo:
        sexo_normalizado = sexo.strip().lower()
        if sexo_normalizado in ("masculino", "m"):
            valores_sexo = ["masculino", "m"]
        elif sexo_normalizado in ("feminino", "f"):
            valores_sexo = ["feminino", "f"]
        else:
            valores_sexo = [sexo_normalizado]

        q = q.filter(sql_func.lower(models.Membro.sexo).in_(valores_sexo))

    if sem_email:
        q = q.filter(
            (models.Membro.email == None) |
            (models.Membro.email == "")
        )

    if sem_whatsapp:
        q = q.filter(
            (models.Membro.celular == None) |
            (models.Membro.celular == "")
        )

    membros = q.order_by(models.Membro.nome_completo).all()

    return {
        "total": len(membros),
        "membros": [
            {
                "id": m.id,
                "nome_completo": m.nome_completo,
                "endereco": m.endereco,
                "bairro": m.bairro,
                "cidade": m.cidade,
                "estado": m.estado,
                "cep": m.cep,
                "email": m.email,
                "telefone": m.telefone,
                "celular": m.celular,
            }
            for m in membros
        ]
    }


@app.get("/api/etiquetas")
def gerar_etiquetas(
    status: Optional[str] = "ativo",
    ids: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.pdfgen import canvas
    from reportlab.lib import colors

    q = db.query(models.Membro)
    if ids:
        id_list = ids.split(",")
        q = q.filter(models.Membro.id.in_(id_list))
    elif status:
        q = q.filter(models.Membro.status == status)
    membros = q.order_by(models.Membro.nome_completo).all()

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4

    # 3x8 labels per page
    label_w = width / 3
    label_h = height / 8
    cols, rows_per_page = 3, 8

    x, y = 0, height - label_h
    count = 0

    for m in membros:
        if count > 0 and count % (cols * rows_per_page) == 0:
            c.showPage()
            x, y = 0, height - label_h

        col = count % cols
        row = (count % (cols * rows_per_page)) // cols

        lx = col * label_w
        ly = height - (row + 1) * label_h

        # Draw label border
        c.setStrokeColor(colors.grey)
        c.rect(lx + 2, ly + 2, label_w - 4, label_h - 4)

        # Write content
        c.setFont("Helvetica-Bold", 9)
        c.drawString(lx + 8, ly + label_h - 20, (m.nome_completo or "")[:40])
        c.setFont("Helvetica", 8)
        endereco = f"{m.endereco or ''}, {m.numero or ''}"
        if m.complemento:
            endereco += f" - {m.complemento}"
        c.drawString(lx + 8, ly + label_h - 35, endereco[:45])
        c.drawString(lx + 8, ly + label_h - 48, f"{m.bairro or ''}")
        c.drawString(lx + 8, ly + label_h - 61, f"{m.cidade or ''} - {m.estado or ''}")
        c.drawString(lx + 8, ly + label_h - 74, f"CEP: {m.cep or ''}")
        if m.matricula:
            c.drawString(lx + 8, ly + label_h - 87, f"Matrícula: {m.matricula}")

        count += 1

    c.save()
    buf.seek(0)
    return StreamingResponse(
        buf, media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=etiquetas.pdf"}
    )

# ════════════════════════════════════════════════════════════════════════════════
# SERVE FRONTEND STATIC FILES
# ════════════════════════════════════════════════════════════════════════════════
from fastapi.staticfiles import StaticFiles

_static_dir = os.path.join(os.path.dirname(__file__), "../frontend/dist")
if os.path.exists(_static_dir):
    app.mount("/assets", StaticFiles(directory=f"{_static_dir}/assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str):
        index_file = os.path.join(_static_dir, "index.html")
        return FileResponse(index_file)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
