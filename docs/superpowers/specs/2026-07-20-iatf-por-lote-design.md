# Programação IATF por lote/data — Design

**Data:** 2026-07-20
**Fatia:** IDEagri-gaps #2 (prioridade alta, dado 777: `PROGRAMACAOIATF` 67 + `PROGRAMACAOIATFASSOCIACAO` 418). Reprodução.
**Relacionado:** estende o catálogo IATF do #163 (`ProtocoloIATF` + `EtapaProtocoloIATF` + `AplicacaoProtocoloIATF`); `docs/design/ideagri-gaps.md` linha 20.

## 1. Problema

O #163 entregou o **catálogo** de protocolos IATF (D0/D7/D9/D11) e a aplicação **animal a animal**. Na prática, o produtor não aplica uma vaca por vez: ele **programa um lote inteiro** num mesmo D0 ("segunda-feira começa o protocolo IATF do lote das novilhas") e conduz o calendário de manejos coletivamente. O IDEagri modela isso em `PROGRAMACAOIATF` (67 programações) + `PROGRAMACAOIATFASSOCIACAO` (418 associações animal↔programação) — dado real substancial.

## 2. Objetivo / decisão entregue

Registrar a **programação de IATF por lote**: escolher um protocolo + uma data D0 + um conjunto de animais (por grupo/lote, ou seleção manual) e materializar a agenda coletiva D0/D7/D9/D11 uma vez. Cada animal do lote recebe a aplicação individual (reusa `AplicacaoProtocoloIATF`), amarrada à programação. A tela mostra o **calendário do lote** e a **lista de animais**.

## 3. Não-objetivos (YAGNI)

