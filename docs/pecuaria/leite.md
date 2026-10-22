# Produção de leite — V5 em implementação

Este contrato descreve o código desta frente V5. As migrations ainda precisam ser aplicadas e verificadas no ambiente autorizado; código e testes isolados não comprovam operação da fazenda. A reprodução V4 permanece no seu contrato e na frente paralela.

## Finalidade do animal na produção

A elegibilidade leiteira usa a `FinalidadeAnimal` vigente na data operacional, resolvida pelo intervalo `[desde, ate)`. Somente uma finalidade `LEITE` comprovada admite produção; `CORTE`, `REPRODUCAO`, lacuna ou sobreposição impedem inclusão e são apresentados como motivo ou pendência. A exceção de lactação desconhecida permanece explícita apenas quando a finalidade Leite está comprovada. A possibilidade de inclusão manual não torna uma fêmea sem lactação participante efetiva do cálculo de custos. Na extremidade encerrada por uma baixa ativa, a produção do próprio dia continua admitida somente pelo vínculo comprovado entre a baixa e a finalidade que ela fechou; a evidência registra esse motivo e o identificador da baixa. Essa regra não estende uma finalidade encerrada por mudança para Corte ou Reprodução. Localização na data, lactação, carência e papel reprodutivo continuam sendo dimensões próprias.

Folha, seleção/inclusão de animais, gravação, prévia e confirmação individual ou conjunta de estoque usam a mesma elegibilidade. Participantes guardam referência e snapshot da evidência usada. Alterações retroativas de finalidade, desfazer e ajuste de entrada são protegidos quando atingem produção registrada; rascunhos conciliáveis exigem ação explícita, motivo e auditoria. Na reinclusão após regularizar a finalidade, a evidência deve refletir o intervalo válido para aquela data, com atualização de versões; origens confirmadas continuam protegidas. Reenvio já concluído recupera o resultado idempotente. Produção e custos históricos permanecem consultáveis com pendência explícita quando não há evidência histórica única; não são filtrados pela finalidade atual.

Custos pontuais usam a finalidade na data do fato. Componentes de consumo que atravessam uma mudança de finalidade sem parcela temporal comprovada deixam o custo/L pendente, sem rateio presumido. Nutrição, custo total da ficha, referência comercial R07, qualidade, colostragem e fatos comerciais não recebem filtro genérico pela finalidade atual.

Essa compatibilização está implementada nesta branch V5. A migration `20261021190000_finalidade_producao_leite` ainda não foi aplicada nem validada por SQL no PostgreSQL; testes focados e typecheck não comprovam gatilhos, locks ou concorrência real. A revisão independente Astra foi concluída, com três achados corrigidos por Sol e revalidados; a homologação manual permanece pendente. O roteiro manual V4 e seus resultados não foram alterados nem aprovados por esta frente.

## Ordenhas e histórico

Pecuária → Leite (`/pecuaria/leite`) registra litros por animal, data operacional e posição de ordenha. A rotina inicial tem Manhã, Tarde e Noite; configurações permitem de uma a doze posições, nomes, ordem e horários opcionais. A identidade da posição é independente de seu nome/ordem. Configurações têm vigência e não reescrevem dias já registrados. `1900-01-01` é o marco técnico da configuração virtual inicial, não data de produção.

Ao salvar pela primeira vez, a folha congela a configuração e a população histórica. Presença vem da localização na data; a lactação é conferida na mesma data. Inclusão explícita sem lactação conhecida conserva a pendência; não cria parto, lactação nem dias em leite fictícios. Inclusões e exclusões posteriores exigem motivo, preservam registros anteriores e invalidam versões das sessões. Exclusão é lógica.

Cada célula tem um estado: MEDIDO exige litros, inclusive zero explícito; NÃO ORDENHADO exige motivo e não presume volume; PENDENTE significa ausência de informação. Totais somam somente medições conhecidas e informam cobertura. Uma folha parcial não comprova toda a produção do dia. Filtros por ordenha, data, busca e página permanecem na URL. O rascunho local fica separado por sítio/data e conserva a chave de reenvio após resposta perdida. A ação “Salvar animal” envia somente a célula daquele animal na ordenha selecionada; “Salvar ordenha” guarda as alterações restantes da folha. Cada linha diferencia rascunho local, falha e salvo no servidor. Salvar um animal atualiza a versão base sem apagar rascunhos ou falhas dos demais; reabrir recupera os dados persistidos e o rascunho local ainda pendente. Versão vencida é recusada pelo servidor, sem sobrescrita silenciosa entre abas.

