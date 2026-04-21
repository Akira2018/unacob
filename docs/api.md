# Referência de API

## Visão geral

Base path principal: `/api`

Documentação nativa da FastAPI:

- Swagger UI: `/docs`
- ReDoc: `/redoc`
- OpenAPI JSON: `/openapi.json`

Autenticação:

- A maior parte dos endpoints exige header `Authorization: Bearer <token>`.
- O token é obtido em `POST /api/auth/login`.

Formato predominante:

- JSON para requests e responses.
- Alguns endpoints retornam arquivos para download.
- Alguns endpoints aceitam upload de arquivos, como PDF, CSV e extratos.

## Healthcheck

### GET /api/health

Uso: verificação de disponibilidade da API.

Exemplo de chamada:

```http
GET /api/health
```

## Autenticação

### POST /api/auth/login

Autentica um usuário e retorna token JWT.

Exemplo de request:

```json
{
  "email": "admin@unacob.local",
  "password": "SenhaSegura123!"
}
```

Exemplo de response:

```json
{
  "access_token": "jwt-token",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "email": "admin@unacob.local",
    "nome_completo": "Administrador",
    "role": "administrador"
  }
}
```

### GET /api/auth/me

Retorna os dados do usuário autenticado.

Exemplo de response:

```json
{
  "id": "3b3b0b53-9ff0-4f42-9a8c-17db2553a7ab",
  "email": "admin@unacob.local",
  "nome_completo": "Administrador do Sistema",
  "role": "administrador"
}
```

## Usuários

### GET /api/users

Lista usuários internos.

### POST /api/users

Cria novo usuário interno.

Campos relevantes:

- `email`
- `nome_completo`
- `role`
- `password`

Exemplo de request:

```json
{
  "email": "financeiro@unacob.local",
  "nome_completo": "Responsável Financeiro",
  "role": "gerente",
  "password": "SenhaSegura123!"
}
```

Exemplo de response:

```json
{
  "id": "a8fe0f2d-bf29-4b1e-baf7-6cbbe3db6d5e",
  "email": "financeiro@unacob.local",
  "nome_completo": "Responsável Financeiro",
  "role": "gerente",
  "ativo": true,
  "created_at": "2026-04-21T13:00:00"
}
```

### PUT /api/users/{user_id}

Atualiza dados de um usuário.

### DELETE /api/users/{user_id}

Exclui usuário.

### GET /api/users/me

Consulta o próprio cadastro.

### PUT /api/users/me

Atualiza o próprio cadastro.

## Associados

### GET /api/membros

Lista associados com filtros.

Query params identificados:

- `skip`
- `limit`
- `search`
- `status`

### POST /api/membros

Cria associado.

Exemplo de request:

```json
{
  "matricula": "80105246",
  "inscricao": "2026-001",
  "nome_completo": "Maria de Souza",
  "cpf": "12345678900",
  "codigo_dabb": "998877",
  "dabb_habilitado": true,
  "dabb_valor_mensalidade": 35.0,
  "email": "maria@example.com",
  "telefone": "1432320000",
  "celular": "14999990000",
  "endereco": "Rua Exemplo",
  "numero": "100",
  "bairro": "Centro",
  "cidade": "Bauru",
  "estado": "SP",
  "cep": "17000-000",
  "data_nascimento": "1955-03-12",
  "data_filiacao": "2026-02-01",
  "status": "ativo",
  "sexo": "F",
  "beneficio": "Aposentadoria",
  "valor_mensalidade": 35.0,
  "observacoes": "Associada cadastrada pela secretaria"
}
```

Exemplo de response:

```json
{
  "id": "d8257166-b24f-4414-8690-8ef465e6a5d7",
  "matricula": "80105246",
  "inscricao": "2026-001",
  "nome_completo": "Maria de Souza",
  "cpf": "12345678900",
  "codigo_dabb": "998877",
  "codigo_barras_dabb": null,
  "dabb_habilitado": true,
  "dabb_valor_mensalidade": 35.0,
  "email": "maria@example.com",
  "telefone": "1432320000",
  "celular": "14999990000",
  "ddd": null,
  "endereco": "Rua Exemplo",
  "numero": "100",
  "complemento": null,
  "bairro": "Centro",
  "cidade": "Bauru",
  "estado": "SP",
  "cep": "17000-000",
  "ect": null,
  "data_nascimento": "1955-03-12",
  "data_filiacao": "2026-02-01",
  "status": "ativo",
  "sexo": "F",
  "cat": null,
  "beneficio": "Aposentadoria",
  "valor_mensalidade": 35.0,
  "observacoes": "Associada cadastrada pela secretaria",
  "created_at": "2026-04-21T13:10:00"
}
```

