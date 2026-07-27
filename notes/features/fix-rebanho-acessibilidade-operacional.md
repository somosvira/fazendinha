# fix/rebanho-acessibilidade-operacional

## Objetivo

Corrigir os bloqueios centrais de teclado, foco e reflow do módulo rebanho.

## Escopo

- `RebModal` usa o Dialog Radix já existente, com nome, trap e restauração de foco;
- apenas o modal superior trata Escape;
- tabelas de tarefas/carteira expõem botões reais para abrir a ficha;
- seletor de worklist comunica estado ativo;
- KPIs e IA refluem em viewport estreito/zoom.

Contraste, live regions e formulários serão tratados em PRs seguintes para manter revisão objetiva.
