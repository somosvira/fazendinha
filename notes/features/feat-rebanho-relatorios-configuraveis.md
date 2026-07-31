# feat/rebanho-relatorios-configuraveis

## Objetivo

Criar relatórios do rebanho como formulários guiados por templates e filtros que geram listas operacionais.

## Decisões do usuário

- Templates prontos com filtros ajustáveis, não construtor totalmente livre.
- Primeira entrega: fundação reutilizável + reprodução.
- Resultado em tela, PDF e CSV.
- A lista permite abrir ficha e registrar ação por animal.
- Eventos são uma linha por tentativa; duas inseminações da mesma vaca aparecem em duas linhas.

## Reúso

- Relatório agregado existente (`relatorio-reproducao.*`) continua intacto; esta feature acrescenta listagens detalhadas configuráveis.
- `DateRangePicker`, `RebTable`, `RebButton`, `AnimalIdentity`, `EventoForm`.
- Escopo via `resolverEscopoLeitura` e `comPropriedade`.

## Limites v1

Sem persistência de templates/filtros, sem schema novo, sem construtor livre e sem relatórios sofisticados de taxas por faixas.