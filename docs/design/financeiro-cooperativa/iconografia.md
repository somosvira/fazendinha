# Iconografia — Cooperativa contemporânea

Implementação na branch `codex/financeiro-cooperativa-contemporanea`. Fonte: PNGs em `output/design/financeiro-cooperativa-2026-10-10/`. A imagem 01 define sidebar e dashboard; as demais definem controles locais. Os PNGs gerados não possuem vetores originais. O catálogo identifica o desenho usado e sua conferência, sem prometer identidade pixel a pixel.

## Tratamento comum

- Biblioteca instalada: `lucide-react`. Sem nova biblioteca, emoji ou fonte de símbolos.
- Sidebar: ícones 18 px; destinos internos 16 px; traço 1,7 px, terminais arredondados, `currentColor`. Seleção mantém o mesmo desenho.
- Cabeçalho de painel: círculo sálvia `--fin-sidebar` de 36 px, desenho floresta `--primary` de 20 px com traço 1,8 px, gap 12 px. Formulário: círculo 28 px, desenho 16 px, mesmo tratamento.
- Refinamento dos modais/folhas após os feedbacks de 11/10: cabeçalho sálvia e círculo floresta com desenho branco, mantendo tamanho, espessura, geometria e orientação do inventário. O símbolo Terrano no documento financeiro usa cinza para impressão; a marca da interface mantém suas cores.
- Ações/filtros: 16 px, traço 1,8 px, gap 8 px; sem fundo individual dentro de um botão já identificado. Fechar: 18 px; chevron de navegação: 14–16 px.
- Indicadores: 16 px, floresta; quando há fundo individual, 28 px sálvia. Indicador de atraso preserva vermelho sem transformar seta financeira em alerta.
- Todo desenho decorativo é `aria-hidden`; controles conservam nomes acessíveis e alvo de toque. A marca Terrano utiliza o vetor original, sem redesenho.

## Catálogo canônico

| Papel | Referência / região | Desenho existente escolhido | Tratamento |
| --- | --- | --- | --- |
| Marca | 01, topo esquerdo | `TerranoSymbol` original | Marca original |
| Busca global e filtros de texto | 01 topo; 02 barra de filtros | `Search` | Ação |
| Recolhimento | 01 topo | SVG existente de painel com seta | Sidebar |
| Sítio | 01 seletor | Vetor existente `Layers` | Sidebar |
| Financeiro | 01 grupo | SVG existente de cifrão | Sidebar |
| Visão geral | 01 seleção | SVG existente de quatro quadrados | Sidebar |
| Operações | 01 destino | SVG existente quadrado com sinal + | Sidebar |
| Compromissos | 01 destino | `CircleDollarSign` | Sidebar |
| Contas e extratos | 01 destino | `Wallet` | Sidebar |
| Configurações financeiras | 01 destino | `Settings` | Sidebar |
| Relatórios | 01 destino | `FileText` | Sidebar |
| Pecuária | 01 grupo | Vetor existente de cabeça bovina | Sidebar |
| Estoque | 01 destino | Vetor existente de caixa | Sidebar |
| Trabalhos em edição | 01 trabalhos ativos | `FilePenLine` | Sidebar |
| Contas/disponibilidade | 01 painel superior esquerdo; 11 | `Landmark` | Cabeçalho |
| Conta bancária | 01 lista; 12 identificação | `Landmark` | Ação |
| Caixa físico | 01 lista | `ClipboardCheck` | Ação |
| Fluxo realizado | 01 painel superior direito | `ArrowUpDown` | Cabeçalho |
| Recebimento | 01 indicador realizado | `ArrowUpRight` | Indicador |
| Pagamento | 01 indicador realizado | `ArrowDownRight` | Indicador |
| A pagar | 01 compromissos; 05 | `ArrowUpRight` | Indicador |
| A receber | 01 compromissos; 05 | `ArrowDownLeft` | Indicador |
| Compromissos / vencimentos | 01 painel central; 05/08 | `CalendarDays` | Cabeçalho / indicador |
| Expandir calendário | 01 calendário | `Maximize2` | Ação |
| Mês anterior / próximo | 01 calendário; 06 | `ChevronLeft` / `ChevronRight` | Ação |
| Categorias / classificação | 01 painel inferior; 03/27 | `ChartPie` | Cabeçalho |
| Ver todos / abrir linha | 01 links; 02 linhas | `ChevronRight` | Ação |
| Nova operação / novo item / cadastro | 01/03/14 | `Plus` | Ação |
| Operações do período | 02 lista | `Layers` | Cabeçalho |
| Identificação da operação | 03 primeiro grupo | `Info` | Cabeçalho de formulário |
| Itens da operação | 03 itens | `Package` | Cabeçalho de formulário |
| Revisão dos efeitos | 03 lateral | `ListChecks` | Cabeçalho de formulário |
| Efeito financeiro | 03 | `ArrowUpDown` | Cabeçalho de formulário |
| Documentos / anexar | 03/09 | `Paperclip` | Cabeçalho / ação |
| Documentos preservados | 04 | `FileText` | Cabeçalho |
| Procedimentos vinculados | 04 | `Link` | Cabeçalho |
| Arquivo / relatório | 03 anexo; 24 lista | `FileText` | Ação |
| Excluir anexo/item | 03/09 | `Trash2` | Ação destrutiva |
| Confirmar efeito / sucesso | 03 revisão; 13 | `Check` | Ação |
| Lista / calendário | 05/06 controle | `List` / `CalendarDays` | Ação |
| Liquidar compromisso | 09/10 | `ArrowUpRight` / `ArrowDownLeft` | Cabeçalho |
| Histórico / voltar | 04/12 | `ArrowLeft` | Ação |
| Transferência entre contas | 13 | `ArrowLeftRight` | Cabeçalho / ação |
| Informação / revisão de consequência | 13 | `Info` | Indicador neutro |
| Contas cadastradas | 14 aba | `Building2` | Ação |
| Clientes e fornecedores | 15 aba; 20 | `Users` | Ação |
| Produtos | 16 aba; 21 | `Package` | Ação |
| Categorias cadastradas | 17 aba; 22 | `Tags` | Ação |
| Centros de custo | 18 aba; 23 | `Target` | Ação |
| Editar | 14–18 ações | `Pencil` | Ação |
| Desativar / reativar | 14–18 ações | `PowerOff` / `Power` | Ação |
| Baixar PDF/documento | 24/26; 04 | `Download` | Ação |
| Atualizar | 24 | `RefreshCw` | Ação |
| Cancelar operação / alerta | 28 | `CircleAlert` | Cabeçalho destrutivo |
| Serviço / procedimentos | 29 | `Stethoscope` | Cabeçalho |
| Fechar diálogo/folha | 08–10/13/19–23 | `X` | Ação |
| Menus de ações | 02/04 | `MoreHorizontal` | Ação |

## Conferência

Desenho, orientação, tamanho, traço, cor e fundo foram conferidos nas capturas da implementação em 11/10/2026. As evidências consolidadas e os limites estão em [design-qa.md](../../../design-qa.md); os recortes do fluxo, documentos e vínculos registram as correções finais. Os vetores reais do sistema têm precedência sobre ambiguidades de pixels gerados, mantendo a geometria canônica em todas as telas. Divergências são registradas no relatório `design-qa.md`; esta lista não equivale a uma aprovação visual antecipada.

Papéis ausentes nas previews (spinner, permissão, tipo de operação adicional, reordenação, vínculos condicionais de pecuária e estados específicos de relatório) preservam os ícones existentes como extensões. Não removê-los para imitar o PNG.
