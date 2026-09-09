# Plano de homologação — entregas Codex da semana

**Escopo:** commits `a8621f9`, `e7368cd`, `bb710c0`, `e45e736`, `40c49f7`, `304ed15` e `34417f4` (31/07 a 05/08/2026).

## Objetivo e regra de segurança

Validar, como usuário real, o fluxo completo entre Dashboard, Central de Relatórios, relatórios reprodutivos, exportações e formulários de campo. Faça os testes de escrita em uma **propriedade de homologação**, nunca na base produtiva sem uma cópia recuperável.

Registre cada caso como `PASSOU`, `FALHOU` ou `BLOQUEADO`, anexando print e, para falhas, animal, propriedade, horário e sequência executada.

## 0. Preparação obrigatória

- [ ] Abrir o túnel/conexão do Postgres esperado em `127.0.0.1:5433` ou ajustar `server/.env` para uma base de homologação.
- [ ] Confirmar `GET http://localhost:41873/api/health` com HTTP 200.
- [ ] Confirmar `GET http://localhost:41873/api/health/db` com HTTP 200 e `{"ok":true,"db":"up"}`.
- [ ] Abrir `http://localhost:41875` e entrar com usuário que possa visualizar valores, exportar e registrar manejos.
- [ ] Selecionar explicitamente a propriedade de homologação.
- [ ] Separar três matrizes conhecidas: uma com histórico reprodutivo, uma prenhe e uma sem eventos no período.
- [ ] Definir um período que contenha IA, DG, parto e secagem conhecidos para conferir os resultados manualmente.

## 1. Smoke test e regressão de navegação

- [ ] Login, logout e recarregamento da página funcionam.
- [ ] Trocar de propriedade altera os dados e não mistura animais entre fazendas.
- [ ] Sidebar apresenta `Relatórios` no grupo Gestão.
- [ ] O submenu de Rebanho não apresenta uma segunda entrada duplicada de Relatórios.
- [ ] `/relatorios` abre a Central Geral.
- [ ] O endereço legado `/relatorio` continua abrindo a Central.
- [ ] Busca global por “relatórios”, “reprodução” e “fechamento” encontra a Central.
- [ ] Voltar/avançar do navegador não deixa a sidebar e o conteúdo em rotas diferentes.
- [ ] Repetir a navegação em largura de celular e verificar menu, rolagem e ausência de conteúdo cortado.

## 2. Dashboard mensal — commits `40c49f7` e `304ed15`

### Período e consistência

- [ ] Abrir o Dashboard e confirmar título “O que aconteceu no mês”.
- [ ] Alternar entre um mês fechado e o mês em andamento; conferir o marcador exibido.
- [ ] Conferir entradas, saídas e saldo contra os lançamentos financeiros do mesmo período.
- [ ] Conferir partos, prenhezes, secagens e baixas contra eventos conhecidos.
- [ ] Comparar pelo menos três números com consultas/listas de origem, evitando validar apenas visualmente.
- [ ] Confirmar que mês sem movimento mostra zero/estado vazio, nunca `NaN`, valor do mês anterior ou erro.

### Interações

- [ ] “Ver detalhes” financeiro abre Gastos.
- [ ] “Ver rebanho” abre o painel do rebanho.
- [ ] Cada pendência abre a área correta: Reprodução, Sanidade, Produção ou Animal.
- [ ] Alertas atuais continuam atuais mesmo ao selecionar um mês histórico, conforme texto da tela.
- [ ] Trocar a propriedade refaz o resumo mensal e os alertas.

## 3. Central Geral de Relatórios — commit `34417f4`

- [ ] A Central mostra modelos das áreas Rebanho, Reprodução, Sanidade, Produção, Financeiro e Estoque.
- [ ] Busca por “inseminação”, “carência”, “CCS”, “lactação”, “estoque” e “fechamento” retorna resultados coerentes.
- [ ] Filtros por categoria combinam corretamente com a busca textual.
- [ ] Modelos ainda não entregues mostram `Em preparação` e não fingem abrir um relatório pronto.
- [ ] Favoritar e desfavoritar um modelo atualiza a aba Favoritos.
- [ ] Recarregar o navegador preserva os favoritos.
- [ ] Abrir um relatório disponível faz com que ele apareça em Recentes.
- [ ] “+ Criar relatório” abre o compositor de relatórios reprodutivos.
- [ ] Abrir “Fechamento financeiro mensal” preserva o documento antigo e sua exportação PDF.
- [ ] “Voltar para relatórios” retorna à Central sem recarregar o aplicativo.
- [ ] Usuário sem permissão `relatorio` recebe a tela de acesso bloqueado.

## 4. Motor e tela de relatórios — commits `a8621f9`, `e7368cd` e `304ed15`

Execute os casos abaixo com filtros amplos e depois com grupo, setor, categoria e situação do animal.

### Modelos por evento

- [ ] Inseminações no período: uma linha por tentativa, inclusive duas tentativas da mesma matriz.
- [ ] Coberturas: não mistura monta natural com IA.
- [ ] Transferências de embrião: apresenta receptora, doadora, touro/sêmen e protocolo quando existentes.
- [ ] Diagnósticos: positivo/negativo e parto previsto coerentes.
- [ ] Partos: tipo, auxílio, número de crias, vivas, natimortas e sexo.
- [ ] Secagens: motivo e observação.

### Modelos por animal

