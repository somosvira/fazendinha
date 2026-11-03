# Leite — emissões preservadas e conferência física

Este contrato complementa [Leite V5](leite.md) e [estoque/valor da produção](leite-decisoes-estoque.md). Sua estrutura integra a baseline V5 vigente. Disponibilidade e integridade em cada ambiente dependem da aplicação efetiva e da validação correspondente; a presença do SQL no repositório não substitui essa conferência.

Novas emissões usam `LEITE_GERENCIAL_V5` e acrescentam operações comerciais por período integral, com o fechamento vigente no corte. A fonte geral por tanque/ordenha, incorporada na V4, conserva referências e versões das aferições e tanques. A fonte configurada na data impede somar controles individuais aos litros gerais. Emissões V1–V4 continuam sendo lidas pelo snapshot original, sem completar seções ou datas ausentes. O painel administrativo também distingue a cobertura de tanques da cobertura individual; não exige uma aferição por vaca nos dias gerais.

## Emissão e reabertura

`EmissaoRelatorioLeite` conserva o snapshot JSON, sítio/nome, filtros, período, instante de corte, autoria e versão de cálculo. A emissão lê as fontes em uma única transação `Serializable`; o corte identifica a emissão consistente, sem reconstruir um estado histórico que nunca foi emitido. Retentativa com a mesma chave/dados/autor devolve a mesma emissão. Outro conteúdo sob a mesma chave é conflito.

A consulta e a exportação leem exclusivamente esse snapshot. Corrigir medição, amostra, natureza, destinação, custo ou operação depois da emissão não reescreve o relatório existente. Uma nova emissão consulta as fontes atuais e recebe outro corte. UPDATE e DELETE da emissão são bloqueados no SQL.

O recorte produtivo usa os mesmos cálculos de custos/ritmo: mede litros, cobertura das células, dias sem folha, dias parciais, período e população. Filtros de animal/ordenha não transformam cobertura parcial em total conhecido. A emissão conserva as referências/versionamentos das folhas e medições. Custo por litro continua não apurado quando faltam dados ou rateio apropriado; custo direto parcial não é lucro.

Qualidade conserva as amostras individuais/coletivas válidas e seus resultados vigentes no corte, sujeitos, formato snapshot, versão e unidade de cada campo. Emissões V5 também apresentam a data da amostra, a data do resultado laboratorial e a do recebimento do laudo, quando informadas, separadas do cadastro no sistema. Ausência continua desconhecida e não recebe a data de cadastro por inferência. Vínculos comerciais usam as datas do snapshot da amostra preservado no próprio fechamento, que podem diferir da amostra vigente na seção de qualidade. Coleta sem resultado permanece explicitamente sem resultado. Não há média entre formatos, unidades ou sujeitos incompatíveis. Filtro de animal seleciona suas amostras individuais; sem esse filtro são incluídas amostras individuais e coletivas. Não há atribuição automática de uma amostra à ordenha filtrada.

Destinos, descartes, retiradas comerciais e balanço são do sítio/período, independentemente do filtro do animal produtor. Cada seção declara esse alcance. Apenas destinos/descartes confirmados com saída confirmada entram nos fatos ativos; o razão inclui originais revertidos e seus inversos para conservar abertura/fechamento. Valores de venda vêm da versão confirmada da operação, separados de custos e do volume físico. A seção documental conserva entregas e a última conferência de aceite, demonstrativos válidos e suas alocações ativas. Datas, quantidades, referência, número da venda e aceite são operacionais; preço, valor, pagamento informado e composição documental ficam exclusivamente no bloco financeiro. Cabeçalhos dos demonstrativos conservam seu período integral; parcelas e agregados são limitados às entregas do recorte. O preço faturado ponderado é a soma dos valores das parcelas dividida pela soma dos litros dessas mesmas parcelas, sem usar volume expedido ou caixa como denominador. Sem quantidade positiva/valor conhecido, o preço fica `null`. Venda e faturamento documental mantêm rótulos distintos. Não se inventa preço, recebimento ou lucro quando uma fonte está ausente.

## Permissões e arquivos

Consultar exige sessão, área Pecuária e escopo de sítio. Emitir e exportar exigem também `exportar`. A emissão produtiva funciona sem acesso financeiro. Incluir dinheiro exige área Financeiro e `verValores`; sem essa opção o snapshot não inclui custos/valores comerciais.

