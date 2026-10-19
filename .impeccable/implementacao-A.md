# Correções da avaliação A — 15/10/2026

## Fechamento adicional dos achados concretos

### Reconciliação final do inventário (32/35/40/41/42/51/54/56/58/59/61/62/64/65)

| Item A | Estado e decisão verificável |
|---|---|
| 32 | Corrigido: legenda de distribuição quebra nomes completos, inclusive palavras longas, e conserva `title` com nome integral. Não depende de sigla truncada. |
| 35 | Já atendido: ficha tem âncora Sanidade e a ação de leitura visível Abrir foi separada das ações com verbos Registrar/Corrigir/Anular; gates de escrita preservados. Não juntar registros de naturezas diferentes num CTA genérico. |
| 40 | Corrigido: movimentação avisa quando destino coincide com localização atual de parte da seleção. Não bloqueia indiscriminadamente porque há data histórica e seleção coletiva; servidor mantém regras factuais. |
| 41 | Já atendido no estado atual: carências na baixa usam seção neutra compacta `text-sm`, não alerta vermelho dominante. Ciência e justificativa só aparecem quando necessárias; consequência sanitária não foi escondida. |
| 42 | Já atendido: históricos possuem cabeçalhos próprios, filtros/paginação e acesso ao detalhe. Decisão: preservar localização/data/animal e tabelas, não compactar retirando rastreabilidade. Ficha de lote recebeu âncoras na rodada anterior. |
| 51 | Corrigido: busca de animal explica que reduz opções e que a escolha acontece no seletor seguinte. Preserva opção atual e sítio histórico na data. |
| 54 | Corrigido anteriormente: resumo junto à confirmação da aplicação repete identificação do animal/conjunto, medicamento e carências; não depende de lembrar a primeira etapa. |
| 56 | Corrigido: form de exame explicita coleta agora, resultado opcional depois e preservação do formato. Não altera resultados nem payload. |
| 58 | Corrigido: datas de prazo usam 14px e linha 1,5, mantendo data/hora exata. Estados desconhecido/zero/encerrado/não aplicável e ajuda contextual já eram distintos; não colapsados. |
| 59 | Corrigido: escolha de Serviço usa diálogo compacto e explica próximo passo (consultar vinculados/adicionar realizados, sem criar fato); vazio sem Serviço já orientava o Financeiro. |
| 61 | Corrigido: Corrigir vigência usa a superfície de botão secundário, distinta de links de consulta. |
| 62 | Corrigido: prévia no formulário passa a repetir receita selecionada, data e lote, atualizando com os campos. Não promete gravação antes de salvar. |
| 64 | Já atendido: detalhe de fechamento mantém tabela precisa por ingrediente, origem/estoque e participação, com valores mascarados. Decisão: preservar exatidão; reduções da ficha individual e receita já foram feitas sem remover a tabela de origem. |
| 65 | Decisão deliberada: não fabricar centenas de registros para justificar mudança; paginação já implementada e testada. A ressalva de volume era limite de evidência do seed, não defeito funcional ou de desenho demonstrado. |

Teste focado: sete arquivos/54 testes passaram; após novas asserções de destino coincidente e orientação de coleta/busca, dois arquivos/11 passaram (sobreposição). Não houve coleta visual ou detector. Root fecha a suíte global.

### Batelada final de composição (substitui as recomendações ainda abertas descritas abaixo)

- A31: consultar animais/lotes agora está logo após a navegação do panorama, antes de gráficos e atividade recente.
- A36: peso e GMD do período mantêm destaque; recente e desde a entrada usam `dl` compacto com as duas definições, sem apagar ou recalcular diferenças.
- A45–48: filtros/retorno URL preservados; tarefas priorizam atrasadas dentro da página e depois data, com limite explicitado; ciclo remove superfície/borda externa redundante e comparação de andamento fica expansível; tabelas/ações seguem disponíveis.
- A49: rodapé da aplicação resume animal/conjunto, medicamento, lote e estados/prazos de carência junto à conferência, mantendo desconhecido, zero e não aplicável distintos.
- A60: panorama nutricional abre com resumo curto de animais/cobertura; os comparativos expandem sem empurrar a tabela de lotes inicialmente.
- A93: somente duas consultas rápidas iniciais; demais em “Mais consultas financeiras”, escopo/perfil explicado. Guias continuam abertos inicialmente e mídia permanece disponível, sem nova chamada de IA.

Validação: sete suítes/93 testes passaram; depois, dois arquivos/13 testes passaram com novas provas de expansão de comparativos/sugestões e ajuda inicialmente aberta (contagens sobrepostas). TypeScript passou no estado compartilhado atualizado. Nenhum novo detector ou navegação browser; o fechamento visual fica com root. Essas alterações encerram as recomendações concretas remanescentes de A no escopo delegado, sem conceder nota 4 por intenção.

