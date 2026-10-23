# Proposta: builder em página dedicada

Mockup isolado, com dados fictícios e estado apenas em memória. Não altera os cadastros reais, não inscreve animais e não movimenta estoque. Recarregar reinicia a demonstração. A composição usa a página Nova operação como referência: editor principal e revisão com ações ao lado.

## Fluxos para revisão

- O cadastro de origem nas Configurações define o domínio, sem campo de área no formulário. O breadcrumb identifica Protocolos sanitários ou Protocolos reprodutivos. Na implementação, o servidor deve validar esse escopo.
- Começar do zero ou selecionar uma versão existente do mesmo domínio como base. A busca e a seleção da base paginam em até dez itens.
- Usar como base cria, por padrão, uma **nova versão do mesmo protocolo**, conforme confirmação do usuário. O nome identifica o protocolo-base e fica preservado neste percurso. Começar do zero cria um novo protocolo na versão 1. A numeração é ilustrativa no mockup; na implementação vem de `proximaVersao`/validação do servidor, sem pressupor que a versão selecionada seja a última.
- A cópia contém somente a estrutura configurável, sem participantes, atendimentos, resultados ou custos realizados. A versão original permanece preservada.
- No início do zero, editar nome; na derivação, preservar o nome do protocolo-base. Em ambos os percursos, editar finalidade, etapas, intervalos, instruções, modo, procedimentos, produtos e quantidades. Etapas, procedimentos e composição de produtos paginam em até dez itens. O resumo de produtos é por animal, sem presumir o tamanho de uma futura turma.
- Trocar a origem solicita descarte explícito no próprio conteúdo. Trocar a base conserva o contexto do cadastro de origem.

O fluxo possui uma única ação **Salvar protocolo**, com validação completa. Não inclui rascunhos, autosave ou publicação separada; a referência de Nova operação diz respeito ao formato de página.

## Implementação vigente

A proposta aprovada foi incorporada aos cadastros sanitário e reprodutivo, nas rotas de Configurações terminadas em `/protocolos/novo`. O contrato atual, os limites e a compatibilidade legada estão em [Protocolos e exames](../../../protocolos-exames.md#cadastro-de-modelos-finalidade-parâmetros-e-compatibilidade). A página real está em `PaginaCadastroProtocolo.tsx`; os HTMLs desta pasta permanecem como referência ilustrativa, sem persistência.

## Limites da demonstração

As consultas são simuladas. Não há saldo, preços, cópia de banco ou gravação real. Os exemplos não prescrevem manejo clínico. A revisão visual usa Impeccable; a skill `frontend-design` mencionada em `AGENTS.md` não foi localizada no ambiente. `mobile.html` apresenta o mesmo documento em um iframe de 390 px para conferir as regras responsivas, sem simular um dispositivo real.

## Verificação do mockup

Sintaxe JavaScript conferida. No navegador, foram verificados a seleção paginada da base, a derivação ilustrativa v2 → v3, a troca de produto com quantidade a revisar, unidade herdada e via condicional, além da composição lateral atualizada. A conferência visual cobriu desktop e o documento em largura de 390 px. Isso valida a demonstração; não comprova persistência ou integração no sistema.

## Entradas da demonstração

- Reprodutivo: `index.html`.
- Sanitário: `index.html?contexto=sanitario`.

O parâmetro representa apenas as duas entradas deste mockup estático. Na aplicação real, cada página recebe o contexto da respectiva rota de cadastro nas Configurações, sem seleção de área pelo usuário. Trocar a base mantém esse contexto.
