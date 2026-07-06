# Design — OCR de folhas de setor por foto (A3)

**Status:** proposta para aprovação. Nada implementado.
**Restrição dura (não negociável):** o **papel continua existindo**. O OCR só elimina a **redigitação mensal** — nunca substitui a folha nem grava evento direto. Toda extração vira **RASCUNHO numa fila de revisão**; um humano confere contra o papel e confirma. Espelha a decisão já registrada no backlog (A3).

---

## 1. Contexto e objetivo

Cada setor (ordenha, bezerreiro, recria…) mantém uma **folha diária de acontecimentos** em papel. 1×/mês alguém redigita tudo. A dor é a redigitação, não a folha.

O que já existe e dá para reusar:

- **Storage abstrato** (`server/src/lib/storage.ts`): `getStorage()` → `local` (dev) ou `r2` (Cloudflare R2). Interface `putObject / getObjectBuffer / getSignedUrl / deleteObject`. Chaves tipo `notas/_pendente/<sha>.<ext>`.
- **Fila de revisão de NF já modelada** (`NotaFiscalUploadPendente`): upload → `AGUARDANDO` → `confirmarPendenteECriarLancamento()` promove numa transação → `CONFIRMADO`. Guarda `sha256` (dedupe), `expiraEm`, `ocrTexto`. **É exatamente o padrão que a folha precisa**, só que o alvo aqui é evento de rebanho, não `Lancamento`.
- **OCR Tesseract** (`server/src/lib/ocr.ts`, `OCR_ENABLED`): hoje usado só para **validar** que uma NF é NF (regex CNPJ/chave/termos em `validacaoAssincrona.ts`). **Não faz extração de campos estruturados** — não serve, sozinho, para ler uma tabela de ordenha.
- **Provider LLM único = OpenAI** (`env.OPENAI_MODEL` default `gpt-4o`, SDK `openai` já em `package.json`). `gpt-4o` **é vision-capable** → dá para mandar a foto e pedir JSON estruturado. É o caminho certo para folha (layout variável), ao contrário do Tesseract+regex.
- **Scaffold de extração por foto** já no schema: `WhatsAppConfirmacaoPendente` tem `dadosExtraidos Json`, `modeloIa`, `tokensInput/Output` — desenhado para vision, mas o writer **ainda não foi implementado** (o `handler.ts` do WhatsApp responde "imagens entram na Fase 4"). Ou seja: a forma existe, a pipeline não.
- **`LancamentoRascunho.rawOcr Json?`** existe, mas é **rascunho financeiro** (campos de `Lancamento`, chaveado por `telefone`). **Não reusável** para eventos de ordenha/sanidade/pesagem — por isso proponho um rascunho genérico novo.

**Objetivo:** foto da folha → parser tolerante a layout (LLM vision) → N rascunhos de evento → fila de revisão → humano confirma linha a linha → vira evento real (`ControleLeiteiro`, `EventoSanitario`, `Pesagem`…). Começar por **1 tipo de folha**.

---

## 2. Por onde começar: folha de ordenha

É a mais frequente (diária, todo dia, todo mês) → maior retorno na eliminação de redigitação. Ela mapeia para escritas que **já existem**:

- `registrarControle(animalId, {data, peso1, peso2, peso3})` → `ControleLeiteiro` (modo ORDENHA), **ou**
- `registrarProducaoLote({grupoId, data, litros})` → `ProducaoLote` (modo TANQUE_LOTE).

Qual dos dois depende de `Configuracao.producaoModo` (`ORDENHA | TOTAL_DIARIO | TANQUE_LOTE`) — o parser produz linhas por-animal ou por-lote conforme o modo da fazenda. Isso já deixa a feature **configurável para revenda** desde o início.

---

## 3. Modelo de dados proposto

Um rascunho **genérico de evento por foto**, com um cabeçalho (a foto/folha) e N linhas (os eventos candidatos). Espelha o par `UploadPendente`→promoção que a NF já usa, mas com payload flexível (`Json`) porque cada tipo de folha tem campos diferentes.