`DiaProducaoLeite`, `SessaoOrdenha`, `ParticipanteProducaoLeite` e `MedicaoLeite` preservam snapshots, versões e vínculos históricos. Alterações retroativas de localização, baixa ou lactação que invalidariam fatos são recusadas. Uma localização referenciada não pode ser apagada, mesmo após exclusão lógica do participante. Não remover FKs para contornar essa preservação.

## Produção, estoque e retirada

Salvar medições não movimenta estoque. Na conferência, prepare grupos de medições inteiras e confirme a sessão em uma única ação. O comando `POST /estoque/confirmacoes-sessao` exige distribuir todas as medições positivas ainda livres e executa os grupos na mesma transação `Serializable`; falha de um grupo aborta o comando inteiro. A chave da sessão e as chaves dos grupos preservam retries, autoria e payload. O caminho anterior de confirmação individual permanece compatível. Confirmar um grupo seleciona medições inteiras de animais na mesma sessão e gera uma origem física em um produto ativo em litros sem rastreio por partida, no estoque comum. A natureza comercial, colostro ou não comercial é explícita por grupo. Uma sessão admite vários grupos separados; o vínculo ativo de cada medição é único entre todos os produtos. A origem conserva versão, quantidade, autoria e snapshot das medições. Produção parcial exige justificativa e inclui somente litros conhecidos. Após o primeiro grupo, a sessão fica congelada para edição, mas permite confirmar medições restantes. Corrigir os litros exige regularizar todos os grupos ativos; anular um grupo conserva seu histórico e libera somente suas medições, sem afetar os demais. Outras ordenhas do dia continuam editáveis.

O usuário escolheu registrar volume e apurar custo depois. Custo pendente é `null`, não zero. A apuração documentada tem referência, evidência, motivo, autoria e versão; apropria o valor entre saídas já existentes e saldo sem repetir quantidade, despesa ou caixa. O cálculo gerencial por litro não valoriza o estoque automaticamente. Consulte o [contrato da integração de estoque](leite-decisoes-estoque.md).

No fluxo de venda imediata, o preço definitivo já é conhecido na retirada. Para acumular retiradas com preço pendente, use a operação por comprador/período descrita em [comercial do leite](leite-comercial.md). A venda imediata usa o motor financeiro existente: uma baixa física e uma operação VENDA, com recebimento agora ou compromisso a receber. Recebimentos posteriores e parciais seguem o Financeiro; faturar ou receber não baixa novamente os litros.

A correção comercial cria uma versão substituta da operação e conserva a retirada original, produto, litros e data. Exige motivo, versão esperada e condição financeira explícita; cancela os compromissos anteriores e cria os substitutos na mesma transação, sem outra baixa. Recebimentos confirmados precisam ser regularizados explicitamente no Financeiro antes da correção. Produto, categoria e centro históricos inativos permanecem válidos quando preservados; novas referências exigem cadastro ativo. O estorno genérico permanece bloqueado: cancelar preço não comprova retorno físico ao tanque.

O saldo físico só é apresentado como conhecido quando concilia as origens e o razão. Ausência de produção confirmada não comprova saldo zero. Novas confirmações exigem natureza explícita; entradas históricas podem ter natureza não informada e exigem declaração antes da venda. Colostro e leite não comercial restringem a entrada inteira e não podem ser reclassificados como comerciais neste incremento. Classificações são imutáveis, versionadas, com motivo/autoria; cada alocação conserva finalidade e classificação vigentes.

