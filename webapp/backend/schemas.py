from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal


# Auth schemas
class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict


class AniversarioEmailRequest(BaseModel):
    email: EmailStr
    nome: str


# User schemas
class UserCreate(BaseModel):
    email: str
    nome_completo: str
    role: str  # administrador, gerente, assistente
    password: str

class UserUpdate(BaseModel):
    email: Optional[str] = None
    nome_completo: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None
    ativo: Optional[bool] = None


class UserSelfUpdate(BaseModel):
    nome_completo: Optional[str] = None
    current_password: Optional[str] = None
    password: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    email: Optional[str]
    nome_completo: Optional[str]
    role: Optional[str]
    ativo: Optional[bool]
    created_at: Optional[datetime]
    class Config:
        from_attributes = True


# Membro schemas
class MembroCreate(BaseModel):
    matricula: Optional[str] = None
    inscricao: Optional[str] = None
    nome_completo: str
    cpf: Optional[str] = None
    email: Optional[str] = None
    telefone: Optional[str] = None
    celular: Optional[str] = None
    ddd: Optional[str] = None
    endereco: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    cep: Optional[str] = None
    ect: Optional[str] = None
    data_nascimento: Optional[date] = None
    data_associacao: Optional[date] = None
    status: Optional[str] = 'ativo'
    sexo: Optional[str] = None
    cat: Optional[str] = None
    beneficio: Optional[str] = None
    valor_mensalidade: Optional[float] = 0
    observacoes: Optional[str] = None

class MembroUpdate(MembroCreate):
    nome_completo: Optional[str] = None

class MembroResponse(BaseModel):
    id: str
    matricula: Optional[str]
    inscricao: Optional[str]
    nome_completo: Optional[str]
    cpf: Optional[str]
    email: Optional[str]
    telefone: Optional[str]
    celular: Optional[str]
    ddd: Optional[str]
    endereco: Optional[str]
    numero: Optional[str]
    complemento: Optional[str]
    bairro: Optional[str]
    cidade: Optional[str]
    estado: Optional[str]
    cep: Optional[str]
    ect: Optional[str]
    data_nascimento: Optional[date]
    data_associacao: Optional[date]
    status: Optional[str]
    sexo: Optional[str]
    cat: Optional[str]
    beneficio: Optional[str]
    valor_mensalidade: Optional[float]
    observacoes: Optional[str]
    created_at: Optional[datetime]
    class Config:
        from_attributes = True


# Pagamento schemas
class PagamentoCreate(BaseModel):
    membro_id: str
    valor_pago: float
    mes_referencia: str  # YYYY-MM
    data_pagamento: Optional[date] = None
    status_pagamento: str = 'pago'
    forma_pagamento: Optional[str] = None
    observacoes: Optional[str] = None

class PagamentoUpdate(BaseModel):
    valor_pago: Optional[float] = None
    mes_referencia: Optional[str] = None
    data_pagamento: Optional[date] = None
    status_pagamento: Optional[str] = None
    forma_pagamento: Optional[str] = None
    observacoes: Optional[str] = None

class PagamentoResponse(BaseModel):
    id: str
    membro_id: Optional[str]
    valor_pago: Optional[float]
    mes_referencia: Optional[str]
    data_pagamento: Optional[date]
    status_pagamento: Optional[str]
    forma_pagamento: Optional[str]
    observacoes: Optional[str]
    created_at: Optional[datetime]
    class Config:
        from_attributes = True


class PlanoContaCreate(BaseModel):
    codigo: str
    nome: str
    tipo: str  # entrada, saida
    ordem: Optional[int] = 0
    ativo: Optional[bool] = True


class PlanoContaUpdate(BaseModel):
    codigo: Optional[str] = None
    nome: Optional[str] = None
    tipo: Optional[str] = None
    ordem: Optional[int] = None
    ativo: Optional[bool] = None


class PlanoContaResponse(BaseModel):
    id: str
    codigo: Optional[str]
    nome: Optional[str]
    tipo: Optional[str]
    ordem: Optional[int]
    ativo: Optional[bool]

    class Config:
        from_attributes = True


class PrevisaoOrcamentariaCreate(BaseModel):
    conta_id: str
    ano: int
    mes: int
    valor_previsto: float
    observacoes: Optional[str] = None


class PrevisaoOrcamentariaUpdate(BaseModel):
    valor_previsto: Optional[float] = None
    observacoes: Optional[str] = None


class PrevisaoOrcamentariaResponse(BaseModel):
    id: str
    conta_id: str
    conta_codigo: Optional[str] = None
    conta_nome: Optional[str] = None
    ano: int
    mes: int
    valor_previsto: float
    observacoes: Optional[str] = None
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class PrevisaoOrcamentariaUpsertItem(BaseModel):
    conta_id: str
    ano: int
    mes: int
    valor_previsto: float
    observacoes: Optional[str] = None


# Despesa schemas
class DespesaCreate(BaseModel):
    descricao: str
    categoria: Optional[str] = None
    conta_id: str
    valor: float
    data_despesa: date
    mes_referencia: Optional[str] = None
    forma_pagamento: Optional[str] = None
    fornecedor: Optional[str] = None
    nota_fiscal: Optional[str] = None
    observacoes: Optional[str] = None

