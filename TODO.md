# TODO — FAZENDINHA

Backlog derivado da nota "FAZENDINHA" (01/jul/2026). Cada item foi cruzado com o
estado atual do código. Módulos existentes: Financeiro, Rebanho (leiteiro),
Corte, Plantio — todos com sub-abas de Nutrição, Estoque, Custo (hoje em mock/UI,
sem os vínculos abaixo).

---

## 1. Baixa automática de estoque a partir da dieta

> "Relacionar dieta com o estoque fazendo a baixa automática"

Hoje `NutricaoTab`/`DietaForm` e `EstoqueTab` existem separados, **sem vínculo**.

- [ ] Modelar relação Dieta → Insumo de estoque (qtd por cabeça/dia × nº de animais no lote)
- [ ] Gerar movimento de **saída de estoque** automático quando a dieta é aplicada a um lote/período
- [ ] Recalcular saldo e alertar quando insumo ficar abaixo do mínimo
- [ ] Refletir consumo no **Custo de Produção** (`CustoProducaoTab` já existe)

## 2. Separar categoria de setor no estoque

> "Fazer separação entre categoria e setor no estoque"

Hoje o `EstoqueTab` usa só `grupo`/`fornecedor`.

- [ ] Adicionar dimensão **Setor** (Leite / Café / Corte / Geral) além da **Categoria** do produto
- [ ] Filtros e agrupamento por setor **e** por categoria
- [ ] Refletir setor nos relatórios de custo (amarra com centros de custo existentes)

## 3. Controle geral de funcionários por setor

> "Fazer controle geral de funcionário separando por setor"

Não existe módulo de funcionários hoje.

- [ ] Modelo `Funcionario` (nome, cargo, setor, custo/salário)
- [ ] Alocação de funcionário a setor (Leite / Café / Corte / Milho)
- [ ] Tela de listagem/cadastro (reusar padrão dos outros módulos)
- [ ] Ligar custo de mão de obra ao custo por setor

## 4. Parametrizar manejo (regras configuráveis por fazenda)

> "Modelar os parâmetros — Embrapa indica 120 dias de desmame, mas aqui vão por peso do animal"

Hoje há indicadores Embrapa fixos (`indicadores-embrapa.ts`).

- [x] Tornar parâmetros de manejo **configuráveis** (ex.: desmame por dias **ou** por peso)
- [x] Guardar padrão Embrapa como referência, permitindo override por fazenda
- [x] Aplicar o parâmetro escolhido nos cálculos/alertas de manejo

## 5. Cadastro dos plantios reais

> "28 mil pés de café" · "100 ha de milho (terceiro)"

- [ ] Cadastrar talhão de **café: 28.000 pés** (módulo Plantio já existe)
- [ ] Cadastrar **milho: 100 ha em regime de terceiro/arrendamento** — definir tratamento de receita/custo de terceiro
- [ ] Verificar se Plantio comporta a cultura milho ou precisa generalizar

## 6. Sistema de notificação de nota vencendo

> "Sistema de notificação de nota vencendo"

Há `dataVencimento` no schema e módulos de vigilância/ruptura no financeiro.

- [ ] Regra de alerta para lançamentos `ABERTO` com vencimento próximo (D-3, D-1, vencido)
- [ ] Surface na UI (reusar `RupturaCaixa` / `Vigilancia` ou notificação no chat/WhatsApp existente)
