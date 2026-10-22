# Validação do refino operacional

## Evidências locais — 15/10/2026

- Suíte completa do client: 1.181 testes aprovados em 156 arquivos.
- Builds do client e servidor aprovados; `git diff --check` sem erros.
- Convite e recuperação: cinco testes com PostgreSQL descartável, incluindo expiração, reutilização e disputa concorrente do convite.
- Nutrição: cenário isolado com 1.201 lotes, 1.200 receitas/animais, 2.200 vigências e 2.201 fechamentos. Validados escopo, estornos, distinção null/zero, mascaramento de valores e paginação profunda. Não é benchmark de concorrência nem SLA de produção.
- PDF real com dados fictícios: duas páginas renderizadas e inspecionadas. Persistência/download pelo R2 real não homologados.
- Navegação por teclado, retorno de foco de diálogos e reflow em larguras reduzidas conferidos em fluxos locais. Corrigidos retorno ao acionador e fonte de campos móveis. Isso não comprova leitor de tela ou Safari físico.
- Preparação de mídia e falhas de autenticação cobertas por testes; chamadas reais de IA, entrega de e-mail e captura física de áudio não comprovadas por mocks.

Os bancos de validação eram descartáveis. Não houve limpeza do banco operacional, reexecução do seed ou deploy. As evidências não atribuem aprovação universal 4/4 nem alteram marcações de roteiros manuais anteriores.

## Homologação pendente

- [ ] **R2:** configurar bucket/namespace isolado e autorizar upload, download e persistência de PDF fictícios. Credenciais fora do Git e do chat.
- [ ] **E-mail:** configurar remetente/provedor e caixa de teste; autorizar envio de convite e recuperação e conferir recebimento, spam e abertura dos links.
- [ ] **IA:** configurar chave de teste com segurança, estabelecer teto de gasto e autorizar consultas reais de texto, imagem e transcrição. Revogar chaves expostas. Manter o modelo de menor custo compatível, sem fallback mais caro.
- [ ] **Dispositivos/acessibilidade:** validar iPhone/Android, Safari/Chrome, toque, microfone, zoom real de 200% e NVDA/VoiceOver/TalkBack. Emulação de largura não equivale a zoom ou dispositivo físico.
- [ ] **Workers/Neon:** disponibilizar ambiente e contas de homologação, autorizar ensaio e definir volume, concorrência e latência aceitável. Medições locais em Node/PostgreSQL não homologam o runtime de produção.

### Roteiro assistivo mínimo

Navegar com Tab/Shift+Tab; conferir nomes e ordem anunciados; abrir/fechar seletores e diálogos; verificar retorno de foco; provocar erro e confirmar anúncio e preservação dos campos. Em 200%, conferir acesso às ações. No celular, focar campos, rolar e usar o microfone sem perder o formulário.