class DespesaUpdate(BaseModel):
    descricao: Optional[str] = None
    categoria: Optional[str] = None
    conta_id: Optional[str] = None
    valor: Optional[float] = None
    data_despesa: Optional[date] = None
    mes_referencia: Optional[str] = None
    forma_pagamento: Optional[str] = None
    fornecedor: Optional[str] = None
    nota_fiscal: Optional[str] = None
    observacoes: Optional[str] = None

class DespesaResponse(BaseModel):
    id: str
    descricao: Optional[str]
    categoria: Optional[str]
    valor: Optional[float]
    data_despesa: Optional[date]
    mes_referencia: Optional[str]
    forma_pagamento: Optional[str]
    fornecedor: Optional[str]
    nota_fiscal: Optional[str]
    observacoes: Optional[str]
    conta_id: Optional[str]
    conta_codigo: Optional[str]
    conta_nome: Optional[str]
    created_at: Optional[datetime]
    class Config:
        from_attributes = True


# OutraRenda schemas
class OutraRendaCreate(BaseModel):
    descricao: str
    categoria: Optional[str] = None
    conta_id: str
    valor: float
    data_recebimento: date
    mes_referencia: Optional[str] = None
    fonte: Optional[str] = None
    observacoes: Optional[str] = None

class OutraRendaUpdate(BaseModel):
    descricao: Optional[str] = None
    categoria: Optional[str] = None
    conta_id: Optional[str] = None
    valor: Optional[float] = None
    data_recebimento: Optional[date] = None
    mes_referencia: Optional[str] = None
    fonte: Optional[str] = None
    observacoes: Optional[str] = None

class OutraRendaResponse(BaseModel):
    id: str
    descricao: Optional[str]
    categoria: Optional[str]
    valor: Optional[float]
    data_recebimento: Optional[date]
    mes_referencia: Optional[str]
    fonte: Optional[str]
    observacoes: Optional[str]
    conta_id: Optional[str]
    conta_codigo: Optional[str]
    conta_nome: Optional[str]
    created_at: Optional[datetime]
    class Config:
        from_attributes = True


# AplicacaoFinanceira schemas
class AplicacaoFinanceiraCreate(BaseModel):
    instituicao: str
    produto: str
    data_aplicacao: Optional[date] = None
    saldo_anterior: Optional[float] = 0
    aplicacoes: Optional[float] = 0
    rendimento_bruto: Optional[float] = 0
    impostos: Optional[float] = 0
    resgate: Optional[float] = 0
    mes_referencia: Optional[str] = None
    observacoes: Optional[str] = None


class AplicacaoFinanceiraUpdate(BaseModel):
    instituicao: Optional[str] = None
    produto: Optional[str] = None
    data_aplicacao: Optional[date] = None
    saldo_anterior: Optional[float] = None
    aplicacoes: Optional[float] = None
    rendimento_bruto: Optional[float] = None
    impostos: Optional[float] = None
    resgate: Optional[float] = None
    mes_referencia: Optional[str] = None
    observacoes: Optional[str] = None


class AplicacaoFinanceiraResponse(BaseModel):
    id: str
    instituicao: Optional[str]
    produto: Optional[str]
    data_aplicacao: Optional[date]
    saldo_anterior: Optional[float]
    aplicacoes: Optional[float]
    rendimento_bruto: Optional[float]
    impostos: Optional[float]
    resgate: Optional[float]
    saldo_atual: Optional[float]
    mes_referencia: Optional[str]
    observacoes: Optional[str]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class AplicacaoFinanceiraTotais(BaseModel):
    saldo_anterior: float
    aplicacoes: float
    rendimento_bruto: float
    impostos: float
    resgate: float
    saldo_atual: float


class AplicacaoFinanceiraResumoResponse(BaseModel):
    mes_referencia: str
    total_registros: int
    totais: AplicacaoFinanceiraTotais


class SaldoMensalUpsert(BaseModel):
    mes_referencia: str
    valor_saldo_inicial: float
    observacoes: Optional[str] = None


class SaldoMensalResponse(BaseModel):
    mes_referencia: str
    valor_saldo_inicial: float
    origem: str  # manual, calculado
    observacoes: Optional[str] = None


# Festa schemas
class FestaCreate(BaseModel):
    nome_festa: str
    data_festa: date
    local_festa: Optional[str] = None
    valor_convite: Optional[float] = 0
    valor_convite_dependente: Optional[float] = 0
    link_inscricao: Optional[str] = None
    descricao: Optional[str] = None
    observacoes: Optional[str] = None
    politica_precos: Optional[str] = None
    status: Optional[str] = 'ativa'
    capacidade: Optional[int] = None

class FestaUpdate(FestaCreate):
    nome_festa: Optional[str] = None
    data_festa: Optional[date] = None

