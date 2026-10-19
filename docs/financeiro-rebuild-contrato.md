# Contrato atual de Financeiro e Estoque

Este contrato descreve a implementação atual, independente do financeiro anterior e do Excel. Estrutura em `server/prisma/schema.prisma`; regras em `server/src/services/financeiro/` e `services/estoque/`; rotas em `server/src/routes/financeiro.ts` e `estoque.ts`.

## Fatos e efeitos

| Entidade | Significado |
|---|---|
| `Operacao` / `ItemOperacao` | Fato de negócio e seus itens |
| `CompromissoFinanceiro` | Valor pendente a pagar/receber |
| `Liquidacao` | Vínculo do pagamento/recebimento posterior ao compromisso |
| `TransacaoFinanceira` | Dinheiro realizado |
| `MovimentoConta` | Efeito no saldo da conta |
| `MovimentoEstoque` | Efeito físico com origem justificável |
| `DocumentoFinanceiro` | Comprovante/anexo da operação ou transação |
| `AuditoriaFinanceira` | Autoria, ação, motivo e estados anteriores/posteriores |

Itens, compromissos, transações, movimentos físicos e documentos só existem quando exigidos pelo fato. Rascunho não deve produzir efeitos de uma operação confirmada.

## Dinheiro e histórico

1. Saldo da conta resulta da abertura e do razão de movimentos; `MovimentoConta` é a fonte dos efeitos de dinheiro. Saldo geral respeita contas ativas incluídas na disponibilidade e o escopo consultado.
2. Compromisso não altera saldo. Compra/serviço integralmente pago no ato não cria compromisso; pagamento parcial cria transação pelo pago e compromisso somente pelo restante.
3. Liquidação não supera o pendente. Transferência entre contas próprias gera duas pontas equivalentes, sem criar receita/despesa pela circulação do dinheiro.
4. Use `Prisma.Decimal` e `dinheiro()` em `regras.ts`; preserve precisão e os formatos dos DTOs existentes.
5. Escritas financeiras respeitam o sítio e `PeriodoFinanceiro` fechado, usam transação e registram auditoria. Confirmados são cancelados/estornados com eventos inversos, sem apagar o fato original.
6. Relatórios/visão geral distinguem competência do fato, dinheiro realizado e pendências. Não use custo de consumo pecuário como nova compra/despesa. Cálculos atuais ficam em `services/financeiro/dashboard.calc.ts` e `services/relatorio-gerencial.calc.ts`, com seus testes.

## Estoque compartilhado

- Recebimento físico independe de pagamento. Compra para estoque recebida gera entrada vinculada à operação; compra a prazo pode aumentar estoque sem alterar conta. Serviço não gera quantidade física.
- Produto não tem setor único: possui centros por `ProdutoCentroCusto`. Categoria é classificação financeira; usos genético, sanitário e nutricional são atributos independentes do Produto e podem coexistir.
- O sítio distingue saldos e custos. Transferência conserva origem/destino, quantidade, unidade, vínculos e custo congelado; não cria nova despesa nem duplica custo no consolidado.
- Ajuste e perda precisam de justificativa e trilha. Estorno conserva o original e seu inverso. O cálculo físico considera o par conforme `statusSaldoEstoque`/`estoque.calc.ts`; não filtre indiscriminadamente apenas confirmados.
- `PartidaProduto` é o lote do produto, distinto do lote de animais. Saldo rastreado exige alocação por partida, compatibilidade de unidade e tratamento explícito de validade desconhecida/vencida na data do fato.
- Ativar rastreio de estoque existente exige prévia; não altera saldo/valor nem cria lote vazio. A identificação de partidas redistribui o histórico sem efeito líquido. Não desative rastreio para contornar uma validação.
- Aplicações sanitárias/fechamentos nutricionais usam o estoque único. Origens de compra direta, aplicação documentada e reconciliação têm efeitos próprios; não substitua uma pela outra para criar saldo fictício.
- Centros, categorias e movimentos de atividades agrícolas anteriores podem permanecer. A remoção dos módulos não autoriza apagar a história financeira ou seus cadastros pelo nome.

A consulta de Estoque reúne valor e produtos com saldo positivo em uma faixa compacta, com atalhos para os filtros de saldo negativo e abaixo do mínimo. Essas contagens usam os saldos do escopo/centro consultado, antes da busca e da paginação locais; não somam unidades diferentes. Últimas entradas ficam em uma seção expansível. As tabelas agrupam classificação/centros, saldo/mínimo e valor/custo médio; o histórico reúne produto/data e os links de estorno junto da origem. Datas, valores desconhecidos, vínculos, permissões e paginação permanecem preservados.

## Permissões e documentos

Rotas exigem sessão, área/ação e escopo. Listagem, detalhe e respostas de criação de operações aplicam contratos explícitos de visibilidade em `services/financeiro/visibilidade.ts`, para todos os tipos de operação. Sem área financeira e `verValores` (ou dono), totais/preços/custos ficam `null`, inclusive itens, parcelas, liquidações/transações/movimentos, atribuições de serviço e impactos de cancelamento. IDs, quantidades, datas, status, autoria e contagens permanecem disponíveis; o mascaramento não altera fatos persistidos. Configurações preservam contas selecionáveis com saldos nulos; respostas de movimentos de estoque também ocultam custos sem essa combinação.

