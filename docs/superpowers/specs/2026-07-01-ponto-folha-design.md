# Equipe & Ponto — jornada e apuração de hora extra (design)

**Data:** 2026-07-01 · **Status:** aprovado. Admin-gerenciado; regra de hora extra prática.

## Objetivo
Módulo de RH leve: cadastrar funcionários, lançar a jornada diária (admin gerencia — não há
login por funcionário), e apurar **hora extra** cruzando horas trabalhadas × salário.

## Modelo (Prisma — já `db push`)
- `Funcionario` {nome, cargo?, salarioMensal, cargaMensalHoras(=220), jornadaDiariaHoras(=8),
  dataAdmissao?, cpf?, chavePix?, ativo}.
- `RegistroPonto` {funcionarioId, data, entrada?"HH:MM", saida?"HH:MM", intervaloMin(=60),
  tipoDia(TipoDiaPonto: UTIL/DOMINGO/FERIADO/FOLGA/FALTA), observacao?}. Único (funcionarioId, data).

## Motor de apuração (puro, TDD) — `services/ponto/folha.ts`
- `horasDoDia(reg)` = ((saida−entrada) em min − intervaloMin)/60, ≥0. FOLGA/FALTA → 0.
- Por dia: `extra` = UTIL/FERIADO/DOMINGO. UTIL → max(0, horas−jornadaDiaria) a 50%; DOMINGO/FERIADO →
  todas as horas a 100%; horas normais = min(horas, jornada) nos úteis.
- `valorHora` = salarioMensal ÷ cargaMensalHoras.
- Mês/funcionário (`apurarFolha(mes: "YYYY-MM")`): diasTrabalhados, totalHoras, horasNormais,
  extra50, extra100, `valorExtra` = extra50×valorHora×1,5 + extra100×valorHora×2,
  `totalPagar` = salarioMensal + valorExtra. Somatório da fazenda no fim.

## Backend
- `services/ponto/`: `funcionarios.ts` (CRUD + baixa=ativo:false), `pontos.ts` (upsert registro por
  funcionário+data; listar por funcionário+mês), `folha.ts` (motor puro + `apurarFolha` service),
  mappers, schemas Zod. Erros → 404/409/400.
- `routes/ponto/`: `GET/POST/PATCH /api/ponto/funcionarios[/:id]`, `GET /api/ponto/registros?funcionarioId=&mes=`,
  `POST /api/ponto/registros` (upsert), `DELETE /api/ponto/registros/:id`, `GET /api/ponto/folha?mes=`.
  Montar em `index.ts`.
- `seed-ponto.ts` (script `seed:ponto`, idempotente): ~6 funcionários (peão, tratorista, gerente,
  ordenhador…) com salários/jornadas realistas + registros de um mês (com alguns dias de extra e um domingo).
- Testes: `folha.test.ts` (motor: horasDoDia, extra 50/100, valorExtra, edge cases).

## Client — módulo "Equipe & Ponto" (3 abas), no grupo Administração do sidebar
- `client/src/equipe/` (espelha a estrutura dos outros módulos): `EquipeContent.tsx` (roteia as 3 sub-abas),
  `api.ts` (fetchers+hooks reais), `types.ts`.
- **Funcionários** — lista + `FuncionarioForm` (nome/cargo/salário/carga/jornada/admissão/cpf/pix).
- **Ponto** — seletor de funcionário + mês → **grade do mês**: uma linha por dia (tipoDia automático pelo
  dia da semana, editável), inputs entrada/saída/intervalo, mostra horas e extra por dia + totais do mês.
  Salvar faz upsert do registro.
- **Folha** — apuração do mês pra todos: tabela funcionário × (dias, horas, extra 50/100, valorExtra,
  **total a pagar**), com totais. Cruza com o salário.
- Wiring: `App.tsx` (`EQP` map `eqp-*`→sub + render `<EquipeContent>`), `Shell.tsx` (Tab union +eqp-*),
  `AppSidebar.tsx` (novo módulo/entrada na Administração), CSS reusa `.rb-*` / novo `equipe.css` se preciso.

## Não-objetivos (v1)
Login/auto-ponto por funcionário; DSR/adicional noturno/banco de horas; feriados automáticos (tipoDia é
manual); ponte com os lançamentos reais "Pessoal - Salário" (comparação vs realizado fica pra depois).

## Verificação
tsc + vitest + build; browser — cadastrar funcionário, lançar jornada com hora extra, ver a Folha
computar valorExtra/total a pagar; sidebar; sem regressão.
