# Registro local — protocolos unificados

A implementação local dos fluxos sanitário/reprodutivo e individual/coletivo está em validação. O contrato vigente, a estrutura, os serviços, o calendário, as permissões e os efeitos estão em [Protocolos, exames e papéis reprodutivos](protocolos-exames.md); o material visual e o catálogo de metadados estão na [base documental](artefatos/protocolos/index.html).

O escopo usa sete tabelas centrais, incluindo `EventoTarefaProtocolo` e `ParticipacaoProtocolo.origemCalendario`, com paginação operacional de até dez itens. A migration `20261019190000_eventos_tarefas_protocolos` foi aplicada localmente. O catálogo registra apenas metadados do schema.

Os calendários legados preservam sua interpretação e histórico; prévias de recálculo não gravam e mudanças que afetem previsões exigem ciência explícita. Não atendimento e adiamento não criam fatos clínicos nem movimentam estoque. O IDEAGRI permanece fonte de carga inicial e reconciliação, sem sincronização contínua presumida. A implementação ainda não representa homologação manual/de campo nem publicação em produção.
