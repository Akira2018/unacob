from sqlalchemy import Boolean, Date, DateTime, Index, Numeric, String, Text, Float, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base
from datetime import datetime
import uuid


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    nome_completo: Mapped[str | None] = mapped_column(String(255))
    role: Mapped[str | None] = mapped_column(String(20))  # administrador, gerente, assistente
    password: Mapped[str | None] = mapped_column(String(255))
    ativo: Mapped[bool | None] = mapped_column(Boolean, default=True)
    created_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)



class ConfiguracaoSistema(Base):
    __tablename__ = "configuracoes_sistema"

    chave: Mapped[str] = mapped_column(String(100), primary_key=True)
    valor: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class HistoricoConfiguracaoDabb(Base):
    __tablename__ = "historico_configuracao_dabb"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    tipo_evento: Mapped[str | None] = mapped_column(String(50), index=True)
    valor_mensal_anterior: Mapped[Numeric | None] = mapped_column(Numeric(12, 2), nullable=True)
    valor_mensal_novo: Mapped[Numeric | None] = mapped_column(Numeric(12, 2), nullable=True)
    taxa_anterior: Mapped[Numeric | None] = mapped_column(Numeric(12, 2), nullable=True)
    taxa_nova: Mapped[Numeric | None] = mapped_column(Numeric(12, 2), nullable=True)
    aplicar_reajuste_todos: Mapped[bool | None] = mapped_column(Boolean, default=False)
    somente_habilitados_dabb: Mapped[bool | None] = mapped_column(Boolean, default=False)
    quantidade_membros_afetados: Mapped[int | None] = mapped_column(Integer, default=0)
    observacoes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, index=True)


class Membro(Base):
    __tablename__ = "membros"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str | None] = mapped_column(String(36))
    matricula: Mapped[str | None] = mapped_column(String(50), unique=True, index=True)
    inscricao: Mapped[str | None] = mapped_column(String(50))
    nome_completo: Mapped[str | None] = mapped_column(String(255))
    cpf: Mapped[str | None] = mapped_column(String(20))
    cpf2: Mapped[str | None] = mapped_column(String(20))
    codigo_dabb: Mapped[str | None] = mapped_column(String(50))
    codigo_barras_dabb: Mapped[str | None] = mapped_column(String(50))
    dabb_habilitado: Mapped[bool | None] = mapped_column(Boolean, default=True)
    dabb_valor_mensalidade: Mapped[Numeric | None] = mapped_column(Numeric(12, 2), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255))
    telefone: Mapped[str | None] = mapped_column(String(30))
    celular: Mapped[str | None] = mapped_column(String(30))
    ddd: Mapped[str | None] = mapped_column(String(20))
    endereco: Mapped[str | None] = mapped_column(String(255))
    numero: Mapped[str | None] = mapped_column(String(20))
    complemento: Mapped[str | None] = mapped_column(String(100))
    bairro: Mapped[str | None] = mapped_column(String(120))
    cidade: Mapped[str | None] = mapped_column(String(120))
    estado: Mapped[str | None] = mapped_column(String(50))
    cep: Mapped[str | None] = mapped_column(String(20))
    ect: Mapped[str | None] = mapped_column(String(50))
    data_nascimento: Mapped[Date | None] = mapped_column(Date)
    data_filiacao: Mapped[Date | None] = mapped_column("data_filiacao", Date)
    status: Mapped[str | None] = mapped_column(String(20), default='ativo')  # ativo, inativo, suspenso
    sexo: Mapped[str | None] = mapped_column(String(20))
    cat: Mapped[str | None] = mapped_column(String(50))
    beneficio: Mapped[str | None] = mapped_column(String(120))
    valor_mensalidade: Mapped[Numeric] = mapped_column(Numeric(12, 2), default=0)
    observacoes: Mapped[str | None] = mapped_column(Text)
    foto_url: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    pagamentos = relationship("Pagamento", backref="membro", lazy="dynamic")
    participacoes = relationship("ParticipacaoFesta", backref="membro", lazy="dynamic")
    remessas_dabb = relationship("DabbRemessaItem", backref="membro", lazy="dynamic")


Index("ix_membros_status", Membro.status)
Index("ix_membros_cidade", Membro.cidade)


