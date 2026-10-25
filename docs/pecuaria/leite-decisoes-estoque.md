# Leite V5 — estoque e valor da produção

Contrato da integração entre produção de leite e estoque, conforme as decisões confirmadas para a V5. Disponibilidade em cada ambiente depende da aplicação das migrations; este documento não autoriza aplicação, carga ou deploy.

## Decisões vigentes

- **K1-B escolhido:** a ordenha confirmada entra no estoque único com custo pendente. Consumos e vendas podem ocorrer antes da apuração. Valor ausente é `null`; zero exige comprovação documental.
- **Venda imediata:** quando o preço definitivo é conhecido na retirada, cria uma operação `VENDA` com uma única saída física. A operação por comprador/período também admite retiradas antes da negociação final, conforme [comercial do leite](leite-comercial.md); seu fechamento não baixa os litros novamente.
- A produção é um fato próprio `EntradaProducaoLeite`, vinculado à sessão e ao `MovimentoEstoque` de origem `PRODUCAO`. Não cria uma operação financeira de valor fictício, compra, compromisso, receita, pagamento ou movimento de conta.
- A apuração posterior recebe valor total documentado, referência, evidência e motivo. Não deriva automaticamente valor de estoque de um preço de venda ou de um indicador parcial de custo/L. A cobertura da apuração deve estar explicada na evidência.

## Fonte física e confirmação

A fonte física é definida na configuração vigente: `MedicaoLeite` para produção individual; parcelas `MedicaoGeralLeite` de `SessaoOrdenha` para produção geral. Na data geral, os controles individuais acompanham o animal e não geram outra entrada. Guardar parcelas não movimenta estoque. Cada parcela identifica tanque/versionamento ou recipiente livre segregado; litros e régua são informados manualmente e somente litros compõem a quantidade. A capacidade é validada somente para tanque cadastrado. Naturezas diferentes não podem ser obtidas por rateio de leite já misturado; cada recipiente aparece uma única vez na sessão.

`POST /geral/parcelas/confirmacoes` confirma o conjunto selecionado em uma transação `Serializable`, com chave do conjunto e chave, versão, produto e motivo próprios de cada parcela. Cada parcela positiva inteira gera uma entrada separada; zero é preservado na aferição, sem criar entrada. Falha de uma recusa todo o conjunto; reenvio idêntico recupera o resultado sem duplicar origens. Chaves de reenvio são reservadas antes das travas ordenadas de animais, sessão e produtos. `POST /geral/confirmacoes` permanece adaptador individual do mesmo núcleo. O índice parcial continua impedindo duas entradas ativas da mesma parcela.

