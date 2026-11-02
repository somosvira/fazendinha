# Mockup de nutrição para aprovação

Situação: referência visual aprovada na conversa para implementação. Os dados do mockup são demonstrativos, sem acesso ao banco. O contrato implementado e os limites de validação estão em [Nutrição mensal](../../pecuaria/nutricao-mensal.md).

Direção: operação de fazenda, leitura de quantidades e consequências de estoque. Uma família tipográfica de sistema; texto #243e36, ação #256347, fundo #f5f7f6, superfície #ffffff, atenção #fff5df. Formulário de configuração em linhas explicativas; fechamento centrado na tabela de ingredientes, sem cartões de indicadores que repitam valores. Alertas apresentam motivo e ação.

Revisão com as orientações de impeccable (Operate) e frontend-design:

- Modelo automático recomendado, mas escolha confirmada explicitamente; calendário e autorização de seleção por validade separados.
- Revisão mensal mostra baixado, revisado e diferença lado a lado. Não soma unidades nem repete baixa na confirmação.
- Justificativa aparece quando há diferença. Campos inválidos impedem a confirmação simulada.
- Origem estimada permanece explícita após revisão. Perda não é tratada como devolução.
- Foco visível, labels nos campos, mensagens de status e tabela rolável em largura estreita.
- Controles demonstrativos identificados como simulação, sem sugerir persistência real.

Validação realizada: sintaxe JavaScript e unicidade de IDs. Renderização visual e navegação real ainda não verificadas. A política do navegador integrado bloqueou a abertura local nesta conversa; não foi contornada.

O usuário aprovou a aplicação do mockup conforme AGENTS.md. A implementação inclui estados carregando, erro recuperável, sem dados, sem permissão e confirmação concorrente; conectar consultas e escritas aos serviços transacionais.