class Pagamento(Base):
    __tablename__ = "pagamentos"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    membro_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("membros.id"), index=True, nullable=True)
    valor_pago: Mapped[Numeric] = mapped_column(Numeric(12, 2), nullable=True)
    mes_referencia: Mapped[str | None] = mapped_column(String(10), index=True, nullable=True)  # YYYY-MM
    data_pagamento: Mapped[Date | None] = mapped_column(Date, nullable=True)
    status_pagamento: Mapped[str | None] = mapped_column(String(20), index=True, nullable=True)  # pago, pendente, atrasado
    forma_pagamento: Mapped[str | None] = mapped_column(String(50), nullable=True)  # dinheiro, pix, transferencia, boleto
    comprovante: Mapped[str | None] = mapped_column(String(500), nullable=True)
    observacoes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=True)
    updated_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=True)


class DabbRemessa(Base):
    __tablename__ = "dabb_remessas"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    arquivo_nome: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    sequencial_arquivo: Mapped[int | None] = mapped_column(Integer, index=True)
    mes_inicio: Mapped[str | None] = mapped_column(String(7), index=True)
    mes_fim: Mapped[str | None] = mapped_column(String(7), index=True)
    data_debito: Mapped[Date | None] = mapped_column(Date, index=True)
    incluir_atrasados: Mapped[bool | None] = mapped_column(Boolean, default=True)
    valor_total: Mapped[Numeric | None] = mapped_column(Numeric(12, 2), nullable=True)
    quantidade_registros: Mapped[int | None] = mapped_column(Integer, default=0)
    observacoes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    itens = relationship("DabbRemessaItem", backref="remessa", lazy="dynamic")


class DabbRemessaItem(Base):
    __tablename__ = "dabb_remessa_itens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    remessa_id: Mapped[str] = mapped_column(String(36), ForeignKey("dabb_remessas.id"), index=True)
    membro_id: Mapped[str] = mapped_column(String(36), ForeignKey("membros.id"), index=True)
    conciliacao_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("conciliacoes.id"), index=True, nullable=True)
    codigo_dabb: Mapped[str | None] = mapped_column(String(50), index=True)
    codigo_barras: Mapped[str | None] = mapped_column(String(50), nullable=True)
    numero_documento: Mapped[str | None] = mapped_column(String(50), index=True)
    valor_competencias: Mapped[Numeric | None] = mapped_column(Numeric(12, 2), nullable=True)
    taxa_bancaria: Mapped[Numeric | None] = mapped_column(Numeric(12, 2), nullable=True)
    valor_total: Mapped[Numeric | None] = mapped_column(Numeric(12, 2), nullable=True)
    quantidade_competencias: Mapped[int | None] = mapped_column(Integer, default=0)
    competencias_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str | None] = mapped_column(String(30), default="gerada", index=True)
    created_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class Transacao(Base):
    __tablename__ = "transacoes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    descricao: Mapped[str | None] = mapped_column(Text, nullable=True)
    valor: Mapped[Numeric] = mapped_column(Numeric(12, 2), nullable=True)
    tipo: Mapped[str | None] = mapped_column(String(10), index=True, nullable=True)  # entrada, saida
    categoria: Mapped[str | None] = mapped_column(String(100), index=True, nullable=True)
    data_transacao: Mapped[Date | None] = mapped_column(Date, index=True, nullable=True)
    origem: Mapped[str | None] = mapped_column(String(50), nullable=True)  # mensalidade, doacao, evento, despesa
    membro_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=True)
    updated_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=True)