### GET /api/membros/{membro_id}

Consulta associado por ID.

### PUT /api/membros/{membro_id}

Atualiza associado.

### DELETE /api/membros/{membro_id}

Exclui associado.

## Configurações DABB

### GET /api/configuracoes/dabb

Retorna configuração atual da DABB.

### GET /api/configuracoes/dabb/historico

Retorna histórico de alterações.

### PUT /api/configuracoes/dabb

Atualiza parâmetros de remessa e reajuste.

### DELETE /api/configuracoes/dabb/historico

Limpa histórico quando autorizado.

## Pagamentos

### GET /api/pagamentos

Lista pagamentos com filtros por competência, associado e status.

Query params identificados:

- `mes_referencia`
- `membro_id`
- `status_pagamento`

### GET /api/pagamentos/painel

Monta painel mensal por associado.

### POST /api/pagamentos

Cria ou atualiza pagamento do associado na competência informada.

Exemplo de request:

```json
{
  "membro_id": "uuid-do-membro",
  "valor_pago": 35.0,
  "mes_referencia": "2026-04",
  "data_pagamento": "2026-04-21",
  "status_pagamento": "pago",
  "forma_pagamento": "pix",
  "observacoes": "Pagamento registrado manualmente"
}
```

Exemplo de response:

```json
{
  "id": "9d50f548-469a-49f7-b8bd-8ab7b6539799",
  "membro_id": "uuid-do-membro",
  "valor_pago": 35.0,
  "mes_referencia": "2026-04",
  "data_pagamento": "2026-04-21",
  "status_pagamento": "pago",
  "forma_pagamento": "pix",
  "observacoes": "Pagamento registrado manualmente",
  "created_at": "2026-04-21T13:20:00"
}
```

### PUT /api/pagamentos/{pagamento_id}

Atualiza pagamento existente.

### DELETE /api/pagamentos/{pagamento_id}

Remove pagamento.

### POST /api/pagamentos/baixa-automatica-banco

Executa baixa automática a partir de dados bancários importados.

### GET /api/pagamentos/pendencias-conciliacao-manual

Lista pendências para conciliação manual.

### POST /api/pagamentos/pendencias-conciliacao-manual/confirmar

Confirma o vínculo manual de pendência com pagamento.

### POST /api/pagamentos/reprocessar-dabb

Reprocessa pagamentos relacionados à rotina DABB.

### POST /api/pagamentos/reparar-dabb-bimestral

Executa rotina de reparo da remessa bimestral DABB.

## Plano de contas

### GET /api/contas
### POST /api/contas
### PUT /api/contas/{conta_id}
### DELETE /api/contas/{conta_id}

Operações CRUD do plano de contas.

Exemplo de request para criação:

```json
{
  "codigo": "1.7",
  "nome": "Receitas extraordinárias",
  "tipo": "entrada",
  "ordem": 170,
  "ativo": true
}
```

## Previsão orçamentária

### GET /api/previsoes-orcamentarias
### GET /api/previsoes-orcamentarias/analise
### POST /api/previsoes-orcamentarias
### PUT /api/previsoes-orcamentarias/{previsao_id}
### DELETE /api/previsoes-orcamentarias/{previsao_id}
### POST /api/previsoes-orcamentarias/upsert-lote

Permite cadastro mensal por conta, análise consolidada e atualização em lote.

## Despesas

### GET /api/despesas
### POST /api/despesas
### PUT /api/despesas/{despesa_id}
### DELETE /api/despesas/{despesa_id}

Exemplo de request para criação:

```json
{
  "descricao": "Pagamento de internet",
  "categoria": "infraestrutura",
  "conta_id": "uuid-da-conta",
  "valor": 199.9,
  "data_despesa": "2026-04-15",
  "mes_referencia": "2026-04",
  "forma_pagamento": "pix",
  "fornecedor": "Operadora X",
  "nota_fiscal": "NF-12345",
  "observacoes": "Despesa recorrente"
}
```

## Outras receitas

### GET /api/outras-rendas
### POST /api/outras-rendas
### PUT /api/outras-rendas/{renda_id}
### DELETE /api/outras-rendas/{renda_id}

Exemplo de request para criação:

```json
{
  "descricao": "Doação espontânea",
  "categoria": "doacao",
  "conta_id": "uuid-da-conta",
  "valor": 500.0,
  "data_recebimento": "2026-04-10",
  "mes_referencia": "2026-04",
  "fonte": "Associado benfeitor",
  "observacoes": "Receita extraordinária"
}
```

## Aplicações financeiras

### GET /api/aplicacoes-financeiras

Lista registros por período.

### GET /api/aplicacoes-financeiras/resumo

Retorna consolidação das aplicações.

### POST /api/aplicacoes-financeiras/importar-pdf-preview

Faz leitura prévia de PDF.

### POST /api/aplicacoes-financeiras/importar-pdf-confirmar

Confirma a importação do PDF.

Exemplo de request:

```json
{
  "instituicao": "Banco do Brasil",
  "produto": "CDB DI",
  "data_aplicacao": "2026-04-01",
  "origem_registro": "importacao_pdf",
  "conta_origem": "Conta investimento principal",
  "arquivo_origem": "extrato-abr-2026.pdf",
  "saldo_anterior": 15000.0,
  "aplicacoes": 1000.0,
  "rendimento_bruto": 120.0,
  "imposto_renda": 18.0,
  "iof": 0.0,
  "impostos": 18.0,
  "rendimento_liquido": 102.0,
  "resgate": 300.0,
  "saldo_atual": 15802.0,
  "mes_referencia": "2026-04",
  "observacoes": "Importação do extrato mensal",
  "overwrite_existing": true
}
```

Exemplo de response:

```json
{
  "id": "e9777cbe-e58f-4f9d-bf25-8ba25b10d0a1",
  "instituicao": "Banco do Brasil",
  "produto": "CDB DI",
  "data_aplicacao": "2026-04-01",
  "origem_registro": "importacao_pdf",
  "conta_origem": "Conta investimento principal",
  "arquivo_origem": "extrato-abr-2026.pdf",
  "saldo_anterior": 15000.0,
  "aplicacoes": 1000.0,
  "rendimento_bruto": 120.0,
  "imposto_renda": 18.0,
  "iof": 0.0,
  "impostos": 18.0,
  "rendimento_liquido": 102.0,
  "resgate": 300.0,
  "saldo_atual": 15802.0,
  "mes_referencia": "2026-04",
  "observacoes": "Importação do extrato mensal",
  "created_at": "2026-04-21T13:30:00"
}
```

### POST /api/aplicacoes-financeiras
### PUT /api/aplicacoes-financeiras/{aplicacao_id}
### DELETE /api/aplicacoes-financeiras/{aplicacao_id}

## Transações, saldo e fluxo de caixa

### GET /api/transacoes
### POST /api/transacoes
### GET /api/saldo-inicial
### PUT /api/saldo-inicial
### DELETE /api/saldo-inicial
### GET /api/fluxo-caixa
### GET /api/dashboard

Cobrem consolidação financeira, painel inicial e saldo de abertura do período.

## Festas e participantes

### GET /api/festas
### POST /api/festas
### GET /api/festas/{festa_id}
### PUT /api/festas/{festa_id}
### DELETE /api/festas/{festa_id}

CRUD de festas.

Exemplo de request para criação:

```json
{
  "nome_festa": "Festa Junina UNACOB",
  "data_festa": "2026-06-20",
  "local_festa": "Sede da associação",
  "valor_convite": 30.0,
  "valor_convite_dependente": 20.0,
  "descricao": "Evento anual para associados",
  "observacoes": "Levar documento na entrada",
  "politica_precos": "Titular paga valor integral; dependente paga valor reduzido",
  "status": "ativa",
  "capacidade": 250
}
```

