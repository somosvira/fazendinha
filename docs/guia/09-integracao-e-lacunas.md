# Integração, estados e lacunas

## Uma história atravessando os eixos

Uma vaca entra no rebanho com identidade e localização comprovadas. A dieta do lote recebe vigência; o fechamento confirma consumo e atribui custo pelos dias de presença. Uma aplicação usa material do estoque e preserva carência. A tentativa reprodutiva registra a intervenção; o diagnóstico confirma gestação. O parto cria as crias vivas e pode abrir lactação quando informado.

Cada ordenha mede leite; a confirmação cria origem física. A natureza e as carências limitam sua destinação. Uma coleta retira leite antes ou depois de negociar preço. O fechamento comercial cria venda e condição financeira. A liquidação registra o recebimento na conta. Relatórios reúnem os fatos pelo recorte correto, sem somar compra, consumo e pagamento como despesas diferentes.

## As quatro perguntas que evitam confusão

| Pergunta | Exemplo | Fonte |
|---|---|---|
| Como está o animal na data? | Gestante e lactante | Evidências reprodutivas e lactação |
| Qual é o estado do registro? | Aplicação válida ou anulada | Histórico do fato |
| Que leite existe e qual sua natureza? | 10 L de colostro disponíveis | Origem, classificação e movimentos |
| O que aconteceu com o dinheiro? | R$ 500 ainda a receber | Compromisso e liquidações |

Uma resposta não substitui a outra. “Descarte” pode ser restrição reprodutiva da matriz, natureza não comercial do leite ou eliminação física, conforme o contexto. A documentação e os formulários precisam nomear o objeto.

## Modelo detalhado e desenho do sistema

O HTML inclui, na sequência, a matriz completa de estados, o system design e as lacunas. Em Markdown, consulte [estados do animal](../pecuaria/estados-animal.md), [system design](../system-design.md) e [lacunas](../lacunas.md). São fontes complementares: manual explica o uso, contrato fixa regras, código/SQL implementam e testes/evidências verificam cenários.

## O que ainda precisa ser decidido ou comprovado

As principais lacunas são atendimento protocolar multiação por momento, idade embrionária no contexto individual de TE, comprovação de nunca lactante, custo por natureza, produção individual entre controles, saldo atual por tanque e carga histórica de leite. Custo direto registrado não deve ser apresentado como rentabilidade integral.

O código atual não entrega formulação automática de dieta, diagnóstico veterinário, laboratório/FIV, sincronização contínua IDEAGRI nem execução automática de todas as propostas dos mockups. Os números didáticos do guia não são recomendações clínicas ou dados da fazenda.

## Como manter esta documentação

Ao alterar uma regra, atualize seu contrato e o capítulo de usuário afetado. Ao criar um estado, defina fonte, data, transições, coexistência, evidência desconhecida e efeito nos demais eixos. Ao emitir um relatório, preserve o snapshot e sua metodologia. Ao concluir uma proposta, incorpore decisões ao contrato e retire o plano temporário.

Regere o HTML pelos capítulos; não mantenha uma segunda cópia manual do conteúdo. A revisão documental verifica links, estrutura, diagramas e leitura do arquivo. Não concede aceite aos roteiros nem comprova deployment, banco ou operação rural.
