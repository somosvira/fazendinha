# Assistente financeiro — primeira versão

## Escopo implementado

O assistente web em `/ia` recebe texto ou áudio para consultas financeiras. Está disponível no menu Financeiro e pelo botão “Perguntar ao financeiro”. O botão abre a mesma tela; a antiga tela demonstrativa e o chat paralelo foram substituídos. WhatsApp continua bloqueado, independentemente das credenciais.

Perguntas suportadas: entradas e saídas de caixa, resultado de caixa, maiores saídas por categoria, saídas de uma categoria identificada, saldo atual das contas e saldo pendente a pagar/receber. É possível comparar dois períodos de caixa e continuar uma pergunta (“e no mês passado?”). Categoria ambígua pede o nome exato; categoria inexistente não vira consulta geral. Produtos, fornecedores, centros de custo como filtros, custos por animal, lucro contábil, previsão e alterações de registros ficam fora deste piloto.

## Regras de resposta

- Caixa reutiliza `obterDashboard`/`movimentoRealizado`: inclui aportes/retiradas, exclui transferências entre contas próprias e abate estornos na data do evento. A resposta declara essas regras e distingue resultado de caixa de lucro. “Quanto gastei?” usa saídas de caixa, sem prometer apuração de custo/competência.
- Categorias usam o rateio financeiro vigente. O filtro de categoria reutiliza `analisarCategorias` na base pagamentos; o total cobre todas as linhas do recorte. Rankings mostram até dez categorias e avisam quando há outras.
- Pendências reutilizam `listarCompromissos`: saldo atual restante, descontadas liquidações válidas. O período se refere ao vencimento, não ao saldo pendente que existia no passado. Sem período, inclui todos os vencimentos. Não há comparação histórica de pendências.
- Saldo de contas reutiliza `resumoSaldos`: abertura mais movimentos; apenas contas ativas incluídas no saldo geral compõem o total. Saldo é atual; o piloto não aceita saldo histórico.
- Período omitido para caixa: primeiro dia do mês até hoje em `America/Sao_Paulo`. Datas precisam existir no calendário, e cada intervalo aceita até 731 dias. Recortes com mais de 20 mil movimentos/compromissos são recusados, sem somar amostra parcial. Comparações apresentam os dois intervalos e avisam sobre mês corrente; não inferem causa econômica das diferenças.
- O sítio vem do resolvedor de escopo do servidor. O usuário troca o sítio no seletor do app; o modelo não escolhe propriedade. Uma consulta anterior de outro sítio é descartada. Não há ACL de sítios por usuário no cadastro atual.
- Os links são montados pelo servidor. A visão geral abre o período correspondente; pendências abrem o tipo e vencimentos; operações de uma categoria podem ser abertas individualmente. O link geral do Financeiro não promete aplicar filtro de categoria.

## Acesso e memória

Todas as rotas `/api/bot/*`, inclusive status e transcrição, exigem sessão de uma conta pessoal (`id > 0`), área Financeiro e `verValores`, `verSalarios` e `verInvestimento`, ou dono. A ponte `SHARED_ACCESS_TOKEN` não habilita o assistente. Não são alterados presets ou permissões persistidas: o perfil “gestor” atual, sem `verSalarios`, precisa de autorização individual do proprietário para consultar totais integrais nesta versão. A tela explica o acesso necessário quando recebe 403.

Esse gate evita que totais revelem dados que o usuário não pode ver. Não depende do mascaramento incompleto das rotas financeiras antigas. Não há filtragem parcial de salários/investimentos no piloto.

A conversa existe apenas na memória da tela. Sair de `/ia`, trocar usuário/sítio ou iniciar nova conversa descarta mensagens/contexto e cancela requests locais. O contexto enviado contém só parâmetros da última consulta, validados novamente; não contém resultados anteriores nem concede acesso. Não são usadas as tabelas legadas de conversa WhatsApp. Não há migration nesta entrega.

## OpenAI e áudio

O SDK OpenAI continua sendo a integração. `OPENAI_MODEL` (padrão `gpt-4o`) interpreta a pergunta em uma única chamada de ferramenta estrita. O servidor valida a estrutura e executa serviços financeiros; texto e valores finais são montados deterministicamente, sem uma segunda chamada para narrar. Os registros e totais financeiros não são enviados ao modelo; pergunta e parâmetros de contexto são enviados para interpretação.

O navegador grava até um minuto com MediaRecorder, ou recebe um arquivo de áudio. A transcrição é enviada à OpenAI em português; `OPENAI_TRANSCRIPTION_MODEL` tem padrão `gpt-4o-mini-transcribe`. O usuário confere/edita o texto e toca em “Perguntar”. Não há reprodução de voz nesta versão. Limite de arquivo: 10 MB; formatos aceitos: WebM, MP3, MP4/M4A, OGG e WAV. Gravação exige HTTPS ou localhost, suporte do navegador e permissão de microfone. Arquivo vazio, excessivo ou de outro formato é recusado.

O áudio não é persistido no Fazendinha nem enviado ao R2. As chamadas ao provedor têm timeout de 45 segundos e nenhum retry automático. Falhas mostram mensagem recuperável; não retornam mocks. Cancelar a interface interrompe o request local, mas não garante cancelamento de uma chamada já recebida pelo provedor.

Referências de implementação: [transcrição](https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create) e [saída estruturada](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=chat).

## Operação

Configure `OPENAI_API_KEY` no ambiente do servidor, nunca no cliente. Os exemplos de modelos estão em `server/.env.example`; no Worker, use os secrets/variáveis existentes conforme `DEPLOY.md`. Sem chave, `/bot/status` indica indisponibilidade e a tela orienta procurar o responsável. A presença da chave não comprova saldo, acesso aos modelos ou validade da credencial.

`ASSISTENTE_ATIVO` nos dois lados controla apenas o assistente web. O bloqueio de WhatsApp permanece separado em `app.ts`. Publicação e configuração de produção não são efeitos desta mudança local.

## Validação

Os testes próximos ao código cobrem datas/fuso, contexto entre sítios, interpretação estruturada simulada, cálculos reais dos serviços com fixtures em memória, pagamentos parciais, estornos, transferências, saldos, categorias ambíguas, limites, autorização e transcrição simulada. Testes de interface cobrem envio, continuidade, revisão do áudio, indisponibilidade e descarte de respostas antigas.

`pnpm --filter rionovo-server run assistente:conferir` faz conciliação somente de leitura em `fazendinha_seedatev3`, sem OpenAI e sem criar fixtures. Compara caixa do mês da última transação e pendências de todos os vencimentos contra SQL independente. Não recria banco, não executa seed e não altera manifesto. A bateria anterior, dependente de `Lancamento`, foi retirada.

Para validar o modelo de verdade, configure a chave e exercite perguntas financeiras, correção da transcrição, continuação e comparação. Confira os períodos e valores nas telas e no gabarito. Testes simulados e conciliação SQL não homologam reconhecimento de fala ou interpretação real. Homologação do gerente deve verificar se ele consegue gravar, corrigir e entender a resposta sem ajuda; não está implícita nos testes automatizados.