Dashboard, análise por categoria, contas/extratos, compromissos e relatórios financeiros/gerenciais são consultas monetárias: exigem `verValores` no servidor e devolvem 403 antes de consultar dados quando a permissão falta. Relatórios continuam exigindo a aba correspondente, e geração/download também exigem `exportar`. Download de documento financeiro exige `verValores`, pois o arquivo pode conter valores mesmo quando seu DTO foi mascarado. Não existe promessa de extração/expurgo de dinheiro em texto livre de descrição ou em nomes informados pelo usuário.

`lancar` sem `verValores` permite criar uma nova operação por POST com preços manuais, simular parcelas dos dados informados e registrar fatos físicos autorizados. Correção de operação pré-existente (`corrigeOperacaoId`), cancelamento/estorno, liquidação e criação/edição de conta exigem também `verValores` para impedir revisão cega de valores ocultos. Liquidação resolve o sítio de escrita e confere o sítio do compromisso antes de calcular o saldo ou gravar, inclusive na releitura transacional.

Rascunhos financeiros são documentos de edição, não DTOs de consulta: todas as suas rotas exigem `verValores`. Não se retorna um JSON de formulário mascarado para um autosave substituir valores históricos por zero/vazio. Sem essa permissão, o cliente usa envio direto de uma nova operação, sem autosave/retomada/anexos de rascunho. A exigência do servidor também impede sobrescrita, confirmação e exclusão de um rascunho oculto via request direto.

Na interface, o trabalho de rascunho exige `lancar` e `verValores`; acesso de consulta não oferece o atalho de criação. Operadores sem valores recebem orientação sobre envio manual e ausência de autosave, com proteção de saída para dados preenchidos. Valores ocultos aparecem como travessão, nunca como dinheiro zero. Falhas de conexão mantêm os campos preenchidos; o reenvio conserva a chave de idempotência enquanto os dados não mudam.

Cadastros de clientes e fornecedores usam o termo guarda-chuva “parceiro”. Na criação genérica nenhum papel é pré-selecionado: o usuário escolhe ao menos um. A lista de contas precede o gráfico consolidado, sem alterar o período ou o escopo de cada consulta. O aviso de relatório em andamento permite voltar à lista sem continuar nem descartar o rascunho.

As listagens financeiras conservam paginação de quinze registros, sem limitar a altura por uma segunda rolagem vertical interna. Linhas acionáveis não acrescentam seta decorativa: clique e teclado continuam abrindo o registro. Em Compromissos, o saldo pendente aparece junto ao título e a alternância Lista/Calendário fica junto dos filtros, sem faixa repetindo a contagem. A busca dos cadastros aproveita a largura disponível. Campos longos podem aumentar a altura da linha; não se corta conteúdo para impor uma altura física fixa.

Documentos e relatórios usam R2 e chaves persistidas. Rascunhos com anexo e operações confirmadas têm fluxos distintos de acesso; não suponha rota de download onde ela não existe. Confira rotas e `services/financeiro/documentos.ts` antes de mudar esse contrato.

O [assistente de consulta](assistente-consulta.md) reutiliza dashboard, saldos e compromissos por período. Suas ferramentas agregadas exigem `verValores`, `verInvestimento` e `verSalarios`, além da área/aba correspondente, pois não há mascaramento granular confiável desses agregados. A ajuda de uso segue disponível por área/aba. O assistente não grava fatos; as respostas identificam sítio, regime/período e fontes para conferência. A Visão geral aceita `inicio`/`fim` inclusivos pela URL, inclusive navegação no mesmo componente, para manter o recorte do link de conferência.

## Validação

Invariantes, estornos e concorrência ficam nos testes ao lado dos serviços e em `server/tests/financeiro/invariantes.test.ts`. A bateria `test:financeiro:integration` prepara seu próprio banco temporário com migrations. Não depende de seeds antigos nem de checklist de PR. Consulte [desenvolvimento](desenvolvimento.md) para o cenário integrado atual.

## Apresentação do detalhe da operação

Os resumos dos formulários são prévias, sem ícones de aprovação antes da gravação. Quando faltam dados obrigatórios, o formulário informa que a prévia está incompleta; a validação de confirmação permanece junto dos campos e do comando final. O detalhe do relatório mantém tabelas dentro da largura do painel e só compara categoria/centro lado a lado em telas com espaço suficiente. A ficha de conta apresenta os rótulos de tipo em português, preservando os valores do contrato de dados.

Documentos sem anexos e vínculos com Pecuária sem fatos nem itens de consumo direto são ocultados. A consulta de vínculos mantém carregamento e erro com opção de tentar novamente; itens diretos ainda disponíveis para destinação permanecem visíveis mesmo sem procedimentos vinculados.

O detalhe usa linhas compactas para itens e parcelas. A data aparece com ícone junto ao código e status; tipo, parceiro, centro, categoria e classificação usam etiquetas com rótulos acessíveis. Compromissos e estoque aparecem apenas nas respectivas seções, sem faixa duplicada de contagens, com links para cada movimento de estoque. Em telas largas, itens e compromissos dividem a mesma faixa. As orientações de correções e cancelamentos ficam nas respectivas confirmações, sem faixa explicativa no detalhe; efeitos e permissões das ações permanecem inalterados.
