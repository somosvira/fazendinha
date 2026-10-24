# Ajustes aprovados de origens e escolha do tanque

Os componentes React da V5 incorporam a revisão do mockup: seleção de um tanque por vez, pré-seleção histórica de origens e ações apresentadas por componentes compartilhados. Origens e gestão de tanques usam `PainelCadastro`, `Button`, `Checkbox` e `SelectCampo`. Os detalhes secundários usam `SecaoDetalhesLeite`, baseado em `Collapsible` e `Button`, preservando o conteúdo ao recolher. As regras operacionais e os limites estão no [contrato de leite](../../../../pecuaria/leite.md).

## Conferência visual

Capturas de 23/10/2026 dos componentes reais, carregando o tema da aplicação em uma montagem local com respostas simuladas. Não foram usados API operacional, banco nem dados reais. A primeira aferição fictícia conserva suas origens; a nova pré-seleciona os animais devolvidos pela consulta simulada. Essas capturas comprovam somente a renderização e os estados percorridos, não o cálculo no banco ou homologação da fazenda.

- [Escolha do tanque, painel de origens e ações](ordenha.png).
- [Modal de origens em viewport interno de 390 px](mobile-origens.png).

A inspeção conferiu desktop e celular, acesso ao painel de origens e disposição dos botões/rodapés. Regressões automatizadas cobrem seleção na data, preservação da composição histórica, remoção explícita de origem antiga, confirmação ao cancelar, troca de tanque com rascunho e campos de confirmação preservados, versão histórica do tanque e expansão de detalhes sem perder conteúdo.

Migrations e deploy não foram executados. A implementação continua sujeita à aplicação autorizada das migrations já versionadas e à integração/homologação operacional.

Após a integração da main, `SecaoDetalhesLeite` passou a adaptar `SecaoRecolhivel` do Rebanho; os conteúdos e rascunhos seguem montados. Veja a [verificação dos componentes compartilhados](../integracao-main-20261024/README.md).
