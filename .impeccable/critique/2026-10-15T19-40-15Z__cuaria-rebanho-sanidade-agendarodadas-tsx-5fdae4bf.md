---
target: Ciclo sanitário filtrado pelo animal Aurora
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/home/mathe/fazendinha/client/src/pecuaria/rebanho/sanidade/AgendaRodadas.tsx"
target_fingerprint: "sha256:e5c43abd1deed54dbb025920be2237a02abd9b8f107d19fa71e76f5c8856c9d6"
target_path: /home/mathe/fazendinha/client/src/pecuaria/rebanho/sanidade/AgendaRodadas.tsx
timestamp: 2026-10-15T19-40-15Z
slug: cuaria-rebanho-sanidade-agendarodadas-tsx-5fdae4bf
---
Method: dual-agent (A: /root/ciclo_design_a · B: /root/ciclo_evidencia_b)

# Ciclo sanitário — revisão de 15/10/2026

Alvo: `client/src/pecuaria/rebanho/sanidade/AgendaRodadas.tsx`, ciclo vacinação principal filtrado pelo animal Aurora e por etapa. Avaliação anterior a qualquer reformulação do ciclo nesta rodada.

## Especificidade e impressão geral

O domínio é real, mas a composição parece uma tela administrativa genérica que expõe tabelas de serviços. O foco deveria ser qual etapa precisa de atenção, para qual animal e qual ação segura executar. Mais decoração não resolve a hierarquia.

Detector estático: zero achados, nenhuma regra/localização a classificar. A inspeção visual e a árvore acessível confirmaram problemas que o detector não mede. Não houve overlay: a execução JavaScript disponível é somente leitura.

## Saúde do design

| Heurística | Nota /4 | Evidência |
|---|---:|---|
| Estado do sistema | 2 | Há loading/erro, mas etapa e filtro por animal pouco reconhecíveis |
| Linguagem do domínio | 3 | Termos adequados; início próprio e execuções existentes exigem interpretação |
| Controle e liberdade | 3 | Retorno, cancelamento e URL; filtro herdado sem saída evidente |
| Consistência | 2 | Ações equivalentes visualmente e painéis em camadas |
| Prevenção de erros | 3 | Motivos e confirmações; cancelar compete com executar |
| Reconhecimento | 2 | Tarefas não nomeiam a etapa; exige lembrar seleção |
| Eficiência | 3 | Há execução coletiva e paginações; excesso de rolagem |
| Minimalismo | 1 | Doze colunas e cinco ações numa única tarefa |
| Recuperação de erros | 3 | Código preserva trabalho e distingue gravação de falha no refresh; erro real não provocado |
| Ajuda contextual | 1 | Explica mecanismo do filtro, não o próximo trabalho |
| **Total** | **23/40** | **Aceitável, com melhorias significativas necessárias** |

## Pontos fortes

- Distinção entre previsto, realizado, participação e histórico, com rastreabilidade.
- URLs profundas, paginações independentes e execução coletiva.
- Carregamento, sucesso e recuperação explícita, estados sanitários com texto.

## Prioridades

1. **P1 — Tarefa abaixo da dobra.** Etapas ocupam cerca de 346px no viewport observado e tarefas começam perto de y637. Compactar cabeçalho/etapas e trazer tarefas para o foco. Sugestão: layout/distill.
2. **P1 — Tabela incompatível com largura.** Doze colunas, campos realizados vazios e cinco botões criam rolagem lateral e linha muito alta. Usar 5–6 colunas úteis; execução primária e secundárias em menu, detalhes na consulta. Sugestão: distill/adapt.
3. **P1 — Contexto invisível.** Explicitar animal filtrado com ação limpar e etapa selecionada no título/estado acessível. Sugestão: clarify.
4. **P2 — Contagens repetidas.** Andamento do contexto atual na etapa; comparação integral opcional claramente nomeada, sem confundir escopos nem somar atrasadas às pendentes. Sugestão: distill.
5. **P2 — Administração compete com execução.** Reunir gestão do ciclo em menu; diferenciar execução, consulta e cancelamento, preservando confirmações e gates. Sugestão: shape/polish.

## Carga cognitiva e jornada

Alta: seis de oito itens falham (foco, chunking, hierarquia, decisão única, escolhas mínimas, memória). A entrada dá identidade, mas os dois universos de contagem geram dúvida; depois é preciso rolar vertical e horizontalmente até decidir. Histórico preserva confiança, mas o fim burocrático não facilita concluir o trabalho.

## Personas

- Alex, operador frequente: tarefa primária longe e linha alta custam tempo.
- Sam, teclado/leitor de tela: botões repetidos, etapa sem seleção anunciada e nomes acessíveis incluindo zeros que a visão omite.
- Jordan, iniciante: filtro atual sem nome e cancelar execução ambíguo.

## Observações menores

Concordância singular/plural, paginações sem necessidade em uma única página, título genérico repetido e excesso de campos vazios em tarefa pendente. Nenhum crash ou bloqueio funcional foi observado. Gravação clínica, mobile físico e leitor de tela real não exercitados.

## Decisões para o próximo passo

- Etapas compactas primeiro ou tarefas primeiro?
- Abas Tarefas/Participantes/Histórico ou tarefas com painel auxiliar lateral?

As correções pontuais das outras telas nesta rodada são independentes desta avaliação; o ciclo ainda não foi reformulado.
