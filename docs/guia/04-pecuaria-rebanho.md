# Pecuária · Rebanho

## Conceito: identidade estável, contexto histórico

Animal é a identidade permanente. Categoria, finalidade, sítio, lote, papel reprodutivo e atividade são dimensões separadas. A ficha deve responder quem é o animal e o que era verdadeiro na data consultada, sem reclassificar todo o passado pela situação de hoje.

O brinco é identificação de uso; o ID preserva os vínculos. Uma cria sem brinco definitivo pode receber identificação provisória explícita e ser completada depois, conservando a mesma identidade e história.

## Cadastro, entrada e nascimento

Animal comprado registra entrada e origem; o cadastro zootécnico não deve ser presumido como pagamento financeiro. Animal nascido pode ser criado atomicamente pelo parto de sua mãe. Sexo, origem, datas, saldo de partos anteriores e filiação precisam refletir evidências.

Não invente datas para preencher lacunas. “Partos antes da entrada” é um saldo conhecido, não uma lista de partos com datas recuperadas. Para consultas anteriores à entrada, esse saldo não pode ser distribuído no tempo por suposição.

Corrigir nascimento ou entrada preserva as datas factuais de pesos históricos, inclusive cargas antigas identificadas por origem IDEAGRI ou vínculo de importação. Pesos associados a parto/secagem também não acompanham a correção cadastral. Se a nova cronologia contrariar esses fatos, a alteração é recusada por inteiro e informa o registro a reconciliar. Cadastro ou movimentação não podem tornar incompatíveis pesos com contexto interno/externo nem controles documentais de leite já registrados.

## Categoria, finalidade e papel

Categoria vem de regras configuráveis, avaliadas em ordem, com critérios como sexo, idade e partos. Uma exceção manual tem história própria. “Vaca” e “novilha” não são sinônimos de gestante e vazia. A contagem de partos usa o saldo anterior mais eventos válidos não incluídos naquele saldo; pela convenção operacional vigente, inclui aborto e natimorto.

Finalidade informa Leite, Corte ou Reprodução, por período. Papel informa NENHUM, DOADORA ou RECEPTORA, também por período. Uma receptora pode ter finalidade Leite e continuar produzindo. Finalidade Reprodução não prova papel de doadora, mérito genético ou aptidão clínica.

O nome interno `AptidaoAnimal`/`aptidao` ainda representa a finalidade por compatibilidade. Ele não é a elegibilidade clínica calculada para uma intervenção. Lacuna de período é desconhecimento; não vira automaticamente NENHUM.

## Localização e movimentação

1. Consulte sítio/lote e data da movimentação.
2. Selecione animais e destino, conservando a origem de cada item.
3. Confira os efeitos históricos e conflitos.
4. Confirme o conjunto atomicamente.
5. Consulte o histórico. Desfazer é um ato rastreável, não exclusão do movimento anterior.

Os períodos usam início incluído e fim excluído. No dia da transferência, a participação nutricional conta no destino. Aplicação ou tentativa passada continua pertencendo ao sítio onde ocorreu. A condição reprodutiva pode acompanhar o animal transferido, sem conceder acesso aos valores de outro sítio.

## Baixa e descarte

Baixa registra a saída efetiva: venda, abate, morte, doação ou extravio. Cadastro indevido é fluxo interno de correção sujeito às guardas de fatos existentes. Motivo precisa ser compatível com o tipo; venda/abate/doação distinguem descarte voluntário/involuntário, morte tem sua classe própria.

Marcar uma matriz para descarte reprodutivo é uma decisão de não fazer novas intervenções reprodutivas. Ela continua ativa até ocorrer uma baixa real e pode continuar lactante. Essa decisão não vende o animal, não encerra lactação e não cria receita. Desfazer a decisão é explícito e auditado.

Baixa não apaga dados. O contexto da data deve ser revalidado, inclusive carências e ciência exigida. A V5 conserva uma exceção comprovada para a produção no próprio dia da baixa, usando o vínculo à finalidade que a baixa fechou; não é uma liberação genérica após a saída.

## Genética

Cada lado da filiação aponta para animal interno ou genitor externo, de forma exclusiva. Na transferência de embrião, a doadora é a mãe genética e a receptora é a mãe gestacional. Doadora desconhecida permanece desconhecida.

Composição racial informada e composição calculada têm proveniências distintas. O cálculo dos genitores não sobrescreve uma composição informada sem aceite. MaterialGenetico associa sêmen ou embrião ao Produto do estoque; seu cadastro não cria doses disponíveis. A tentativa guarda um retrato da genética usada.

## Peso e manejo

Pesagens têm data, tipo e origem; podem ser individuais ou coletivas. GMD é ganho médio diário entre pesos válidos com intervalo conhecido. Peso ausente não é zero; uma pesagem isolada não comprova tendência. Desmama e castração são fatos de manejo com autoria e histórico.

Peso de nascimento e peso ligado ao parto precisam conservar seus vínculos. A ficha usa a mesma série comparável para último peso, peso anterior e GMD, até a referência ou baixa. Estimados, informados e externos permanecem no histórico, mas não entram nesses indicadores. Precisão desconhecida no legado continua identificada, sem virar medição comprovada. Indicadores com janelas diferentes conservam suas definições, mesmo que coincidam numericamente. A existência do enum BALANCA não significa integração automática com equipamento.

Pesagem com origem histórica exige reconciliação da fonte para corrigir ou excluir; o editor comum não apaga sua proveniência. Por exemplo, o GMD entre 300 kg medidos em 30/09 e 340 kg medidos em 20/10 é 2 kg/dia; uma estimativa intermediária não substitui esses pesos comparáveis.

## Onde consultar

Rebanho tem panorama, Animais e Lotes. A ficha animal organiza Resumo, Cadastro, Histórico, Reprodução, Sanidade, Nutrição e Produção para fêmeas. O resumo combina dimensões; as abas explicam a evidência. Lotes permite acompanhar seus animais, baixas, movimentos, sanidade, nutrição e alterações.

Gráficos devem declarar cobertura e recorte. Dados de uma página não representam o rebanho inteiro. Falha ao consultar sanidade não autoriza um selo de saudável; ausência de fechamento não prova ausência de dieta.

## Modelo de estados e exemplos

Uma fêmea pode ser simultaneamente ativa, no lote Lactantes, categoria Vaca, finalidade Leite, papel Receptora, gestante, lactante, em carência e participante de uma dieta. Nenhum desses rótulos substitui os outros. O [modelo completo de estados](../pecuaria/estados-animal.md) descreve origem, transições e restrições, e o capítulo Reprodução mostra o ciclo.

## Implementação e verificações

Interface em `client/src/pecuaria/rebanho/telas/`; API em `server/src/routes/pecuaria/rebanho.ts`; regras em `server/src/services/pecuaria/rebanho/`. Animal se relaciona com LocalizacaoAnimal, FinalidadeAnimal, PeriodoReprodutivoAnimal, CategoriaManualAnimal, BaixaAnimal, Pesagem, Movimentacao/MovimentacaoAnimal e AuditoriaPecuaria.

Schema e baseline SQL preservam FKs, unicidade e exclusividade de filiação. Cálculos de categoria, partos, papel, peso e movimentação têm testes próprios. O [contrato pecuário](../pecuaria/README.md) detalha as demais guardas.