Os valores ficam isolados em `snapshot.valores`. A leitura e o CSV reavaliam a permissão atual: sem Financeiro/`verValores`, esse bloco é `null`, mesmo se a emissão original continha dinheiro. Ganhar a permissão depois não reconstrói valores que não foram incluídos na emissão original.

O CSV apresenta seções humanas de período/corte/cobertura, ritmo, animais, qualidade com unidade/sujeito/datas, destinos, descartes, balanço, operações comerciais por período integral e valores autorizados. Interface e CSV leem os mesmos fatos preservados e usam os mesmos rótulos de recorte e situação comercial. Preserva zero e distingue vazio/desconhecido. Texto é escapado contra fórmulas de planilha. A exportação grava uma cópia privada no R2, em chave separada por emissão e nível de acesso (`operacional`/`valores`), e entrega o conteúdo pela rota autenticada. Não fornece URL assinada reutilizável para contornar a reautorização. R2 usa a infraestrutura/runtime existentes. Impressão pela interface pode usar o mesmo DTO preservado; não há gerador próprio de PDF binário neste incremento.

Rotas sob `/api/pecuaria/rebanho/leite`:

- `POST /relatorios/emissoes`: chave, início/fim, animal/posição opcionais e `incluirValores` (padrão falso).
- `GET /relatorios/emissoes`: histórico paginado de emissões no sítio.
- `GET /relatorios/emissoes/:id`: snapshot preservado e reautorizado.
- `GET /relatorios/emissoes/:id/csv`: CSV do snapshot reautorizado.

Sítio pode ser omitido no corpo quando o resolvedor encontra o principal; o servidor conserva o escopo efetivo. Leituras consolidadas de vários sítios são recusadas. O relatório possui limites de período e quantidade de fatos para controlar memória no Worker.

## Descarte físico

`DescarteLeite` registra origem confirmada, sítio, data, litros, saldo esperado, motivo e autoria, sem destinatário. A saída é única no estoque existente, com origem `PERDA`, método leiteiro e alocação `DESCARTE` da origem selecionada. Não cria venda, operação financeira ou movimento de conta, e não presume natureza sanitária/carência a partir do motivo.

A transação revalida a origem/data, trava o produto, confere saldo esperado e usa `baixarLeiteTx`. O motor existente revalida lastro, cronologia, período aberto e conservação. Retentativa não cria outra saída. Dez litros com descarte de três conservam sete na mesma origem.

Estorno exige versão atual e motivo. `estornarBaixaLeiteTx` preserva o original e cria o inverso, respeitando períodos original/inverso e valores conhecidos ou pendentes. O fato passa à versão terminal estornada; outro reenvio com a mesma chave retorna o mesmo fato. Nenhum registro físico é apagado. SQL confere origem/sítio/data/litros/finalidade, saída única, inverso e imutabilidade.

- `POST /descartes`: chave, origem, data, quantidade, saldo esperado e motivo.
- `GET /descartes` e `GET /descartes/:id`: histórico e detalhe.
- `POST /descartes/:id/estorno`: chave, versão esperada e motivo.

Escritas exigem Pecuária/`lancar`. Consultas operacionais não expõem valores financeiros.

## Observação física e balanço

`ConferenciaSaldoLeite` é observação manual do produto/sítio/data, com litros observados (zero explícito permitido), referência, responsável e autor. Não é inventário/ajuste, não cria entrada/saída, não recalcula preço e não altera saldo econômico. Correção cria outra versão da mesma data/produto/sítio, com motivo obrigatório e versão esperada. Versões anteriores são imutáveis; exclusão também é bloqueada. A primeira versão espera zero; correções esperam a versão vigente.

- `POST /conferencias-saldo`: chave, produto, data, litros observados, referência, responsável, versão esperada e motivo de correção quando aplicável.
- `GET /conferencias-saldo`: histórico paginado, com filtros opcionais de produto/data.

O balanço separa abertura e encerramento do razão de observações reais. Por produto, a identidade é abertura + produção confirmada − vendas líquidas − fornecimento interno líquido − descarte líquido + outros movimentos = encerramento do razão. Métodos legados, outros movimentos sem explicação, saldo negativo e ausência de razão são pendências, sem certificar um saldo conhecido.

Somente a observação da data final do relatório compõe `medicaoCampo`. A versão mais recente dessa data é preservada no snapshot, e a divergência é observado menos encerramento do razão. Dez litros observados contra doze do razão geram menos dois, sem ajuste. Uma observação anterior ao início aparece em `aberturaObservada` com sua data/referência; o sistema não supõe que uma leitura antiga seja a abertura efetiva do período. Ausência continua `null`, incluindo diferença quando não há fonte comparável.

