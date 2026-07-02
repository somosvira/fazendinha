# Visita à fazenda 2026-07 — investigação das anotações → backlog de features

**Origem:** anotações da visita/reunião com a administração da Fazenda Rio Novo (2026-07-01).
**Lente obrigatória:** o sistema será **revendido para outras fazendas**. Toda feature nova nasce configurável (multi-opção + defaults sensatos), nada hardcoded para a Rio Novo. Multi-propriedade é o primeiro degrau rumo a multi-tenancy real.

Como ler: cada anotação foi classificada em **(A) feature nova**, **(B) já em andamento**, **(C) já coberto** ou **(D) contexto operacional** (não vira feature, mas calibra decisões).

---

## A. Features novas

### A1. Multi-propriedade

> "outra propriedade → 60 cabeças de recria entre matrizes e novilha, trabalham também com receptora"

Hoje o sistema assume uma fazenda única. A segunda propriedade (recria + receptoras) precisa aparecer sem misturar rebanho, custos e estoques.

- **Escopo:** entidade `Propriedade`; `Animal`, lotes, silos e centros de custo ganham vínculo; filtro global de propriedade no shell; relatórios consolidados ou por propriedade.
- **Revenda:** é a feature mais estratégica do backlog — o isolamento por propriedade é o esqueleto do multi-tenant. Fazendas-cliente com 1 propriedade não devem nem perceber a camada (default = propriedade única).
- **Tamanho:** grande (toca schema em vários módulos). Vale design doc próprio antes de codar.

### A2. Reprodução avançada — receptoras, embrião/sêmen (TE/FIV)

> "toda a reprodução feita aqui dentro, tem um veterinário reprodutivo → compram embriões e sêmen por fora, 35% de concepção → informações são salvas no parto no Ideagri"
> "raça: nelore (receptoras), girolando → mudando pro holandês"

Gap confirmado no código: `TipoEventoReprodutivo` só tem CIO / INSEMINACAO / DIAGNOSTICO / PARTO / SECAGEM — **não existe transferência de embrião nem o conceito de receptora** ([schema.prisma](server/prisma/schema.prisma)).

- **Escopo:** novo tipo de evento `TRANSFERENCIA_EMBRIAO`; papel de **receptora** no animal (a genética do bezerro vem da doadora, não da barriga); estoque de **embriões e doses de sêmen** como insumo comprado (já existe `MovimentoEstoque` — estender, não recriar); **taxa de concepção** como KPI por método (IA × TE) — os 35% citados viram baseline visível no dashboard de reprodução.
- **Revenda:** TE/FIV é comum em fazendas maiores; ter isso diferencia do Ideagri, onde hoje eles só registram no parto (perdem toda a rastreabilidade do processo).
- **Tamanho:** médio. Extensão natural do rebanho já existente.

### A3. OCR de folhas de setor + notas fiscais (por foto)

> "cada setor (ordenha, bezerreiro, recria, etc.) mantém uma planilha diária de 'acontecimentos' → 1x por mês fecha as contas e lança no Ideagri (Sarlo tirando foto das tabelas)"
> "→ os formulários **não podem ser totalmente substituídos** por questão de controle […] → ler formulários (folhas) e notas fiscais por foto pra facilitar o trabalho"

- **Restrição dura:** o papel **continua existindo** — funcionários preferem e a administração quer o controle físico. O OCR *complementa* o fluxo, nunca substitui. A feature é eliminar a redigitação mensal, não a folha.
- **Infra parcial já existe:** bot WhatsApp + `LancamentoRascunho.rawOcr` (rascunho a partir de foto) no main, e o PR #5 (upload de NF para R2) aberto. A feature é generalizar: foto da folha do setor → rascunhos de eventos (ordenha, sanidade, pesagem…) **em fila de revisão** antes de virar lançamento — nunca gravação direta, o humano confere contra o papel.
- **Revenda:** praticamente toda fazenda pequena/média vive de caderno + planilha; "tire foto e o sistema lê" é o pitch de venda mais forte da lista. Os modelos de folha variam por fazenda → o parser precisa ser tolerante a layout, não treinado num formulário fixo.
- **Tamanho:** grande, mas fatiável (começar por 1 tipo de folha, ex. ordenha, + NF que já tem PR).

### A4. Caixinha (fundo fixo do financeiro)

> "a menina do financeiro tem um dinheiro separado que ela pode usar, ela precisa lançar todas as entradas e saídas desse dinheiro e atualizar a caixinha dela"

- **Escopo:** mini-módulo autocontido no financeiro: fundo com saldo corrente, lançamentos de entrada/saída com categoria e comprovante (foto — conecta com A3), recomposição do fundo, extrato mensal. Respeitar `FechamentoMensal` como o resto do financeiro.
- **Revenda:** toda operação rural tem caixa pequeno em dinheiro; é feature universal e barata.
- **Tamanho:** pequeno. Melhor relação valor/esforço da lista — bom candidato a próxima entrega depois do custo-safra.

### A5. Parâmetros zootécnicos configuráveis

> "registro de animais dinâmico, tempo de gestação, corte, leite, etc. podem ser configuráveis mas aparentemente tem alguns padrões"

