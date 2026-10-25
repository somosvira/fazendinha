# Comercialização e conciliação do leite

Contrato aditivo da V5. Migrations e testes isolados não comprovam banco aplicado, R2 real ou homologação da rotina. O [contrato de leite](leite.md) e o [Financeiro](../financeiro-rebuild-contrato.md) continuam responsáveis pelos demais efeitos.

## Consulta e acesso às operações

Pecuária → Leite → **Vendas** reúne operações abertas/fechadas por comprador e período e vendas avulsas. A consulta unificada usa `GET /comercial/vendas-unificadas`, com comprador, período, busca, modalidade, situação e paginação. Retorna o resumo do recorte autorizado completo antes de paginar; limites exigem refinar a consulta sem truncar os totais. Operações canceladas ficam identificadas, fora dos totais vigentes. A avulsa aparece pela última versão comercial de sua retirada; as versões substituídas permanecem no histórico, sem reaparecer como outra venda ou outro comprador.

A listagem abre detalhes para negociação/fechamento, coletas físicas, qualidade vinculada, documentos, demonstrativos e operação financeira, preservando as permissões de cada ação. Nova operação por período e Venda avulsa usam os fluxos existentes. **Entregas e demonstrativos** fica acessível dentro de Vendas; o caminho antigo continua compatível. O resumo operacional mostra litros e preço pendente independentemente de acesso financeiro, enquanto dinheiro permanece mascarado no servidor.

**Coletas** conserva consulta autônoma pela data física da saída, mesmo com preço pendente. A partir dela é possível registrar retirada/conferir aceite e abrir a operação relacionada. Coleta, aceitação, venda e recebimento são fatos diferentes: negociar, corrigir preço, faturar ou receber não repete a baixa física. Rotina de coleta é previsão configurável em Configurações de produção, sem execução ou alerta automático prometido.

## Entrega e venda

`EntregaLeite` documenta uma única retirada física já comprovada pela cadeia de `VENDA` do leite. A relação com o movimento é única. O volume expedido vem dessa retirada; volume aceito é informado separadamente e pode permanecer desconhecido (`null`). Zero é aceite zero explícito. Uma divergência pode inclusive informar aceite superior ao expedido: o registro conserva o relato, mas não aumenta estoque ou limite físico.

O registro conserva referência, ponto de coleta e horário opcionais, autoria e comprovantes privados. A conferência tem versões imutáveis com situação, motivo e destinação relatada. Registrar rejeição ou destinação posterior não gera retorno ao tanque, descarte ou estorno financeiro. Essas ações precisam de seus próprios fatos comprovados. Toda correção mantém o registro anterior.

A API oferece dois percursos: nova VENDA e entrega na mesma transação; ou vínculo a uma VENDA leiteira já existente e confirmada no sítio. A nova venda reutiliza `venderLeiteTx`, que usa o executor financeiro normal e baixa uma única vez. Falha da entrega aborta também venda/efeitos. Reenvio idempotente devolve a identidade existente.

A consulta de vendas vinculáveis mostra impedimentos de históricos sem lastro leiteiro, retiradas já vinculadas e vendas sem comprador. Não converte movimento V1 nem cria estoque retroativo. Reconciliação de legado incompatível permanece explícita; não se inventa origem para disponibilizar o botão de vínculo.

O comprador vigente é o da última versão comercial. O snapshot original da entrega e as versões anteriores da operação conservam o histórico. Trocar comprador comercialmente antes da conciliação não recria retirada.

## Demonstrativo documentado

`DemonstrativoLeite` registra comprador, período, referência, preço-base, volume reconhecido e valor comercial declarados. Componentes tipados registram bônus, desconto, retenção e adiantamento com valor positivo e referência. Valor de pagamento informado pode ser desconhecido. Esses dados são documentais: não calculam bônus por limites presumidos, não classificam retenção/adiantamento como desconto de receita e não comprovam pagamento.

A composição não recalcula nem substitui o total da VENDA por suposição. Caso o documento divirja da operação, a correção comercial explícita ocorre antes da alocação final. Não há segundo motor de preço, caixa, obrigação ou recebimento. O pagamento real continua no Financeiro, inclusive parcial e em data diferente.