class PlanoConta(Base):
    __tablename__ = "plano_contas"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    codigo: Mapped[str | None] = mapped_column(String(20), unique=True, index=True)
    nome: Mapped[str | None] = mapped_column(String(255))
    tipo: Mapped[str | None] = mapped_column(String(10), index=True)  # entrada, saida
    ordem: Mapped[int | None] = mapped_column(Integer, default=0)
    ativo: Mapped[bool | None] = mapped_column(Boolean, default=True)
    created_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class PrevisaoOrcamentaria(Base):
    __tablename__ = "previsoes_orcamentarias"
    __table_args__ = (
        UniqueConstraint("conta_id", "ano", "mes", name="uq_previsao_orcamentaria_conta_ano_mes"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    conta_id: Mapped[str] = mapped_column(String(36), ForeignKey("plano_contas.id"), index=True, nullable=False)
    ano: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    mes: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    valor_previsto: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    observacoes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[DateTime | None] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[DateTime | None] = mapped_column(DateTime, default=datetime.utcnow)


class PrevisaoOrcamentariaAnual(Base):
    __tablename__ = "previsoes_orcamentarias_anuais"
    __table_args__ = (
        UniqueConstraint("conta_id", "ano", name="uq_previsao_orcamentaria_anual_conta_ano"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    conta_id: Mapped[str] = mapped_column(String(36), ForeignKey("plano_contas.id"), index=True, nullable=False)
    ano: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    valor_previsto_anual: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    observacoes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[DateTime | None] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[DateTime | None] = mapped_column(DateTime, default=datetime.utcnow)


class Despesa(Base):
    __tablename__ = "despesas"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    descricao: Mapped[str | None] = mapped_column(String(255))
    categoria: Mapped[str | None] = mapped_column(String(100))
    valor: Mapped[float | None] = mapped_column(Float)
    data_despesa: Mapped[Date | None] = mapped_column(Date)
    mes_referencia: Mapped[str | None] = mapped_column(String(7))  # YYYY-MM
    forma_pagamento: Mapped[str | None] = mapped_column(String(50))
    fornecedor: Mapped[str | None] = mapped_column(String(255))
    nota_fiscal: Mapped[str | None] = mapped_column(String(100))
    observacoes: Mapped[str | None] = mapped_column(Text)
    conta_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("plano_contas.id"), index=True, nullable=True)
    conta_codigo: Mapped[str | None] = mapped_column(String(20), index=True, nullable=True)
    conta_nome: Mapped[str | None] = mapped_column(String(255), nullable=True)
    user_id: Mapped[str | None] = mapped_column(String(36))
    created_at: Mapped[DateTime | None] = mapped_column(DateTime, default=datetime.utcnow)


class OutraRenda(Base):
    __tablename__ = "outras_rendas"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    descricao: Mapped[str | None] = mapped_column(String(255))
    categoria: Mapped[str | None] = mapped_column(String(100))  # doacao, aluguel, evento, patrocinio, outro
    valor: Mapped[float | None] = mapped_column(Float)
    data_recebimento: Mapped[Date | None] = mapped_column(Date)
    mes_referencia: Mapped[str | None] = mapped_column(String(7))  # YYYY-MM
    fonte: Mapped[str | None] = mapped_column(String(255))
    observacoes: Mapped[str | None] = mapped_column(Text)
    conta_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("plano_contas.id"), index=True, nullable=True)
    conta_codigo: Mapped[str | None] = mapped_column(String(20), index=True, nullable=True)
    conta_nome: Mapped[str | None] = mapped_column(String(255), nullable=True)
    user_id: Mapped[str | None] = mapped_column(String(36))
    created_at: Mapped[DateTime | None] = mapped_column(DateTime, default=datetime.utcnow)


class AplicacaoFinanceira(Base):
    __tablename__ = "aplicacoes_financeiras"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str | None] = mapped_column(String(36))
    mes_referencia: Mapped[str | None] = mapped_column(String(7), index=True)  # YYYY-MM
    data_aplicacao: Mapped[Date | None] = mapped_column(Date, index=True)
    instituicao: Mapped[str | None] = mapped_column(String(150))
    produto: Mapped[str | None] = mapped_column(String(150))
    origem_registro: Mapped[str | None] = mapped_column(String(50), default="manual")
    conta_origem: Mapped[str | None] = mapped_column(String(150))
    arquivo_origem: Mapped[str | None] = mapped_column(String(255))
    saldo_anterior: Mapped[float | None] = mapped_column(Float, default=0)
    aplicacoes: Mapped[float | None] = mapped_column(Float, default=0)
    rendimento_bruto: Mapped[float | None] = mapped_column(Float, default=0)
    imposto_renda: Mapped[float | None] = mapped_column(Float, default=0)
    iof: Mapped[float | None] = mapped_column(Float, default=0)
    impostos: Mapped[float | None] = mapped_column(Float, default=0)
    rendimento_liquido: Mapped[float | None] = mapped_column(Float, default=0)
    resgate: Mapped[float | None] = mapped_column(Float, default=0)
    saldo_atual: Mapped[float | None] = mapped_column(Float, default=0)
    observacoes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[DateTime | None] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[DateTime | None] = mapped_column(DateTime, default=datetime.utcnow)


class SaldoMensal(Base):
    __tablename__ = "saldos_mensais"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str | None] = mapped_column(String(36))
    mes_referencia: Mapped[str | None] = mapped_column(String(7), unique=True, index=True)  # YYYY-MM
    valor_saldo_inicial: Mapped[float | None] = mapped_column(Float, default=0)
    observacoes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[DateTime | None] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[DateTime | None] = mapped_column(DateTime, default=datetime.utcnow)