- [ ] Gestantes atualmente: uma linha por matriz e apenas prenhezes atuais.
- [ ] Partos previstos: previsão dentro do intervalo e duração gestacional configurada.
- [ ] Animal baixado não aparece com situação `Ativos`; aparece com `Baixados` ou `Todos`.
- [ ] Grupo, setor e categoria restringem corretamente o conjunto.
- [ ] Busca em uma propriedade nunca retorna animal de outra.
- [ ] Período invertido ou incompleto apresenta erro compreensível.
- [ ] Resultado vazio apresenta estado vazio, não tabela quebrada.

### Composição das colunas

- [ ] Remover Número/animal, Categoria, Grupo, Setor, Data e colunas específicas individualmente.
- [ ] Reordenar colunas para a esquerda e direita.
- [ ] “Restaurar padrão” recupera todas na ordem original.
- [ ] Nenhuma coluna selecionada bloqueia PDF e CSV.
- [ ] Gerar novamente o relatório restaura a composição do novo resultado sem cruzar índices de colunas.
- [ ] Abrir ficha e ação por animal continuam funcionando após reordenar/remover colunas.

## 5. Exportação CSV e PDF — commits `e7368cd`, `bb710c0` e `304ed15`

### CSV

- [ ] Cabeçalhos e ordem são exatamente os escolhidos na tela.
- [ ] Acentos abrem corretamente no Excel/LibreOffice.
- [ ] Nome contendo vírgula ou aspas não quebra colunas.
- [ ] Valores zero permanecem `0`; ausências ficam vazias.
- [ ] Ações da interface não aparecem no arquivo.

### PDF

- [ ] PDF usa orientação paisagem e contém título, descrição, total e período.
- [ ] Ordem e seleção de colunas são iguais à tela.
- [ ] Nomes longos quebram linha sem serem cortados.
- [ ] Tabela não sai da página e linhas não são partidas entre páginas.
- [ ] Documento sai em preto e branco, sem botões, estrelas ou texto acessível duplicado.
- [ ] Valores zero e travessões de ausência estão corretos.
- [ ] Testar relatório com 1 linha, muitas linhas e quantidade de colunas mínima/máxima.

## 6. Formulários de campo — commit `e45e736`

### Montagem e impressão

- [ ] Gerar relatório com conjunto pequeno e clicar “Montar formulário”.
- [ ] Dar nome à atividade e selecionar campos preenchíveis válidos para o modelo.
- [ ] Salvar como modelo e reutilizá-lo em nova folha.
- [ ] Criar folha e verificar total de animais e snapshot das colunas.
- [ ] PDF impresso possui espaço suficiente para escrita e não contém botões da interface.
- [ ] Relatório vazio ou truncado não permite criar folha.

### Retorno do campo

- [ ] Folha aparece em “Folhas em aberto”.
- [ ] Marcar uma linha como `Preencher` e informar todos os campos obrigatórios.
- [ ] Marcar outra como `Não realizado` e registrar motivo.
- [ ] Deixar uma pendente e confirmar que a conclusão fica bloqueada.
- [ ] Salvar rascunho, recarregar a página e conferir persistência.
- [ ] Resolver todas as linhas e concluir.
- [ ] Conferir que apenas linhas preenchidas criaram eventos; “Não realizado” ficou no histórico sem criar evento zootécnico.
- [ ] Conferir na ficha do animal data, tipo e valores lançados.
- [ ] Confirmar que concluir novamente não duplica eventos.
- [ ] Testar cancelamento de uma folha separada e confirmar que ela não registra eventos.

## 7. Fluxo integrado crítico

Este é o principal teste de aceite da semana:

1. [ ] Criar relatório “Inseminações no período” para 2–5 matrizes.
2. [ ] Escolher e ordenar as colunas que serão levadas ao campo.
3. [ ] Exportar CSV e PDF e conferir paridade.
4. [ ] Montar uma folha para registrar DG.
5. [ ] Imprimir, preencher uma positiva, uma negativa e uma não realizada.
6. [ ] Lançar o retorno, salvar rascunho e concluir.
7. [ ] Abrir as fichas e conferir os novos diagnósticos.
8. [ ] Gerar “Diagnósticos de gestação” no mesmo período e localizar os resultados.
9. [ ] Abrir o Dashboard e conferir reflexo no resumo/pendências aplicável.
10. [ ] Trocar de propriedade e garantir que nenhum dado do teste aparece fora do escopo.

## 8. Não funcionais e encerramento

- [ ] Executar o fluxo principal no Chrome e em pelo menos um navegador móvel ou modo responsivo.
- [ ] Verificar navegação completa por teclado, foco visível e nomes acessíveis dos botões.
- [ ] Confirmar que erros de rede permitem tentar novamente sem duplicar gravações.
- [ ] Conferir tempos percebidos com relatório grande e ausência de congelamento da página.
- [ ] Rodar `pnpm -r test` e `pnpm -r run build` no mesmo commit homologado.
- [ ] Registrar falhas com severidade: bloqueante, alta, média ou cosmética.
- [ ] Só aprovar produção quando o fluxo integrado crítico estiver 100% aprovado e não houver falha bloqueante/alta.

## Evidência automatizada já obtida

- Suítes completas de cliente e servidor aprovadas em 05/08/2026.
- Build de servidor aprovado.
- Build de cliente aprovado após validação isolada.
- API inicia e responde em `/api/health`; conexão ao banco permanece bloqueada até ativar o Postgres/túnel local em `127.0.0.1:5433`.