Exemplo de response:

```json
{
  "id": "37ef8e9d-c929-42ef-b10f-68c8cc2f72bf",
  "nome_festa": "Festa Junina UNACOB",
  "data_festa": "2026-06-20",
  "local_festa": "Sede da associação",
  "valor_convite": 30.0,
  "valor_convite_dependente": 20.0,
  "link_inscricao": null,
  "descricao": "Evento anual para associados",
  "observacoes": "Levar documento na entrada",
  "politica_precos": "Titular paga valor integral; dependente paga valor reduzido",
  "status": "ativa",
  "capacidade": 250,
  "created_at": "2026-04-21T13:40:00"
}
```

### POST /api/festas/{festa_id}/enviar-convites

Dispara convites por e-mail.

### GET /api/festas/{festa_id}/convite-link/{membro_id}

Gera ou consulta link de convite.

### GET /api/festas/{festa_id}/participantes
### POST /api/festas/{festa_id}/participantes
### PUT /api/participantes/{part_id}
### DELETE /api/participantes/{part_id}

Gerenciam participantes da festa.

## Fluxo público de festa

### GET /api/public/festas/{festa_id}

Consulta festa disponível publicamente.

### POST /api/public/festas/{festa_id}/identificar

Identifica o associado para confirmação.

### POST /api/public/festas/{festa_id}/confirmar

Confirma participação no fluxo público.

Exemplo de request:

```json
{
  "matricula": "80105246",
  "cpf": "12345678900",
  "levar_dependente": true,
  "nome_dependente": "João de Souza",
  "idade_dependente": 14,
  "parentesco": "filho",
  "levar_convidado": false,
  "observacoes": "Preferência por mesa próxima à entrada"
}
```

Exemplo de response:

```json
{
  "ok": true,
  "detail": "Participação confirmada com sucesso",
  "festa_id": "37ef8e9d-c929-42ef-b10f-68c8cc2f72bf",
  "membro_id": "d8257166-b24f-4414-8690-8ef465e6a5d7",
  "titular_participacao_id": "11111111-2222-3333-4444-555555555555",
  "dependente_participacao_id": "66666666-7777-8888-9999-000000000000",
  "convidado_participacao_id": null
}
```

## Aniversariantes

### GET /api/aniversariantes
### POST /api/aniversariantes/enviar-email

## Conciliação bancária

### GET /api/conciliacao
### GET /api/conciliacao/resumo
### POST /api/conciliacao
### PUT /api/conciliacao/{conc_id}
### DELETE /api/conciliacao/{conc_id}

CRUD e resumo dos lançamentos conciliáveis.

Parâmetros relevantes:

- `GET /api/conciliacao`: `mes_referencia`, `conciliado`, `tipo`
- `GET /api/conciliacao/resumo`: `mes_referencia`

Exemplo de criação manual:

```json
{
  "data_extrato": "2026-04-18",
  "descricao_extrato": "PIX RECEBIDO MARIA DE SOUZA",
  "valor_extrato": 35.0,
  "tipo": "credito",
  "conciliado": false,
  "observacoes": "Entrada importada manualmente",
  "mes_referencia": "2026-04",
  "banco": "Banco do Brasil",
  "numero_documento": "PX123456"
}
```

Exemplo de response de resumo:

```json
{
  "mes_referencia": "2026-04",
  "mes_referencia_anterior": "2026-03",
  "saldo_anterior": 10250.0,
  "total_creditos": 7450.0,
  "total_debitos": 5210.5,
  "saldo_extrato": 2239.5,
  "saldo_final": 12489.5,
  "total_lancamentos": 87,
  "total_conciliados": 74,
  "total_pendentes": 13
}
```

### GET /api/conciliacao/membros/buscar
### GET /api/conciliacao/membro/{membro_id}/pagamentos-pendentes
### GET /api/conciliacao/{conc_id}/sugestoes-mensalidade
### GET /api/conciliacao/{conc_id}/sugestoes
### POST /api/conciliacao/{conc_id}/reconciliar
### POST /api/conciliacao/{conc_id}/lancar-despesa
### POST /api/conciliacao/{conc_id}/lancar-receita
### POST /api/conciliacao/processar-ofx/{mes_referencia}

