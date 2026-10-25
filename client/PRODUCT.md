# Produto

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

O usuário confirmou dois percursos: trabalho diário do funcionário autorizado e análise pelo gestor. Cada tela deve apresentar somente informação e ações úteis à tarefa atual, com navegação estável e sem descrições que apenas repitam títulos.

## Product Purpose

Gestão rural integrada de Financeiro (Operações e Estoque compartilhado), Pecuária (Rebanho, Reprodução, Produção V5, Sanidade e Nutrição), Sítios e Contas/Acessos. A interface deve facilitar a leitura dos dados existentes e a passagem da análise para a consulta detalhada.

## Capabilities and Constraints

Preservar módulos, regras, permissões, histórico, escopo por sítio, contratos de URL e filtros. A autorização pertence ao servidor. Interface e API no mesmo Cloudflare Worker, Neon e R2; Node somente no desenvolvimento/testes. Nenhuma alteração visual autoriza reativar módulos suspensos ou criar indicadores sem fonte comprovada.

## Brand Commitments

A marca Terrano e seu símbolo são preservados. A direção aprovada usa petróleo #006f68 nas ações, turquesa #009c91 nos detalhes, fundo quase branco com gradiente suave, sidebar cinza esverdeada #dce8e5 com seleção petróleo, cards brancos e sombras suaves. Títulos usam Manrope; dados e controles conservam DM Sans. O mockup orienta o estilo, sem substituir conteúdo, contratos ou a composição funcional aprovada da visão geral financeira.

## Evidence on Hand

README.md, ARCHITECTURE.md, docs/system-design.md, docs/guia/README.md e contratos de domínio são as fontes funcionais. A implementação atual e a captura do Rebanho são evidências visuais; capturas isoladas não comprovam funcionamento.

## Product Principles

- Priorizar leitura de gestão e comparação de dados.
- Aproximar rótulos, quantidades e contexto.
- Evitar caminhos repetidos para a mesma consulta.
- Distinguir ausência, falha, carregamento e dados ocultos por permissão.
- Mostrar estados do animal por eixos independentes e com data/evidência; gestante e lactante podem coexistir.
- Separar medição, estoque, coleta, venda, recebimento e custo produtivo; cada fato tem seus efeitos e cobertura.
