# feat/rebanho-relatorios-configuraveis

## Objetivo

Criar relatórios do rebanho como formulários guiados por templates e filtros que geram listas operacionais.

## Decisões do usuário

- Templates prontos como ponto de partida, com escolha, remoção e ordenação livre das colunas no resultado.
- Primeira entrega: fundação reutilizável + reprodução.
- Resultado em tela, PDF e CSV.
- A lista permite abrir ficha e registrar ação por animal.
- Eventos são uma linha por tentativa; duas inseminações da mesma vaca aparecem em duas linhas.

## Reúso

- Relatório agregado existente (`relatorio-reproducao.*`) continua intacto; esta feature acrescenta listagens detalhadas configuráveis.
- `DateRangePicker`, `RebTable`, `RebButton`, `AnimalIdentity`, `EventoForm`.
- Escopo via `resolverEscopoLeitura` e `comPropriedade`.

## Limites v1

Sem persistência de templates/filtros e sem schema novo. O compositor v1 personaliza as colunas do modelo; filtros calculados entre domínios (por exemplo taxa de prenhez por animal) entram na próxima evolução do motor.
