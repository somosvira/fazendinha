# Pecuária · Produção

## Conceito: medir, guardar, destinar e vender

A V5 acompanha leite por sítio, data operacional e ordenha. Medição, confirmação no estoque, natureza, destino, coleta, venda, demonstrativo e recebimento são fatos distintos. Uma medição salva não é saldo disponível; uma coleta não é pagamento; uma amostra de qualidade não libera automaticamente leite para venda.

O menu **Leite** tem sete entradas: Ordenhas, Produção, Estoque, Coletas, Qualidade, Vendas e Alimentação e descarte. Configurações, relatórios e conferência histórica têm acessos próprios.

## Configurar a rotina

A configuração tem vigência, fonte dos totais GERAL/INDIVIDUAL, posições da ordenha, horários opcionais, intervalo de aferição individual e critério de colostro. Admite de uma a doze posições. Nome e ordem não substituem a identidade da posição. Alterar a rotina não reescreve um dia já registrado.

Para sítio sem configuração, a rotina virtual inicia geral, mensal e Manhã/Tarde/Noite. Configurações históricas conservam sua fonte; clientes antigos que omitem fonte na criação mantêm a compatibilidade individual. “Mensal” não significa trinta dias fixos e não impede uma medição extra.

A operação relatada usa produção geral em cada ordenha e aferição individual periódica. O controle individual acompanha cada animal; não estima automaticamente os dias intermediários nem soma seus litros de novo ao tanque.

## Produção geral: cada parcela é física

1. Abra Ordenhas e escolha data e turno.
2. Registre as parcelas segregadas: comercial, não comercial ou colostro.
3. Identifique um tanque cadastrado/versionado ou outro recipiente segregado por descrição.
4. Informe litros daquela ordenha e, se disponível, régua em milímetros. Não informe o saldo acumulado do tanque como nova produção.
5. Confira os animais de origem e as justificativas exigidas.
6. Salve as parcelas. Isso preserva a medição, sem movimentar estoque.
7. Prepare produto/motivo e confirme o conjunto selecionado no estoque.

Cada recipiente aparece uma única vez na sessão. Leite misturado não é separado em naturezas por rateio fictício. Tanque cadastrado tem capacidade conferida; recipiente livre não recebe capacidade presumida. Régua e litros são campos manuais independentes: a régua não soma volume nem converte automaticamente pela tabela do tanque.

O cadastro do tanque preserva versões, capacidade, identificação e pontos de calibração conhecidos. Fotografias parciais não autorizam completar a tabela. Uma versão nova não altera aferições anteriores.

## Quem pode ser origem

Finalidade LEITE precisa estar comprovada na data. CORTE, REPRODUCAO, lacuna ou sobreposição impedem identificar o animal como participante leiteiro. Localização, sexo, entrada/baixa, lactação e carência continuam sendo verificações separadas.

Sugestões automáticas gerais usam lactação vigente única e DEL maior que zero. D0 pode participar do contexto de colostro quando existe parto/lactação compatível e declaração necessária. Ausência de lactação não é completada com parto inventado. A exceção explícita de lactação desconhecida mantém pendência e não comprova população de custo.

Registro direto de não comercial/colostro exige justificativa e pode conservar origens desconhecidas. Nesse caso o volume é conhecido, mas população e custo não ficam comprovados; não é autorização comercial.

## Controle individual

O dia congela configuração e população histórica na primeira gravação. Cada célula de animal/ordenha tem estado próprio:

| Estado | O que informar | Como entra nos totais |
|---|---|---|
| `MEDIDO` | Litros, inclusive zero explícito | Soma a quantidade medida |
| `NAO_ORDENHADO` | Motivo | Informa a ocorrência, sem presumir volume |
| `PENDENTE` | Informação ainda ausente | Reduz cobertura; não vira zero |

Salvar animal envia sua célula; salvar ordenha envia as demais alterações. Rascunhos conservam o contexto, a chave de reenvio e diferenças entre salvo, falha e edição local. Versão vencida impede sobrescrever outra aba silenciosamente. Inclusão/exclusão de participantes exige motivo e preserva o histórico.

Na fonte INDIVIDUAL, grupos de medições positivas inteiras da mesma sessão podem gerar origens segregadas. Uma medição não pode entrar em duas origens nem ser fracionada arbitrariamente. Na fonte GERAL, o controle individual não gera outra entrada.

