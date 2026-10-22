# Validação local — tokens, PDF e mídia

15/10/2026. Sem browser, detector, alteração de senha UI, envio de email, bucket R2 ou chamada externa de IA. Esta rodada alterou somente testes. Não equivale a aprovação 4/4 do fluxo implantado.

| Fluxo | Comprovado localmente | O que esta execução não prova |
|---|---|---|
| Convite válido | Serviço real sobre Prisma mockado ativa somente pendente, preserva papel/áreas/flags; frontend validado entra uma vez e ignora resposta do token anterior | Persistência/concorrência Postgres real de convite, uso único na implantação, entrega do convite |
| Convite inválido | Novos casos: expirado, já usado, tipo RESET, usuário já ativo não consomem nem alteram senha/acessos. Perda da disputa atômica não cria senha | Garantia transacional real é tarefa da integração descartável; mock não é banco |
| Reset | Serviço unitário cobre hash novo, consumo atômico, revogação de sessões, expirado e corrida; rota valida senha mínima, retorna sessão e 404 inválido; frontend distingue404/503/rede, impede submit prematuro/duplo, conserva senhas e ignora contexto antigo | A integração Postgres existente cobre reset real, reuso e revogação, mas não foi habilitada por A. Agente B executa em banco descartável; não assumir aprovação sem seu resultado |
| Recuperação | Resposta HTTP neutra para inexistente/canal desligado; email normalizado e entrega por função simulada | Email real, SPF/DKIM, provedor e caixa de entrada dependem configuração/credenciais |
| PDF | Gerador real cria Buffer PDF1.4, xref/offsets/tamanhos de stream/EOF válidos; acentos/escape, filtros longos sem invadir rodapé e400itens com paginação. Serviço monta snapshot filtrado, emite bytes reais e download devolve os mesmos bytes via storage em memória; falha de storage preserva rascunho. Rota define application/pdf, attachment UTF8 e escopo | Não renderizou visualmente as páginas; teste estrutural não certifica cada layout. Serviço/rota usam Prisma/storage simulados, não R2 real nem download pelo browser. R2implantado/URL/ambiente exigem configuração do usuário |
| Print cliente | Tipo permitido e8MB antes de URL; imagem corrompida, dimensões100MP e saída>2MB recusadas; caso aceito reencoda JPEG0.8 a1600×800 e libera URL em sucesso/erro | Image/canvas são fixtures; decodificador/cores de browser real e análise semântica pela IA não exercitados |
| Print servidor | Assinatura/dimensões e MIME real; recusa URL remota,SVG,MIME falso,bytes inválidos e dimensão>1600 | Não envia imagem a provedor nem certifica resposta do modelo |
| Áudio cliente | PCMmono16bit16kHz e duração real;60s limite; microfone somente por ação; limpeza ao fechar/contexto e permissão tardia; permissão negada não transcreve; novos testes de8MB,navegador sem decoder,erro de decode e fechamento de contexto | Microfone/MediaRecorder/AudioContext simulados; captura/dispositivo/codecs reais e qualidade de transcrição dependem browser e provedor |
| Áudio servidor | WAV assinatura/bytes/duração real até60s; corrompido/61s recusados; configuração ausente não chama SDK; modelo econômico e nome neutro; transcrição vazia/erro não inventa texto nem vaza detalhe | SDK totalmente mockado, chave fictícia de teste. Disponibilidade/latência/custo e voz real exigem credenciais e autorização de uso |

## Execução

- Client: `vitest run` midia-assistente, midia-assistente.preparo, useAudioAssistente, AssistenteConsulta, AuthHardening, RelatorioGerencialDocumento, RelatorioFinanceiroDetalhe: **7 arquivos/41 testes passaram**.
- Server: contas, routes/auth, relatorios.pdf, relatorios service, routes/relatorios-financeiros e assistente/midia: **6 arquivos/53 testes passaram**. Flags de integração explicitamente0; URL inerte em127.0.0.1:1. Nenhuma conexão operacional foi usada.
- O primeiro novo teste PDF esperava assinatura de getObjectBuffer como string; corrigido para o contrato `{ key }` e reexecutado verde. Nenhuma mudança de runtime motivada por essa expectativa errada.
- Novos arquivos/casos: client/src/lib/midia-assistente.preparo.test.ts (7); server/src/services/auth/contas.test.ts (+5); server/src/services/financeiro/relatorios.test.ts (mesmos bytes emissão/download).
- `npx tsc --noEmit` no client passou; `git diff --check` limpo.

Dependências externas reais restantes são de infraestrutura/credenciais, não justificam usar segredo ou conta operacional nesta validação. As provas locais reduzem lacunas, mas não autorizam nota global máxima sem a integração/visual correspondente.