`SEM_DIVERGENCIA_NO_CORTE` significa igualdade entre as duas fontes naquele corte, sem afirmar conciliação integral. `DIVERGENTE`, `INCONCLUSIVA` e `NAO_REALIZADA` conservam suas causas; cobertura produtiva/fatos e produção medida sem confirmação permanecem separadas. O relatório não converte uma identidade aritmética do razão em medição de campo.

## Validação

Testes unitários e de serviços verificam conservação, diferença observado/razão, zero explícito, snapshot estável após correções, reenvios, escopo, máscara financeira, CSV humano, descarte único e estorno. Rotas mockadas verificam sessão/área/ações/permissão financeira. Testes estruturais verificam as garantias descritas nas migrations, sem executar SQL.

Prisma validate/generate não aplicam migrations. Execução PostgreSQL, concorrência real, escrita/leitura R2 autorizada, inspeção visual, impressão e homologação da fazenda são evidências distintas e não foram comprovadas pelos testes unitários.

## Consulta direta de produção diária e mensal

A leitura `GET /consultas-producao` usa a data operacional das folhas e suas medições, sem depender de confirmação no estoque, retirada ou fechamento comercial. Não cria tabela mensal: mês é um intervalo de dias. O componente `ConsultasProducaoLeite` oferece dia/mês, natureza, paginação e filtros próprios na URL (`producaoVisao`, `producaoData`, `natureza`), preservando os outros parâmetros.

Totais do período, ritmo e agregados por animal, ordenha e natureza são calculados antes da paginação. As linhas conservam litros medidos, estados pendentes/não ordenhados e natureza da origem confirmada quando disponível; sem essa classificação, exibem `A_CLASSIFICAR`, mantendo os litros no total. Zero exige medição explícita. Dias sem folha, sem participação e parciais continuam distintos. Mês corrente é identificado como em andamento. Consulta/exportação não incluem custos nem dados financeiros.

`GET /consultas-producao/exportacao` exige `exportar` e retorna todas as linhas do mesmo recorte, com os mesmos filtros e limite de 50 mil medições materializadas. O CSV usa esse retorno completo, incluindo linhas além da página atual, e escapa textos que possam iniciar fórmula de planilha. Este CSV é consulta atual; não substitui a emissão preservada descrita acima. Ambas as rotas exigem sessão/Pecuária e sítio: Consolidado de vários sítios é recusado e não permite escrita.

A rota está montada sob `/api/pecuaria/rebanho/leite/consultas-producao`, com acesso pela seção Produção no módulo. A leitura consolidada entre vários sítios não foi entregue neste incremento. Testes de serviço, rota e React cobrem recorte atravessando meses, medições sem confirmação, lacunas, agregados, paginação/exportação e autorização; não equivalem a SQL real ou inspeção visual.

## Coletas e vendas independentes

`GET /comercial/consultas/coletas` usa a data real do movimento da retirada, incluindo operação comercial aberta com `PRECO_PENDENTE`. Não exige Financeiro para consultar litros. `GET /comercial/consultas/vendas` usa comprador e sobreposição do período comercial das operações fechadas, com volume reconhecido e fechamento vigente; recebimento posterior não muda esse recorte. Preço/total exigem Financeiro e `verValores` no servidor, permanecendo nulos sem acesso.

Ambas as consultas usam sítio autorizado, `de`, `ate`, `parceiroId`, `pagina` e `porPagina`. A interface tem acessos diretos Coletas e Vendas, estados de carregamento/erro/vazio, paginação e filtros próprios na URL (`coletasDe/Ate/Comprador` e `vendasDe/Ate/Comprador`). O detalhe da operação aceita `operacaoLeiteId`, `operacoesDe` e `operacoesAte`. As consultas operacionais anteriores e seus históricos permanecem acessíveis; estas leituras novas cobrem a identidade `OperacaoComercialLeite` e suas retiradas/fechamentos.

## Metodologia V5 e compatibilidade

A abertura aceita explicitamente `LEITE_GERENCIAL_V1`, `LEITE_GERENCIAL_V2`, `LEITE_GERENCIAL_V3`, `LEITE_GERENCIAL_V4` e `LEITE_GERENCIAL_V5`. Lê exatamente o snapshot persistido, sem reinterpretar, recalcular ou completar uma emissão antiga. Métodos desconhecidos são recusados.