O saldo comercial é separado do físico. Uma origem positiva sem natureza declarada deixa a disponibilidade comercial e a meta não aferíveis; custo pendente não é impedimento comercial. A separação é feita antes da entrada, selecionando os animais de cada grupo. Não há fracionamento de uma medição individual entre naturezas nem segregação retrospectiva de uma entrada misturada: uma origem declarada colostro/não comercial mantém todo seu remanescente restrito. A declaração registra a informação dos responsáveis, sem certificar aptidão sanitária. A confirmação conserva no snapshot a versão da classificação para venda, a data operacional, o horário conhecido da ordenha e as aplicações consideradas por animal. Carência ativa, prazo ausente ou administração em revisão impedem declarar o grupo comercial. Se falta o horário exato, o intervalo conservador precisa demonstrar o fim da carência; o dia limítrofe não presume liberação. Colostro mantém sua natureza mesmo quando há carência comercial. Nova informação sanitária retroativa exige regularização antes de nova venda, sem reescrever saídas ou classificações já registradas. Esta conferência trata da venda; os destinos internos seguem a decisão específica de uso do leite não comercial disponível.

## Entregas e demonstrativos

Pecuária → Leite → Entregas e demonstrativos registra ponto de coleta, horário opcional, referência e conferência dos volumes expedido e aceito. Aceite desconhecido permanece nulo; rejeição, divergência e destinação posterior têm motivo e histórico. Nenhuma conferência devolve leite ao tanque, gera descarte ou confirma dinheiro por suposição.

A entrega pode criar uma VENDA na mesma transação ou vincular uma venda leiteira já comprovada, sem repetir a saída nem a obrigação. Históricos V1 sem lastro exibem impedimento e exigem reconciliação específica. O demonstrativo reúne entregas e parcelas explícitas de litros/valor, com versões e limites concorrentes por entrega/venda. Registra preço-base, bônus, desconto, retenção e adiantamento documentados, sem calcular políticas presumidas ou gerar outra operação. Correções dependentes exigem regularização dos demonstrativos ativos. Compradores históricos inativos permanecem consultáveis para conciliação.

Comprovantes usam upload privado R2 vinculado à entrega, com autorização e reenvio protegidos. Consulte o [contrato comercial](leite-comercial.md) para estados, saldos de faturamento, composição e anulação.

## Programação de retirada

A programação é versionada por sítio e vigência. Há quatro alternativas exclusivas: diária, semanal, dias da semana escolhidos ou meta de litros de um produto explícito. Mudanças entram em vigência a partir de hoje e depois da última versão. A previsão dos próximos quatorze dias considera a versão vigente em cada data.

Meta é conferência de saldo disponível atual, nunca produção acumulada. Datas passadas/futuras ou saldo sem lastro ficam não aferíveis. Custo pendente não transforma volume conhecido em desconhecido. A previsão não confirma retirada, venda, recebimento nem cria alertas persistentes; retirada parcial altera a próxima consulta ao saldo.

## Leite na dieta e referência gerencial

A conferência de Nutrição reutiliza a receita publicada, vigência, previsão por cabeça/dia e participantes do lote. O ingrediente em litros precisa ter origem histórica de produção V5 no sítio para usar o adaptador leiteiro; um produto genérico em L não basta. Na prévia, o usuário confere e seleciona as origens disponíveis, inclusive produtos distintos confirmados na produção. Na confirmação, leite `NAO_COMERCIAL` disponível tem prioridade e o comercial complementa, em FIFO dentro de cada natureza. Sessões confirmadas e disponibilidade comprovada são necessárias; colostro conserva o fluxo V4 e leite fisicamente descartado não está disponível.

Um consumo de 60 L pode usar 40 L não comerciais e 20 L comerciais, com movimentos por origem/produto na mesma transação do fechamento. O item não recebe uma segunda baixa genérica. A previsão de 60 L não autoriza fornecer 60 quando só existem 50: o usuário informa o consumo efetivo e justifica a diferença. Falta de custo não impede volume comprovado. `FornecimentoNutricionalLeite` liga o item da dieta às saídas e às parcelas por animal, atribuídas proporcionalmente aos dias no lote, com resíduos conservados em mililitros; atribuição não significa ingestão individual medida. O estorno do fechamento recompõe as origens exatas uma vez, mantém o histórico e não altera colostragem independente. O comando coletivo usa chave idempotente e divisão por mês/vigência; o comando individual leiteiro também exige chave. Leituras do detalhe e dos fechamentos usam snapshot `RepeatableRead`.