class Festa(Base):
    __tablename__ = "festas"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    nome_festa: Mapped[str | None] = mapped_column(String(255), nullable=True)
    data_festa: Mapped[Date | None] = mapped_column(Date, index=True, nullable=True)
    local_festa: Mapped[str | None] = mapped_column(String(255), nullable=True)
    valor_convite: Mapped[Numeric] = mapped_column(Numeric(12, 2), nullable=True)
    valor_convite_dependente: Mapped[Numeric] = mapped_column(Numeric(12, 2), nullable=True)
    link_inscricao: Mapped[str | None] = mapped_column(String(500), nullable=True)
    descricao: Mapped[str | None] = mapped_column(Text, nullable=True)
    observacoes: Mapped[str | None] = mapped_column(Text, nullable=True)
    politica_precos: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str | None] = mapped_column(String(20), default='ativa')  # ativa, encerrada, cancelada
    capacidade: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=True)
    updated_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=True)

    participacoes = relationship("ParticipacaoFesta", backref="festa", lazy="dynamic")


class ParticipacaoFesta(Base):
    __tablename__ = "participacao_festa"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    festa_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("festas.id"), index=True, nullable=True)
    membro_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("membros.id"), index=True, nullable=True)
    nome_participante: Mapped[str | None] = mapped_column(String(255), nullable=True)
    tipo_participante: Mapped[str | None] = mapped_column(String(20), nullable=True)  # titular, dependente, convidado
    custo_convite: Mapped[Numeric] = mapped_column(Numeric(12, 2), nullable=True)
    pago: Mapped[bool | None] = mapped_column(Boolean, nullable=True, default=False)
    data_pagamento: Mapped[Date | None] = mapped_column(Date, nullable=True)
    nome_dependente: Mapped[str | None] = mapped_column(String(255), nullable=True)
    parentesco: Mapped[str | None] = mapped_column(String(100), nullable=True)
    observacoes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=True)
    updated_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=True)


class Conciliacao(Base):
    __tablename__ = "conciliacoes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    pagamento_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("pagamentos.id"), nullable=True, index=True)
    despesa_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    outra_renda_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    data_extrato: Mapped[Date | None] = mapped_column(Date, index=True, nullable=True)
    descricao_extrato: Mapped[str | None] = mapped_column(Text, nullable=True)
    valor_extrato: Mapped[Numeric] = mapped_column(Numeric(12, 2), nullable=True)
    tipo: Mapped[str | None] = mapped_column(String(10), nullable=True)  # credito, debito
    conciliado: Mapped[bool] = mapped_column(Boolean, index=True, nullable=False, default=False)
    observacoes: Mapped[str | None] = mapped_column(Text, nullable=True)
    mes_referencia: Mapped[str | None] = mapped_column(String(7), index=True, nullable=True)
    banco: Mapped[str | None] = mapped_column(String(100), nullable=True)
    numero_documento: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=True)
    updated_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=True)


class Aniversariante(Base):
    """View helper - uses Membro.data_nascimento"""
    __tablename__ = "mensagens_aniversario"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    membro_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("membros.id"), nullable=True)
    mensagem: Mapped[str | None] = mapped_column(Text, nullable=True)
    data_envio: Mapped[DateTime | None] = mapped_column(DateTime, nullable=True)
    enviado: Mapped[bool | None] = mapped_column(Boolean, default=False, nullable=True)
    created_at: Mapped[DateTime | None] = mapped_column(DateTime, default=datetime.utcnow, nullable=True)
