# Pecuária · Nutrição

## Conceito: receita, vigência e consumo

Receita descreve ingredientes e quantidades planejadas. Sua versão preserva a composição usada. Vigência liga uma receita a um lote em determinado intervalo. Fechamento confirma consumo de um período. Participação atribui quantidade/custo aos animais presentes naquele intervalo.

Receita não baixa estoque. Dieta vigente não prova fornecimento. Fechamento não mede quanto cada animal efetivamente ingeriu: a atribuição individual usa permanência histórica no lote.

## Rotina de trabalho

1. Cadastre ingredientes e seus perfis/unidades no estoque compartilhado.
2. Crie uma receita e publique/use a versão adequada conforme o fluxo.
3. Atribua a dieta ao lote com início de vigência comprovado.
4. Abra Conferir consumo para o lote/período.
5. Confira permanências, quantidades sugeridas, alterações reais, origens e cobertura de custo.
6. Confirme. O fechamento registra consumo, saídas e participações atomicamente.
7. Consulte os detalhes por lote e animal; corrija pelo estorno/novo fechamento quando permitido.

Mudança de dieta cria outra vigência, sem editar retroativamente o consumo confirmado. Períodos e segmentações devem respeitar as vigências e os fechamentos existentes. Alteração retroativa de localização/dieta que afete consumo confirmado exige tratamento das dependências.

## Animal-dias e rateio

Animal-dias soma os dias de presença de cada animal no lote. O período solicitado tem início/fim inclusivos; a localização usa início incluído e fim excluído, contando o dia de transferência no destino.

Exemplo: A permaneceu dez dias e B cinco dias. São 15 animal-dias. Um consumo confirmado de 150 kg atribui 100 kg a A e 50 kg a B. Se o custo conhecido for R$ 300, as parcelas são R$ 200 e R$ 100. A explicação é permanência, não medição de ingestão.

O cálculo conserva unidades mínimas e centavos por maiores restos, com desempate estável. Não perde quantidades por arredondar cada animal isoladamente. Se parte dos ingredientes não tem custo, o conhecido pode ser apresentado com cobertura parcial; não se transforma o restante em zero.

## Estados que devem ser lidos separadamente

| Objeto | Leitura | Cuidado |
|---|---|---|
| Receita/versão | Planejamento disponível e composição preservada | Não representa consumo |
| Vigência no lote | Receita aplicável na data | Não prova que o fechamento foi feito |
| Fechamento | `CONFIRMADO` ou `ESTORNADO` | Estornado conserva história e inversos |
| Participação | Dias, quantidades e custos atribuídos | Não é ingestão medida |
| Custo | Conhecido, parcial ou não apurado | Não usar zero por falta de dados |
| Consulta vazia | Nenhum consumo atribuído no recorte | Não afirmar que o animal não tem dieta |

Não existe um único enum nutricional no Animal que resuma tudo isso. Se futuramente houver alertas como “consumo atrasado”, precisam de calendário/critério próprios; não se deduzem automaticamente de uma tela vazia.

## Leite na dieta

A V5 permite consumo de leite por origens leiteiras comprovadas, conservando natureza, litros, parcelas por animal e estoque. Fechamentos são segmentados por mês/vigência quando exigido. Quantidades atribuídas são conservadas em mililitros; o leite não é comprado outra vez para aparecer como ingrediente.

Não comercial é natureza operacional; descarte físico é eliminação. Leite usado na alimentação não recebe uma segunda saída como descarte. Colostragem tem fato próprio e não deve ser duplicada pelo fechamento da dieta.

O custo produtivo acompanha a apuração das origens. Enquanto alguma parcela não tiver valor comprovado, o fornecimento permanece não apurado, mesmo que litros sejam conhecidos.

## Referência comercial não é custo produtivo

R07 é uma referência gerencial do leite usado internamente. Pode vir de um fechamento comercial vigente comprovado; ausência ou multiplicidade deixa pendência. Revisões explícitas preservam fonte, versão, motivo e autoria, sem alterar litros ou dinheiro.

Para 60 L, referência de R$ 2,50/L representa R$ 150. Revisá-la para R$ 2,70/L mostra R$ 162. Se o custo produtivo for R$ 84, ele continua R$ 84: não se soma R$ 84 + R$ 162 como gasto. Referência, custo e receita têm significados distintos.

A consulta operacional de custos atribuídos segue a política pecuária. Referência comercial monetária exige acesso financeiro/valores. Ocultar valores no cliente não substitui a máscara do servidor.

## Estorno e dependências

Estornar um fechamento conserva o original e cria os movimentos inversos correspondentes uma vez. As origens exatas do leite são recompostas quando o estorno é permitido. Não altera colostragem independente nem remove restrição da natureza leiteira.

Consumos posteriores ainda confirmados, estoque utilizado e períodos fechados podem impedir regularização isolada. O sistema deve validar o conjunto antes de confirmar; reenvio idempotente não deve duplicar fechamento ou inverso.

## Interface e indicadores

Nutrição apresenta panorama, receitas, vigências e fechamentos; a ficha do lote oferece a rotina no contexto. A ficha animal apresenta sua participação atribuída. O resumo usa agregação do servidor e não baixa todo o histórico para calcular no navegador.

Calendário de fechamentos e comparação de ingredientes são alternativas à tabela. Quantidades mantêm unidade; custos mostram cobertura; estornados não entram no total atual. O volume conhecido não é um diagnóstico de adequação da dieta.

Não há formulação automática, recomendação nutricional, previsão de ganho ou balanço de nutrientes completos apenas por registrar o consumo. O aplicativo registra e reconcilia a prática; o planejamento técnico precisa de sua fonte profissional e dos dados adequados.

## Implementação e verificações

Rotas em `server/src/routes/pecuaria/nutricao.ts`; serviços `dietas.ts`, `consumo.ts`, `resumo.ts`, `animalDias.calc.ts` e `atribuicao.calc.ts` em `server/src/services/pecuaria/nutricao/`. A integração leiteira usa `server/src/services/pecuaria/leite/nutricao.ts`.

Dieta/ItemDieta → VigenciaDietaLote → FechamentoConsumo/ItemFechamentoConsumo → ParticipacaoConsumoAnimal organizam o domínio. FornecimentoNutricionalLeite, suas parcelas/movimentos e ReferenciaGerencialLeite conservam o leite fornecido e a referência separada.

Testes de permanência, atribuição, estorno, resumo e integrações verificam conservação e dependências. Fonte contratual: [Pecuária](../pecuaria/README.md) e [leite na dieta](../pecuaria/leite.md#leite-na-dieta-e-referência-gerencial).
