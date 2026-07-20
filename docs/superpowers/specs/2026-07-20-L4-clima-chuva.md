# L4 — Clima / registro de chuva (pluviômetro)

**IDEagri gap:** "Clima / registro de chuva" (Análise · vazio) — prioridade baixa.
**Escopo mínimo:** só o **pluviômetro** (mm de chuva por dia). Sem estação meteorológica,
sem API de clima, sem temperatura. Registro manual → acumulado mensal.

## Schema (aditivo)

```prisma
model RegistroChuva {
  id            Int          @id @default(autoincrement())
  data          DateTime     @db.Date
  mm            Decimal      @db.Decimal(6, 1) // milímetros de chuva no dia
  observacao    String?
  propriedade   Propriedade? @relation(fields: [propriedadeId], references: [id])
  propriedadeId Int?
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  @@index([data])
  @@index([propriedadeId])
}
```
+ inverse `registrosChuva RegistroChuva[]` em `Propriedade`.

Sync em dev: `prisma db push` no Postgres local (prod usa `db push` no `start:prod`).

## Calc puro — `chuva.calc.ts`

`agruparChuva(registros)`:
- Entrada: `{ data: "YYYY-MM-DD", mm: number }[]`.
- Saída:
  - `meses: { mes: "YYYY-MM"; total: number; dias: number }[]` — acumulado por mês,
    **crescente** por `mes`; `dias` = nº de dias com `mm > 0` no mês.
  - `total` — soma de todos os `mm`.
  - `diasComChuva` — nº de registros com `mm > 0`.
- Arredonda somas a 1 casa (evita ruído de ponto flutuante).

## Serviço — `chuva.ts` (CRUD, I/O Prisma)

- `listarChuva(propriedadeId)` → `{ registros: RegistroChuvaDTO[]; resumo: ResumoChuva }`
  (registros desc por data; resumo = `agruparChuva`).
- `registrarChuva(input, propriedadeId)` → cria (data + mm + observação?).
- `excluirChuva(id)` → 404 `ChuvaError` se não existir.

## Rota fina — `chuva.ts` (routes/rebanho)

- `GET /rebanho/chuva`
- `POST /rebanho/chuva` (zValidator: `data` YYYY-MM-DD, `mm` ≥ 0, `observacao?`)
- `DELETE /rebanho/chuva/:id`
Escopo via `resolverEscopoLeitura/Escrita`.

## Frontend — `ClimaChuvaSection.tsx` (aba Carteira)

- Form: data + mm (+ observação) → `registrarChuva`.
- Acumulado mensal com **`MiniBarChart`** reusado (`components/charts`).
- Lista dos últimos registros (data · mm · obs) com excluir.
- Montada na `CarteiraTab` após `QuantitativoSection`.

## Deferido (fora de escopo)

- Estação meteorológica / integração com API de clima.
- Temperatura, umidade, vento, evapotranspiração.
- Correlação chuva × produção/pastagem.
