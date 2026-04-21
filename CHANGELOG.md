# Changelog

Este arquivo registra mudanças relevantes do projeto em formato legível para operação e manutenção.

O repositório ainda não adota versionamento formal por release. Por isso, este changelog inicial foi consolidado a partir do histórico recente de commits.

## Unreleased

### Added

- análise e relatório de previsão orçamentária.
- importação de PDF do Banco do Brasil na conciliação.
- diagnósticos de schema e checklist de deploy.
- suporte a OFX e CSV na conciliação.
- diagnósticos de SQLite e melhorias no fluxo de remessa DABB.

### Changed

- melhoria dos textos do relatório de previsão orçamentária.
- melhoria do fluxo de remessa bimestral DABB.
- abertura do painel geral no último mês com movimentação.
- seleção de mês no painel geral.
- atualização conjunta de backend e frontend.
- remoção de cache antigo do frontend no nginx.

### Fixed

- compatibilidade de schema em aplicações financeiras.
- correções mobile em despesas.
- remoção de duplicidade na conciliação.
- ajustes na reconciliação bimestral DABB.

## Base Histórica Utilizada

Commits recentes considerados na consolidação inicial:

- `c4277c2` chore: melhorar textos do relatorio de previsao orcamentaria
- `444cc18` feat: adicionar analise e relatorio da previsao orcamentaria
- `b22e91e` fix: improve dabb bimonthly reconciliation
- `a43265c` feat: improve dabb remittance workflow and sqlite diagnostics
- `e936ec2` abre painel geral no ultimo mes com movimentacao
- `c15a223` permite selecionar mes no painel geral
- `be22f75` adiciona importação PDF BB na conciliação
- `7d92e04` adiciona arquivos pendentes do projeto
- `f58a741` atualiza backend e frontend
- `f7220d2` conciliacao: suporte OFX/CSV, filtro mensal e calculos sem linhas de saldo
- `6676a3c` evita cache antigo do frontend no nginx
- `0704c0c` atualiza checklist de deploy para validação completa
- `b2bf7d3` corrige Despesas mobile e remove duplicidade na Conciliação
- `ac40dc3` chore: adicionar diagnostico de schema e checklist de deploy
- `b7d9567` fix: compatibilidade de schema em aplicacoes financeiras

## Convenção sugerida para próximas entradas

### Added

Novas funcionalidades, novos endpoints, novos relatórios e novos fluxos operacionais.

### Changed

Mudanças de comportamento, ajustes de layout, evolução de regras e refatorações relevantes ao usuário ou à operação.

### Fixed

Correções de defeitos, regressões, problemas de compatibilidade e falhas operacionais.

### Removed

Funcionalidades, endpoints, telas ou comportamentos removidos.

### Security

Correções ou endurecimentos relacionados a autenticação, autorização, segredos e exposição de dados.