```prisma
// PROPOSTO
enum TipoFolhaSetor {
  ORDENHA      // 1ª folha suportada
  SANIDADE     // futuro → EventoSanitario
  PESAGEM      // futuro → Pesagem
  REPRODUCAO   // futuro → EventoReprodutivo
  // extensível por fazenda
}

enum StatusFolhaImportacao {
  AGUARDANDO_OCR   // foto no storage, extração agendada
  EM_REVISAO       // extraída, esperando o humano conferir contra o papel
  CONFIRMADA       // todas as linhas decididas
  CANCELADA
  ERRO_EXTRACAO
}

enum StatusRascunhoEvento {
  PENDENTE    // aguardando decisão do revisor
  CONFIRMADO  // virou evento real
  DESCARTADO  // revisor rejeitou (ex.: ilegível, duplicado)
}

// Cabeçalho: uma foto de folha. Reusa o mesmo shape de storage da NF.
model FolhaSetorImportacao {
  id            Int            @id @default(autoincrement())
  tipo          TipoFolhaSetor
  setor         String?        // texto livre ("Ordenha", "Bezerreiro") p/ revenda
  dataReferencia DateTime?     @db.Date // dia da folha, se legível

  // storage (idêntico a NotaFiscalUploadPendente)
  storageDriver String
  bucket        String?
  storageKey    String  @unique
  sha256        String  @unique   // dedupe: mesma foto não entra 2×
  mimeType      String
  tamanhoBytes  Int

  // extração
  ocrTexto       String? @db.Text // Tesseract cru (fallback/auditoria)
  dadosExtraidos Json?            // JSON estruturado do vision (auditoria)
  modeloIa       String?          // ex.: "gpt-4o"
  tokensInput    Int?
  tokensOutput   Int?

  status     StatusFolhaImportacao @default(AGUARDANDO_OCR)
  rascunhos  RascunhoEventoFolha[]
  criadoEm   DateTime  @default(now())
  revisadoEm DateTime?

  @@index([status])
  @@index([tipo, dataReferencia])
}

// Uma linha da folha = um evento candidato. payload flexível por tipo.
model RascunhoEventoFolha {
  id            Int                  @id @default(autoincrement())
  folha         FolhaSetorImportacao @relation(fields: [folhaId], references: [id], onDelete: Cascade)
  folhaId       Int
  linha         Int                  // ordem na folha (rastreio visual)
  status        StatusRascunhoEvento @default(PENDENTE)

  // Resolução tolerante: o vision devolve "vaca 214"; o revisor casa com Animal.
  animalIdSugerido Int?             // match automático por Animal.numero
  animalId         Int?             // confirmado pelo revisor
  confiancaMatch   Decimal?  @db.Decimal(4, 3) // 0..1 do match automático

  // Campos do evento (nullable — o vision preenche o que conseguiu ler).
  data     DateTime? @db.Date
  payload  Json      // { peso1, peso2, peso3 } | { doenca, produto } | { peso } …
  rawTexto String?   // o que estava escrito na linha (auditoria)

  eventoId   Int?    // id do evento real criado ao confirmar (ControleLeiteiro etc.)
  criadoEm   DateTime @default(now())
  decididoEm DateTime?

  @@index([folhaId, status])
}
```

**Por que `payload Json` e não colunas fixas?** Porque a folha de ordenha, a de sanidade e a de pesagem têm campos diferentes; um modelo por tipo multiplicaria tabelas. O `Json` (mesmo padrão de `dadosExtraidos`/`rawOcr` já no schema) mantém uma única fila e um único componente de revisão. A validação forte acontece **na hora de confirmar** (Zod por tipo), não no armazenamento do rascunho.

---

## 4. Fluxo

