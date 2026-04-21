# Política de Versionamento

## Objetivo

Definir uma convenção simples e sustentável para identificar releases, registrar mudanças e reduzir ambiguidade operacional.

## Situação atual

O projeto usa Git e já possui histórico de commits com prefixos mistos como `feat`, `fix` e `chore`, mas ainda não há um processo formal de releases versionadas.

## Proposta

Adotar versionamento semântico simplificado:

`MAJOR.MINOR.PATCH`

Exemplo:

- `1.0.0`
- `1.1.0`
- `1.1.1`

## Regras

### MAJOR

Incrementar quando houver:

- quebra de compatibilidade relevante;
- mudanças estruturais fortes em API, banco ou fluxos operacionais;
- remoção ou alteração incompatível de comportamento crítico.

### MINOR

Incrementar quando houver:

- nova funcionalidade compatível com versões anteriores;
- novos relatórios, novas telas ou novos endpoints sem quebra de uso existente;
- ampliações de fluxo como novas importações ou novas análises.

### PATCH

Incrementar quando houver:

- correções de bugs;
- ajustes visuais e operacionais sem mudança estrutural;
- melhorias internas sem impacto de compatibilidade.

## Recomendações de workflow

### Commits

Manter prefixos coerentes, por exemplo:

- `feat:` nova funcionalidade
- `fix:` correção
- `chore:` tarefa técnica ou manutenção
- `docs:` documentação
- `refactor:` reorganização interna

### Release

Para cada release:

1. atualizar [CHANGELOG.md](CHANGELOG.md);
2. definir a nova versão;
3. criar tag Git correspondente;
4. publicar notas resumidas da release.

Exemplo de tag:

- `v1.0.0`
- `v1.1.0`

## Sugestão de marco inicial

Como o sistema já possui múltiplos módulos de negócio implementados, um ponto de partida razoável é considerar uma primeira release formal como `v1.0.0` no momento em que a equipe decidir congelar escopo mínimo operacional.

## Relação com o changelog

O changelog deve refletir apenas mudanças relevantes para operação, manutenção, integração ou uso do sistema.

Mudanças pequenas e ruído técnico sem impacto real não precisam virar item isolado.

## Critérios práticos para publicar uma nova versão

- build e smoke checks passando;
- documentação atualizada quando houver mudança de fluxo;
- variáveis de ambiente revisadas quando houver nova dependência;
- backup realizado antes de deploy em produção;
- rollback conhecido para a release anterior.