O balanço V2 reconhece `RETIRADA_LEITE` e seus inversos como retirada comercial física mesmo sem operação financeira vinculada ao movimento. O campo histórico `vendas` do balanço representa essa saída líquida; CSV e interface distinguem retirada física, venda registrada e preço não inferido. A ausência de preço não cria zero, venda ou recebimento. `dados.comercial` inclui essas retiradas com número financeiro nulo quando inexistente.

Os fornecimentos `FornecimentoNutricionalLeite` confirmados entram em `dados.destinos`, conservando suas origens/naturezas, litros, parcelas por animal e base `ATRIBUIDA`. Mistura recebe natureza `MISTA`, sem atribuir cada parcela animal a uma origem específica que não foi registrada. Isso não duplica o movimento `NUTRICAO` do balanço e não soma referência comercial ao custo produtivo. Referências gerenciais e valores desses fornecimentos não entram neste incremento da emissão.

A V5 acrescenta `dados.operacoesComerciais` e, quando autorizado na emissão, `valores.operacoesComerciais`. O recorte usa a mesma sobreposição do período comercial de Vendas: fim da operação maior ou igual ao início do filtro e início da operação menor ou igual ao fim do filtro, no sítio autorizado. Não depende da data da coleta, da data financeira ou do recebimento. Os filtros de animal/ordenha não atribuem essas operações ao produtor filtrado.

Cada operação conserva identidade, comprador, referência, período **integral**, versão/status do agregado e somente a última versão do fechamento no instante da emissão, com identidade, versão, operação financeira, número/data, volume reconhecido e status financeiro. Operação aberta apresenta `PRECO_PENDENTE`, sem receita de valor zero. Somente agregado `FECHADA` com operação financeira `CONFIRMADA` inclui preço, ajuste e valor integral no bloco protegido. Estados anulados, cancelados ou estornados são apresentados como inativos; seu fechamento preservado não entra como receita ativa. A emissão captura todas essas fontes na mesma transação; revisão posterior só aparece em nova emissão.

`parcialForaFiltro` identifica um período comercial que ultrapassa o filtro. Interface e CSV mostram “Abrange datas fora do filtro” e o intervalo integral. Volume reconhecido, preço e valor continuam os do fechamento inteiro: não há rateio diário nem afirmação de receita exclusiva dos dias filtrados. Vendas legadas usam data da retirada e demonstrativos usam alocações de entregas no período; essas competências distintas não recebem um total combinado.

A fonte legada permanece consultável. Uma operação financeira já ligada a `FechamentoOperacaoLeite` é excluída de `valores.comercial` por essa relação e pela identidade financeira capturada, evitando contar a mesma versão por `VersaoComercialVendaLeite` e pelo novo fechamento. Demonstrativo, venda e recebimento continuam referências separadas, sem somar o mesmo fato novamente. A nova seção não cria movimento físico, compromisso ou caixa; o balanço continua lendo o razão, com uma única retirada e seus inversos.

Preço negociado, ajuste e total ficam exclusivamente em `snapshot.valores`. A parte operacional não copia motivos/justificativas financeiras nem JSON arbitrário de qualidade: dos vínculos ao fechamento conserva identidade/versão da amostra e suas datas já preservadas. Perda de Financeiro/`verValores` mascara novamente o bloco na leitura/CSV, e a interface oculta valores se a permissão atual for retirada. Ganhar permissão não completa uma emissão originalmente operacional. A contagem de operações e vínculos de qualidade ocorre antes do join e participa do teto combinado de fatos; o limite dos vínculos inclui versões históricas de forma conservadora.

As referências gerenciais de Nutrição continuam fora das emissões preservadas. Consulte Nutrição para essas medidas; não equivalem a custo produtivo, receita ou recebimento.

## Entrada unificada e consultas personalizadas

Os relatórios também podem ser abertos em `/pecuaria/relatorios?tipo=leite`, preservando o sítio local da consulta em Consolidado. O gráfico inicial é leitura atual, separado da emissão preservada. Período em edição só altera essa consulta após confirmação, inclusive para leitores sem `exportar`. Histórico, inclusão de valores e CSV mantêm as permissões e snapshots deste contrato. O builder inicial oferece a fonte paginada de ordenhas e declara o alcance da exportação; as seções especializadas deste relatório não são confundidas com essa fonte. Siga a [regra de evolução do catálogo](relatorios.md#regra-para-novas-variáveis-e-relatórios).
