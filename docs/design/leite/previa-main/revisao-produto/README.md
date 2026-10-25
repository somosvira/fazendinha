# Revisão de produto · Leite V5

Mockup navegável C01 para aprovação. Este diretório é independente e preserva as prévias anteriores. Abra `index.html` por um servidor estático da raiz do worktree. Fontes e imagens são locais; nenhum serviço ou API é chamado. Dados fictícios, mantidos somente em memória: recarregar reinicia as simulações. Seleção de documento guarda apenas seu nome; exportações baixam arquivos locais demonstrativos.

## Proposta vigente

As sete rotinas são Ordenhas, Produção, Estoque, Coletas, Qualidade, Vendas e Alimentação e descarte. Relatórios, Configurações de produção e Conferir importação ficam na lateral. Rebanho e Nutrição oferecem contexto para vínculos individuais. Consultas viram cartões até 900px; detalhes usam modais com Escape, Cancelar/Fechar e retorno de foco.

- **Ordenhas abre na consulta.** A tabela mostra turno, litros por natureza, total conhecido e situação. Uma linha com classificação pendente conserva o total. Registrar ordenha abre uma página própria; voltar mantém filtros e o rascunho em memória, com ação de retomada. O controle individual mensal continua na subaba própria e na ficha animal.
- **Régua e litros são simultâneos.** Em cada parcela, milímetros são uma observação do mesmo volume informado manualmente em litros. Não há conversão automática, interpolação ou soma dos milímetros ao total. Informar somente régua exige completar os litros manualmente antes de guardar.
- **Divulgação progressiva por contexto.** Comercial fica sempre aberto. Descarte surge como sugestão quando há animais em carência na data; Colostro, quando há parto compatível com a regra vigente. As sugestões abrem a parcela sob ação. Parcelas preenchidas ou históricas permanecem visíveis. Não existe aviso fixo de ausência de carência.
- **Registro direto com justificativa.** A ação própria permite escolher Descarte ou Colostro e exige motivo, mesmo sem carência/parto conhecido. O motivo acompanha parcela, origem e detalhe como declaração direta, sem criar ou presumir eventos e sem liberar o leite para venda. Ao trocar a data, os valores e origens são preservados; contexto incompatível exige justificativa antes de guardar ou confirmar.
- **Uma ordenha admite Comercial, Descarte e Colostro.** Cada parcela identifica tanque cadastrado com versão ou outro recipiente segregado por texto, régua opcional, litros manuais e animais de origem. Somente parcelas preenchidas são guardadas. A confirmação exige origens físicas distintas entre naturezas: não divide leite já misturado por rateio. Volumes acima da capacidade de um tanque cadastrado são recusados por parcela; recipientes livres não recebem capacidade presumida. Cada parcela positiva cria uma origem de estoque e o reenvio conserva as entradas existentes.
- **Carência é visível e independente do volume.** Mimosa tem uma carência fictícia entre 24 e 27/10/2026. É destacada nos animais e não pode compor a origem comercial nesse recorte; não se calculam litros por vaca. O fluxo contextual de Colostro mantém Canela, DEL 0 e parto P088 em 24/10, com declaração da primeira ordenha ou janela configurada vigente. O registro direto justificado não exige criar ou vincular parto ausente.
- **Produção usa o painel Filtros.** Agrupar por dia/mês é rascunho, aplicado somente em Aplicar filtros; Cancelar/Escape conserva o modo anterior. A tabela mostra os volumes dos turnos e total, sem contagem de aferições. Soma apenas litros das parcelas, sem duplicar régua e litros.
- **Custos ficam abaixo da Produção geral.** Usam o mesmo período, busca e filtros, incluindo natureza e classificação. Apresentam fontes de custo fictícias explícitas, separadas da valorização do estoque. Filtros por natureza/classificação sem vínculo deixam valores a apurar; o custo/L completo fica pendente quando a cobertura é parcial. Não existe distribuição por percentual entre componentes. A referência comercial R07 permanece separada.

## Demais percursos preservados

Estoque abre com todos os produtos e três naturezas, classificação pendente em controle próprio e medições não confirmadas separadas do saldo. As parcelas manuais seguem na consulta pendente, na confirmação e na exportação. Não há saldo presumido por tanque: sua identidade/versão comprova o equipamento na origem, não a localização de toda a sobra hoje.

Coletas registra retirada sem preço e permite conferir aceite antes de abrir a operação de venda. Vendas conserva períodos abertos/fechados, avulsas, negociação com retorno ao detalhe, laudos, referências de documentos, demonstrativo e financeiro único; preço, correção e recebimento não repetem a baixa física. Rotina de coleta é previsão configurável sem execução automática.

Qualidade registra amostras individuais/coletivas, datas independentes, resultados, formatos versionados, correção com motivo e anulação. Laudo completo fica no detalhe; Resultados separa parâmetro, unidade, formato, método e origem.

Alimentação seleciona quantidades por origem e condição quente limpo/sujo; colostragem identifica cria/parto e cria ou vincula o fornecimento. Referência R07 provisória pode ser revisada com uma fonte comercial elegível. Descarte físico exige confirmação; estorno recompõe origens exatas.

Configurações conserva snapshots únicos de v1/v2 e novas versões, sem misturar o histórico comercial/custos. Os tanques continuam com cadastro, capacidade, modelo, série e tabelas de calibração versionadas consultáveis; essas tabelas não fazem cálculo automático no novo registro. Relatórios concentra CSV e emissão de snapshot local. Importação oferece conferência sem gravação. Estados da prévia reúne carga, vazio, erro, falta de sítio, valores ocultos e histórico pendente.

## Evidência e limites

Nesta rodada, `node --check app.js` passou. Em Node VM, 20 páginas foram renderizadas sem exceção e foram simulados: três parcelas com régua e litros independentes; guardar sem estoque; confirmação/reenvio sem duplicação; preservação da identidade/versão do tanque; custos agregando várias origens do mesmo registro; filtro por natureza; dia/mês; volume pendente; bloqueio da carência e exigência de primeira ordenha de colostro e recusa de 4.000 L em tanque cadastrado de 3.000 L. O coordenador conduz a revisão de navegador; a avaliação em VM não a substitui.

Mockup é proposta visual e simulação, não implementação React, autorização do servidor, auditoria SQL, concorrência, aptidão sanitária, liberação comercial ou homologação da fazenda. Tabelas, valores e carências são fictícios. A configuração versionada demonstrada não é um motor completo de vigências. Nenhum dado, schema, migration ou código do aplicativo foi alterado nesta pasta.

Impeccable orientou o desenho. A skill frontend-design não foi localizada pelo coordenador e não é declarada como executada. Aprovação desta revisão permanece necessária antes de implementar a interface real.

Refinamento progressivo: verificação focal em Node VM de ausência/presença de contexto, abertura sob ação, motivo obrigatório e persistido em parcela/origem/detalhe, troca de data sem perda de litros/régua e confirmação direta sem alterar eventos ou configuração. `node --check app.js` passou; não foram repetidas as renderizações amplas da rodada anterior.