Preço comercial de referência é uma medida gerencial separada do custo de produção. Ambas as naturezas usam a mesma referência escolhida. Ao confirmar a dieta, um único fechamento comercial vigente e comprovado do mês anterior pode criar referência provisória; ausência ou multiplicidade de fontes mantém pendência, sem média presumida nem zero fictício. Nos detalhes do consumo, quem tem permissão financeira para valores e lançamento pode selecionar explicitamente um fechamento do mês do consumo ou do mês anterior e confirmar referência/revisão com motivo e versão esperada. O período do consumo e o período atual precisam estar abertos para revisar. Fechamentos retificados deixam de ser fonte válida para novos comandos; snapshots anteriores permanecem identificados por fechamento/versão.

A revisão grava nova `ReferenciaGerencialLeite`, com preço, comprador, período, autor, motivo e versão. Não altera litros, movimentos, custo produtivo, compras, receita ou caixa. Para 60 L, referência R$ 2,50/L mostra R$ 150; revisão para R$ 2,70/L mostra R$ 162, mantendo, por exemplo, R$ 84 de custo produtivo. O resumo do lote exibe a referência separadamente dos custos: nunca soma esses valores como R$ 234 ou R$ 246 de gasto da fazenda. Preços, totais referenciais, valores por animal e justificativas comerciais são mascarados sem a permissão financeira `verValores`; a leitura dos custos operacionais conserva a política pecuária existente.

As migrations aditivas incluem vínculos e verificações de conservação, imutabilidade e observação do estoque/fechamento. A implementação e os testes sem banco não comprovam execução desses gatilhos ou concorrência SQL real; aplicação e testes com o PostgreSQL autorizado, CI e homologação operacional continuam gates independentes.

## Destinos internos

O destino registra origem confirmada, natureza declarada, data, responsável e quantidades explícitas por animal. A soma servida gera uma saída única; o restante permanece na origem. Dez litros, com parcelas de três e quatro, deixam três. Não há divisão igual presumida, reserva do restante ou segunda baixa por descarte.

Colostro exige cria de parto já registrada e cria ou vincula um `FornecimentoColostro` compatível, sem duplicá-lo. Leite comum/não comercial não cria fornecimento de colostro. Vínculos ativos impedem alterar quantidade/data/anulação do fornecimento independentemente do destino; qualidade e observações seguem o contrato V4. O estorno conserva o fato e suas parcelas, devolve a quantidade pelo movimento inverso e anula apenas fornecimentos criados pelo próprio destino.

Saldos antes/depois são snapshots do ato. Após estorno, o saldo atual vem da consulta de origens; não se reescreve o snapshot anterior. Colostro e leite não comercial declaram a origem inteira restrita antes da saída no mesmo fluxo atômico, inclusive seu remanescente. O estorno não reabilita a natureza comercial. Declarar natureza registra a prática relatada e não é uma prescrição ou certificação de uso do leite.

O descarte físico tem registro próprio, origem e quantidade explícitas, com uma única saída PERDA. Alimentação interna não é lançada novamente como descarte. A regularização por erro preserva o original e gera o inverso, respeitando períodos e vínculos. Leite efetivamente descartado não retorna fisicamente por uma alteração documental.

## Histórico individual e contexto sanitário

A Visão geral da ficha das fêmeas apresenta o histórico produtivo por período, ordenha, lactação e DEL conhecido, reutilizando as medições originais. DEL segue a convenção D0 existente; lactação ausente permanece desconhecida. Participações excluídas são identificadas e ficam fora dos totais. Dias sem registro não viram produção zero.

A carência do leite e as revisões sanitárias usam a fonte comum na data de referência. O histórico de um animal fora do sítio atual não expõe aplicações de outro sítio. Contexto desconhecido/em revisão não certifica leite apto e não cria descarte, destino ou bloqueio clínico automático.

## Qualidade e laudos

Pecuária → Leite → Qualidade permite configurar campos e unidades manualmente a partir do laudo. Não há unidades, limites comerciais ou diagnósticos presumidos do IDEAGRI. O [mapa de referência](leite-ideagri-referencia.md) mantém as lacunas do mapeamento automático identificadas.

`FormatoQualidadeLeite` identifica versões de `TipoExame` do núcleo comum, com resultados estruturados. Cada coleta conserva assinatura e snapshot do formato; versão usada não pode mudar os campos/unidades. Alterar exige nova versão. Inativação impede novas coletas, preservando leituras históricas. Os formatos de qualidade têm fluxo próprio; o endpoint sanitário genérico não contorna suas garantias.

