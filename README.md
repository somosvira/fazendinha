# Sistema de Gestão Financeira — Fazenda Rio Novo

Reescreve, como software próprio, o **relatório gerencial de fluxo de caixa** que hoje é
montado em Excel (tabelas dinâmicas lendo bancos Access do BPO). Os lançamentos passam a
viver em banco próprio (PostgreSQL) e os relatórios são gerados por código — visualizados
na tela e exportáveis em `.xlsx` idêntico ao original (workbook multi-abas).

Regime de **caixa**: lançamentos `LIQUIDADO` alimentam o *Realizado*; `ABERTO` (a vencer)
alimentam a *Projeção*.

## Stack

- **Backend:** Node.js + TypeScript, Express, Prisma ORM, ExcelJS, Zod, JWT — `server/`
- **Frontend:** React + TypeScript + Vite — `client/`
- **Banco:** PostgreSQL (database `rionovo`)

## Modelo de dados (`server/prisma/schema.prisma`)

`Lancamento` (natureza, valor, datas de competência/vencimento/liquidação, situação, estorno)
relaciona-se com `Categoria` (dentro de `GrupoCategoria`), `CentroCusto`, `ContaBancaria`
e `ClienteFornecedor`. `FechamentoMensal` registra meses bloqueados. Espelha o modelo
extraído do relatório original.

## Como rodar

Pré-requisitos: Node 18+, pnpm, PostgreSQL rodando.

```bash
# 1. Banco
createdb rionovo            # ajuste DATABASE_URL em server/.env se necessário

# 2. Backend (porta 41873)
cd server
pnpm install
pnpm prisma:migrate         # cria as tabelas
pnpm run import             # importa o histórico real do .xlsx (recomendado)
#   OU: pnpm seed           # popula apenas dados de exemplo
pnpm dev

# 3. Frontend (porta 41875, faz proxy de /api -> 41873)
cd ../client
pnpm install
pnpm dev
```

Abra http://localhost:41875 e entre com **admin / rionovo** (configurável em `server/.env`).

### Importar histórico do .xlsx

```bash
python3 scripts/extract_rio_novo.py "Relatório Rio Novo 2026.05.04.xlsx" server/prisma/rio_novo.json
cd server && pnpm run import
```

O extrator lê o pivotCache do arquivo, filtra `*Fonte = RIO NOVO` e gera ~6.700 lançamentos
reais (validados contra os totais do relatório original).

## API

Todas as rotas sob `/api` (exceto `/api/health` e `/api/auth/login`) exigem `Authorization: Bearer <token>`.

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/login` | `{usuario, senha}` → `{token}` |
| GET | `/api/relatorios/dashboard?tipo=REALIZADO\|PROJECAO` | painel por atividade (Leite/Café/Outros) |
| GET | `/api/relatorios/resultado-operacional?tipo=REALIZADO\|PROJECAO` | relatório em JSON |
| GET | `/api/relatorios/resultado-operacional.xlsx?tipo=...` | download `.xlsx` |
| GET | `/api/relatorios/meses` | meses realizados disponíveis |
| GET | `/api/relatorios/mensal/:mes[/xlsx]` | detalhe mensal (categoria × centro) |
| GET | `/api/relatorios/diario/:mes[/xlsx]` | realizado diário |
| GET | `/api/relatorios/completo.xlsx` | **workbook completo** (todas as abas) |
| GET/POST/PUT/DELETE | `/api/lancamentos[/:id]` | CRUD de lançamentos (respeita fechamento) |
| GET/POST/PUT/DELETE | `/api/cadastros/{centros-custo,grupos,categorias,contas,fornecedores}[/:id]` | CRUD de cadastros |
| GET/POST/DELETE | `/api/fechamentos[/:ano/:mes]` | fechamento mensal |

## Status

- [x] Modelo de dados + migração + seed
- [x] Motor de agregação do `Resultado Operacional` (mês × centro de custo × grupo × categoria)
- [x] Exportação `.xlsx` formatada (validada contra os números reais)
- [x] **Painel** visual (recharts): separa Leite × Café × Outros, com KPIs (receita/despesa/investimento/lucro), donut de despesas por grupo, lucro mensal por atividade e entradas×saídas mensais; filtro por ano e Realizado/Projeção
- [x] Telas: **Painel**, Resultado, **Mensal**, **Diário**, Lançamentos, **Cadastros**, **Fechamento**
- [x] Abas mensais detalhadas + `Realizado_Diário` + **workbook completo** (27 abas)
- [x] Importação do histórico real do `.xlsx` (~6.700 lançamentos)
- [x] CRUD dos cadastros pela interface
- [x] Autenticação (JWT, login/logout)
- [x] Fechamento mensal (bloqueia lançamentos em meses fechados)
- [ ] Próximos: múltiplos usuários/permissões, conciliação bancária, dashboard/gráficos
```
