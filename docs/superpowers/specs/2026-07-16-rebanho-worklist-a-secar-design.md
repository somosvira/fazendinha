# Rebanho — Work-list operacional “A secar”

**Data:** 2026-07-16 · **Módulo:** Rebanho / Reprodução · **Linha:** complementos do Histórico de Lactações

## Contexto

A base já possui quase todo o encanamento de secagem:

- `ResumoAnimal.previsaoSecagem`, calculada a partir do parto previsto e do parâmetro `SECAGEM_ANTEC`;
- evento reprodutivo `SECAGEM`, com motivo e recomputação do resumo;
- work-list “A secar (atrasadas)” na aba Reprodução;
- insight da IA que considera vacas entrando na janela de secagem nos próximos 30 dias;
- histórico de lactações, motivo de secagem e produção por ciclo no cockpit.

A lacuna é operacional: a work-list atual mostra somente previsões vencidas, não ordena explicitamente por urgência e abre o formulário genérico de Reprodução em “Inseminação”. Para registrar uma secagem, a pessoa precisa corrigir manualmente tipo e data e, após salvar, é desviada ao cockpit do animal em vez de continuar a fila.

## Objetivo

Transformar “A secar” numa fila operacional diária que:

1. inclua vacas com secagem prevista nos próximos 30 dias e as atrasadas;
2. ordene as vacas da mais urgente à menos urgente;
3. comunique claramente se a secagem está atrasada, vence hoje ou vence em N dias;
4. abra o formulário já preparado para registrar `SECAGEM` no animal selecionado;
5. após salvar, recarregue a aba Reprodução e mantenha a work-list selecionada, removendo da fila a vaca cujo resumo foi recomputado.

## Regra de negócio

### Elegibilidade

Uma vaca entra na work-list quando todos os critérios forem verdadeiros:

- `statusReprodutivo === "PRENHE"`;
- `del != null` (a vaca ainda está em lactação);
- `previsaoSecagem` existe e é uma data ISO válida;
- `previsaoSecagem <= hoje + 30 dias`.

O status `PRENHE` permanece depois da secagem — a vaca continua gestante. É `del == null`, derivado da ausência de lactação aberta, que a remove corretamente da fila. Não há limite inferior: previsões anteriores a hoje continuam na lista como atrasadas. Animais sem previsão ou já secos ficam fora; a aplicação não estima nem inventa uma data.

A janela é inclusiva:

- previsão exatamente hoje entra;
- previsão exatamente `hoje + 30 dias` entra;
- previsão em `hoje + 31 dias` fica fora.

As comparações usam datas civis ISO (`YYYY-MM-DD`), sem hora. `HOJE` continua vindo do helper corrente do módulo.

### Ordenação

A saída é ordenada por `previsaoSecagem` crescente:

1. atrasadas mais antigas;
2. atrasadas mais recentes;
3. vence hoje;
4. próximas, da menor para a maior quantidade de dias.

Em empate de data, usar `animalId` crescente como desempate determinístico.

### Estado de urgência

Uma função pura deriva o texto apresentado na linha:

- previsão anterior a hoje: **“Atrasada há N dias”**;
- previsão igual a hoje: **“Secar hoje”**;
- previsão posterior a hoje: **“Secar em N dias”**.

Atrasadas usam tom de alerta. Hoje e próximas usam tom de atenção, sem tratar uma tarefa futura como erro.

## Experiência na aba Reprodução

### Card da work-list

- Renomear **“A secar (atrasadas)”** para **“A secar”**.
- A contagem inclui próximas 30 dias + atrasadas.
- A seleção permanece entre recarregamentos provocados pelo registro de secagem.

### Tabela

Quando “A secar” estiver selecionada, a tabela continua mostrando Animal e as colunas gerais de Reprodução, mas adiciona informação específica suficiente para decidir a ação:

- **Secar até:** `previsaoSecagem` formatada em PT-BR;
- **Prazo:** pill “Atrasada há N dias” / “Secar hoje” / “Secar em N dias”.

A linha comunica a ação **“Registrar secagem”**. O clique na linha executa essa ação primária; não abre primeiro o cockpit.

As demais work-lists mantêm o comportamento atual de abrir o registro genérico de evento reprodutivo. A customização é vinculada ao `id === "secar"`, não aplicada globalmente.

### Formulário preparado