- Sem novo cálculo de agendamento — `agendarEtapas` do #163 já resolve o calendário (a programação tem UMA data D0, então UMA agenda vale para o lote todo).
- Sem "marcar etapa concluída" por animal (a agenda é derivada/prevista, como no #163; execução real vira evento INSEMINACAO no D_IATF, fora do escopo desta fatia).
- Sem substituir a aplicação individual — ela continua existindo; a programação por lote é um agrupador que a cria em massa.
- Sem filtro de elegibilidade automático hormonal (o produtor escolhe o lote; sinalizamos gestantes como aviso, mas não bloqueamos — decisão dele).

## 4. Arquitetura

### 4.1 Schema (aditivo)

Novo model `ProgramacaoIATFLote` + coluna nullable `programacaoId` em `AplicacaoProtocoloIATF` (a aplicação individual passa a poder pertencer a uma programação de lote; `null` = aplicação avulsa do #163, retrocompatível).

```prisma
model ProgramacaoIATFLote {
  id            Int                      @id @default(autoincrement())
  protocolo     ProtocoloIATF            @relation(fields: [protocoloId], references: [id])
  protocoloId   Int
  grupo         Grupo?                   @relation(fields: [grupoId], references: [id])
  grupoId       Int?                     // lote de origem (opcional — pode ser seleção manual)
  nome          String?                  // rótulo livre ("IATF novilhas — jul/26")
  dataInicio    DateTime                 @db.Date // D0 comum do lote
  observacao    String?
  aplicacoes    AplicacaoProtocoloIATF[] // as aplicações individuais criadas por esta programação
  propriedade   Propriedade?             @relation(fields: [propriedadeId], references: [id])
  propriedadeId Int?
  createdAt     DateTime                 @default(now())
  updatedAt     DateTime                 @updatedAt

  @@index([propriedadeId])
  @@index([grupoId])
  @@index([dataInicio])
}
```

`AplicacaoProtocoloIATF` ganha: `programacao ProgramacaoIATFLote? @relation(...)` + `programacaoId Int?` + `@@index([programacaoId])`. `ProtocoloIATF`, `Grupo`, `Propriedade` ganham o inverse `programacoesLote`.

Sync = `db push` no Postgres local (rito da fatia). `programacaoId` nullable → não quebra dados existentes.

### 4.2 Cálculo puro

`iatf-lote.calc.ts` (TDD):
- `resumoProgramacao({ etapas, dataInicio, hoje })` → deriva a agenda (via `agendarEtapas`) + a **etapa atual/próxima** do lote (qual D está vencendo hoje) e o **progresso** (etapas passadas/total). Determinístico: `hoje` vem do chamador.
- `proximaEtapa(agenda, hoje)` → primeira etapa com `data >= hoje` (a próxima ação do lote), ou `null` se o protocolo já terminou.

### 4.3 Serviço

`iatf-lote.ts`:
- `criarProgramacao(input, propriedadeId)` — numa transação: cria a `ProgramacaoIATFLote` e uma `AplicacaoProtocoloIATF` por animal do `animalIds`, todas com o mesmo `dataInicio`/`protocoloId` e `programacaoId` apontando para a programação. Valida protocolo ativo e existência dos animais.
- `listarProgramacoes(propriedadeId)` — lista com protocolo, grupo, contagem de animais, agenda derivada + próxima etapa (via calc). Ordena por `dataInicio` desc.
- `detalheProgramacao(id)` — a programação + a lista de animais (numero/nome) + agenda.
- `excluirProgramacao(id)` — apaga a programação e as aplicações-filhas (cascade via transação).

Erros via `IatfLoteError` (mesma forma do `IatfError`).

### 4.4 Rota fina

`routes/rebanho/iatf-lote.ts` (montado como `iatfLoteRouter` no index):
- `GET  /rebanho/iatf/programacoes` — lista (escopo leitura).
- `POST /rebanho/iatf/programacoes` — cria (escopo escrita) — `{ protocoloId, dataInicio, grupoId?, nome?, observacao?, animalIds: number[] }`.
- `GET  /rebanho/iatf/programacoes/:id` — detalhe.
- `DELETE /rebanho/iatf/programacoes/:id`.

### 4.5 Frontend

- `api.ts` — DTOs `ProgramacaoIatfLoteDTO` (+ item), hooks `useProgramacoesIatf`, funções criar/excluir/detalhe.
- `ProgramacaoIatfLote.tsx` — painel em Reprodução (abaixo de ProtocolosIatf): "Programar lote" → escolhe protocolo + D0 + grupo (carrega animais ativos do grupo) → cria. Lista as programações com o calendário derivado (D0/D7/D9/D11 + próxima etapa destacada) e contagem de animais.
- Entra no `ReproducaoTab` no `topo` (junto de ProtocolosIatf).

## 5. F1 continuation (dobrada nesta fatia — worklist "precisa-de-exame")

O calc `worklist-exame.calc.ts` (`precisaExame`) já existe e passa (entregue no #170, exposição deferida). Ativar:
- `dashboard-rebanho.ts` — incluir `EXAME_GINECOLOGICO` no stream de `eventoReprodutivo.findMany` (ou query dedicada) e derivar `ultimoExameGinecologico` por animal (a data mais recente).
- `dashboard.types.ts` — `AnimalDashboardIn.ultimoExameGinecologico: string | null`; nova chave `"precisa-de-exame"` em `ChaveWorklistRebanho`.
- `regras-manejo.ts` — nova worklist `precisa-de-exame` usando `precisaExame({ statusReprodutivo, del, ultimoExameGinecologico }, pevDias, hoje)`; ação `{ tipo: "EXAME_GINECOLOGICO", rotulo: "Registrar exame" }`, aba reprodução.
- `client/api.ts` — chave `precisa-de-exame` no union e no catálogo de worklists da reprodução.

## 6. Testes & entrega

- Vitest: `iatf-lote.calc.test.ts` (próxima etapa / progresso / protocolo terminado), `regras-manejo.test.ts` (nova worklist sinaliza/ignora).
- Smoke local (Postgres): cria protocolo → programa lote com 2 animais → confere calendário + aplicações individuais criadas.
- Build verde nos 2 workspaces + suítes completas.
- PR único (F2 + F1 continuation, commits separados).

## 7. Reúso

`ProtocoloIATF` + `AplicacaoProtocoloIATF` + `agendarEtapas`/`ordenarEtapas` (#163), `resolverEscopoLeitura/Escrita`, `precisaExame` (#170), `EventoForm` (já tem EXAME_GINECOLOGICO), `WorklistCanonica`.
