# Caderno de campo — direção visual

Direção visual das áreas operacionais (Financeiro, Estoque, Pecuária, Configurações). Substitui a identidade "cooperativa" (petróleo, Manrope + DM Sans, sombras e cartões arredondados). A estrutura das telas, as permissões, as URLs e os contratos de dados não mudam com ela.

## Para quem

Quem administra a fazenda: passa o dia conferindo o que venceu, o que falta registrar e onde está cada animal. As telas são ferramentas de trabalho, não vitrines. Por isso leitura e comparação vêm antes de decoração.

## Princípios

1. **Listas abrem em tabela.** `useVisualizacaoConsulta` usa `tabela` como padrão. Cartões continuam disponíveis no alternador e só são o padrão quando mostram algo que a tabela não mostra: calendário, linha do tempo, prazos, gráficos, as ordenhas do dia, sítios e a ficha do animal.
2. **Um único marcador de destaque.** O dourado do colostro (`--campo-ouro`) marca só "onde você está": a página atual na navegação lateral e a aba atual. Não é usado em texto nem em decoração.
3. **Sem enfeite que repete o rótulo.** Sem sombra no que está na página (só menus e diálogos flutuam), sem ícone em caixa ao lado do título, sem seta no fim de links, sem rótulo em caixa alta acima do título.
4. **Uma família tipográfica.** Public Sans (OFL, hospedada em `client/public/fonts/public-sans/`): desenhada para formulários e dados públicos, com números tabulares e zero sem corte. Todos os números usam algarismos tabulares.
5. **Abas são marcadores, não pastas.** Um único estilo (`styles/abas.css`): rótulo sem ícone, sublinhado dourado na aba atual, conteúdo com espaço próprio abaixo.

## Tokens

Definidos em `client/src/styles/cooperativa-theme.css`; todo o restante deriva deles.

| Token | Valor | Uso |
| --- | --- | --- |
| `--campo-papel` | `#f5f6f2` | fundo da aplicação (branco-cal frio, não creme) |
| `--campo-folha` | `#ffffff` | painéis, tabelas, barra lateral |
| `--campo-tinta` | `#1e2621` | texto principal e títulos |
| `--campo-tinta-2` | `#56615a` | texto de apoio (contraste 6,4:1 sobre branco) |
| `--campo-linha` / `--campo-linha-forte` | `#dce0d9` / `#a9b2a6` | divisórias / contorno de controles |
| `--campo-pasto` | `#2c5a3f` | ação principal, seleção, valores positivos |
| `--campo-ouro` | `#a87a1f` | marcador de página e aba atuais |
| `--campo-atraso` | `#a3312a` | vencido, erro, ação destrutiva |
| `--campo-atencao` | `#7a5410` | atenção (com fundo `--campo-atencao-claro`) |

Raio: 6px em controles, 8px em painéis, 4px em etiquetas. Títulos de página com 24px (21px no celular), peso 700.

## Onde está no código

- `styles/cooperativa-theme.css`: tokens.
- `styles/campo.css`: decisões globais (tipografia, sem caixa alta, sem sombras, ícones de título, navegação lateral). Carregado por último em `App.tsx`.
- `styles/abas.css`: abas.
- `styles/operacional-aprovado.css`: densidade de tabelas e formulários, agora sobre os tokens.

## Ficha do animal

A ficha foi montada para o contexto de uso da fazenda. Ela recebe paleta, fonte e abas, mas não perde seções, ordem, blocos nem o modo de apresentação: os alertas e históricos da ficha continuam abrindo como antes. A regra que esconde ícones de título exclui `.pec-ficha`. Se a organização da ficha servir de modelo para outras telas, ela deve ser reaproveitada, não alterada.
