# Interface V5 no padrão da main

A estilização do mockup aprovado está aplicada aos componentes reais de `/pecuaria/leite`. A implementação reutiliza tokens do tema Cooperativa, fontes e shell da main; não cria um design system paralelo. O [contrato funcional](../../../pecuaria/leite.md#interface-de-produção) descreve navegação, URLs e estados preservados.

## Referência e diferenças funcionais

A [prévia aprovada](../previa-main/index.html) orienta as seis consultas principais, o menu de rotinas, sessões de ordenha e resumo lateral. O aplicativo conserva mais contexto que a ilustração: status de persistência, salvar por animal, exclusões justificadas e cobertura parcial. A confirmação física continua no fluxo Estoque, com conferência dos grupos de animais; o botão simulado do mockup não foi tratado como comando de gravação. Configuração aceita uma a doze posições, com vigência, nomes, ordem e horários; não somente duas ou três.

Os cabeçalhos compactos de tabela mantêm 12–13 px, conforme a implementação da main e a prévia, com corpo de 14 px; trata-se da variante local, sem alterar a escala global.

Produção, Coletas e Vendas reorganizam suas tabelas em cartões no celular, sem retirar campos ou ações. Ordenhas conserva edição por animal e situação. Tabelas auxiliares extensas, como laudos, mantêm rolagem local. “Mais rotinas” usa o menu Radix e mantém teclado, foco, rotina selecionada e todos os identificadores de URL existentes.

## Evidência visual

Capturas do aplicativo React real, com respostas HTTP interceptadas e dados inteiramente ilustrativos. Nenhuma requisição de gravação foi encaminhada à API; nenhum banco foi consultado ou alterado. Desktop em 1440 × 1000 e celular em 390 × 844. As imagens mostram o estado de uma interface em teste, não registros da fazenda.

- [Ordenhas — desktop](ordenhas-desktop.png) e [primeira dobra](ordenhas-primeira-dobra.png).
- [Ordenhas — celular](ordenhas-mobile.png).
- [Configuração — celular](configuracao-mobile.png), com conteúdo rolável e fechamento por Escape.
- [Vendas — celular](vendas-mobile.png).

Foram conferidos seis destinos principais, o menu secundário por teclado, abertura/fechamento da configuração e ausência de rolagem horizontal no documento da ordenha. Testes automatizados cobrem navegação/URL, permissões e fluxos de leite. O detector visual apontou apenas um raio legado de 5 px, ajustado à escala compartilhada de 8 px. O acabamento não autoriza aplicação de migrations, publicação de ambiente nem aprovação dos roteiros manuais existentes.

A revisão independente das capturas e fontes não identificou bloqueio material no recorte inspecionado. Jornadas com dados reais, SQL, R2, concorrência, dispositivos físicos e homologação da fazenda continuam separadas dessa evidência. Os documentos `client/PRODUCT.md` e `client/DESIGN.md` permanecem como referência compartilhada; nenhuma alteração de identidade global foi necessária.
