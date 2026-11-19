# Piloto de leilões externos

O Worker existente consulta a [agenda da Programa Leilões](https://programaleiloes.com/appportal) a cada 15 minutos quando `LEILOES_PROGRAMA_ENABLED=true`. A flag começa desligada. A migration `20261113120000_piloto_leiloes` deve estar aplicada antes de habilitar. Use o cron já configurado no Worker. Cada rodada atualiza a agenda e revisita um evento por ordem de tentativa mais antiga. O portal inclui eventos passados e futuros. A data de observação permite distinguir a agenda atual dos eventos que já saíram da listagem, preservando o histórico de eventos observados.

O piloto guarda cada evento por fonte e ID externo, o horário exibido pela fonte, links de documentos e os lotes identificáveis na seção de vídeos. Essa seção pode representar apenas parte do catálogo. O horário é mantido como informado, sem assumir fuso para eventos de outras praças. O Worker guarda a hora da tentativa e da última leitura bem-sucedida. Uma falha HTTP ou página sem horário reconhecível conserva o último catálogo. O lote é identificado pelo seu rótulo dentro do evento, inclusive sufixo e zeros publicados. Rótulos repetidos com descrições conflitantes são descartados.

O cruzamento fica disponível para inspeção operacional na view `pecuaria."VinculoLoteLeilaoAnimal"`. Ela associa registros iguais entre o catálogo e `pecuaria."RegistroGenealogicoAnimal"`. Para o piloto, a tabela de registros é preenchida por manutenção controlada, a partir do certificado ou exportação oficial, com o ID interno do animal e referência à evidência. Use o formato canônico `ABCZ:RGD:SERIE:NUMERO` ou `ABCZ:RGN:SERIE:NUMERO`. A extração do PDF lê as fichas individuais no formato verificado do catálogo Mafra, com número de lote, série, RGN ou RGD, URL do PDF e página. O Worker baixa até um PDF por rodada, com limites de 8 MiB e 150 páginas. Lotes coletivos, PDFs digitalizados sem camada de texto e outros layouts ficam fora desta versão. A extração do HTML só aceita rótulo com entidade, tipo, série e número explícitos, dentro do formato aceito pelo piloto. Nomes, brincos, SISBOV, códigos sem qualificação e registros dos pais ficam fora desse cruzamento. A própria ABCZ tem formatos de registro que exigem tratamento adicional.

O piloto é interno e consultável no banco. A exposição futura dos vínculos exige permissão de leitura pecuária e escopo do sítio na data da consulta. Sem uma tela ou destino navegável, eventos, lotes e registros do piloto ficam fora da busca global. Arremates, compras, vendas e alterações do rebanho não são gravados por este fluxo.

## Fontes avaliadas em 13/11/2026

| Fonte | Agenda e catálogo | Evidência para arremate |
| --- | --- | --- |
| [Programa Leilões](https://programaleiloes.com/appportal) | Agenda, lotes em HTML quando publicados, [PDF por evento](https://programaleiloes.com/leilao/download/25505-catalogo-do-leilao-em-pdf). Piloto lê HTML, indexa links de documentos e extrai as fichas individuais no formato Mafra. | Preço final por lote não confirmado em fonte pública. Solicitar exportação oficial. |
| [eRural](https://www.erural.net/) | Agenda e [fichas individuais com URL estável na amostra](https://www.erural.net/evento/shopping-corrego-do-meio-6f2c/lotes/1076-da-cmeio--1591). | A ficha confirma vendido em alguns casos. A página inicial mostra exemplo de preço total em shopping. Verificar se o valor final permanece publicado por lote em eventos de leilão. |
| [Connect Leilões](https://www.conectleiloes.com.br/) | Agenda e [catálogo em PDF](https://www.conectleiloes.com.br/files/arquivos/f68911fd2dad400069159aa2d23b6698.pdf). | Preço final por lote não confirmado publicamente. Solicitar exportação e amostra de evento. |
| [MF Leilões](https://www.mfleiloes.com.br/leilao/2-etapa-leilao-liquidacao-girolando-fazenda-limeira/7382) | Página com lista de lotes e fichas. | Campo de lance atual e condições. Validar se encerrados publicam preço final e situação de venda. |
| [Central Leilões](https://centralleiloes.com.br/arquivos/Catalogo_Corte%2815%29.pdf) | Catálogo público em PDF, com lotes coletivos e individuais conforme o evento. | Preço final por lote não confirmado. |
| [Remate Web](https://remateweb.com/) | Agenda e transmissão. Há eventos em comum com a Programa. | Feed público de resultado não confirmado. Tratar como segunda fonte do mesmo evento quando houver referência cruzada. |
| [EB Leilões / Estância Bahia](https://ebleiloes.com.br/home) | Agenda e páginas de eventos. Conferir cobertura dos catálogos em amostras por modalidade. | Preço final por lote não confirmado. |
| [Lance Rural](https://www.lancerural.com.br/wp-content/uploads/2023/09/cat-evolucao.pdf) | Transmissões e catálogos publicados em PDF. | Preço final por lote não confirmado. |
| [Parceria Leilões](https://www.parcerialeiloes.com.br/agenda/leiloes-realizados) | Arquivo público de eventos. Verificar anexos e ficha por evento. | Preço final por lote não confirmado. |
| [LN Leilões](https://www.lnleiloes.com.br/resultados) | Eventos e tabelas de resultados. | Médias por categoria, peso e R$/kg para referência regional. Identidade do animal não está na tabela verificada. |
| [Gralha Azul](https://gralhaazulleiloes.com.br/results) | Página pública de resultados por evento. | Validar detalhe e unidade do preço antes de integrar. |
| [Ricardo Nicolau Leilões](https://www.ricardonicolauleiloes.com.br/) | Agenda e transmissão anunciadas. | Exportação e resultado final por lote a verificar. |
| [Arroba Brasil](https://arrobabrasil.com/) | Agrega resultados publicados. | Indicador por categoria. A metodologia usa arroba de 30 kg de peso vivo. |
| [Portal DBO](https://portaldbo.com.br/jornal-de-leiloes/) | Agenda e notícias de resultados. | Indicadores e médias de mercado. Pedir acesso ao histórico estruturado se houver interesse comercial. |
| [Suporte Leilões](https://www.suporteleiloes.com.br/documentacao-api) | API documentada para instâncias de leiloeiros. | Confirmar clientes de pecuária, dados disponíveis por instância e [status dos webhooks](https://docs.suporteleiloes.com/docs/erp/comunicacao/comunicacao-webhooks/). |
| [NC Brasil](https://www.ncbrasil.com.br/sistema-de-leilao-rural) | Sistema para leiloeiros anuncia cadastro de lotes e validação de registros. | Anuncia fechamento com totais, médias e comissões. Consultar acesso por leiloeira. |

A ordem proposta para as próximas integrações é eRural, Connect e MF. Para cada fonte, validar no mesmo evento o catálogo e o resultado após o fechamento. Guardar a unidade publicada, quantidade de animais, parcelas e comissão quando disponíveis. Registrar preço confirmado somente se a fonte informar o fechamento e o valor correspondente ao lote. Eventos replicados em transmissores não devem gerar novo arremate.

A [ABCZ](https://www.abcz.org.br/noticias/noticia/23118/consulta-publica-permite-acesso-a-dados-de-4-8-milhoes-zebuinos) oferece consulta pública com cobertura dependente da disponibilização pelo criador. O [PRODUZ](https://www.abcz.org.br/produtos-e-servicos/produz/downloads/solicitacao-de-genealogia) oferece solicitação oficial dos dados do próprio rebanho. É o caminho para popular os registros locais em lote quando houver arquivo. A [Associação Girolando](https://intranet.girolando.com.br/consulta-publica) tem consulta por registro e Botton, com campos distintos. Essas fontes ajudam a confirmar identidade e genealogia. A evidência do preço vem do leilão ou do documento comercial.

## Validação do piloto

Testes unitários cobrem deduplicação de evento, leitura de lote e rejeição de registros incompletos. A leitura de HTML público da Programa foi conferida contra a agenda e um evento com lotes e PDF. A cobertura do registro no catálogo depende do formato publicado. O cadastro de registros por exportação oficial depende de uma amostra do arquivo do rebanho. No PRODUZ, o caminho é Utilitários → Importação e exportação → Exportação → Exportar genealogia PRODUZ ou Exportar para leilão. Consulte o [manual de exportação da ABCZ](https://www.abcz.org.br/common/uploads/produz/e588f1a628b9e9db103ff8b5bda43a8d.pdf).

Na amostra verificada em 13/11/2026, o HTML continha 137 eventos e a ficha de Touros Nelore Mafra trazia 86 rótulos de lotes, um link PDF e zero registros explícitos no formato do piloto. O SQL foi exercitado no banco local autorizado em transação revertida, com um vínculo exato e um lote sem registro. A execução agendada em Cloudflare fica para a homologação.

O PDF público do mesmo evento tem 110 páginas. O extrator identificou 83 fichas individuais, dos lotes 01 a 83, incluindo o RGN CAMT 11142 no lote 01, página 4. A busca por arquivo PRODUZ não identificou uma exportação do rebanho no workspace.

## Amostra eRural e entrada por compra

A flag `LEILOES_ERURAL_ENABLED` habilita uma consulta por hora da amostra pública do 1º Leilão Univida, lote 40. O piloto guarda o identificador de catálogo declarado e a URL da ficha. Nesse lote, `GSC-5144` aparece como ABCZ, mas a ficha não informa o tipo RGN/RGD. O campo usado no cruzamento exato fica nulo. A ficha pública mostra o lote como vendido, mas a ficha do lote não exibe o preço final. Valores de ofertas recomendadas pertencem a outros lotes.

A experiência de entrada automática depende de confirmação individual da compra. Para cada plataforma, a fonte preferencial é um webhook ou uma consulta autorizada à conta do comprador. Uma confirmação comercial encaminhada pelo próprio cliente também pode fornecer o lote. O catálogo completa a identidade e a genealogia depois de o documento ou evento autorizado ligar comprador, lote e compra. A proposta de entrada deve abrir para conferência do sítio, dos animais incluídos, valor e condições. A chave da compra na fonte impede avisos duplicados. Cancelamentos e correções precisam ser conciliados com a mesma compra. O piloto público ainda não recebe confirmações privadas nem cria propostas.

## Conferência simulada

Em desenvolvimento, selecione um sítio e abra Financeiro → Operações → Conferir compra de leilão simulada. O atalho exige permissão para lançar, visualizar valores e nenhum rascunho em andamento. A matriz fictícia aparece no formulário de Compra de animais. Complete fornecedor, classificação, valor e pagamento. A confirmação grava a compra e o animal pelo fluxo normal. Use um ambiente local de teste.

O atalho de demonstração fica fora da busca global. A operação e o animal confirmados usam os destinos e índices existentes. Veja a [auditoria de compatibilidade](auditoria-leiloes.md).