### POST /api/conciliacao/importar/csv
### POST /api/conciliacao/importar/extrato
### POST /api/conciliacao/importar/pdf-bb

Fluxos de importação e tratamento do extrato.

Exemplo de response de sugestões por valor:

```json
{
  "total": 2,
  "sugestoes": [
    {
      "pagamento_id": "17fd0f2b-1f3d-4a8b-982b-b0bd3d0a62c7",
      "membro_nome": "Maria de Souza",
      "mes": "2026-04",
      "valor": 35.0,
      "diferenca": 0.0
    },
    {
      "pagamento_id": "aa51bcf4-68e1-4e4d-bfd0-2e8f1b8d3643",
      "membro_nome": "José Pereira",
      "mes": "2026-04",
      "valor": 35.0,
      "diferenca": 0.0
    }
  ]
}
```

Exemplo de request para reconciliar:

```json
{
  "conc_id": "2d4b081b-c606-4f6f-8f81-f0538a3b30df",
  "pagamento_id": "17fd0f2b-1f3d-4a8b-982b-b0bd3d0a62c7"
}
```

Exemplo de request para lançar despesa a partir da conciliação:

```json
{
  "conta_id": "uuid-da-conta-de-saida",
  "categoria": "despesa bancária",
  "forma_pagamento": "extrato_bancario",
  "fornecedor": "Banco do Brasil",
  "nota_fiscal": null,
  "observacoes": "Tarifa identificada via extrato"
}
```

Exemplo de request para lançar receita a partir da conciliação:

```json
{
  "conta_id": "uuid-da-conta-de-entrada",
  "categoria": "outras arrecadações",
  "fonte": "Depósito identificado no extrato",
  "observacoes": "Receita classificada manualmente"
}
```

Exemplo de response do processamento OFX:

```json
{
  "ok": true,
  "mes_referencia": "2026-04",
  "total_creditos_baixados": 18,
  "total_debitos_lancados": 11,
  "creditos_sem_match": 3,
  "debitos_sem_conta": 2
}
```

## Financeiro consolidado

### GET /api/financeiro/balancete

Retorna o balancete consolidado do período.

## Relatórios

### Endpoints identificados

- `GET /api/relatorios/dabb-remessa-bimestral`
- `GET /api/relatorios/dabb-remessa-bimestral/previa`
- `GET /api/relatorios/dabb-remessa-bimestral/previa.xlsx`
- `GET /api/relatorios/dabb-remessa-bimestral/ultima`
- `GET /api/relatorios/dabb-remessa-bimestral/ultima/previa`
- `GET /api/relatorios/dabb-remessa-bimestral/remessas`
- `GET /api/relatorios/dabb-remessa-bimestral/remessas/{remessa_id}/previa`
- `GET /api/relatorios/dabb-remessa-bimestral/remessas/{remessa_id}/arquivo`
- `DELETE /api/relatorios/dabb-remessa-bimestral/remessas/{remessa_id}`
- `GET /api/relatorios/membros`
- `GET /api/relatorios/pagamentos`
- `GET /api/relatorios/aniversariantes`
- `GET /api/relatorios/balancete`
- `GET /api/relatorios/livro-diario`
- `GET /api/relatorios/conciliacao`
- `GET /api/relatorios/aplicacoes-financeiras`
- `GET /api/relatorios/previsao-orcamentaria`
- `GET /api/relatorios/consolidado-financeiro`
- `GET /api/relatorios/festas/{festa_id}`

### Parâmetros mais relevantes

