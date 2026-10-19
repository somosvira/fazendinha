# Produto

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

O usuário confirmou dois percursos: trabalho diário do funcionário autorizado e análise pelo gestor. Cada tela deve apresentar somente informação e ações úteis à tarefa atual, com navegação estável e sem descrições que apenas repitam títulos.

## Product Purpose

Gestão rural integrada de Financeiro, Estoque, Pecuária, Sítios e Contas/Acessos. A interface deve facilitar a leitura dos dados existentes e a passagem da análise para a consulta detalhada.

## Capabilities and Constraints

Preservar módulos, regras, permissões, histórico, escopo por sítio, contratos de URL e filtros. A autorização pertence ao servidor. Interface e API no mesmo Cloudflare Worker, Neon e R2; Node somente no desenvolvimento/testes. Nenhuma alteração visual autoriza reativar módulos suspensos ou criar indicadores sem fonte comprovada.

## Brand Commitments

O usuário confirmou preservar a identidade atual e melhorar a organização. Marca Terrano, português do domínio e identidade rural existente. O mockup gerado na conversa não é uma nova direção aprovada. A visão geral financeira atual foi explicitamente aprovada como referência visual; sua composição deve ser preservada.

## Evidence on Hand

README.md, ARCHITECTURE.md, docs/README.md e contratos de domínio são as fontes funcionais. A implementação atual e a captura do Rebanho são evidências visuais; capturas isoladas não comprovam funcionamento.

## Product Principles

- Priorizar leitura de gestão e comparação de dados.
- Aproximar rótulos, quantidades e contexto.
- Evitar caminhos repetidos para a mesma consulta.
- Distinguir ausência, falha, carregamento e dados ocultos por permissão.
