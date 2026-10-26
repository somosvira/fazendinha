# Proposta navegável para as páginas V5

Mockup para avaliação, sem integração de dados ou gravações. Abra com o Vite em execução: `http://localhost:41875/mockups/v5/index.html`.

O seletor superior percorre as 12 telas: Ordenhas, Registro da ordenha, Controle individual, Produção, Estoque, Coletas, Qualidade, Vendas, Alimentação e descarte, Configurações de produção, Partos e pós-parto e Indicadores reprodutivos. O seletor, as abas disponíveis e os atalhos para registro/configuração trocam a tela da prévia. As demais abas de Reprodução estão desativadas. A navegação usa apenas estado local, sem alterar as rotas do produto.

Os diálogos são placeholders de abertura contextual, sem detalhes completos nem aplicação de filtros. Campos editáveis, alternâncias de turno/período, seleção de sítio e mensagens de salvamento somente simulam estados locais; não consultam APIs, não persistem dados e não comprovam a operação dos fluxos. Busca e filtros não recortam os registros ilustrativos. Todos os nomes, números e registros são ilustrativos.

A proposta reutiliza os componentes shadcn/ui de `client/src/components/ui`, o símbolo da marca e o tema vigente. Não modifica rotas, serviços, páginas operacionais nem o design system aprovado. As capturas locais em `output/mockups-v5/` são evidência de renderização desktop, não homologação funcional ou de dispositivos móveis. A composição foi aprovada e incorporada às telas reais; o comportamento vigente está em [docs/pecuaria/leite.md](../../../docs/pecuaria/leite.md).

A referência visual permanece em `client/PRODUCT.md`, `client/DESIGN.md` e `docs/design/cooperativa-unificada.md`. O CSS desta prévia contém ajustes locais de composição, tamanhos e cores; eles não redefinem os tokens compartilhados nem estabelecem um novo padrão aprovado. As regras responsivas presentes no arquivo também não constituem validação em dispositivos móveis.

As regras permanecem em `docs/pecuaria/leite.md` e `docs/pecuaria/reproducao.md`. Na implementação, preservar permissões, estados de carregamento/erro/vazio, URL/filtros e dados exatos dos registros. Não derivar funcionalidade ou cálculos dos valores desenhados neste mockup.