class FestaResponse(BaseModel):
    id: str
    nome_festa: Optional[str]
    data_festa: Optional[date]
    local_festa: Optional[str]
    valor_convite: Optional[float]
    valor_convite_dependente: Optional[float]
    link_inscricao: Optional[str]
    descricao: Optional[str]
    observacoes: Optional[str]
    politica_precos: Optional[str]
    status: Optional[str]
    capacidade: Optional[int]
    created_at: Optional[datetime]
    class Config:
        from_attributes = True


class FestaConviteEmailRequest(BaseModel):
    assunto: Optional[str] = None
    mensagem: Optional[str] = None
    somente_pendentes: Optional[bool] = False
    membro_ids: Optional[List[str]] = None
    filtro_nome: Optional[str] = None
    filtro_matricula: Optional[str] = None
    filtro_cidade: Optional[str] = None
    filtro_sexo: Optional[str] = None
    filtro_status: Optional[str] = "ativo"
    somente_email_valido: Optional[bool] = True


class ParticipacaoPublicaCreate(BaseModel):
    levar_dependente: Optional[bool] = False
    nome_dependente: Optional[str] = None
    idade_dependente: Optional[int] = None
    parentesco: Optional[str] = None
    levar_convidado: Optional[bool] = False
    nome_convidado: Optional[str] = None
    idade_convidado: Optional[int] = None
    observacoes: Optional[str] = None


class ParticipacaoPublicaAuthRequest(BaseModel):
    matricula: str
    cpf: str


class ParticipacaoPublicaConfirmRequest(ParticipacaoPublicaCreate):
    matricula: str
    cpf: str


class ParticipacaoPublicaResponse(BaseModel):
    ok: bool
    detail: str
    festa_id: str
    membro_id: str
    titular_participacao_id: Optional[str] = None
    dependente_participacao_id: Optional[str] = None
    convidado_participacao_id: Optional[str] = None


# ParticipacaoFesta schemas
class ParticipacaoCreate(BaseModel):
    festa_id: str
    membro_id: Optional[str] = None
    nome_participante: str
    tipo_participante: str  # titular, dependente, convidado
    custo_convite: Optional[float] = 0
    pago: Optional[bool] = False
    data_pagamento: Optional[date] = None
    nome_dependente: Optional[str] = None
    parentesco: Optional[str] = None
    observacoes: Optional[str] = None

class ParticipacaoUpdate(BaseModel):
    nome_participante: Optional[str] = None
    tipo_participante: Optional[str] = None
    custo_convite: Optional[float] = None
    pago: Optional[bool] = None
    data_pagamento: Optional[date] = None
    nome_dependente: Optional[str] = None
    parentesco: Optional[str] = None
    observacoes: Optional[str] = None

class ParticipacaoResponse(BaseModel):
    id: str
    festa_id: Optional[str]
    membro_id: Optional[str]
    nome_participante: Optional[str]
    tipo_participante: Optional[str]
    custo_convite: Optional[float]
    pago: Optional[bool]
    data_pagamento: Optional[date]
    nome_dependente: Optional[str]
    parentesco: Optional[str]
    observacoes: Optional[str]
    created_at: Optional[datetime]
    class Config:
        from_attributes = True


# Conciliacao schemas
class ConciliacaoCreate(BaseModel):
    data_extrato: date
    descricao_extrato: str
    valor_extrato: float
    tipo: str  # credito, debito
    conciliado: Optional[bool] = False
    observacoes: Optional[str] = None
    mes_referencia: Optional[str] = None
    banco: Optional[str] = None
    numero_documento: Optional[str] = None

class ConciliacaoUpdate(BaseModel):
    data_extrato: Optional[date] = None
    descricao_extrato: Optional[str] = None
    valor_extrato: Optional[float] = None
    tipo: Optional[str] = None
    mes_referencia: Optional[str] = None
    banco: Optional[str] = None
    numero_documento: Optional[str] = None
    pagamento_id: Optional[str] = None
    conciliado: Optional[bool] = None
    observacoes: Optional[str] = None

class ConciliacaoResponse(BaseModel):
    id: str
    pagamento_id: Optional[str]
    data_extrato: Optional[date]
    descricao_extrato: Optional[str]
    valor_extrato: Optional[float]
    tipo: Optional[str]
    conciliado: bool
    observacoes: Optional[str]
    mes_referencia: Optional[str]
    banco: Optional[str]
    numero_documento: Optional[str]
    created_at: Optional[datetime]
    class Config:
        from_attributes = True

class ConciliacaoImportRequest(BaseModel):
    """Schema para sugerir matching de pagamentos"""
    conc_id: str
    membro_id: Optional[str] = None


# Transacao schemas
class TransacaoCreate(BaseModel):
    descricao: str
    valor: float
    tipo: str  # entrada, saida
    categoria: Optional[str] = None
    data_transacao: date
    origem: Optional[str] = None
    membro_id: Optional[str] = None

class TransacaoResponse(BaseModel):
    id: str
    descricao: Optional[str]
    valor: Optional[float]
    tipo: Optional[str]
    categoria: Optional[str]
    data_transacao: Optional[date]
    origem: Optional[str]
    membro_id: Optional[str]
    created_at: Optional[datetime]
    class Config:
        from_attributes = True