A work-list reutiliza `EventoForm`; não cria outro modal nem duplica a chamada à API. O componente recebe valores iniciais opcionais:

- `tipoInicial="SECAGEM"`;
- `dataInicial=HOJE`;
- `dominioFixo="reproducao"`;
- animal já selecionado.

O motivo continua selecionável. O valor inicial é o primeiro motivo já definido pelo formulário, sem gravar silenciosamente antes da confirmação.

Para os demais chamadores, a ausência das novas props preserva o comportamento atual (`INSEMINACAO`, data vazia).

### Pós-salvamento

O registro iniciado pela work-list usa retorno **“permanecer na lista”**:

1. API registra o evento `SECAGEM`;
2. backend recomputa o resumo do animal pelo fluxo já existente;
3. modal fecha;
4. `ReproducaoTab` recarrega os animais;
5. work-list “A secar” continua selecionada;
6. a vaca seca deixa a lista porque o resumo atualizado não satisfaz mais a regra.

O fluxo genérico iniciado por outras work-lists continua podendo navegar ao cockpit após salvar. O estado de registro inline precisa carregar a intenção de retorno (`"lista" | "cockpit"`) e o tipo inicial, evitando inferência por texto ou nome da aba.

Se a API falhar, o modal permanece aberto e exibe o erro existente; a lista não é alterada otimisticamente.

## Salvaguarda obrigatória do histórico de lactações

O fluxo atual de `server/src/services/rebanho/eventos.ts#recomputarAnimal` executa `deleteMany` em todas as lactações do animal e as recria apenas com `numero`, `dtInicio` e `dtFim`. Depois dos PRs #146/#147, isso é destrutivo: registrar qualquer evento reprodutivo pode apagar `motivoSecagem`, `tipoAleitamento`, `induzida`, `producaoTotal`, `producao305` e `duracaoDias` importados.

Esta fatia deve tornar a recomputação **não destrutiva** antes de expor “Registrar secagem” como ação operacional:

- preservar as lactações históricas já persistidas;
- ao registrar `PARTO`, criar/garantir apenas o novo ciclo correspondente;
- ao registrar `SECAGEM`, encerrar somente a lactação aberta mais recente (`dtFim = data do evento`) e salvar `motivoSecagem` nesse mesmo registro;
- não sobrescrever produção, flags ou metadados importados;
- ao excluir `SECAGEM`, reabrir somente o ciclo que foi encerrado por esse evento, limpando `dtFim` e `motivoSecagem` sem tocar nos demais campos;
- ao excluir `PARTO`, **preservar a lactação correspondente** nesta fatia: sem FK/proveniência não é seguro distinguir um ciclo histórico importado de um ciclo criado pelo app; apagar seria risco de perda de produção e metadados reais;
- ao excluir outros eventos reprodutivos, não alterar lactações;
- executar a mutação do evento + atualização das lactações + resumo em transação, para não deixar evento e read-model divergentes em caso de falha.

A correspondência entre ciclo derivado e persistido usa `dtInicio` como identidade natural dentro do animal, com `numero` como verificação/ordenação. Se houver dado legado ambíguo (mais de uma lactação com o mesmo início), a operação deve falhar com erro explícito em vez de apagar ou mesclar silenciosamente.

Testes de regressão precisam provar que uma lactação com produção e flags preenchidas mantém esses valores após registrar uma secagem e após registrar outro evento reprodutivo.

## Arquitetura e arquivos

### Backend — recomputação não destrutiva

`server/src/services/rebanho/reproducao.recompute.ts`

- separar o cálculo puro dos ciclos desejados da estratégia de persistência;
- produzir operações declarativas de criar/encerrar/reabrir ciclo, sem I/O e sem campos enriquecidos.

`server/src/services/rebanho/eventos.ts`

- substituir `deleteMany + createMany` por sincronização pontual/transacional;
- aplicar `motivoSecagem` à lactação encerrada;
- preservar todos os campos enriquecidos existentes;
- manter o resumo reprodutivo coerente com as lactações resultantes.

`server/src/services/rebanho/reproducao.recompute.test.ts` e teste de service

- cobrir preservação de produção/metadados;
- cobrir secagem da lactação aberta correta;
- cobrir idempotência e ambiguidade;
- cobrir exclusão de `SECAGEM` (reabre ciclo), exclusão de `PARTO` (preserva ciclo) e demais eventos sem perda dos dados importados.

### Cálculo puro da work-list