Confronto com o relatório A, sem novo detector:

- A27: ficha de produto explica que seu seletor de sítio afeta apenas a consulta, não o sítio global.
- A34: categoria saiu do subtítulo duplicado; o chip e a regra permanecem.
- A37: períodos nutricionais individuais têm `details` para ingredientes/custos/origem; período, lote, dieta e status não desaparecem.
- A43/A44: FormLote agora usa diálogo compacto; ficha do lote oferece sete âncoras sticky, preservando todo o conteúdo.
- A50/A55: ações sanitárias mostram Abrir, Encerrar, Anular, Resultado, Corrigir, Origem e Carência, mantendo nomes acessíveis e gates de escrita.
- A52: título do detalhe identifica ocorrência, aplicação, exame, tarefa, execução ou ciclo em vez de “fato sanitário”.
- A53: nome histórico do medicamento é a informação principal na tabela; vínculo de produto fica como contexto secundário.
- A57: diálogo de resultado repete tipo de exame e animal quando disponíveis no DTO, sem inventar nomes quando ausentes.
- A67: quantidade da receita usa nome do ingrediente, não número mecânico.
- A68: tabela da receita é a fonte de leitura precisa; comparação gráfica fica em divulgação progressiva, evitando três representações abertas simultaneamente.
- A74/A77: busca local por nome/sigla de raça e explicação clara de 64 partes, metade e parcela não informada.

Já resolvidos antes desta rodada: A21 overflow, A33 prévia sem check, A38 tradução de auditoria, A72/A82 busca de motivos/doenças, A83/A85/A87 diálogos sanitários breves, A94 auth consistente. Ficha animal já tinha navegação sticky (preservada). A79 seleção de material genético já usa `bg-mast`, não preto, no código atual. Raças já possuem nomes completos nas opções de composição. As ajudas dos formulários reutilizam CampoFormulario; seu alinhamento compartilhado pertence ao root.

Validação final deste delta: dez arquivos/107 testes passaram (Cadastros, DetalheLote, DetalheAnimal, SanidadeAnimal, Sanidade, DetalheSanitario, PainelDetalheSanitario, FormGenitor, ReceitasDieta, NutricaoAnimal). Inclui novos testes de busca sem requests/escritas, destinos das sete âncoras, títulos por natureza e contexto exame/animal. Primeiro lote de cinco arquivos/60 testes passou antes dos últimos ajustes; não somar contagens. `tsc` foi bloqueado por `App.rascunho.test.tsx:133` usando opção `exact` de findByRole; comunicado ao root. Nenhuma alteração nessa linha por A. Root executa fechamento global e validação visual.

As recomendações de composição A31/36/45–49/60/93 foram implementadas na batelada final acima. Filtros/históricos, prévias e nomes factuais foram preservados, não eliminados para encurtar páginas. Financeiro/App/Shell/Acessos, flutuante e cabeçalhos compartilhados pertencem ao escopo do root; esta seção não certifica seu fechamento. Sem nova nota global ou detector.

## Implementado no escopo delegado

- Detalhe de relatório: grade só divide em duas colunas a partir de 2xl, com `minmax(0,…)` e filhos `min-w-0`, preservando tabelas e totais.
- Operação e novo animal: componente `LinhaPrevia` usa informação/pendência em vez de check de aprovação; resumo da operação diz explicitamente quando a prévia está incompleta. O efeito físico de compra incompleta fica condicionado ao preenchimento; ajuste sem diferença mantém mensagem própria. Nenhuma mudança de payload, cálculo ou validação de negócio.
- Doença, tipo de aplicação, tipo de exame e resultado de exame: reutilizam `PainelCadastro compacto`. Corrigido o flex/altura do diálogo compacto para ter cabeçalho, corpo rolável e rodapé dentro de 90dvh. Não foi criado um segundo sistema de modal.
- Motivos de baixa e catálogos sanitários: busca local insensível a acentos/caixa, vazios com orientação para limpar busca, sem ampliar consulta ou escopo autorizado.
- Recuperação e definição de senha: tokens Cooperativa existentes, sans e hierarquia tipográfica equivalente; definição de senha agora usa heading semântico. Assistente usa tokens e títulos sans. Convite em Acessos pertence ao agente principal.
- Ficha de conta: tipos bancários e de conta usam rótulos portugueses.
- Auditoria do animal: tradução apenas para resumo técnico padrão conhecido; resumo específico do servidor e eventos desconhecidos permanecem intactos. ID, autoria, datas e dados não são modificados.
- Contratos financeiro e Pecuária atualizados para refletir os comportamentos de apresentação/busca.