```
1. Upload da foto (web ou WhatsApp) + tipo da folha
   → getStorage().putObject(...)  (key folhas/_pendente/<sha>.<ext>)
   → cria FolhaSetorImportacao (AGUARDANDO_OCR), dedupe por sha256
   → responde rápido (200); extração roda em background (padrão agendarValidacaoAssincrona)

2. Extração assíncrona (setImmediate, como validacaoAssincrona.ts):
   a. buffer = storage.getObjectBuffer(key)
   b. LLM vision (gpt-4o) com prompt específico do tipo → JSON de linhas
      (Tesseract opcional em paralelo → ocrTexto p/ auditoria/fallback)
   c. para cada linha: match Animal por numero → animalIdSugerido + confiancaMatch
   d. cria N RascunhoEventoFolha; status FolhaSetorImportacao = EM_REVISAO
   (falha → ERRO_EXTRACAO, folha fica na fila para digitação manual — nunca trava)

3. Revisão (humano, com o papel na mão):
   - lista das linhas lado a lado com a foto
   - corrige valores, confirma/troca o animal do match, descarta linha ilegível
   - "Confirmar linha" → cria o evento real numa transação:
       ORDENHA → registrarControle(animalId, {data, peso1..3})  [reusa serviço existente]
       grava eventoId no rascunho, status = CONFIRMADO
   - quando todas decididas → FolhaSetorImportacao = CONFIRMADA

4. Cleanup: folhas AGUARDANDO_OCR/EM_REVISAO velhas expiram
   (espelha notaFiscal/cleanupPendentes.ts) — o papel é a fonte de verdade, então
   expirar um rascunho não perde nada.
```

Nunca há gravação direta: o passo 3 é obrigatório e é o único que escreve na tabela real.

### Endpoints (router novo `folhas`, montado em `/api`)

| Método | Rota | Ação |
|---|---|---|
| `POST` | `/folhas` | multipart: foto + `tipo` + `setor?` → cria importação, agenda extração |
| `GET` | `/folhas?status=EM_REVISAO` | fila de revisão |
| `GET` | `/folhas/:id` | folha + rascunhos + URL assinada da foto (`getSignedUrl`) |
| `PATCH` | `/folhas/:id/rascunhos/:rid` | corrige payload / animalId do rascunho |
| `POST` | `/folhas/:id/rascunhos/:rid/confirmar` | vira evento real |
| `POST` | `/folhas/:id/rascunhos/:rid/descartar` | marca DESCARTADO |
| `DELETE` | `/folhas/:id` | cancela a folha inteira |

Segue a forma Hono chained + `zValidator` do resto do backend.

---

## 5. Reuso da infra existente (o que NÃO reescrever)

- **Storage:** `getStorage()` tal como está — só muda o prefixo de chave (`folhas/…`).
- **Padrão de fila:** copiar a forma de `NotaFiscalUploadPendente` + `confirmarPendente.ts` (transação de promoção, trava otimista por `updateMany where status=AGUARDANDO`, dedupe por `sha256`).
- **Background job:** `setImmediate` + `.catch` logando, igual `agendarValidacaoAssincrona`.
- **LLM:** o SDK `openai` já instalado; `gpt-4o` já é o default e é vision. Novo módulo `lib/vision.ts` (ou `services/folhas/extracao.ts`) chama `chat.completions.create` com `image_url` (data URI do buffer) + prompt do tipo, pedindo JSON. Reaproveita o padrão de chamada de `rebanho/ia.llm.ts`.
- **WhatsApp:** quando a extração de imagem do bot for ligada (hoje "Fase 4"), ela pode **desaguar na mesma `FolhaSetorImportacao`** em vez de criar caminho paralelo — folha por foto no WhatsApp = mesmo modelo.

---

## 6. Faseamento (fatias pequenas entregáveis)

**Fatia 0 — Storage prefixo + upload cru.** `POST /folhas` grava a foto e cria `FolhaSetorImportacao` (sem extração). Já dá para arquivar folhas digitalmente. Reusa storage 100%.