Um demonstrativo pode reunir várias entregas; uma entrega pode participar de vários demonstrativos parciais. Cada parcela informa quantidade e valor e referencia a versão vigente da venda. As somas precisam coincidir com os totais declarados. O período deve abranger as entregas; comprador e sítio precisam conferir.

As parcelas acumuladas não podem superar o menor valor entre expedição e aceite conhecido nem o valor da venda. Aceite desconhecido não vira aceite integral: a parcela exige motivo explícito da pendência e do volume reconhecido no demonstrativo; o teto expedido só protege contra apropriação física excessiva. O DTO deixa a disponibilidade comercial desconhecida nesse caso e apresenta separadamente o limite físico pendente de conferência.

O fechamento da quantidade faturável e do valor integral precisam ocorrer juntos, evitando saldo residual impossível de apropriar sem parcela fictícia. Divergências exigem regularização comercial; não alteram os litros retirados.

## Correção, concorrência e arquivos

Um demonstrativo não pode ser reescrito nem apagado. Anulação identificada preserva documento/parcelas, desativa suas alocações e libera o saldo documental sem retornar leite ou dinheiro. Novo documento usa nova identidade. Conferências da entrega e correções da VENDA ficam bloqueadas enquanto houver alocações ativas; é necessário anular explicitamente os demonstrativos dependentes primeiro.

Serviços serializáveis usam a trava comum do produto e travas ordenadas das entregas, versões esperadas e idempotência por sítio/autor/payload. Períodos da operação/entrega, do demonstrativo e da anulação são revalidados. SQL aditivo protege unicidade, histórico imutável, somas, saldo de quantidade/valor, vínculo à venda vigente e coerência entre anulação e parcelas. A verificação estrutural não substitui ensaio no PostgreSQL autorizado.

Comprovantes usam upload direto privado R2 com contexto, entrega, sítio, autor, tamanho, MIME e hash; confirmação deduplica o hash e preserva objetos já confirmados após resposta perdida. Download confere sítio/entrega e retorna URL assinada temporária. DTOs não expõem storageKey ou hash privado.

Consultas e registros físicos exigem autorização Pecuária e escopo. Criar nova venda e operar demonstrativos também exige Financeiro/verValores; candidatas de venda podem ser consultadas operacionalmente com valores mascarados; escritas exigem lançar. DTO operacional de entrega mascara valores no servidor. As rotas devem aplicar esses gates, inclusive quando o botão estiver oculto.

## Interfaces

Schemas em `comercial.schemas.ts`; serviços em `comercial.ts`:

- `registrarEntregaLeite`: vínculo a venda existente ou nova venda atômica, referência e conferência inicial.
- `conferirEntregaLeite`: nova conferência com motivo e versão esperada.
- `consultarEntregasLeite`: filtros de período/comprador/página, versões, comprovantes e saldos, com dinheiro mascarado quando necessário.
- `consultarVendasVinculaveisLeite`: candidatas e impedimentos; sem migração silenciosa.
- `registrarDemonstrativoLeite`, `consultarDemonstrativosLeite`, `anularDemonstrativoLeite`: conciliação documental e liberação explícita de parcelas.
- `solicitarComprovanteEntregaLeite`, `confirmarComprovanteEntregaLeite`, `baixarComprovanteEntregaLeite`: arquivos privados.

Testes focados cobrem limites e fechamento parcial, desconhecido/zero, versão e comprador, nova venda no mesmo transaction client, ausência de efeitos duplicados, bloqueio de correção, mascaramento de valores, contrato SQL e falhas/reenvios do upload. Concorrência PostgreSQL, R2 real, dados existentes, CI e homologação da fazenda permanecem etapas próprias.

## Operação aberta com coletas antes do preço

A expansão de outubro de 2026 acrescenta `OperacaoComercialLeite`, com identidade estável e unicidade por sítio, comprador e intervalo. A operação começa aberta, com preço desconhecido; ela não é uma `Operacao` financeira de valor zero nem o formulário `RascunhoOperacao`. `RetiradaOperacaoLeite` reúne as coletas do período. Cada coleta registra data real, produto, litros, referência, ponto/horário informados e comprovantes privados, baixando somente origens comerciais elegíveis pelo núcleo leiteiro. A saída usa `RETIRADA_LEITE`, preserva custo produtivo conhecido ou pendente e não cria compromisso ou caixa.

