# Redesign da Pecuária — plano de execução

Data: 07/10/2026. Base: `main@f060470798e2dc5c34bc43717e77ebc75c01d838`.
Branch: `codex/pecuaria-redesign`. PR em rascunho: [#312](https://github.com/somosvira/fazendinha/pull/312). Implementação e validação por etapas.

## Objetivo e decisões fechadas

Simplificar a operação da Pecuária sem retirar capacidades da V3. O fluxo de campo parte da seleção de lotes, gera uma ficha impressa e retorna a uma interface com os mesmos animais, ordem, títulos e campos. Consultas e ações podem aparecer em mais de um contexto, sempre sobre os mesmos fatos.

Preservar identidade Terrano, componentes existentes, genética, histórico, auditoria, escopo por sítio, permissões, ciclos e desvios, carências, estoque e financeiro. IDEAGRI permanece somente como fonte de carga inicial/reconciliação. Reprodução e leite futuros não entram neste redesign.

## Arquitetura de navegação

Manter a área/permissão `pec-rebanho` e distribuir seus destinos na sidebar, sem uma segunda navegação global horizontal. URLs antigas continuam acessíveis; detalhes usam retorno ao contexto de origem.

| Sidebar | Divisão e propósito |
|---|---|
| Visão geral | Acessos às rotinas de campo, sanidade, exames e consumo; indicadores ligados às consultas do rebanho. |
| Coletas de campo | Preparar ficha, imprimir, retomar preenchimento, revisar e concluir. Pesagem corporal, aplicações e exames avulsos. Tarefas de protocolo são executadas na Agenda. |
| Animais | Lista e ficha: resumo, histórico, sanidade, peso/manejo, nutrição e genética. |
| Lotes | Integrantes, nutrição e histórico; movimentar, preparar coleta, atribuir dieta e conferir consumo. |
| Pesagens | Fichas coletivas e histórico completo consultável por animal (inclusive baixados), usando os mesmos pesos das fichas. |
| Sanidade | Agenda (Ciclos/Tarefas), Aplicações, Exames e Carências. Ocorrências em consulta secundária e ações contextuais. |
| Nutrição | Dietas, Atribuições e Consumos; consulta global, consumo diário e consolidação mensal. |
| Cadastros | Rebanho, Genética e Sanidade; versões de protocolos conservadas. |

## Comportamentos e contratos

### Formulários, erros e atualização

- Reutilizar painéis/formulários do aplicativo, tabelas para históricos e tokens visuais existentes.
- Erros próximos ao campo, resumo visível, foco/rolagem para o primeiro erro e abertura de seção recolhida que contenha erro. Conservar os dados digitados.
- Depois de salvar, atualizar as consultas afetadas, inclusive carências e ficha do animal, protegendo contra respostas atrasadas. Gravação concluída com falha na atualização informa o salvamento e oferece repetir somente a consulta.
- Não exibir “Válido” rotineiramente. Manter indicação de Anulado, Cancelado e Estornado e respectivos motivos/histórico.

### Sanidade e manejo

- Cada tabela conserva seus filtros. Categorias em multiselect; busca textual e datas em controles próprios. Query plural CSV `animalIds`, `loteIds`, `situacoes`, com aliases singulares compatíveis; OR dentro de cada categoria, AND entre categorias, antes da paginação.
- Registro sanitário: animal/data/hora → tipo/origem → Produto/Serviço e quantidade → lotes/ciências → carências → responsável/detalhes → revisão. Apenas detalhes opcionais de Produto incluso em Serviço podem ser recolhidos.
- Planejamento de protocolo continua bloqueado até desvio explícito e motivado; preservar snapshots e confirmação atômica/idempotente.
- Desmama única válida por animal. Ocultar a opção após confirmação e reoferecer depois de anulação com motivo. Manter somente Desmama/Castração como categorias padrão; anulação conserva a pesagem vinculada.

### Coletas e pesagens

- Persistir ficha e itens, sítio, data, rotina, identificação, lista e ordem congeladas, rascunho versionado e referências aos fatos concluídos. Não usar armazenamento do navegador como fonte de verdade.
- Impressão A4 legível em preto e branco, código da ficha, identificação dos animais e espaço de anotação. Reimpressão conserva a mesma seleção/ordem.
- Preenchimento acompanha a impressão, ordenação natural dos brincos, vírgula decimal e teclado. Não medido/não realizado é explícito; campo vazio não vira zero nem procedimento confirmado.
- Animais adicionais/mudanças exigem revisão. Concluir reutiliza os serviços da V3 e sua atomicidade/idempotência, sem duplicar estoque ou fatos em reenvio.
- Aplicações/exames desta coleta são avulsos: não concluem tarefas pendentes de protocolo. Ciclos, tarefas e desvios continuam na Agenda, sem substituição ou inferência automática.

### Nutrição

- Criação de dieta, edição de rascunho, nova versão e publicação são ações explícitas em formulários. Uma nova dieta não pode reutilizar nome normalizado; novas versões preservam a família existente. Proteger criação concorrente.
- Excluir rascunho/dieta somente sem uso operacional, com auditoria; quando usada, permitir inativação e conservar história.
- Na ficha do lote apenas atribuir dieta publicada, consultar histórico e consumo. Criar dieta pertence à página global.
- Corrigir dieta/data da atribuição ou anulá-la com motivo e conferência dos impactos. Consumo confirmado afetado exige estorno antes da correção.
- Previsão de produtos e custos por lote/cabeça/dia, com sítio/data, permissão e indicação de estimativa ou incompletude.
- Consumo diário usa prévia e confirmação humana; ontem é a data inicial sugerida. Manter lançamento por período para atrasos, sem sobreposição. O mês consolida consumos existentes e não baixa novamente o estoque.
- Sem baixa física, mostrar quantidade/motivo e custo não apurado; não apresentar previsão de custo nessa confirmação nem inventar valor realizado.
- Reutilizar `FechamentoConsumo` para intervalos de um dia e períodos. Consulta global não exige escolher lote; lote é campo do formulário de nova conferência. Participantes em ordem numérica.

## Orquestração e propriedade

Um orquestrador e até três agentes simultâneos, trabalhando no WSL em uma cópia isolada. O checkout anterior e suas alterações não são incorporados nem modificados automaticamente.

| Papel | Modelo/esforço planejado | Responsabilidade |
|---|---|---|
| Orquestrador | Modelo deste chat | Contratos compartilhados, schema/migrations, integração, coletas, revisão crítica e aceite. |
| Experiência | GPT-6.1 Sol / medium | Sidebar, navegação, sanidade/manejo, formulários, tabelas e acessibilidade; nutrição após estabilizar base. |
| Regras | GPT-6.1 Sol / high | Nutrição, manejo, filtros, validações, auditoria e testes de domínio. |
| Verificação | GPT-6 Luna / medium | Cobertura do guia, documentação e verificações delimitadas. Não aprova sozinha integridade de estoque/custos. |

Proprietário único por arquivo compartilhado; frontend/backend paralelos somente com contrato definido. Briefs enxutos, sem copiar toda a conversa. Reutilizar agentes por especialidade. Testes focados por entrega e regressão integrada nos marcos. Após duas tentativas sem avanço comprovado, encaminhar diagnóstico ao orquestrador. Não há contagem de tokens ou economia estimada sem medição disponível.

## Sequência e acompanhamento

- [x] Criar branch isolada a partir da `main` atualizada e registrar o plano.
- [x] Abrir PR em rascunho e vinculá-lo ao chat.
- [ ] Etapa 1: navegação, padrões comuns, sanidade e manejo.
- [ ] Etapa 2: coletas persistidas, impressão e retorno para pesagem/rotinas sanitárias.
- [ ] Etapa 3: dietas, atribuições, consumo diário/global e consolidação.
- [ ] Integração, documentação e regressão da V3/Estoque/Financeiro.
- [ ] Conferência visual/teclado a 1440, 1180 e 720 px e impressão A4.

Cada marco será atualizado apenas com evidência da execução. PR em rascunho não significa redesign concluído nem homologação manual.

### Limite de execução solicitado

Em 07/10/2026, o usuário definiu parada obrigatória com **75% ou menos de uso restante**, mesmo sem conclusão. A consulta inicial confirmou 89% restante. Consultar o limite compartilhado da conta em cada etapa e antes de iniciar a próxima; agentes também devem respeitar o checkpoint. Ao atingir o limite, interromper o trabalho e os agentes, preservar os arquivos e informar entregas, validações e pendências. Não iniciar implementação, testes ou publicação adicionais depois da parada sem nova orientação do usuário.

## Critérios de aceite e testes

Conservar os 107 casos do guia V3 e os contratos herdados. Manter IDs, chave `fazendinha:guia-v3:20261004:1`, resultados e anotações; casos novos recebem IDs próprios, sem reset nem aprovação automática.

Acrescentar regressões para: filtros múltiplos antes da paginação; carência atualizada após aplicação; erro com foco/rolagem; desmama duplicada e anulação; rascunho/reimpressão/concorrência/reenvio de coleta; ordenação natural; nomes e versões de dietas; exclusão com uso; correção de atribuição; consumo diário sem sobreposição; consolidação sem nova baixa; ausência de custo sem baixa; estorno exato; permissões e escopo por sítio.

Executar testes direcionados, TypeScript e builds; integrações PostgreSQL em banco isolado. Nunca limpar o cenário do usuário para testes. Documentar falhas/limitações e distinguir evidência automatizada de homologação manual.
