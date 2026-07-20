# L5 — Ajuste de U.A. de referência (unidade animal / lotação)

**IDEagri gap:** "Ajuste de U.A. de referência" (Nutrição · —) — prioridade baixa.
**Escopo:** unidade animal (UA) por categoria + conversão de lotação (UA total e UA/ha).

## Decisão: SEM schema novo

O `parametros.ts` (`ParametroManejo`) **já tem** todos os pesos-referência necessários:
- `PESO_UA_REF_KG` — peso vivo de 1 UA (default 450 kg).
- `PESO_REF_VACA` / `_TOURO` / `_NOVILHA` / `_BEZERRA` / `_BEZERRO` / `_CABRA` /
  `_BODE` / `_CABRITA` / `_CABRITO` — peso-referência por categoria.

Os 9 valores do enum `CategoriaAnimal` batem 1:1 com os `PESO_REF_*`. "Ajustar a U.A.
de referência" = editar esses parâmetros — **e isso já funciona** pela tela de Parâmetros
(rota `PATCH /rebanho/parametros`). L5 só adiciona a **conversão** (efetivo → UA / UA/ha).

## Calc puro — `ua.calc.ts`

`converterUA(efetivo, pesosRef, pesoUaRefKg, areaHa?)`:
- `efetivo`: `{ categoria: string; cabecas: number }[]` (vem do quantitativo).
- `pesosRef`: `Record<categoria, number>` (peso-ref kg por categoria).
- `pesoUaRefKg`: número (peso vivo de 1 UA).
- Por categoria: `ua = cabecas * pesoRef / pesoUaRefKg`. Categoria sem peso-ref → `pesoRef=0`,
  `ua=0`, marcada `semPeso: true` (transparência).
- Saída:
  - `linhas: { categoria; cabecas; pesoRef; ua; semPeso }[]` (por UA desc).
  - `totalCabecas`, `totalUA`.
  - `uaPorHa` — `totalUA / areaHa` quando `areaHa > 0`, senão `null`.
  - `areaHa` — eco da área usada (ou null).
- Arredonda UA a 2 casas; UA/ha a 2 casas.

## Serviço — `ua.ts` (I/O)

`obterUA(propriedadeId, areaHa?)`:
- Lê efetivo por categoria (reusa `obterQuantitativo` → soma faixas por categoria).
- Lê params (`getNumero("PESO_UA_REF_KG")` + `PESO_REF_*` via `getParametros`).
- Chama `converterUA`.

## Rota fina — em `carteira.ts` (routes/rebanho)

`GET /rebanho/ua?areaHa=<n>` (areaHa opcional, ≥ 0). Escopo de leitura.

## Frontend — `UaReferenciaSection.tsx` (aba Carteira)

- Tabela categoria × cabeças × peso-ref × UA + total UA.
- Input de área (ha) → recalcula UA/ha (debounce, refaz o GET).
- Nota: pesos-referência editáveis na tela **Parâmetros** (não duplica edição aqui).
- Montada na `CarteiraTab` após `ClimaChuvaSection`.

## Deferido

- Edição dos pesos-referência dentro desta seção (já existe em Parâmetros).
- Lotação por piquete/pasto (área por talhão) — usa área única informada.
- Curva de UA ao longo do tempo.
