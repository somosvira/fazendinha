# Proposta navegável de Reprodução

Mockup aprovado como referência de composição para as telas operacionais de Reprodução. A prévia usa dados ilustrativos; o comportamento vigente está em [docs/pecuaria/reproducao.md](../../../docs/pecuaria/reproducao.md). Com o Vite em execução, abra [a prévia de Reprodução](http://localhost:41875/mockups/reproducao/index.html).

O seletor superior percorre nove telas:

1. Animais e acompanhamentos
2. Agenda
3. Protocolos
4. Programação IATF
5. Ficha reprodutiva
6. Registrar tentativa
7. Partos e pós-parto
8. Detalhe do parto
9. Indicadores

As abas e os atalhos disponíveis navegam entre exemplos em estado local. Alguns atalhos abrem apenas um exemplo de destino; os registros e percursos não são completos. Os diálogos são placeholders de abertura contextual. Busca e filtro de fila simulam a consulta sobre os animais ilustrativos; outros campos de filtro, ordenação, período e formulários não executam operações no backend. Edições e mensagens de salvamento apenas demonstram estados da prévia, sem persistência. Todos os nomes, números, datas e registros são ilustrativos. Não há consultas a APIs nem gravações na base.

A proposta reutiliza primitivas shadcn/ui em `client/src/components/ui`, o símbolo Terrano, os estilos compartilhados e o CSS da [prévia de Leite](../v5/README.md), com ajustes locais em `mockup.css`. Conserva a identidade petróleo/turquesa, superfícies claras e famílias Manrope/DM Sans. A referência permanece em `client/PRODUCT.md`, `client/DESIGN.md` e `docs/design/cooperativa-unificada.md`; ajustes locais de tamanhos, composição ou cores não redefinem os tokens nem estabelecem um novo padrão aprovado. Esta entrega não altera páginas operacionais ou contratos.

As nove capturas em `output/mockups-reproducao/tela-1.png` a `tela-9.png` registram a renderização desktop na ordem do seletor. São evidências visuais da prévia; não comprovam a operação dos fluxos. Dispositivos móveis não foram homologados, mesmo havendo regras responsivas no CSS.

Na implementação futura, o contrato de `docs/pecuaria/reproducao.md` e a base comum de `docs/pecuaria/protocolos-exames.md` continuam sendo as fontes funcionais. Preservar permissões, autoria, histórico, datas, escopo por sítio e contratos de URL/filtros. Não derivar cálculos, disponibilidade de funcionalidades ou regras dos valores e exemplos desenhados.