Uma amostra individual usa `ExameAnimal`, validando o animal e o sítio na data. Uma coletiva tem identificação explícita da origem/tanque e não cria animal fictício. Pode vincular uma origem confirmada do estoque quando o laudo comprovar a relação, inclusive depois de consumida; o servidor confere sítio e cronologia. O nome do tanque é identificação documentada, não cadastro/inferência de volume físico. Coleta, resultado e destino do leite são fatos distintos.

Coleta sem resultados permanece aguardando laudo, sem converter ausência em zero ou negativo. Campos admitem texto, número, opção e sim/não; zero e falso são preservados. Correção/anulação exige motivo e versão esperada, conserva resultados anteriores e autoria, e usa o formato original. Alterar uma análise não movimenta estoque, dinheiro nem gera descarte ou liberação sanitária automaticamente.

Laudos privados usam R2 pelo padrão de upload direto existente, com limite de 10 MB, assinatura do conteúdo e confirmação vinculada à amostra, sítio e autor. Reenvio do mesmo conteúdo não duplica o anexo. Downloads exigem autorização e conferência do vínculo; não há URL pública permanente. Upload/download real no R2 continua dependendo da validação integrada do ambiente.

## Custos no período

`GET /api/pecuaria/rebanho/leite/custos` exige sítio e período de até 366 dias e 50 mil células; recortes maiores exigem reduzir o período para não materializar volume excessivo no Worker. Reutiliza componentes originais de nutrição, sanidade e reprodução, deduplicados por origem. Custos e litros usam os mesmos animais e período. Consolidado é soma dos custos dividida pela soma dos litros, não média dos custos individuais por litro. R$ 900 / 600 L = R$ 1,50/L.

Dias sem folha, células pendentes, custos desconhecidos, intervalos nutricionais sem rateio e denominador sem volume positivo mantêm o custo por litro não apurado. Filtrar uma ordenha não autoriza atribuir a ela todo o custo diário. O relatório separa cobertura das células informadas de cobertura de todo o calendário. Custos sem componentes não são zero comprovado.

O ritmo diário usa as mesmas folhas e distingue dia sem folha, folha parcial e folha completa. A exportação CSV exige a ação `exportar` no servidor e conserva a máscara financeira e as lacunas do recorte reconsultado. Essa consulta viva fica separada das emissões preservadas descritas abaixo.

## Balanço, conferência física e emissões

A conferência física registra produto, sítio, data, litros observados, referência e responsável. Zero precisa ser informado explicitamente. Correção cria outra versão com motivo; não modifica os movimentos de estoque. O relatório distingue abertura/encerramento calculados do razão de observações físicas documentadas. Medição de 10 L diante de razão de 12 L mostra diferença de −2 L, sem ajuste automático. Medição antiga não se torna abertura atual por suposição.

Relatórios preservados guardam fontes, filtros, unidades, cobertura, corte e versão do cálculo. Reabrir ou exportar usa o snapshot emitido; correções posteriores só aparecem em nova emissão. Valores são novamente mascarados conforme a permissão atual. Produção, qualidade, destinos, descartes, diferenças e composição comercial têm seus alcances explícitos. Preço faturado usa valor e litros das mesmas parcelas documentais ativas, separado do preço vendido e do recebimento.

O painel administrativo apresenta litros medidos e cobertura por dia/sítio, com ligação ao período detalhado. Uma fazenda sem folhas não recebe produção zero presumida; mudanças de rotina permanecem identificadas. Consulte o [contrato de relatórios e conferência](leite-relatorios.md).

## Prévia histórica

Conferência histórica recebe o arquivo de preparação com brinco literal, data, ordenha, estado, litros e identificador de origem, além da referência que comprova a unidade L. A prévia compara localização/lactação e rotina na data, preserva zeros à esquerda do brinco e aponta duplicidades, fatos já existentes e conflitos. Não sobrescreve medições, não cria estoque retroativo e não grava venda ou dinheiro. O retorno identifica movimentos e versões comerciais já existentes para conciliação.

A assinatura identifica o conteúdo recebido; não certifica a fonte nem executa a carga. A preparação e execução da importação real dependem dos registros dos funcionários e da aprovação de seu mapa/corte/reconciliação. O arquivo original e o responsável indicado na fonte precisam ser preservados, sem inventar funcionários ou datas ausentes.