A origem conserva recipiente/tanque/versão, régua/litros, natureza, animais e declarações no snapshot. A comercial exige animais identificados e carências conferidas, sem litros individuais. Descarte e Colostro podem usar registro direto justificado com origens desconhecidas (`animaisOrigem=[]`), mantendo custo/população pendentes, sem fabricar carência ou parto e sem liberar venda. Regra de colostro, fronteiras civis, declaração da primeira ordenha, deduplicação por parto/animal e histórico sem regra estão no [contrato de produção](leite.md#contexto-colostro-e-registro-direto).

Uma parcela confirmada não pode ser corrigida antes de regularizar a entrada e seus consumidores. A anulação conserva o histórico e permite nova confirmação após regularização. Acrescentar outra parcela em recipiente distinto não reabre as confirmadas. A classificação vigente orienta a consulta, mantendo a natureza originalmente aferida no histórico.

Na fonte individual, `MedicaoLeite` continua sendo a fonte dos litros por animal/ordenha. O estoque usa o mesmo `MovimentoEstoque` compartilhado com os demais domínios. `EntradaProducaoLeite` conserva a sessão/versão confirmadas e o snapshot das medições/cobertura; não é outro saldo físico.

A confirmação é explícita **por grupo de medições inteiras da mesma sessão**, permitindo retirar a produção da manhã antes da noite e separar fisicamente comercial, colostro e não comercial na mesma ordenha. O pedido seleciona `medicaoIds` e declara `natureza` e `motivoNatureza`; cada medição selecionada precisa estar `MEDIDO` com litros positivos. Não há fracionamento dos litros de uma medição. `PENDENTE` não vira zero e `NAO_ORDENHADO` não cria volume. Cobertura incompleta da sessão exige motivo; nenhum grupo vazio ou sem litros positivos gera entrada. Mesma chave/dados/autor devolve o fato original; a ordem dos IDs selecionados é normalizada antes do hash. Mudança dos dados sob a mesma chave dá conflito. A transação revalida sítio, versão, produto, período, cronologia e confirmação prévia sob trava.

A interface prepara os grupos e os confirma juntos em `confirmarSessaoProducaoLeite` (`POST /estoque/confirmacoes-sessao`). O comando contém a versão da sessão, chave própria e grupos com produto, medições, natureza, justificativa e chave por grupo. Todas as medições positivas ainda sem origem precisam aparecer uma única vez. A mesma transação `Serializable` executa e audita todos os grupos; não há transações independentes por grupo. A identidade idempotente da sessão registra o resultado público somente após os grupos concluírem. O endpoint individual anterior continua disponível para compatibilidade.

A classificação para venda conserva em `EntradaProducaoLeite.snapshot.carencia` a versão da regra, data/horário de referência, estado de cada animal e evidência das aplicações consideradas. Sem instante exato, a conferência usa o intervalo conservador e não presume liberação no dia limítrofe. Prazo ausente, administração em revisão ou carência ativa impedem declarar `COMERCIAL`; não convertem colostro em outra natureza. Novas vendas revalidam a carência na data da produção: informação retroativa conflitante exige regularização, preservando saídas anteriores. A regra é comercial; a destinação do leite não comercial disponível segue seu contrato próprio.

Na fonte individual, após a primeira entrada confirmada, a sessão permanece congelada para edição enquanto houver qualquer entrada ativa. É possível confirmar outros grupos de medições ainda livres da mesma sessão, com a mesma versão congelada. Uma medição não pode estar ativa em duas origens, mesmo se os produtos forem diferentes. Outras sessões mantêm suas versões e podem continuar sendo preenchidas. Alterar a população diária exige regularizar as sessões confirmadas afetadas. Essas regras existem no serviço e em triggers SQL para medição, população e identidade da sessão.

Na fonte geral, a aferição confirmada fica protegida para edição; a identidade da sessão é preservada, mas medições e população do controle individual podem ser registradas sem alterar o estoque geral.

A primeira implementação usa **produto ativo em litros, sem rastreio por partida**, dedicado ao percurso leiteiro. As origens são as ordenhas; alocações preservam o vínculo aos animais pelo snapshot. Produto com histórico de outro método exige conciliação própria, sem reaproveitar inventário/preço fictício ou alterar o rastreio para contornar validações. Transferências e ajustes genéricos não substituem essa regularização.

## Natureza da entrada inteira e elegibilidade comercial

Cada confirmação conserva o marco inicial `ClassificacaoEntradaLeite` `NAO_INFORMADA` e, na mesma transação, registra a declaração explícita obrigatória do grupo como `COMERCIAL`, `COLOSTRO` ou `NAO_COMERCIAL`, com motivo e autor. O grupo fica integralmente declarado antes do commit. A interface própria de classificação mantém versão esperada e chave de reenvio para declarações posteriores permitidas. O registro é append-only: alterações/exclusões são bloqueadas. `COLOSTRO` e `NAO_COMERCIAL` são terminais neste incremento; não há desbloqueio nem mudança para outra classe restrita. Declarar novamente a mesma classe conserva o evento existente, sem duplicá-lo.

A classificação abrange **todos os litros daquela entrada e seu remanescente**, independentemente de quantos já foram servidos aos bezerros. Um destino de colostro ou leite não comercial registra a restrição na mesma transação da saída interna. O estorno do fornecimento devolve quantidade, mas não remove a declaração restritiva. Vendas anteriores preservam o snapshot comercial vigente na data da saída; a restrição posterior impede novas vendas da sobra.

Na fonte individual, a segregação ocorre ao confirmar grupos distintos de medições inteiras, com vínculo `VinculoMedicaoEntradaLeite` preservando medição, animal, litros e versão no snapshot. Por exemplo, duas vacas da mesma ordenha podem gerar uma origem comercial de 12 L e outra de colostro de 4 L. A natureza abrange todos os litros do grupo confirmado. Uma medição já misturada não é separada automaticamente e nenhuma sobra se torna comercial pela subtração do que foi fornecido. A declaração registra a prática informada, sem certificar elegibilidade sanitária.

O planejador recebe finalidade explícita `VENDA`, `CONSUMO` ou `DESCARTE`. Venda seleciona somente origens declaradas `COMERCIAL`, mesmo quando o custo ainda está pendente. Alocação preserva finalidade e FK/snapshot da classificação da mesma entrada. O SQL confere a classificação vigente ao criar a saída e impede tratar uma operação `VENDA` como consumo para contornar a restrição. Não há certificação sanitária implícita nessa declaração operacional.

O DTO mantém saldo físico e `comercial` separados. Para programação por meta, apenas `comercial.quantidadeLitros` é utilizável. Uma origem `NAO_INFORMADA` com saldo positivo torna a cobertura comercial incompleta e a meta não aferível. Com 50 L comerciais e 10 L de colostro, o saldo físico é 60 L e o elegível comercial é 50 L: vender 55 L é recusado sem consumir os 10 L restritos.

## Saídas e apuração de custo

`LEITE_FIFO_V1` permite custo/valor ausentes somente em movimento ligado a entrada láctea comprovada, a alocações dos seus consumidores ou ao inverso correspondente. Os demais métodos continuam exigindo valores conhecidos. `Operacao` e `ItemOperacao` mantêm seus valores obrigatórios.

`AlocacaoLeiteEstoque` identifica quantos litros uma saída consumiu de cada ordenha, em FIFO por data/ordem da sessão. Pode selecionar explicitamente origens para destinação interna. As alocações não geram outro movimento. O custo inicial da saída permanece conhecido ou pendente conforme suas origens; misturar origens conhecidas e pendentes conserva o total como pendente.

`ApuracaoValorLeite` registra o total documentado por origem e uma versão. `ApropriacaoValorLeite` registra o valor atribuído às alocações já existentes. A apuração não reescreve movimentos físicos nem gera despesa/caixa. Uma correção cria outra versão documentada; versões anteriores e apropriações permanecem imutáveis, inclusive contra exclusão. O serviço confere o período da produção, dos consumidores afetados e da apuração.

O rateio por origem é proporcional às quantidades residuais, na ordem preservada das saídas. A saída que esgota a origem absorve o resíduo de centavos. Exemplo: produzir 1.000 L, vender 600 L, fornecer 100 L e conservar 300 L; apurar R$ 1.500 atribui R$ 900 à venda, R$ 150 ao fornecimento e R$ 450 ao saldo. Isso não cria outra compra nem altera o financeiro dos custos que documentaram a apuração.

A conservação é exata por origem: produção = consumos líquidos + remanescente; valor documentado = valores atribuídos aos consumos líquidos + valor residual. A soma dos consumidores não ultrapassa a origem e uma origem esgotada não conserva valor. Leitores de ficha/movimentos, operações e base de custo consultam o valor atualmente apurado; snapshots anteriores não são reescritos.

O saldo confiável depende da igualdade entre o razão físico e as origens confirmadas, com os mesmos sítio/produto. `consultarEstoqueLeite` retorna `confiavel` e `motivoNaoAferivel`; sem origem comprovada ou com divergência, quantidade e valor totais são `null`, sem simular zero. Custo pendente não torna a quantidade física desconhecida quando o lastro está íntegro. Essa consulta é atual, sem reconstrução histórica implícita.

## Venda e recebimento

`venderLeite()` planeja a saída sob trava e chama `criarVendaLeiteTx()`, adaptação interna do executor financeiro existente. O plano não é um booleano livre do endpoint genérico. Operação, item, movimento, alocações, compromisso/recebimento e auditoria são confirmados na mesma transação. Retry consulta a operação idempotente antes de tentar consumir novamente.

O preço comercial do item é separado do custo físico: 100 L vendidos por R$ 225 criam a operação e seu recebível de R$ 225, enquanto o custo dos 100 L pode permanecer pendente. Liquidação posterior usa as rotas existentes e não baixa estoque. Valor pago parcial conserva o restante pendente.

A venda avulsa recebe o valor comercial definitivo conhecido, sem inferir frete, bonificação, desconto de qualidade, retenção ou divergência de volume. A operação por período registra preço negociado e ajuste explícitos no fechamento; entregas/demonstrativos conservam a composição documental, sem outro motor de preço ou recebimento. Esses percursos e seus limites estão no [contrato comercial](leite-comercial.md). Campos de desconto/logística do executor financeiro genérico continuam restritos a compras.

## Correções e limites do incremento

- Sem consumidores ativos, `anularEntradaProducaoLeite()` cria inverso físico, preserva o original e desativa somente os vínculos daquela entrada, sem apagar seu histórico. As medições liberadas podem compor uma nova confirmação; na fonte individual, editar a sessão exige não haver outra entrada confirmada nela; na fonte geral, a proteção de edição alcança a parcela confirmada. Retry da mesma anulação retorna o inverso existente e recusa motivo/autor divergente.
- Com litros consumidos ou vendidos, a origem não pode ser anulada isoladamente. O serviço e o SQL exigem regularização dos dependentes.
- Destinos internos usam `baixarLeiteTx()` e `estornarBaixaLeiteTx()` na mesma transação do fato chamador, preservando alocações/custos originais. O adaptador recusa estorno de uma saída vinculada a `VENDA`, que exige tratar o financeiro junto.
- `corrigirVendaLeite()` substitui comercialmente a versão vigente, conservando a mesma retirada, produto, litros, sítio e data. O novo comprador, total e condição financeira são explícitos. Categoria e centro omitidos preservam os IDs e snapshots da operação anterior, inclusive quando os cadastros históricos foram inativados; novos selecionados precisam estar ativos. Produto histórico inativo pode receber apenas essa correção estritamente comercial, após prova da retirada existente; nova retirada continua exigindo produto ativo. Não se herda o cadastro atual do produto. Compromissos antigos são cancelados e a operação substituta é criada pelo executor financeiro na mesma transação; não há nova baixa, inverso físico ou estorno automático de dinheiro.
- Qualquer recebimento ou liquidação ainda confirmados bloqueia a correção antes das escritas. O usuário precisa estornar o recebimento explicitamente pelo fluxo financeiro existente; a correção posterior não repete esse estorno. Períodos da operação, retirada e correção são revalidados. Chave/autor/hash preservam reenvios; versão esperada e trava da operação impedem substituição concorrente.
- `VersaoComercialVendaLeite` preserva uma cadeia linear imutável: versões anteriores canceladas e somente a última confirmada, todas ligadas à mesma retirada. O cancelamento financeiro genérico é bloqueado tanto na original quanto nas substitutas, inclusive quando a substituta não possui movimento próprio. Não há retorno físico presumido. A migration de vínculo recusa históricos ambíguos e só associa retiradas existentes inequívocas; não inventa identidade de reenvio histórica.
- Não há motor geral de recálculo histórico, reconciliação automática do estoque anterior, migração automática para partidas ou importação de ordenhas antigas. Apuração leiteira específica e suas versões não autorizam reabrir período fechado.

## Interfaces e autorização

Serviços/validadores em `server/src/services/pecuaria/leite/estoque.ts`:

| Interface | Entrada principal |
|---|---|
| `confirmarParcelasOrdenha` | chave do conjunto e parcelas gerais com chave, medição, versão, produto e motivo da natureza; confirmação atômica |
| `confirmarProducaoGeral` | medição geral, versão, produto, motivo e chave; adaptador compatível |
| `consultarResumoEstoqueLeite` | sítio, produto/busca opcionais e paginação; resumo de todo o recorte e valores mascarados |
| `confirmarSessaoProducaoLeite` | sessão, versão, chave, todos os grupos e justificativa de cobertura parcial quando necessária |
| `confirmarProducaoLeite` | `sessaoId`, `versaoEsperada`, `produtoId`, `chave`, `medicaoIds`, `natureza`, `motivoNatureza`, `motivoParcial` quando necessário |
| `venderLeite` | produto, quantidade, data, comprador, valor definitivo, categoria/centro quando informados, condição financeira e chave |
| `apurarValorProducaoLeite` | entrada, versão esperada da apuração (zero inicialmente), total documentado, referência, evidência, motivo e chave |
| `anularEntradaProducaoLeite` | entrada e motivo; somente sem consumidores ativos |
| `classificarEntradaLeite` | entrada inteira, versão esperada, chave, natureza explícita e motivo |
| `consultarEstoqueLeite` | produto e contexto de sítio; valores somente com permissão |
| `corrigirVendaLeite` | operação vigente, versão esperada, chave, motivo, comprador, valor e condição financeira explícita; categoria/centro opcionais |
| `consultarVendasLeite` | produto/período/paginação no sítio; versões, valores, recebimentos ativos e bloqueios; acesso financeiro integral |

A folha sempre retorna `medicoes[].confirmacaoEstoque` como `null` ou `{ entradaId, produtoId, natureza }`, independente do produto selecionado na interface. Cada sessão retorna `entradasEstoque` com identidade, produto, natureza, status e litros numéricos de seus grupos. A consulta de estoque acrescenta `medicaoIds` e `animaisGrupo` com animal/brinco/nome e litros textuais por origem, para identificação no histórico e na apuração.

Todas recebem sítio/usuário resolvidos pelo servidor. As rotas devem exigir sessão, área, ação e sítio; venda/apuração exigem as permissões financeiras apropriadas. Quantidade pendente, custo pendente, zero comprovado e valor oculto por permissão são estados distintos.

Adaptadores transacionais compartilhados ficam em `services/estoque/leite.ts`; cálculos puros em `leite.calc.ts`. O SQL versionado protege custo pendente, classificações imutáveis, vínculos das medições, soma exata, origem ativa única e coerência dos inversos. Migrations históricas preservam ou recusam vínculos ambíguos conforme suas próprias verificações; este contrato não presume sua aplicação no ambiente nem autoriza reconciliação automática.

A baseline incorpora a antiga migration `20261024200000_parcelas_ordenha_colostro`, com recipientes, declarações e snapshots do contexto. Mantém unicidade por tanque/sessão e acrescenta unicidade do recipiente livre normalizado, guardas conjuntas de segregação e evidências de parto/lactação, sem preencher regra antiga. Ela não foi aplicada nesta rodada. A conferência estrutural não comprova execução ou concorrência PostgreSQL. Confirmação e edição usam `Serializable`; escritas manuais com snapshot `RepeatableRead` antigo não são percurso suportado.

## Consulta consolidada do estoque

`GET /estoque/resumo`, sob o prefixo leiteiro, identifica produtos por movimentos do método leiteiro no sítio; um cadastro em litros isolado não comprova que o produto é leite. Retorna `itens`, `total`, `pagina`, `porPagina` e `resumo` calculado sobre todo o conjunto autorizado e filtrado antes da paginação. Busca/produto refinam o recorte; exceder os limites de segurança exige refinamento, sem totais truncados.

A abertura mostra todos esses produtos e separa quantidade física, comercial, Descarte, Colostro, classificação pendente e custo pendente. Classificação pendente não é uma quarta natureza. Quantidade e valor ficam `null` quando o razão não concilia com as origens ou há mistura incompatível de métodos; ausência de lastro não vira zero. Custo ausente mantém o valor pendente mesmo com litros comprovados, e `verValores` também protege o resumo e o volume de custo pendente. As sobras usam consumos líquidos, estornos e a última apropriação de valor de cada origem.

Aferições salvas sem confirmação continuam na consulta de Ordenhas, separadas do saldo disponível. O tanque informado na origem prova o recipiente na produção, sem demonstrar onde toda a sobra está hoje; a consulta não estima saldo atual por tanque. Estoque Leite é um recorte do estoque compartilhado, sem pré-estoque ou transferência fictícia.

## Validação e evidência

Testes de cálculos verificam FIFO, valor pendente, conservação e precisão. Testes de serviços verificam cobertura parcial, versão/sítio, reenvio, bloqueio de origem consumida e apuração sem movimento físico. O teste do motor financeiro verifica saída única com custo pendente e recebível pelo preço conhecido. Testes de segregação verificam grupos distintos na mesma sessão, dupla confirmação entre produtos, recusa de pendência/zero/animal excluído/medição estrangeira, idempotência, vínculo histórico após anulação e DTO independente do produto. Testes estruturais conferem os gates SQL; eles não comprovam execução da migration em PostgreSQL.

Classificação tem contraprovas de venda limitada ao volume comercial, restrição terminal, ausência de declaração, snapshot de origem, falta de cobertura da meta e confirmação futura na virada UTC com data operacional em `America/Sao_Paulo`.

Regressões de estoque, valorização, operações e nutrição são verificadas separadamente. Integração real de banco, aplicação da nova migration, inspeção visual e homologação da fazenda são etapas distintas. Esta atualização documental não aplica SQL, executa seed/carga, cria banco auxiliar nem altera resultados dos roteiros.

A consulta comercial usa uma transação de leitura `RepeatableRead`; a elegibilidade exibida é informativa e todas as condições são revalidadas na escrita. Datas inexistentes e paginação fora do limite são rejeitadas. O custo médio compartilhado omite uma base enquanto houver remanescente físico com apuração pendente no escopo consultado; bases parcialmente conhecidas não aparecem como custo médio completo.
