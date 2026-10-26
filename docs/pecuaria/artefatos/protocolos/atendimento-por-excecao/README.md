# Mockup — atendimento por exceção

Proposta para revisão em 23/10/2026. Abrir `index.html` por um servidor estático ou pelo navegador. A fonte visual são os tokens e a fonte local do mockup-main, preservados por links relativos.

## Escopo

Demonstração em memória de IATF, TETF e sanidade; contexto individual/coletivo; todos os pendentes incluídos; exceções, estoque, grupos genéticos, recibo e histórico. Builder isolado em `templates.html`: biblioteca de modelos, criação, etapas e procedimentos configuráveis, modo automatizada/manual por etapa, instruções opcionais, seis procedimentos tipados e publicação simulada. Não existe editor de template dentro da turma. O exemplo operacional permanece fixo e não adota modelos criados na biblioteca demonstrativa. Listas paginadas em até dez itens.

Não envia requests à API, não lê dados da fazenda e não altera banco ou estoque real. Recarregar reinicia tudo. Parâmetros, genética, quantidades, saldos e custos são fictícios.

## Verificação desta proposta

Sintaxe JavaScript conferida com `node --check`. Navegação real verificou segunda página, exceção fora da primeira página com recálculo global, bloqueio por saldo, confirmação conjunta simulada, seis doses de sêmen, associação de quatro embriões e paginação do builder com onze ações. Composição inspecionada em prévias de 1280 e 390 pixels. O detector visual indicou apenas o marcador superior da etapa selecionada, mantido por pertencer à referência aprovada.

Essa evidência cobre o protótipo, não a aplicação, a atomicidade de banco ou a homologação de campo. A edição por ação dentro do mesmo animal, origens externas, múltiplos lotes por aplicação e impressão estão no plano; o protótipo simplifica esses casos.

[Plano completo](../../../../lacunas.md)

## Revisão: cadastro independente

Builder retirado da página de atendimento. Biblioteca, criação de versão, modo automatizada/manual e requisitos de cada etapa estão em `templates.html`. Verificados no navegador: derivação preservando v1, bloqueio de IA automatizada sem dados reais, publicação de v2 e criação de onze etapas com paginação. Os códigos dos dois mockups passaram em `node --check`. Não foram alterados backend, schema ou banco.

## Revisão: procedimentos do builder

Definições incorporadas: aplicação e inserção escolhem produtos do catálogo fictício compartilhado com estoque; unidade aparece somente para leitura; via/orientação aparecem individualmente quando presentes. Produto B demonstra ausência de ambos. Retirada não contém produto/quantidade/unidade; IA/TE não contêm seleção de material genético; exame seleciona modelo cadastrado e mostra seus campos para leitura. “Outros” foi removido. Instruções gerais opcionais pertencem à etapa. Resultados e genética exigem modo manual, sem checkboxes para desabilitar requisitos clínicos.

Foi incluído exemplo de pré-sincronização independente, sem etapa de tentativa. Ele demonstra configuração, não prescrição ou avaliação de aptidão. Os cadastros de produtos/exames são fictícios, com até três opções; os seletores reais devem reutilizar busca e paginação de dez no servidor. As versões demonstrativas são cópias em memória, sem alterações nos cadastros reais.

Conferido no navegador nesta revisão: campos por tipo, metadados ausentes no Produto B, bloqueio de exame automatizado, publicação de nova versão preservando a anterior, pré-sincronização sem tentativa, TE sem seletor genético e onze procedimentos/etapas divididos em duas páginas (dez na primeira). Inspeção da tela atual e viewport de 390 px sem transbordamento horizontal; emulação removida ao concluir. Sintaxe do JS validada. O detector manteve dois avisos de estilos preexistentes: margem interna da coluna (há padding no CSS) e marcador superior da etapa operacional aprovada, que não foi alterada. Não houve execução de testes/backend ou banco; o escopo é mockup e plano.

## Correções C1–C4 do builder

Trocar o produto limpa a quantidade, mesmo entre produtos com a mesma unidade; selecionar o mesmo ID conserva a quantidade revisada. Unidade e metadados opcionais vêm do produto escolhido. A troca de tipo descarta parâmetros incompatíveis. Etapas e ações possuem identidade estável; mudanças em produto/tipo atualizam somente o procedimento afetado. A publicação aponta o primeiro campo inválido, abre sua página e associa a mensagem com `aria-invalid`/`aria-describedby`; remover um procedimento leva ao vizinho ou ao botão de adicionar. O limite permanece dez itens por página.

O calendário separa intervalo/unidade DIAS ou HORAS (incluindo frações) da orientação temporal v1, com referência INICIO_EFETIVO/ETAPA_ANTERIOR, intervalo em horas e tolerâncias em minutos. Os dados são conservados ao salvar/reabrir/derivar a cópia em memória. A apresentação mostra o deslocamento relativo e a orientação separadamente, sem calcular datas de tarefas ou presumir horário ausente. Configuração legada não suportada bloqueia a publicação da derivação; o original continua intacto.

A finalidade é explícita na nova versão: sanitário deriva do domínio, preparação permite terminar sem tentativa, IATF exige IA e TETF exige TE. O nome não classifica o modelo. Os quatro exemplos publicados anteriores são apresentados como legado sem finalidade declarada; a derivação reprodutiva solicita escolha, sem reclassificar o original. Nenhum material genético é escolhido no builder.

Verificação desta correção: `node --check` e harness DOM com jsdom cobriram troca de produto/unidade/metadados, manutenção do mesmo ID, quantidade obrigatória/foco/mensagem vinculada, parâmetros removidos na troca de tipo, 7,5 dias, 36 horas, referência anterior e tolerâncias na ida e volta, regras IATF/TETF/preparação, preservação dos quatro originais e onze ações divididas em dez e uma. O harness é verificação de DOM e estado; não substitui teste real de teclado ou inspeção visual. A tentativa de abrir uma aba isolada neste subagente foi bloqueada pelo runtime do navegador. Essas correções não validam API, cálculo temporal comum da aplicação, migrations, estoque real, concorrência ou homologação de campo.