Gap confirmado no código: `GESTACAO_DIAS = 283`, `PEV_DIAS = 60`, `SECAGEM_ANTEC = 60` estão hardcoded em [reproducao.recompute.ts:11](server/src/services/rebanho/reproducao.recompute.ts#L11), e o modelo `Configuracao` só guarda `producaoModo` + `precoLeite`.

- **Escopo:** expandir `Configuracao` (ou tabela de parâmetros por espécie/aptidão): dias de gestação, PEV, antecedência de secagem, pesos-alvo por categoria, preço do leite/@ etc. — **sempre com os defaults atuais** como fallback. UI simples em Cadastros.
- **Revenda:** é o requisito literal da direção de produto ("configurável com padrões"). Fazenda de corte, leite ou mista muda tudo; sem isso não há revenda séria.
- **Tamanho:** pequeno/médio — o grosso é passar constantes para leitura de config nos recomputes.

### A6. Brinco eletrônico + bastão (RFID)

> "brinco + bastão"

- **Escopo:** identificação do animal por leitura RFID em vez de digitação. Fase 1 (barata): a maioria dos bastões bluetooth atua como teclado — basta o campo de busca de animal aceitar o número do brinco lido (mapear `brinco eletrônico → Animal`). Fase 2: integração dedicada/app de curral.
- **Dependência externa:** a fazenda ainda vai comprar o hardware — especificar junto qual bastão (compatibilidade ISO 11784/11785) antes de codar.
- **Revenda:** requisito comum em fazendas que já usam brinco eletrônico; a Fase 1 é genérica para qualquer leitor-teclado.
- **Tamanho:** pequeno na Fase 1.

### A7. Ponto — horário padrão por funcionário + relógio de ponto

> "pra parte fiscal: registrar ponto do funcionário" · "bônus: falar de ajustar horário padrão de ponto do funcionário (contabilidade), adicionar produto pra registrar ponto e integrar ao projeto"

O registro de ponto em si **já existe** (PR #77, módulo Equipe & Ponto, aberto). Sobram duas extensões:

- **Horário padrão por funcionário:** hoje há `jornadaDiariaHoras`; a contabilidade quer entrada/saída padrão (ex. 07:00–17:00) pré-preenchendo a grade do mês — ajuste pequeno no modelo `Funcionario` + grade.
- **Relógio de ponto físico ("adicionar produto"):** integrar um dispositivo/app de batida real (hoje o lançamento é 100% admin). Depende de escolher o produto — investigar opções (REP-P/app com geolocalização) antes de comprometer escopo.
- **Revenda:** ponto é dor universal de fazenda com funcionário CLT; a parte fiscal (contabilidade) é o comprador interno.

---

## B. Já em andamento (não é feature nova — é terminar o que está em voo)

| Anotação | Onde está |
|---|---|
| **Café: "saber todos os custos de produzir café"** (adubação → planta → colhe → limpeza → venda com pesagem) | Custo **financeiro** entregue (PRs #68–72, merged); custo **operacional** (Fase 1c) commitado neste branch `feat/custo-safra` |
| **Milho: custo de safra** (adubo, horas de trator, nº tratores, nº caminhões → custo total; grão + silagem "comida de vaca") | Módulo `cultivo` neste branch: schema (`SafraCultivo`, `AreaCultivo`, `LancamentoCusto`, `ProducaoCultivo`) + rotas + serviços prontos; frontend em construção. Design: [2026-07-01-custo-safra-cafe-milho-design.md](docs/superpowers/specs/2026-07-01-custo-safra-cafe-milho-design.md) |
| **Silos: quantidade de estoque** | Modelos `Silo`/`MovimentoSilo` + rota `cultivo/silos.ts` neste branch |
| **Registrar ponto do funcionário** | PR #77 aberto (Equipe & Ponto) — mergear e depois atacar A7 |
| **Notas fiscais por foto** (metade do A3) | PR #5 aberto (upload NF → R2) + `LancamentoRascunho.rawOcr` no main |

## C. Já coberto pelo sistema

- **Registro de parto e reprodução básica** (cio, IA, diagnóstico, parto, secagem) — módulo rebanho no main; o gap é só o fluxo receptora/TE (→ A2).
- **Custos por atividade** (leite/café/corte) e ponte com o financeiro — entregues nos módulos respectivos.
- **Troca de raça Girolando → Holandês** — `Raca` já é cadastro; nenhuma mudança necessária, só uso.

## D. Contexto operacional (não vira feature; calibra escala e defaults)

- ~130 animais no total, ~100+ em lactação; **"70 e poucos litros de leite esse mês"** — unidade ambígua nas anotações (quase certamente **70 mil L/mês**, ≈ 23 L/vaca/dia com ~100 em lactação; confirmar antes de usar em KPI).
- 25 funcionários, 10 no curral → dimensiona o módulo Ponto e o nº de folhas de setor do A3.
- Milho: ~100 ha, ~100 sacas/ha; café: ~28 mil pés, colheita manual 1×/ano por ~2 meses → dimensionam o custo-safra em voo.
- Concepção ~35% → baseline do KPI do A2.
- **Nada disso deve ser hardcoded** — são números da Rio Novo em jul/2026, não do produto.

---

## Priorização sugerida

1. **Terminar o custo-safra** (café operacional + milho + silos + toggle custeio/investimento) — já em voo neste branch.
2. **Mergear PR #77** (Ponto) e emendar o horário padrão (A7, parte pequena).
3. **A4 Caixinha** — pequena, autocontida, valor imediato pro financeiro.
4. **A5 Parâmetros configuráveis** — barata e é fundação de revenda.
5. **A3 OCR folhas + NF** — maior valor percebido; começar pela NF (PR #5) e 1 tipo de folha.
6. **A1 Multi-propriedade** — estratégica, mas pede design doc próprio.
7. **A2 Reprodução TE/receptoras** — médio porte, depende de A1 se os dados da 2ª propriedade entrarem juntos.
8. **A6 Brinco+bastão** e **relógio de ponto físico** — bloqueados na compra do hardware; especificar produto primeiro.
