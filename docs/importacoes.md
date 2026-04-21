# Guia de Importações

## Objetivo

Este documento descreve os formatos de arquivo aceitos pelas rotinas de importação identificadas no backend, com foco em conciliação bancária e processamento DABB.

## Endpoints envolvidos

- `POST /api/conciliacao/importar/csv`
- `POST /api/conciliacao/importar/extrato`
- `POST /api/conciliacao/importar/pdf-bb`

## 1. Importação de extrato por arquivo

Os endpoints `importar/csv` e `importar/extrato` usam a mesma implementação.

### Formatos aceitos

- CSV
- OFX
- RET
- REM

O backend também detecta conteúdo OFX mesmo quando a extensão não ajuda, desde que o conteúdo contenha marcadores como `<OFX>` ou `<STMTTRN>`.

### Rejeições conhecidas

- arquivo vazio;
- extensão fora de `.csv`, `.ofx`, `.ret` ou `.rem`, quando o conteúdo também não for reconhecido como OFX.

## 2. CSV suportado

O importador documenta dois formatos aceitos.

### 2.1 CSV simples

Colunas esperadas:

- `data`
- `descricao`
- `tipo`
- `valor`

Observação:

- `tipo` deve representar `credito` ou `debito`.

Exemplo:

```csv
data,descricao,tipo,valor
2026-04-10,PIX RECEBIDO MARIA DE SOUZA,credito,35.00
2026-04-11,TARIFA BANCARIA,debito,12.50
```

### 2.2 CSV estilo Banco Real

Colunas citadas na implementação:

- `Data`
- `Lançamento`
- `Detalhes`
- `Nº documento`
- `Valor`
- `Tipo Lançamento`

Exemplo:

```csv
Data,Lançamento,Detalhes,Nº documento,Valor,Tipo Lançamento
10/04/2026,Recebimento,PIX MARIA DE SOUZA,12345,35,Crédito
11/04/2026,Tarifa,TARIFA BANCARIA,12346,12.5,Débito
```

## 3. OFX suportado

O importador percorre transações OFX e tenta construir lançamentos de conciliação automaticamente.

### Comportamentos observados

- identifica `data`, `valor`, `tipo`, `descricao` e `numero_documento`;
- ignora descrições que aparentam ser linha de saldo;
- evita duplicar lançamento já existente;
- quando encontra crédito com padrão de mensalidade, tenta baixar mensalidade automaticamente;
- quando encontra débito e consegue inferir conta contábil, tenta lançar despesa automaticamente.

### Exemplo simplificado de trecho OFX

```xml
<STMTTRN>
  <TRNTYPE>CREDIT</TRNTYPE>
  <DTPOSTED>20260410120000</DTPOSTED>
  <TRNAMT>35.00</TRNAMT>
  <FITID>123456</FITID>
  <MEMO>PIX RECEBIDO MARIA DE SOUZA</MEMO>
</STMTTRN>
```

## 4. REM e RET suportados

Os arquivos `.rem` e `.ret` são tratados como fontes de movimentos DABB.

### Regras identificadas

- o importador procura linhas de detalhe iniciadas por `E` ou `F`;
- extrai `data`, `valor`, `tipo`, `descricao`, `numero_documento`, `codigo_dabb` e eventualmente `codigo_barras`;
- usa `codigo_dabb` para localizar associado;
- tenta fazer baixa automática da mensalidade;
- registra diagnósticos de linhas inválidas, sem associado ou com código ambíguo.

### Observações práticas

- o arquivo deve preservar o layout posicional original;
- alterações manuais de espaçamento ou quebra podem invalidar a leitura;
- códigos DABB divergentes no cadastro reduzem a taxa de baixa automática.

## 5. PDF do Banco do Brasil

O endpoint `POST /api/conciliacao/importar/pdf-bb` aceita apenas PDF.

### Validações identificadas

- o nome do arquivo deve terminar com `.pdf`;
- o conteúdo precisa permitir extração de texto;
- se não houver texto extraível, a importação falha.

### Comportamento observado

- o banco é identificado como `DABB`;
- o sistema extrai transações do PDF;
- cada item tenta localizar associado por `codigo_dabb`;
- quando possível, executa baixa automática de mensalidades ou de competências inferidas;
- registra diagnósticos de blocos inválidos, códigos sem associado e códigos ambíguos.

### Boas práticas para o PDF

- usar PDF textual, não imagem escaneada pura;
- manter o documento original do banco;
- evitar reimpressão por ferramentas que mudem o texto interno;
- revisar previamente se os códigos DABB dos associados estão corretos no cadastro.

## 6. Resultado esperado das importações

As rotinas podem gerar:

- registros de conciliação bancária;
- baixas automáticas de mensalidade;
- lançamento automático de despesas em alguns casos de OFX;
- diagnósticos de linhas inválidas ou duplicadas;
- contagem de itens importados, duplicados, inválidos e conciliados automaticamente.

## 7. Erros comuns

### Arquivo vazio

O backend rejeita o upload quando o conteúdo está vazio após leitura.

### Extensão inválida

O endpoint de extrato rejeita arquivos fora dos formatos permitidos, exceto quando reconhece OFX pelo conteúdo.

### PDF sem texto extraível

Ocorre quando o arquivo é imagem sem camada de texto ou está corrompido.

### Duplicidade de lançamento

O sistema tenta evitar lançamentos repetidos comparando data, valor, banco, tipo, documento e descrição.

### Sem associado correspondente

Mais comum em fluxos DABB quando `codigo_dabb` do cadastro está ausente, inconsistente ou duplicado.

## 8. Checklist antes de importar

- Conferir extensão e origem do arquivo.
- Confirmar que o período do arquivo corresponde ao mês esperado.
- Validar cadastro e `codigo_dabb` dos associados quando a rotina envolver DABB.
- Fazer backup antes de importações volumosas.
- Após a importação, revisar pendências de conciliação manual.