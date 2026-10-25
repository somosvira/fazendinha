# Iconografia — diretrizes vigentes

A implementação usa `lucide-react` e vetores próprios já existentes, incluindo o símbolo Terrano. As fontes de navegação são `client/src/components/AppSidebar.tsx` e os componentes de domínio; não manter uma segunda lista manual de todos os ícones por tela.

## Semântica e interação

- Preserve a identidade e o significado existente ao reutilizar um comando. Busca, filtro, ordenação, documento, estoque e movimento financeiro têm funções diferentes.
- Ícones decorativos são ocultos da árvore acessível; botões com ícone precisam de nome acessível e foco visível.
- Cor e desenho não substituem rótulo de situação. Atraso, cancelamento, pendência e confirmação permanecem textuais.
- Tamanho, traço, espaçamento, fundo e alvo de interação vêm do componente compartilhado e de sua variante. Alvo de toque não é o tamanho do desenho.
- Não usar um ícone de sucesso em uma prévia ainda incompleta nem transformar qualquer seta de fluxo financeiro em alerta.
- A marca usa o vetor existente. Documentos podem usar tratamento monocromático próprio, sem alterar o símbolo da aplicação.

## Proveniência visual

O catálogo de PNGs de outubro de 2026 orientou a identidade original, mas os arquivos locais de `output/design/` não estão nesta árvore. As correspondências manuais daquele plano foram retiradas por não serem a fonte vigente do código. Capturas disponíveis em [QA](../../../design-qa.md) conservam sua data e alcance.

Para uma mudança visual, confira o componente real, o estado focado/selecionado/desativado, o nome anunciado e a versão móvel. Siga [design unificado](../cooperativa-unificada.md) e as regras de aprovação do projeto; uma revisão documental não aprova novo desenho.
