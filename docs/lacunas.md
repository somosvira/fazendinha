# Lacunas e limites atuais

Base da análise: código da `main` em `b63931e4`, que integra Reprodução/consultas e Produção V5. Este documento reúne limitações verificáveis e perguntas de evolução; não cria roadmap aprovado nem indica falha de produção observada. Remover um plano antigo não significa aprovar todas as suas propostas.

## Limitações identificadas no código

| Tema | Estado atual e evidência | Consequência / decisão necessária |
|---|---|---|
| Atendimento por exceção multiação | `protocolos/execucao.schemas.ts` aceita somente v1, até cem tarefas de animais distintos; `execucao.ts` exige mesma ação/contexto | A proposta de envelope v2 por momento inteiro não está entregue; definir contrato, limites e validação antes de implementá-la. A coordenação da visita já existente é outro caminho |
| Nunca lactou | `SEM_LACTACAO` existe no tipo, mas `contexto-animal.calc.ts` retorna NAO_INFORMADA quando falta evidência | Não rotular novilha sem histórico como nunca lactante sem fonte explícita |
| Idade gestacional de TE na ficha | Contexto individual mantém idade embrionária pendente | Não converter dias desde transferência em idade gestacional exata; distinguir das regras analíticas dos indicadores |
| Custo/L por natureza | `leite/custos.ts` e `custos.calc.ts` conservam pendência NATUREZA_SEM_VINCULO | Falta vínculo monetário dos componentes à natureza física; não ratear automaticamente pelo volume |
| Controle individual periódico | Fonte GERAL admite controles individuais, sem interpolação | Não há produção individual completa entre aferições nem custo/L individual demonstrado nesses períodos |
| Saldo atual por tanque | Tanque é evidência da parcela na ordenha; consulta de estoque é por produto/origem/sítio | Não há rastreio completo de transferências/misturas/posição atual por tanque |
| Natureza restrita do leite | COLOSTRO/NAO_COMERCIAL são terminais no contrato vigente | Eventual liberação/reclassificação exigiria novo fluxo explícito e evidência; expiração de carência não basta |
| Custo produtivo da origem | Apuração exige valor documentado; não deriva automaticamente do preço de venda/indicador | Decidir cobertura de custos e fonte comprovada; não chamar custo direto parcial de custo total da fazenda |
| Qualidade e negociação | Formatos manuais/versionados; sem média automática ou faixas universais de preço | Equivalência de parâmetros/unidades e fórmula contratual precisam de especificação própria |
| Importação histórica de leite | `leite/previa.ts` confere; não executa carga operacional automática | Faltam lote real conferido, unidades, corte e reconciliação com estoque/vendas; não repor saldo de leite já vendido |
| IDEAGRI sanitário/nutricional | Carga inicial Rebanho/Genética e ferramenta técnica V4 existem; V3 histórica permanece sem entrega completa | Mapeamento/validação próprios; sem sincronização contínua presumida |
| Liquidação com abatimento | Pagamento menor conserva pendente; desconto comercial pertence à compra | Abatimento posterior requer fato e regra próprios |
| Rentabilidade integral | Caixa, compras, custo direto registrado e custo/L com cobertura têm contratos distintos | Depreciação, mão de obra própria e despesas gerais não atribuídas não viram custo total ou lucro automaticamente |
| Assistente em todos os eixos | Registro de ferramentas atual concentra leitura financeira e ajuda | Estoque/Pecuária precisam de ferramentas autorizadas próprias; não estão disponíveis só porque há chat |

## Perguntas de produto, sem implementação nesta revisão

- Precisamos de observação estruturada de cio/anestro ou basta exame/observação? Qual evidência, responsável e encerramento definiriam o rótulo?
- Como comprovar “nunca lactou” e distinguir desconhecimento de ausência histórica documentada?
- O custo desejado é direto registrado, custo completo da atividade ou margem? Qual fonte cobre cada componente e como evitar dupla contagem?
- É necessário rastrear posição atual do leite por tanque, incluindo mistura, limpeza e transferência? A identificação na ordenha não cobre esse processo.
- Qual política deve orientar preenchimento atrasado, fechamento nutricional pendente e conferência de qualidade? Hoje ausência de registro não cria diagnóstico/alerta arbitrário.
- Quais decisões do antigo mockup de atendimento por exceção continuam desejadas após a operação real? A proposta deve ser reavaliada contra o executor atual, sem reabrir automaticamente todo o plano.

## Validações que não se inferem do merge

Publicação em Workers/Neon, baseline efetivamente aplicada em cada ambiente, R2 real, entrega de e-mail, chamadas reais de IA, dispositivos/leitores de tela e rotina da fazenda exigem evidência do ambiente e do cenário. O merge e os testes com mocks não substituem essas verificações.

Concorrência PostgreSQL deve identificar os comandos e disputas exercitados; um teste estrutural SQL, uma transação revertida ou uma chamada sequencial não comprova todos os interleavings. A substituição histórica autorizada da base demonstrativa não autoriza reset ou nova carga nesta tarefa.

Roteiros V3/V4/V5 e evidências visuais históricas permanecem preservados. Seus resultados pertencem aos cenários/data originais; nenhuma marcação foi aprovada ou reiniciada pela atualização documental. Bases antigas de QA não devem ser recriadas para preencher a documentação.

## Divergências documentais corrigidas

Produção/qualidade V5 deixaram de ser descritas como futuras ou ausentes. A finalidade histórica LEITE passou a ser descrita como guarda implementada. Referências à antiga cadeia SQL foram identificadas como históricas e o deploy passou a apontar a baseline vigente. A navegação e a ficha passaram a incluir Leite/Produção. Instruções de seed V3/V4 separadas foram substituídas pela entrada única vigente. Planos concluídos/relatos redundantes foram retirados; pendências reais foram mantidas aqui e nos contratos.
