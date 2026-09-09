# QA — Pecuária unificada

## Ambiente

- Frontend: <http://localhost:41875>
- API: <http://localhost:41873/api/health>
- Banco: <http://localhost:41873/api/health/db>
- Backup anterior à migração: `/tmp/fazendinha-pecuaria-unificada-20260825-kiQypI.dump`

O banco contém dados reais. Faça primeiro o bloco de leitura. No bloco de
escrita, altere somente animais cuja finalidade você conhece.

## 1. Navegação — leitura

1. Recarregue o app e confira que existe uma única seção **Pecuária**.
2. Confirme que não existem seções separadas “Rebanho leiteiro” e “Gado de corte”.
3. Abra, sem passar por outro menu: Animais, Reprodução, Sanidade, Controle
   leiteiro, Nutrição, Lotes coletivos e Pesagens.
4. Abra **Mais opções de pecuária** e confira Acasalamento, FIV/TE, Pasto,
   Comercialização e demais rotinas secundárias.
5. Use a busca global (`Ctrl+K`) para “animal”, “corte”, “leite”, “lote” e
   “reprodução”. Os resultados de ambos os modelos devem aparecer no grupo
   **Pecuária**.

Aceite: uma única área de trabalho, destinos frequentes em um clique e nenhum
resultado agrupado como módulo “Gado de corte”.

## 2. URLs e compatibilidade — leitura

1. Abra `/pecuaria/animal`, `/pecuaria/reproducao` e `/pecuaria/lotes`.
2. Teste os aliases antigos `/rebanho/animal` e `/corte/lote`.
3. Navegue novamente pela sidebar e confira que os links novos usam
   `/pecuaria/...`.

Aceite: URLs novas são canônicas; links antigos continuam abrindo a mesma tela.

## 3. Cadastro único de animais — leitura

1. Abra **Pecuária > Animais**.
2. O cabeçalho deve dizer “Pecuária”, e a tabela deve oferecer as colunas
   Finalidade, Categoria, Grupo, Localização, Último peso e Situação reprodutiva.
3. O filtro **Todas as finalidades** deve ter Leite, Corte, Dupla aptidão e Não
   informada.
4. O antigo filtro de setor deve aparecer como **Todas as localizações**.
5. Com **Todas as propriedades** selecionado, troque de Ativos para Todos. A
   base completa deve conter 631 animais; antes da classificação produtiva,
   todos estão em “Não informada”. Em uma propriedade específica, espere apenas
   o subconjunto daquele local.
6. Abra uma ficha e confira Finalidade e Localização no cadastro.
7. Clique em editar, confira o campo **Finalidade produtiva** e cancele.

Aceite: finalidade é atributo do animal; “setor” não é apresentado como divisão
produtiva.

## 4. Lotes coletivos — leitura

1. Abra `/pecuaria/lotes`.
2. Confira os 12 lotes existentes, que totalizam 239 cabeças.
3. Abra um lote e volte pelo breadcrumb **Pecuária / Lote coletivo**.
4. Confira Pesagens, Pasto, Sanidade coletiva, Nutrição coletiva e
   Comercialização.

Aceite: históricos agregados continuam intactos e aparecem como subseção da
Pecuária, sem fingir que cada cabeça já possui cadastro individual.

## 5. Classificação coletiva — escrita controlada

Execute somente com um grupo de animais cuja finalidade real seja conhecida.

1. Em Animais, abra **Alteração coletiva**.
2. Filtre por grupo, localização ou finalidade “não informada”.
3. Selecione alguns animais conhecidos.
4. Em **Nova finalidade**, escolha Leite, Corte ou Dupla aptidão; deixe Grupo e
   Localização em “não mexer”.
5. Aplique e confirme a quantidade atualizada.
6. Volte ao filtro de finalidade e confira que apenas os animais selecionados
   aparecem.
7. Abra uma ficha e confirme o novo atributo.

Aceite: a alteração não muda grupo/localização quando esses destinos não foram
preenchidos e não cria novas movimentações físicas ao mudar apenas a finalidade.

## 6. Regressão zootécnica — leitura

1. Reprodução: abra listas de inseminação, DG e partos.
2. Sanidade: abra alertas e uma ficha com histórico.
3. Controle leiteiro: confira produção, controles e tanque.
4. Nutrição: confira grupos, dietas e estoque.
5. Troque a propriedade ativa e confirme que o escopo continua funcionando.

Aceite: a unificação editorial não altera cálculos ou históricos existentes.

## Registro de defeito

Para cada problema, anote: URL, usuário/papel, propriedade ativa, passos,
resultado esperado, resultado obtido e captura de tela. Classifique como
Bloqueador, Alto, Médio ou Baixo.
