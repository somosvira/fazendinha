## Resumo
- unifica a identidade visual de Estoque, Rebanho e Configurações com os componentes compartilhados do Financeiro;
- atualiza Login, navegação lateral, filtros e paginação;
- padroniza cabeçalhos, CTAs, indicadores e responsividade de Acessos e Categorias.

## Validação
- `pnpm --filter rionovo-client run build`
- testes de Estoque, Rebanho (listas, cadastros, detalhes e novo animal), navegação e sidebar.

## Correções e validações adicionais — 15/10/2026
- Consolida refino de hierarquia, filtros, estados vazios/erro, formulários e navegação em Financeiro, Estoque, Rebanho, Sanidade, Nutrição, Configurações e Acessos.
- Reforça perfis restritos, escopo por sítio, mascaramento de valores e consultas nutricionais agregadas/paginadas.
- Corrige retorno de foco de diálogos/sheets controlados e legibilidade dos campos móveis; inclui a skill Impeccable no projeto.
- Evidência local: **1.181 testes do client em 156 arquivos**, builds client/server aprovados, cinco testes de autenticação em PostgreSQL descartável, cenário nutricional de volume e PDF fictício de duas páginas renderizado/inspecionado.
- Testes com mocks não comprovam integrações externas. Volume local não é SLA, ensaio de concorrência ou homologação Workers/Neon. Não houve deploy nem limpeza/reseed do banco operacional.

## Pendências para homologação completa
- [ ] R2 isolado: upload/download e persistência de PDF reais, com credenciais configuradas fora do chat/Git.
- [ ] E-mail: remetente e caixa de teste; envio, recebimento/spam e abertura de convite/reset.
- [ ] IA: chave segura, teto de gasto e autorização para texto, imagem e transcrição reais; revogar chaves expostas.
- [ ] Dispositivos/acessibilidade: iPhone/Android, Safari/Chrome, toque/microfone, zoom real 200% e NVDA/VoiceOver/TalkBack.
- [ ] Workers/Neon: ambiente/contas de homologação autorizados e metas de volume, concorrência e latência.

Detalhes e roteiro: [validação do refino operacional](docs/design/validacao-refino-operacional.md). Não é declarada aprovação universal 4/4 enquanto essas homologações estiverem pendentes.