## Autorização e validação

As rotas exigem sessão e área Pecuária; escritas operacionais exigem `lancar`. Emissões e exportações exigem `exportar`; incluir dinheiro também exige acesso financeiro com `verValores`. Venda e apuração monetária também exigem área Financeiro e `verValores`. Consultas de estoque/custos mascaram dinheiro no servidor. Confirmação física não devolve hashes, snapshots internos ou valores financeiros. Sítio é resolvido no servidor e fatos são conferidos nesse escopo.

Testes automatizados cobrem cálculos, contratos HTTP, permissões, versões, reenvio e fluxos de serviço com dependências controladas. SQL aplicado, concorrência no PostgreSQL, integração com dados existentes, CI remoto, operação em produção e homologação real são evidências distintas e continuam pendentes até execução registrada. A inspeção visual usa os componentes reais com dados ilustrativos, sem conexão com o banco.

O [roteiro de homologação V5 da finalidade](artefatos/homologacao-v5-finalidade.md) lista as conferências manuais; todos os casos começam pendentes. Não foi executado nesta revisão documental e não altera as marcações dos roteiros V3/V4.

## Entregas ainda abertas

- O mapeamento automático de qualidade do IDEAGRI depende de comprovar unidades e vínculos coletivos; o cadastro manual a partir do laudo já tem contrato próprio.
- Carga desde outubro: a prévia de conferência está implementada, mas faltam registros reais, unidade comprovada, sítio/ano/fim do lote e reconciliação com estoque/vendas anteriores. O executor da carga real será definido contra esse lote conferido; não há importação automática neste incremento. Importar medições antigas não pode aumentar saldo de leite já vendido.
- Aplicar e verificar migrations aditivas no ambiente autorizado, revisar fixtures antes de integração e homologar com a fazenda. Preservar exclusivamente `fazendinha_seedatev3` no desenvolvimento, sem reset, clonagem ou nova carga.

As pendências operacionais acima permanecem separadas da implementação e da inspeção visual. Este contrato e os contratos específicos de estoque, qualidade e comercial descrevem o comportamento vigente na branch.


### Compatibilidade com o resumo nutricional

A visão geral e a ficha do lote usam o resumo agregado no servidor (`GET /nutricao/resumo`), sem baixar todos os fechamentos para o navegador. O custo produtivo do leite acompanha a última apropriação de cada origem; uma parcela ainda sem valor mantém o fornecimento não apurado. Referências comerciais são agregadas separadamente pela versão vigente, com volume, pendências e caráter provisório; exigem permissão financeira de valores e nunca entram na soma do custo produtivo. Fechamentos estornados não integram os totais atuais. A listagem mantém os filtros de período/situação da main e a consulta por animal distingue a identidade do fechamento da participação.

## Interface de produção

A V5 usa o tema Cooperativa da main: cores e controles compartilhados, títulos Manrope, superfícies brancas e tabelas operacionais. A navegação apresenta Ordenhas, Produção, Estoque, Coletas, Qualidade e Vendas. “Mais rotinas” conserva Operações de venda, Entregas e demonstrativos, Alimentação e descarte, Programação de retirada, Ritmo e custos, Relatórios preservados e Conferência histórica. Os valores existentes de `leiteSecao`, filtros e links diretos permanecem válidos; o menu identifica a rotina secundária selecionada e aceita teclado.

Ordenhas reúne sessões configuradas, medições por animal, resumo dos litros conhecidos e cobertura. Configurar ordenhas fica no cabeçalho e continua bloqueado enquanto existem alterações locais. No celular, medições, produção e consultas comerciais se reorganizam em linhas/cartões com os mesmos campos, rótulos e ações; tabelas auxiliares extensas conservam rolagem local. A configuração mantém de uma a doze ordenhas, sem limitar o domínio às três demonstradas no mockup.

O mockup aprovado orienta a apresentação, sem acrescentar ações simuladas: salvar medições continua separado da confirmação física em Estoque; controles por animal, justificativas e estados de persistência continuam visíveis. A [referência visual](../design/leite/previa-main/README.md) e a [verificação da implementação](../design/leite/implementacao-main/README.md) distinguem ilustração, inspeção com fixtures e homologação real.