## Validação automatizada

`pnpm --filter rionovo-client exec tsc --noEmit` passou após todas as alterações funcionais principais.

Primeiro lote: RelatorioFinanceiroDetalhe5, NovoAnimal6, Sanidade8, AssistenteConsulta8, RecuperarSenha1 e DefinirSenha1 passaram. FormOperacao teve82/83: a falha esperava a frase antiga de compra incompleta. A asserção foi ajustada para exigir a mensagem de prévia incompleta e ausência de check no resumo.

Segundo lote: CadastrosSanitarios9 passou, incluindo nova prova de filtragem sem acento e sem consulta/gravação adicional. O teste novo de Motivos inicialmente estava sem o fixture; corrigido para usar o catálogo demonstrativo do próprio arquivo.

Terceiro lote: Cadastros29, ContasFinanceiras11 e auditoriaRotulos2 passaram. FormOperacao terminou82/83 com uma falha por timeout5s no caso de centro por item, sob carga concorrente (arquivo levou141s versus41sno primeiro lote). A expectativa alterada de prévia passou. Foi iniciado rerun isolado somente do caso que excedeu tempo; não confundir os demais resultados com aprovação desse último caso.

O rerun isolado do caso de centro por item passou em2,28s. Não foi aumentado timeout nem modificada a regra de centro de custo. Assim todos os casos do arquivo passaram entre a execução principal e o reteste direcionado, embora a execução principal tenha registrado um timeout e não seja reportada como integralmente verde.

## Evidência visual e limites

O browser in-app não ficou disponível no contexto A nesta etapa (`Browser is not available: iab`; inventário só retornava Brave/Chrome). Nenhum navegador pessoal foi aberto. O agente principal mantém browser2 funcional e fará a batelada visual conjunta. Não houve nova chamada de detector por A.

Foram inspecionadas depois as capturas novas do root em `C:/Users/mathe/.codex/visualizations/2026/10/15/impeccable-correcoes/`: recuperar-desktop.jpg confirma a superfície verde/sans; configuracoes-desktop.jpg confirma hub estável; animais-desktop.jpg mostra a abertura de linhas mais explícita; relatorios-desktop.jpg é a lista, portanto não prova ainda a correção do detalhe do relatório. Sem extrapolar a partir de uma tela diferente.

A navegação da ficha já tem sticky, margem de ancoragem e destaque da seção no CSS/JS atual. Foi preservada, sem duplicar mecanismos. Sua eficácia em scroll e mobile deve ser conferida na captura conjunta.

## Reavaliação honesta do delta

| Heurística | Delta sustentado por código/testes | O que impede atribuir 4 agora |
|---|---|---|
| Status | prévia incompleta explícita, sinal não afirmativo | confirmação real, loading/sucesso/erro pós-escrita não exercitados visualmente |
| Mundo real | tipos de conta e eventos técnicos conhecidos traduzidos | vários eventos desconhecidos preservam original; demais catálogos/conceitos exigem validação com usuários |
| Controle | mantém cancelar e confirmação de saída no compacto | escape/restauração de foco/rascunho em todos fluxos e exclusões ainda não verificados ponta a ponta |
| Consistência | recuperação/reset/assistente usam mesma família e tokens | depende da captura final e da migração de convite pelo root; não declarar uniformidade de todas variantes |
| Prevenção | remove check prematuro e explicita pendência | não altera backend nem prova todas combinações de origem, quantidade, estoque, carência, parcelas e período |
| Reconhecimento | busca local em catálogos longos, traduções na ficha | ações visuais e outros catálogos dependem do trabalho root; não testado leitor de tela |
| Eficiência | filtra sem nova request e sem perder catálogo original | busca global, fluxos coletivos e navegação teclado integral não verificados neste delta |
| Estética/economia | relatório restringe largura, breves usam diálogo compacto | mudança de2→3 é plausível mas precisa captura1440/mobile; ficha longa preservada e requer julgamento final |
| Recuperação de erros | preservadas validações e dados, empty de busca orienta | erros assíncronos, retomada e submissão real não exercitados; manter nota conservadora |
| Ajuda | prévia explica o que está pendente; sem prometer gravação | ajuda contextual e descobribilidade com usuários não medidas |

Nenhuma heurística recebe4por intenção. A nota28/40da avaliação é um snapshot anterior; não foi substituída por nota máxima depois de editar código. Falta de evidência não é automaticamente defeito, mas impede aprovação ampla.
