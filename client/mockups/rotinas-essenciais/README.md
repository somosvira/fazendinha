# Prévia interativa das rotinas essenciais

Proposta para revisão visual, orientada pelo [README do frontend](../../README.md). Não substitui nem altera as páginas operacionais.

## Abrir

Com o Vite local em execução:

- `/mockups/rotinas-essenciais/?tela=animais`
- `/mockups/rotinas-essenciais/?tela=ordenhas`
- `/mockups/rotinas-essenciais/?tela=reproducao`

As três telas se conectam pelo menu lateral e à proposta da ficha individual.

## Organização proposta

Animais: busca e lote à vista; filtros adicionais no painel; tabela para comparação, cartões como alternativa; seleção e ações em lote; abertura do animal exato. O resumo individual evita repetir os rótulos em cada linha.

Ordenhas: data operacional no cabeçalho, volume aferido e composição por natureza; sessões separadas por horário; ausência de aferição distinta de zero; confirmação de estoque distinta da aferição e de vendas.

Reprodução: filas de trabalho antes da lista, busca e lote compartilhados; aptidão clínica distinta da liberação operacional. A data de diagnóstico é a do último serviço, não uma previsão. Contagens de filas não representam soma de animais únicos.

## Interações e limites

Busca, lote, categoria, ordenação, paginação, tabela/cartões, seleção, painéis de detalhe, filas e calendário funcionam sobre um snapshot. Filtros do painel só são aplicados na confirmação. Ações de registro abrem simulações explicitamente identificadas, sem persistência. Abas adjacentes demonstram acesso ao contexto; não são propostas completas dessas páginas.

Snapshot do ambiente local em 30/10/2026, sítio principal: 72 animais ativos e filas projetadas pelas funções atuais de manejo/aptidão. Ordenhas: 20 sessões consultadas entre 20 e 26/10/2026, com abertura em 26/10. Datas fora desse recorte não demonstram a ausência de registros no produto. Não há consulta autenticada nem escrita em API no mockup.

Usa componentes existentes de diálogo, painel lateral, seleção, calendário e botões. A busca global operacional não muda: estas URLs são artefatos de revisão e não entram no catálogo de navegação do produto.

## Conferência

Verificação TypeScript estrita do ponto de entrada. Conferência em navegador desktop e celular: busca exata, detalhe do animal, tabela/cartões, seleção, abertura/cancelamento de filtros, troca das três filas, parcelas de leite e simulação de aferição. Sem transbordamento horizontal do documento em 390px; tabelas preservam rolagem própria. Revisão visual conforme `impeccable` e `frontend-design`, mantendo leitura operacional e detalhes sob demanda.

## Revisão visual dos cartões

Após revisão do usuário, cartões são a abertura padrão de Animais e Reprodução; a tabela continua acessível. Identidade do animal, ilustração genérica, peso e ganho de peso têm mais presença, com ícones de lote, finalidade e data. Cabeçalhos, abas, horários de ordenha e filas usam a mesma linguagem iconográfica da ficha. As ilustrações não são fotos dos animais. Busca e alternância tabela/cartões foram reconferidas após essa revisão.