## Confirmação e natureza do leite

Confirmar usa versão esperada, produto, motivo e chaves idempotentes. Falha de uma parcela do conjunto desfaz a confirmação inteira. Só volumes positivos geram entrada; zero medido continua registrado. Sessões/parcelas confirmadas têm proteção contra correção até regularizar entradas e consumidores.

| Natureza | Significado operacional | Consequência |
|---|---|---|
| Comercial | Declaração explícita com origens e guardas satisfeitas | Candidata a venda; custo pode estar pendente |
| Não comercial | Leite segregado e restrito comercialmente | Não pode ser vendido pelo fluxo comercial |
| Colostro | Natureza explicitamente declarada | Destinos próprios e vínculo de colostragem quando aplicável |
| Não informada | Classificação ainda sem prova suficiente em contextos históricos | Não equivale a comercial; cobertura permanece pendente |

No fluxo novo, a confirmação declara a natureza na mesma transação; o marco inicial não informado é preservado no histórico. COLOSTRO e NAO_COMERCIAL são restrições terminais na implementação atual. Estornar um fornecimento não transforma a sobra em leite comercial.

Carência ativa, prazo desconhecido e administração em revisão impedem a declaração comercial. A conferência considera a data/horário da produção e revalida nas novas vendas. Liberar o animal depois não libera retrospectivamente o leite produzido durante a restrição.

## Colostro, alimentação e descarte

Critério de colostro pode ser primeira ordenha ou janela de dias por vigência. A janela inclui D0 e exclui a fronteira final. Primeira ordenha exige declaração explícita: a primeira medição registrada no software não prova que foi a primeira ordenha da vaca. A mesma declaração não pode se repetir para o mesmo parto/animal.

Destino interno informa origem e quantidades explícitas por animal. De 10 L, fornecer 3 L a uma cria e 4 L a outra deixa 3 L. Não há divisão igual automática nem saída adicional do restante. Colostro para cria de parto pode criar/vincular FornecimentoColostro sem duplicação; leite comum não cria esse fato.

Leite não comercial disponível para uso interno não significa leite fisicamente descartado. **Descarte físico** é outra saída, com origem, quantidade e justificativa. Alimentação não deve ser registrada novamente como descarte. Registrar a prática não certifica adequação clínica ou nutricional do uso.

Estornos conservam a origem e o inverso, respeitando dependências. Leite realmente eliminado não reaparece no tanque por uma correção documental.

## Estoque e apuração posterior

A entrada usa MovimentoEstoque compartilhado e pode ter valor pendente. Alocações identificam os litros de cada origem consumidos por saída, em FIFO ou seleção explícita suportada. Apuração documentada distribui valor entre saídas e remanescente, com versões, sem criar dinheiro ou outra despesa.

O saldo físico deve fechar: produção confirmada = saídas líquidas + remanescente. A consulta mostra cobertura de valor e quantidade comercial separadas. Tanque de origem não é um mapa de localização atual de todo o saldo.

## Coletas e comercialização

**Venda avulsa com preço conhecido:** confirma uma retirada física e uma VENDA, com a condição financeira real. Entrega documenta a retirada existente; não a repete.

**Operação por comprador/período:** abre com preço desconhecido. Cada coleta baixa litros comerciais e preserva data, produto, referência e comprovantes. Não cria venda de R$ 0, obrigação ou caixa antes da negociação.

No fechamento, reconheça cada coleta, informe preço e ajuste monetário justificado. Duas coletas de 100 L e 150 L reconhecidas integralmente a R$ 2,50/L geram R$ 625, sem outra saída física. A fórmula usa Decimal: arredondar(litros reconhecidos × preço, 2) + ajuste. Reconhecimento integral zero ou total não positivo exige regularização, sem venda fictícia.

Receber depois usa os compromissos e liquidações do Financeiro. A coleta é física; aceite é conferência; venda é negociação; faturamento é documental; recebimento é dinheiro. Diferença no volume aceito não devolve litros automaticamente.

Correção comercial cria versão substituta preservando as coletas. Recebimento ativo, alocação documental dependente ou período fechado podem bloquear a correção. O usuário deve regularizar os vínculos antes, sem cancelar preço para recuperar estoque.