O detalhe da operação, aberto pela lista unificada de Vendas, permite abertura, consulta, retirada, anexos e conferência do fechamento; a lista usa o período comercial e o detalhe mostra a data real de cada coleta. Entregas/demonstrativos e histórico de avulsas permanecem acessíveis em contexto, sem conversão automática ou refaturamento. Os novos serviços estão em `comercial.operacoes.ts`, com rotas em `/comercial/operacoes` (incluindo detalhe, retiradas, prévia e fechamentos). O catálogo operacional expõe somente identidade/nome de parceiros e produtos elegíveis, sem contas ou custos.

`FechamentoOperacaoLeite` e seus detalhes imutáveis reconhecem explicitamente cada coleta, inclusive reconhecimento zero de uma coleta rejeitada quando houver outras reconhecidas. Diferença entre expedido e reconhecido exige motivo por coleta; não retorna litros, não gera descarte e não altera o fato físico. O acordo informa preço negociado e ajuste monetário separado, com motivo. O total é `arredondar(volume reconhecido × preço, 2) + ajuste`, em Decimal. Não exige laudo, fórmula de qualidade ou preço produtivo apurado.

O fechamento cria uma única venda pelo executor financeiro existente, sem segunda baixa: duas coletas de 100 L e 150 L, reconhecidas integralmente a R$ 2,50/L, geram 250 L e R$ 625. A receita usa item agregado não estocável, com centro de custo explícito, e preserva todos os produtos/origens no detalhe físico. Recebimento à vista ou obrigação a prazo são os efeitos normais; recebimentos parciais/posteriores e estornos usam Financeiro. Reconhecimento integral zero ou total monetário não positivo não cria venda fictícia: a operação permanece pendente de regularização explícita.

Correção acrescenta outra versão de fechamento e uma operação financeira substituta vinculada à anterior, conservando identidade, comprador/período, data financeira e todas as coletas. Recebimento ativo ou período financeiro fechado bloqueia a correção; os recebimentos precisam ser estornados explicitamente antes. Cancelamento genérico de preço não devolve estoque. O fechamento imutável (`id`, preço, comprador e período do pai) pode servir de referência comercial para Nutrição; isso não altera o custo de produção.

Reenvios conferem chave, autor, sítio e payload. O formulário conserva a prévia da tentativa para conseguir repetir um fechamento cuja resposta se perdeu sem ser impedido pela própria versão já confirmada. Retirada e fechamento serializam o agregado; travas de produtos antecedem travas financeiras. A migration aditiva expande a elegibilidade SQL de VENDA somente para retirada pendente comprovada, mantém os vínculos antigos e protege identidade, imutabilidade, versões, total reconhecido, sítio/período, cadeia financeira e ausência de nova baixa. Sem `verValores`, preço, ajuste, total e justificativas comerciais são mascarados pelo servidor; litros e comprovantes permanecem operacionais. Escrita física exige Pecuária/lançar; fechamento exige também Financeiro/verValores.

Testes unitários cobrem cálculo, abertura sem financeiro, retirada única, retry, versões, fechamento integral, correção bloqueada, mascaramento, permissões de rota, anexos privados e formulário. O contrato SQL tem verificação estrutural; schema efetivo, concorrência em PostgreSQL, R2 real, inspeção desktop/celular, CI e homologação têm validações próprias. Esta atualização documental não verifica a aplicação histórica das migrations nem altera dados ou roteiros.

### Leituras e qualidade opcional no fechamento

As consultas diretas de Coletas e Vendas sob `/comercial/consultas` continuam disponíveis, conforme [o contrato de relatórios](leite-relatorios.md#coletas-e-vendas-independentes); a entrada comum de Vendas usa a consulta unificada descrita acima. Coleta usa a data real da saída e admite preço pendente; Venda usa comprador/período comercial. Financeiro/`verValores` protege preço e total, sem ocultar os litros operacionais.

O comando de fechamento aceita `amostras` opcional, com identidade e versão esperada. A conferência permite selecionar ou registrar uma amostra pelo fluxo existente, sem duplicar sua identidade ou exigir qualidade para fechar o acordo. Cada versão comercial conserva seu próprio vínculo/snapshot imutável. Correções na amostra não reescrevem o fechamento anterior; detalhes e guardas estão no [contrato de qualidade](leite-qualidade.md#vínculo-opcional-com-fechamento-comercial).
