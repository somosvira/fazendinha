# Bezerreiro — prévia e planejamento

Prévia estática revisada em 28/10/2026, com dados fictícios e sem conexão com API/banco. A implementação React/API está em `client/src/pecuaria/rebanho/bezerreiro` e `server/src/services/pecuaria/bezerreiro`; comportamento e limites estão no [contrato](../../pecuaria/bezerreiro.md). As migrations aditivas foram entregues, sem aplicação local nesta etapa.

## Artefatos

- `index.html`, `app.js`, `styles.css`: referência navegável de produto e composição.
- `planejamento.html`: decisões consolidadas, contratos, pacotes executados com Sol e revisão Astra, critérios de homologação e relações.
- `planejamento.js`: notas locais/exportação, sem envio automático. A chave v2 de decisões conserva a chave v1 anterior.
- `decisoes-recebidas-2026-10-28.json`: arquivo original enviado, preservado integralmente. A confirmação posterior de volumes diários está no planejamento.
- `participacao.svg`, `alimentacao.svg`, `colostro.svg`: diagramas resumidos dos vínculos, gerados por `gerar-diagramas.py`. Schema e SQL são a fonte exata das constraints.

## Abrir e revisar

Servir a raiz do repositório e abrir `/docs/design/bezerreiro/index.html`. A página importa fontes locais da prévia V5 e estilos de `../leite/colostro/styles.css`; preservar essas dependências. O servidor estático usado na revisão atende em `http://127.0.0.1:41997`.

O cenário é fixo em 28/10/2026, com seis participantes e coleiras vermelha 4 L, verde 2 L, amarela 0 L por animal/dia. São 16 L/dia. A programação inicial tem duas ofertas, com identidade estável e horário opcional. Adicionar/Excluir conserva as outras linhas; a rotina publicada fecha 100%. Rascunho não muda a previsão ativa. Horário não identifica nem limita o fato realizado.

A sessão `bezerreiro-preview-v4` permanece com a mesma chave e conserva fatos, cenários e campos anteriores; o histórico de novos comandos é acrescentado sem limpar a sessão. Reiniciar a simulação não apaga decisões. Tudo é fictício; nomes, doses e resultados não constituem prescrições.

Percursos:

1. Animais: filtrar coleira/fase com Aplicar/Cancelar; histórico de saídas separado; acompanhamento acessível também na ficha.
2. Alimentação: duas ofertas coletivas totalizam 16 L, usando 10 L descarte + 6 L comercial; sobra 2 L comercial. Custo demonstrativo 23,60 e R07 40,00 separados.
3. Configurações: Adicionar oferta e Excluir por linha, sem horário obrigatório; Brix e referência de volume do colostro em seções próprias.
4. Colostragem → Registrar retirada no parto: escolher parto/matriz, vincular produção existente ou declarar retirada nova e origem física. Registrar 6 L → Brix27% → destinar 4 L à cria e uma unidade2 L. O mesmo estado aparece na ficha, retirada e banco.
5. Banco abaixo da colostragem: Enriquecer uma origem existente, informar insumo/volume final e congelar unidades2 L, conservando remanescente livre. Brix não é inferido pelo enriquecimento.
6. Sanidade: registrar ação pelo animal; exame sanguíneo usa método e unidade próprios.

## Estados de correção na prévia

- Colostragem → Destinar: buscar cria por brinco/nome, incluindo histórico; a busca conserva a seleção atual e percorre todos os animais da sessão. Partos também têm busca sobre todo o cenário, sem recorte aos cem primeiros.
- Destinar → Vincular registro existente: escolher fornecimento sem origem, da mesma cria e data, com volume compatível. Em uma sessão nova, `FC-H001` representa 4 L já registrados para Lua, sem horário informado. Vincular a `L101` conserva um único fornecimento de 4 L na ficha. Sessões v4 existentes conservam seus próprios candidatos e fatos.
- Banco → Destinar à cria: informar, por exemplo, 1,5 L de uma unidade de 2 L. Os 0,5 L permanecem como **Remanescente retirado**, disponíveis para destinação ou enriquecimento, sem novo congelamento presumido. Enriquecer também aceita consumo parcial.
- Colostragem → Histórico de destinações / Enriquecimentos registrados → Detalhes / regularizar: pedir estorno com motivo. Uma unidade consumida ou uma origem enriquecida já destinada exige regularizar seus consumidores primeiro; não há estorno em cascata. Desfazer vínculo restaura o fornecimento anterior em vez de anulá-lo. O histórico mantém o registro estornado.
- Registrar fornecimento ou Destinar → Simular contexto alterado: mantém os campos e bloqueia a gravação. **Atualizar contexto** mostra contexto visto/atual; **Conferi as alterações** adota a leitura e desmarca a conferência dos volumes. Essas ações não enviam o formulário; o usuário ainda precisa conferir e confirmar. O botão é um recurso de simulação estática.

Os novos comandos conservam seu histórico e os vínculos necessários ao estorno na sessão. Registros antigos da prévia sem identidade do comando permanecem visíveis, sem reconstrução presumida de suas destinações.

## Validação e limites

Nesta atualização, `node --check app.js` e uma simulação focal JSDOM em Node 24 conferiram vínculo sem duplicação, desfazer vínculo preservando o fato, unidade/remanescente parcial, enriquecimento parcial, bloqueio por dependências, estornos ordenados, recuperação sem submit, busca histórica e persistência v4. A simulação é estática e não valida API, permissões, idempotência ou concorrência SQL. A conferência focal em navegador verificou o vínculo de fornecimento existente e a recuperação de contexto preservando o rascunho. A prévia foi inspecionada em desktop e viewport móvel de 390 px, sem transbordamento global; isso não homologa a aplicação com banco real.

Na revisão anterior, sintaxe dos scripts, âncoras/links locais dos HTMLs e XML dos diagramas foram conferidos. A simulação integrada foi exercitada por JSDOM; o navegador conferiu a composição da prévia. Evidências locais ficam em `.scratch/bezerreiro-qa/`.

A aplicação real abriu em `http://127.0.0.1:41875/pecuaria/bezerreiro`, com sidebar e abas. A inspeção cobriu os estados sem sítio e `MIGRACAO_PENDENTE` no Sítio principal. Não houve conferência visual integral com registros reais: isso depende da aplicação autorizada da migration e da homologação dos fluxos.

Astra revisou código, contratos e reparos de produto/padrões; não executou PostgreSQL. Testes com mocks, parser e checks estáticos não comprovam atomicidade ou concorrência real no banco. Os testes/builds automatizados ficam separados dessa homologação. Não houve seed, reset ou migration aplicada localmente. Publicação e merge do PR dependem dos gates remotos; deploy permanece fora do escopo.

## Continuidade visual

O desenho preserva DM Sans/Manrope locais, verde principal, sidebar sálvia, filtros com rascunho, tabelas compactas e ações em botões. Bezerreiro é item próprio da sidebar; Banco e Enriquecer integram Colostragem. A aplicação usa os componentes compartilhados de Rebanho/Nutrição; o HTML é referência visual, não um catálogo de componentes React. O protótipo anterior em `../leite/colostro/` permanece como referência histórica, sem ser necessário para simular o percurso integrado atual.
