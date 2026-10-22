# Prévia visual V5 a partir da main

Mockup descartável e navegável. Não altera rotas, serviços, permissões ou dados do sistema. Todas as informações são fictícias; as interações são simulações em memória e se perdem ao recarregar.

## Referência visual

Main `895ae3d3de6a1ce43cf95ceaecdc527375413d3b`. Fontes exatas em `referencias.json`. Reutiliza cores, tipografia, lateral, abas e tratamento de tabelas da main. Essa main foi incorporada à branch V5 preservando as alterações locais. O usuário aprovou a estilização desta prévia; ela está aplicada ao módulo V5. As [capturas da implementação](../implementacao-main/README.md) usam os componentes reais e dados simulados, separadamente deste protótipo.

## Proposta

Seis consultas principais: Ordenhas, Produção, Estoque, Coletas, Qualidade e Vendas. As demais rotinas ficam em um menu secundário. Essa organização foi aplicada preservando os identificadores de URL e o acesso às rotinas secundárias.

A produção diária e mensal, as retiradas físicas, os resultados de qualidade e a venda por comprador/período permanecem legíveis separadamente. O preço da retirada fica pendente até o fechamento comercial. Custos não são inferidos da receita. A configuração demonstra duas ou três ordenhas sem limitar o contrato real a essas quantidades.

## Verificação

Sintaxe JavaScript conferida com `node --check`. Inspeção visual no navegador desktop e em iframe de 390 px. Filtro de pendentes e troca para duas ordenhas conferidos pela interface. A confirmação no estoque fica desabilitada enquanto a sessão possui animais sem registro. Isso não constitui teste da implementação V5 nem homologação operacional.

Abra `index.html` para desktop ou `mobile.html` para a prévia em 390 px. `desktop.png` registra a aparência avaliada. Não foram executados migrations, deploy ou acesso ao banco.
