# Reprodução — referência visual aprovada

Segunda proposta, incorporando os 17 comentários da primeira revisão. **Aprovada pelo usuário para implementação.** Prévia independente com dados fictícios; não consulta APIs, banco ou armazenamento do navegador. A implementação está descrita no [contrato de Reprodução](../../../pecuaria/reproducao.md); esta pasta conserva a referência visual e suas fixtures independentes.

## Abrir

[Prévia navegável](http://127.0.0.1:41924) enquanto o servidor estático estiver ativo. Também é possível abrir `index.html` diretamente: fontes e imagens são locais.

```sh
python3 -m http.server 41924 --bind 127.0.0.1 --directory docs/design/reproducao/mockup-v1
```

O processo serve somente estes arquivos. Não inicia API, Vite, migrations ou seed.

## Direção e cobertura

Identidade Terrano preservada: petróleo `#006f68`, lateral sálvia `#dce8e5`, fundo `#f7f8fa`, superfícies brancas e cabeçalho tabular `#e2e7ea`. Manrope em títulos e DM Sans em controles/dados. A referência é o sistema descrito em `client/PRODUCT.md` e `client/DESIGN.md`; a prévia independente não reutiliza os componentes React/Radix e não comprova equivalência funcional.

- **Animais:** abre em Todas; Situação fica no modal de filtros. Pendências aparecem no topo com ação que filtra os animais. Foram retirados os seletores grandes e “Consultar todos”.
- **Agenda:** busca ocupa a largura disponível; controles seguem a barra de consulta.
- **Protocolos:** aba renomeada, cartões/tabela para grupos de animais usando um modelo/versionamento. A nomenclatura da aba não une o modelo do protocolo à sua programação. O endereço ilustrativo `#programacoes` foi preservado.
- **Partos:** cartões/tabela próprios; data e desfecho em colunas separadas. Identificação da matriz abre a ficha; a ação do evento abre parto/pós-parto. A identificação da cria abre seu registro, inclusive quando não existe animal ativo.
- **Pós-parto:** apresenta avaliações, escore com escala, peso da matriz e retenção de placenta com ações demonstráveis. Colostro fica no detalhe da cria viva. Não há calendário clínico presumido.
- **Indicadores:** três taxas e desempenho por período. Pendências fora da base têm aviso de resultado parcial e lista consultável. Sem subabas, memória de cálculo expandida ou texto de rodapé repetido.
- Cabeçalho sem os atalhos genéricos Relatórios/Configurações. Busca/filtros e alternância de apresentação conservam o estado em memória durante a sessão; não há persistência após recarga.

Navegação usa âncoras reais. As outras áreas da lateral são contexto visual. Formulários de registro são recortes ilustrativos: “Concluir simulação” apenas exibe uma mensagem e não insere dados nem altera os resultados.

## Cálculo demonstrativo da base válida

Os números agora são calculados em JavaScript a partir de `indicatorFacts`, não são valores estáticos trocados por rótulo. Cada fato representa um animal em uma das três janelas fixas de 21 dias, com elegibilidade conhecida ou pendente e tentativa opcional com resultado conhecido. Os dados são fictícios e independentes da situação clínica atual exibida na ficha de exemplo.

Somente fatos de animais válidos entram em numeradores e denominadores. A fixture inclui uma tentativa de animal pendente para verificar sua exclusão. Lote e papel restringem a população; tipo de tentativa restringe os serviços/tentativas considerados nessa população. O período inclui apenas as janelas completas da fixture contidas no intervalo escolhido; não gera nem desloca janelas fora dela.

- Serviço = serviços da base válida / exposições elegíveis válidas × 100.
- Concepção = positivas da base válida / tentativas válidas com resultado × 100.
- Prenhez = serviço × concepção / 100, antes de arredondar para apresentação.
- Totais somam numeradores/denominadores dos períodos, sem fazer média das porcentagens. Os nove animais reaparecem nos três períodos: 27 exposições, não 27 animais distintos.
- Denominador ausente mantém taxa indefinida, exibida como “Sem base suficiente”. Pendência não vira zero.

Exemplo inicial: 9 animais válidos, 3 pendentes, 27 exposições elegíveis, 18 serviços e 12 positivas: serviço 66,67%, concepção 66,67%, prenhez 44,44%. Novilhas: 3 válidas, 1 pendente, 9 exposições, 6 serviços e 5 positivas: 66,67%, 83,33% e 55,56%.

Este demonstrador **não replica a metodologia completa do servidor**: PEV proporcional, ciclos históricos, localização temporal, diagnósticos abertos, estimativas e deslocamento analítico de TE não estão implementados. Os parâmetros desses outros cálculos não aparecem como controles fictícios. O aplicativo usa a metodologia V2 de base válida documentada no contrato; os exemplos desta prévia continuam independentes do servidor. A aprovação desta prévia não valida resultados da fazenda nem altera emissões preservadas.

## Recursos, evidências e limites

Marca de `client/src/components/TerranoLogo.tsx`; paisagem de `client/src/assets/financeiro/paisagem-cooperativa.png`; Manrope de `client/public/fonts/manrope`; DM Sans dos recursos locais da prévia de Leite. Nenhuma imagem gerada por IA.

Revisão orientada pelas skills Impeccable e frontend-design, preservando o sistema herdado. O detector desta revisão está em `detector-v2.json`: um aviso sobre `border-top:3px` da timeline anterior, que não é cartão arredondado. Não se aplica aos cartões novos; não houve normalização global.

Verificados no mockup: sintaxe JS; asserções do cálculo por base, lote, período, tipo e falta de base; exclusão dos pendentes dos numeradores; navegação das cinco abas; aplicar/cancelar filtro; alternância Cartões/Tabela; identificação da cria; modal de escore. Console sem erros na coleta. Usar exclusivamente `capturas-v2/` como referência visual desta revisão; parte dos arquivos de `capturas/` foi sobrescrita durante a coleta.

As verificações de cálculo usam os dados fictícios desta prévia. Estas evidências pertencem somente à prévia; a validação da implementação é separada. Capturas móveis não equivalem a homologação em aparelho físico. As decisões vigentes foram incorporadas ao [contrato de Reprodução](../../../pecuaria/reproducao.md).