- `GET /api/relatorios/dabb-remessa-bimestral`: `mes_referencia`, `data_debito`, `incluir_atrasados`
- `GET /api/relatorios/dabb-remessa-bimestral/previa`: `mes_referencia`, `data_debito`, `incluir_atrasados`
- `GET /api/relatorios/dabb-remessa-bimestral/previa.xlsx`: `mes_referencia`, `data_debito`, `incluir_atrasados`
- `GET /api/relatorios/dabb-remessa-bimestral/ultima`: `mes_referencia`, `data_debito`
- `GET /api/relatorios/dabb-remessa-bimestral/remessas`: `mes_referencia`
- `GET /api/relatorios/membros`: `status`
- `GET /api/relatorios/pagamentos`: `mes_referencia`
- `GET /api/relatorios/aniversariantes`: `mes`
- `GET /api/relatorios/balancete`: `mes_referencia`
- `GET /api/relatorios/livro-diario`: `mes_referencia`
- `GET /api/relatorios/conciliacao`: `mes_referencia`
- `GET /api/relatorios/aplicacoes-financeiras`: `mes_referencia`, `instituicao`
- `GET /api/relatorios/previsao-orcamentaria`: `ano`, `mes`, `tipo`
- `GET /api/relatorios/consolidado-financeiro`: `ano`

### Formato de saída

- A maioria dos relatórios retorna arquivo Excel `.xlsx` em streaming.
- A remessa DABB principal retorna arquivo texto com cabeçalhos HTTP adicionais para metadados.
- Algumas rotas da DABB retornam JSON de prévia ou listagem.

### Exemplo de uso: prévia da remessa DABB

```http
GET /api/relatorios/dabb-remessa-bimestral/previa?mes_referencia=2026-04&incluir_atrasados=true
Authorization: Bearer <token>
```

Exemplo de response resumida:

```json
{
  "mes_inicio": "2026-03",
  "mes_fim": "2026-04",
  "data_debito": "2026-04-30",
  "quantidade_associados": 84,
  "quantidade_competencias": 132,
  "valor_total": 4758.0,
  "incluir_atrasados": true,
  "itens": [
    {
      "nome": "Maria de Souza",
      "matricula": "80105246",
      "codigo_dabb": "998877",
      "dabb_habilitado": true,
      "competencias": ["2026-03", "2026-04"],
      "valor_mensalidade_dabb": 35.0,
      "taxa_bancaria": 1.0,
      "valor_total": 71.0
    }
  ]
}
```

### Exemplo de uso: relatório de pagamentos

```http
GET /api/relatorios/pagamentos?mes_referencia=2026-04
Authorization: Bearer <token>
```

Response: arquivo Excel com nome semelhante a `recebimento_mensalidades_2026-04.xlsx`.

### Exemplo de uso: relatório de conciliação

```http
GET /api/relatorios/conciliacao?mes_referencia=2026-04
Authorization: Bearer <token>
```

Response: arquivo Excel com resumo de saldo anterior, créditos, débitos e listagem detalhada do extrato conciliado.

### Exemplo de uso: consolidado financeiro anual

```http
GET /api/relatorios/consolidado-financeiro?ano=2026
Authorization: Bearer <token>
```

Response: arquivo Excel com visão consolidada mensal e aba adicional de detalhamento por conta.

## Etiquetas

### GET /api/etiquetas/membros
### GET /api/etiquetas

## Administração do sistema

### GET /api/admin/system/schema

Inspeciona estrutura disponível.

### GET /api/admin/system/backup

Dispara ou baixa backup, conforme implementação interna.

### GET /api/admin/system/backups

Lista backups existentes.

### GET /api/admin/system/backups/{filename}

Baixa um backup específico.

### POST /api/admin/system/backups/{filename}/restore

Restaura backup salvo.

### DELETE /api/admin/system/backups/{filename}

Exclui backup salvo.

### POST /api/admin/system/restore

Restaura banco a partir de upload.

### GET /api/admin/system/sqlite-status

Mostra journal mode, timeout, integridade e dados do arquivo SQLite.

Exemplo de response:

```json
{
  "is_sqlite": true,
  "database_path": "/data/associacao.db",
  "journal_mode": "wal",
  "synchronous": 1,
  "foreign_keys": true,
  "busy_timeout": 15000,
  "integrity_check": "ok",
  "database_size_bytes": 3145728
}
```

## Observações operacionais

- Como a API já é FastAPI, também é recomendável publicar a documentação interativa nativa do framework em ambiente controlado.
- Para documentação externa de consumidores, vale complementar este arquivo com exemplos reais por schema em uma próxima etapa.