**Fatia 1 — Extração de ordenha (LLM vision).** `lib/vision.ts` + job assíncrono + `RascunhoEventoFolha` para `TipoFolhaSetor=ORDENHA`. Match de animal por `numero`. Sem UI ainda — validar a qualidade da extração com folhas reais via teste/endpoint.

**Fatia 2 — Fila de revisão (UI) + confirmar.** Tela: foto + linhas editáveis + confirmar/descartar. Confirmar chama `registrarControle`/`registrarProducaoLote`. **É aqui que a feature entrega valor real** (elimina a redigitação da ordenha).

**Fatia 3 — Cleanup + robustez.** Expiração de pendentes, reprocessar extração, Tesseract como fallback/auditoria, métricas de acerto do match.

**Fatia 4+ — Novos tipos de folha.** Sanidade (`EventoSanitario`), pesagem (`Pesagem`), reprodução. Cada um = um prompt novo + um validador Zod + um "confirmar" que chama o serviço já existente. O modelo genérico não muda.

---

## 7. Decisões em aberto (o dono precisa responder)

1. **Qual folha primeiro?** Recomendo **ordenha** (mais frequente, mapeia direto pra `ControleLeiteiro`/`ProducaoLote`). Confirmar.
2. **Parser: Tesseract vs LLM vision?** Recomendo **LLM vision (gpt-4o)** para extração estruturada — Tesseract+regex atual só valida NF, não lê tabela manuscrita. Implicações: custo por foto (tokens) e dependência de `OPENAI_API_KEY`. Tesseract fica como fallback offline/auditoria. Decidir se o custo por foto é aceitável (é 1×/mês por setor → volume baixo).
3. **Formato das folhas reais:** precisamos de **fotos de exemplo** das folhas da Rio Novo (e idealmente de 1-2 outras fazendas) para calibrar o prompt. Elas variam por fazenda → prompt tem que ser tolerante, não treinado num layout fixo. **Bloqueio prático:** sem amostras reais, a Fatia 1 fica no escuro.
4. **Manuscrito vs digitado:** as folhas são preenchidas à mão? Letra de curral é o pior caso para OCR. Vision lida melhor que Tesseract, mas o match de animal por número precisa de tolerância (sugerir + revisor confirma, nunca auto-gravar).
5. **Ponto de entrada:** upload pela web (admin, no fechamento mensal) e/ou foto pelo WhatsApp (Sarlo no campo)? Recomendo começar **web** (revisor tem tela grande p/ conferir) e ligar o WhatsApp depois reusando o mesmo modelo.
6. **Granularidade da ordenha:** por animal (`ControleLeiteiro`) ou por lote/tanque (`ProducaoLote`)? Deriva de `Configuracao.producaoModo` — confirmar qual a Rio Novo usa hoje.

---

## 8. Riscos

- **Qualidade da extração:** letra de curral + foto ruim = extração errada. Mitigado pela **revisão obrigatória** (a feature nunca auto-grava) — mas se o acerto for baixo, o revisor "corrige tudo" e o ganho evapora. Medir taxa de acerto na Fatia 1 antes de investir em UI.
- **Match de animal errado:** confirmar peso na vaca errada corrompe o controle leiteiro. Nunca auto-confirmar match; `confiancaMatch` guia o revisor; exigir animal confirmado para poder confirmar a linha.
- **Custo/latência do vision:** volume é baixo (1×/mês por setor), mas prompt mal calibrado gasta tokens à toa. Cachear por `sha256` (não reprocessar a mesma foto).
- **Sensação de "substituir o papel":** reforçar na UI que é rascunho e que a folha manda — a administração exige o controle físico. Nomear a tela "Conferência de folhas", não "importação automática".
- **PII/armazenamento:** fotos de folha podem ter nomes de funcionários. Mesma política de retenção/limpeza da NF (R2 + expiração).