## Demonstrativos e documentos

Demonstrativo registra período, comprador, referência, volumes/valores e componentes documentados. Bônus, desconto, retenção e adiantamento não são intercambiáveis. Retenção/adiantamento relatado não comprova pagamento nem vira desconto de receita automaticamente.

Alocações ligam demonstrativo, entrega e versão comercial, com limites de quantidade/valor. Aceite desconhecido continua pendente; a soma não pode se apropriar de mais volume do que o permitido. Anular demonstrativo libera suas alocações documentais sem devolver leite ou dinheiro. Comprovantes são privados e reautorizados no download.

## Qualidade

Amostra individual usa o núcleo de exames; amostra coletiva identifica sua origem sem animal fictício. Resultado coletivo não é distribuído entre vacas. Formato versionado declara campos, tipos e unidades a partir do laudo: número, texto, opção e sim/não, conservando zero e falso.

Coleta, resultado laboratorial, recebimento do laudo e cadastro no sistema têm datas distintas. Ausência de data não é preenchida com outra. Uma coleta sem resultado continua aguardando laudo; corrigir resultados conserva histórico, formato e autoria.

CPP, gordura, proteína, NU, extrato seco e lactose dependem de código/unidade/método conhecidos. Rótulo igual não prova equivalência entre séries. Não há média automática de três amostras nem cálculo de preço por faixas de qualidade nesta consulta. Vincular amostras ao fechamento é opcional e congela sua versão; corrigir laudo depois não altera o acordo anterior.

## Custos e cobertura

Custo por litro usa custos e litros dos mesmos animais e período. No consolidado, soma custos e divide pela soma dos litros; não faz média simples dos custos/L individuais. Exemplo com base completa: R$ 900 / 600 L = R$ 1,50/L.

Cobertura incompleta, custo desconhecido, população sem comprovação, dia sem folha ou denominador sem volume positivo mantêm o indicador não apurado. Não dividir todo o custo mensal pelos poucos litros de um controle individual mensal; não extrapolar os dias ausentes.

Na fonte geral, exige-se cobertura de sessões e conciliação da união das origens com a população elegível. Filtrar uma natureza não cria vínculo monetário de cada componente com aquela parcela: o custo/L permanece não apurado com `NATUREZA_SEM_VINCULO`. Referência comercial R07 da Nutrição é separada e não entra outra vez no custo produtivo.

## Conferência física e relatórios

Observar 10 L onde o razão mostra 12 L produz diferença de −2 L; a conferência não ajusta estoque automaticamente. Zero observado exige declaração. Uma observação antiga não vira saldo de abertura atual por suposição.

Produção diária/mensal soma volumes medidos e informa cobertura do calendário. Coletas usam data física; vendas usam comprador/período comercial. Relatórios emitidos preservam fontes, filtros, versão do cálculo e corte. CSV/exportação exige autorização e conserva lacunas e máscara monetária.

Prévia histórica confere dados de funcionários, brinco literal, unidade e conflitos. Não executa importação automática nem cria estoque retroativo de leite já vendido. IDEAGRI é referência para carga/reconciliação, não sincronização operacional.

## Implementação e verificações

Prefixo HTTP: `/api/pecuaria/rebanho/leite`; rotas `server/src/routes/pecuaria/leite*.ts`; serviços `server/src/services/pecuaria/leite/`; interface `client/src/pecuaria/rebanho/leite/`. ConfiguracaoOrdenha → DiaProducaoLeite → SessaoOrdenha → MedicaoGeralLeite/MedicaoLeite organizam a produção. EntradaProducaoLeite e AlocacaoLeiteEstoque ligam a origem aos movimentos compartilhados. OperacaoComercialLeite, RetiradaOperacaoLeite e FechamentoOperacaoLeite conservam o percurso comercial.

Contratos especializados: [produção](../pecuaria/leite.md), [estoque](../pecuaria/leite-decisoes-estoque.md), [comercial](../pecuaria/leite-comercial.md), [qualidade](../pecuaria/leite-qualidade.md) e [relatórios](../pecuaria/leite-relatorios.md). Testes de cálculos, serviços, rotas, componentes e SQL estrutural acompanham esses módulos; execução SQL real, R2 e homologação de campo são evidências próprias.