`client/src/rebanho/lib/worklists.ts`

- evoluir `aSecar(resumos, hoje, janelaDias = 30)`;
- filtrar, validar e ordenar;
- exportar helper puro para estado/prazo da secagem, ou retornar um tipo derivado se isso simplificar o consumo sem mutar `ResumoAnimal`.

`client/src/rebanho/lib/worklists.test.ts`

- atrasada entra;
- hoje entra;
- `+30` entra;
- `+31` não entra;
- não-prenhe não entra;
- sem previsão/data inválida não entra;
- ordenação e desempate;
- textos de urgência no singular/plural.

### Configuração e tabela

`client/src/rebanho/domains.tsx`

- renomear a work-list;
- usar a janela de 30 dias;
- fornecer colunas/ação específicas sem duplicar toda a configuração de Reprodução.

`client/src/rebanho/components/HerdDomainView.tsx`

- suportar comportamento por work-list selecionada: dica/ação da linha e colunas complementares;
- preservar o `wlId` quando o componente for recarregado dentro da mesma aba;
- manter o comportamento atual para todas as outras telas.

A extensão do contrato deve ser pequena e declarativa (metadados opcionais na `WorkList`), não condicionais de domínio espalhadas no componente genérico.

### Fluxo de registro

`client/src/rebanho/components/ReproducaoTab.tsx`

- identificar quando a ação veio da work-list `secar`;
- solicitar registro com `tipoInicial: "SECAGEM"`, `dataInicial: HOJE` e retorno à lista;
- expor um gatilho de recarga dos dados após sucesso.

`client/src/rebanho/RebanhoContent.tsx`

- enriquecer `registroInline` com tipo/data iniciais e destino pós-salvamento;
- no destino `lista`, incrementar a chave de recarga da aba e não navegar para `animal`;
- no destino `cockpit`, preservar o fluxo atual.

`client/src/rebanho/components/EventoForm.tsx`

- aceitar props opcionais `tipoInicial` e `dataInicial`;
- inicializar o estado uma única vez ao abrir;
- não afetar formulários de Sanidade nem chamadas sem essas props.

## Testes e verificação

### Automatizados

1. Vitest puro de `aSecar` e do estado de urgência, cobrindo fronteiras, `del != null` e ordenação.
2. Testes puros e de service da sincronização não destrutiva: registrar secagem encerra o ciclo aberto e preserva produção/flags; outro evento reprodutivo não altera lactações; exclusão recompõe datas sem apagar metadados.
3. Teste de componente do `EventoForm` ou da integração mais estreita disponível comprovando que `tipoInicial="SECAGEM"` e `dataInicial=HOJE` preenchem o formulário sem alterar o default genérico.
4. Testes existentes de server e client passam.
5. Typecheck e build dos dois workspaces passam.

### Runtime / navegador

Com banco local e rebanho real importado:

1. abrir Reprodução → “A secar”;
2. confirmar próximas 30 dias + atrasadas em ordem crescente de previsão;
3. abrir uma vaca e observar modal em `SECAGEM`, animal travado e data de hoje;
4. salvar com motivo;
5. confirmar retorno à mesma work-list e remoção da vaca;
6. abrir outra work-list e confirmar que o formulário genérico ainda inicia em `INSEMINACAO`;
7. provocar erro de validação/API e confirmar que o modal não fecha.

Como o passo 4 escreve dados, a verificação deve ocorrer apenas no PostgreSQL local isolado, nunca no Neon de produção.

## Não-objetivos

- secagem coletiva/em lote;
- agenda ou calendário de manejos;
- configurar a janela de 30 dias;
- alterar `SECAGEM_ANTEC` (ele continua definindo a data prevista em relação ao parto);
- criar página dedicada ou card novo no Dashboard;
- alterar o schema Prisma ou o import do Ideagri;
- corrigir em lote dados históricos que já estejam sobrepostos/inconsistentes (a operação apenas recusa ambiguidade);
- implementar Correção 305 ou a aba analítica de Lactações nesta mesma fatia.

## Evolução seguinte

Depois desta fatia:

1. **Correção 305 oficial** — importar `CORRECAO305` e usar o valor zootécnico oficial;
2. **Aba analítica Lactações** — indicadores de persistência, vida produtiva e comparação entre ciclos já sobre dados completos;
3. retomar a fila geral com **Exames ginecológicos**.
