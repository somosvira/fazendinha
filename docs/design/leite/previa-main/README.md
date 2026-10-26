# Prévia navegável da V5 e ajustes em revisão

## Referência da revisão de produto — 24/10/2026

A [prévia de revisão de produto](revisao-produto/index.html#ordenhas) apresenta a reorganização dos 18 comentários, configuração de colostro e estoque compartilhado, conforme o [contrato vigente](../../../pecuaria/leite.md#interface-de-produção). A referência foi incorporada à V5; este arquivo conserva a prévia ilustrativa e sua proveniência, não representa a aplicação conectada. O contrato vigente distingue o que foi implementado.

Essa versão é independente e preserva os arquivos da prévia anterior abaixo. Dados e efeitos são ilustrativos, em memória; nenhuma chamada à API ou escrita no banco faz parte do protótipo. Os limites e fluxos da nova proposta ficam no [README próprio](revisao-produto/README.md).

O Impeccable e as referências reais de Rebanho/Nutrição orientam esta rodada. A skill `frontend-design`, citada em `AGENTS.md`, não foi localizada na instalação atual; não se declara revisão por essa skill.

## Prévia anterior

Mockup descartável e navegável. Não altera rotas, serviços, permissões ou dados do sistema. Todas as informações são fictícias; as interações são simulações em memória e se perdem ao recarregar.

## Comentários incorporados à prévia

Os ajustes abaixo foram solicitados na revisão do navegador e estão demonstrados neste HTML. Após aprovação, foram incorporados ao código da V5 conforme o [contrato funcional](../../../pecuaria/leite.md). As [capturas dos componentes reais](../implementacao-main/ajustes-origens-tanques/README.md) usam fixtures; a execução das migrations, integração e homologação continuam separadas deste mockup.

- Aferições novas pré-selecionam animais com **finalidade Leite e DEL > 0 na data da ordenha**. DEL 0, ausência de evidência e outra finalidade ficam fora do critério. A seleção pode ser conferida em um painel próprio. Origens já salvas conservam seu snapshot e exigem edição explícita; não são recalculadas ao abrir a tela. Os dados de finalidade/parto desta demonstração são fictícios e não comprovam elegibilidade real.
- O operador **escolhe o tanque** e vê somente o formulário correspondente. Uma ordenha pode usar um único tanque; os demais cadastrados são opções, não aferições obrigatórias. Trocar de tanque conserva seus rascunhos por data/ordenha/tanque. O resumo conta aferições salvas e não anuncia cobertura completa de todos os tanques.
- **Orientação visual do usuário:** não usar texto colapsável nativo nem texto com aparência de link para ações. Usar componentes visíveis ou um componente de expansão com cabeçalho, controle e estados próprios; ações devem ter aparência de botão. Esta revisão usa painéis e botões compartilhados em `components.js`, além de componentes específicos para origens e escolha/gestão dos tanques, mantendo a paleta e os modais.
- Os controles de recuperação do protótipo ficam em **Sobre esta prévia → Estados da prévia**, separados da operação diária. Simular falha, lista vazia e restaurar produtos usam o mesmo componente de botão.

## Referência visual

Main `895ae3d3de6a1ce43cf95ceaecdc527375413d3b`. Fontes exatas em `referencias.json`. Reutiliza cores, tipografia, lateral, abas e tratamento de tabelas da main. Essa main foi incorporada à branch V5 preservando as alterações locais. O usuário aprovou a estilização desta prévia; ela está aplicada ao módulo V5. As [capturas da implementação](../implementacao-main/README.md) usam os componentes reais e dados simulados, separadamente deste protótipo.

## Fluxos representados

Seis consultas principais: Ordenhas, Produção, Estoque, Coletas, Qualidade e Vendas. As demais rotinas ficam em um menu secundário. Essa organização foi aplicada preservando os identificadores de URL e o acesso às rotinas secundárias.

A produção diária e mensal, as retiradas físicas, os resultados de qualidade e a venda por comprador/período permanecem legíveis separadamente. O preço da retirada fica pendente até o fechamento comercial. Custos não são inferidos da receita.

- **Ordenhas:** aferição geral por tanque, régua em milímetros e litros daquela ordenha; natureza, animais de origem e confirmação posterior no estoque. O controle individual periódico permanece disponível e não duplica os litros da fonte geral.
- **Configuração:** quantidade e nomes das ordenhas, fonte da produção e intervalo individual em dias ou meses, com vigência. Cadastro de tanques com especificações e versões da tabela de conversão. Os poucos pontos ilustrativos da tabela não substituem a calibração completa; não há interpolação automática.
- **Ficha do animal:** aba Produção com controles individuais por data/ordenha e análises individuais, sem extrapolar o controle mensal para dias sem medição.
- **Qualidade:** amostras coletivas e individuais, separando coleta da amostra, resultado laboratorial, recebimento do laudo e cadastro. Campos sem resultado permanecem pendentes. Correção de datas conserva histórico e versões.
- **Vendas e relatórios:** fechamento por comprador/período, preço negociado e seleção de amostras. Relatórios anteriores conservam seu corte; uma nova emissão captura o fechamento atual. Valores podem ser ocultados na leitura e na exportação simulada.
- **Estados e modais:** recuperação de falha de produtos sem perder preenchimento e confirmação antes de descartar alterações de formulários.

O cenário inicial usa 23/10/2026, três ordenhas e controle individual mensal. Recarregar restaura todos os exemplos. As rotinas secundárias continuam resumidas ao recorte do protótipo.

Referências funcionais: [contrato de leite](../../../pecuaria/leite.md), [qualidade](../../../pecuaria/leite-qualidade.md), [comercialização](../../../pecuaria/leite-comercial.md) e [relatórios](../../../pecuaria/leite-relatorios.md), comparados à interface atual da branch. Este HTML aproxima os fluxos para revisão; não é uma cópia executável dos componentes React nem comprova suas regras no servidor.

## Verificação

Na atualização anterior de 23/10/2026 foram conferidos sintaxe, desktop/390 px, régua, cancelamento, recuperação, ficha individual, datas do laudo, fechamento e preservação de relatórios. A rodada de comentários acrescenta conferência da pré-seleção (incluindo exclusão de DEL 0 e finalidade Reprodução), troca de tanque preservando rascunho, gravação com somente um tanque, gestão dos tanques e botões dos estados simulados. Sintaxe JavaScript e diff conferidos. Isso não constitui teste da implementação V5 nem homologação operacional.

Abra [index.html](index.html#ordenhas) para desktop ou [mobile.html](mobile.html) para a prévia em 390 px. As capturas atuais estão em [revisao-atual/](revisao-atual/); `desktop.png` e `mobile.png` na raiz permanecem como referência visual anterior. Não foram executadas migrations, deploy ou acesso ao banco.
