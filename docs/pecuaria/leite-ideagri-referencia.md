# Referência IDEAGRI — leite e produção

Este documento registra a evidência disponível para orientar o mapeamento de leite na V5. A fonte é o artefato `ideagri-schema-map.html`, em `fazendinha-seedatev3-local/docs/pecuaria/artefatos/`. Ele é um mapa de schema, não uma consulta ao Firebird nem um catálogo integral de colunas. Os nomes SQL abaixo são preservados como aparecem no artefato.

## Cobertura e confiança

A seção **Leite / Produção** declara **18 tabelas · 13 no diagrama**. As 18 tabelas identificadas no inventário são `ANALISELEITE`, `ANALISETANQUE`, `CMT`, `CORRELACAOMICRORGANISMO`, `CULTIVOMASTITE`, `ESCORETETO`, `FAROLQUALIDADE`, `LACTACAO`, `LACTACAOPRODUCAO`, `LEITE`, `MAMITE`, `MICROORGANISMO`, `MOTIVOSECAGEM`, `PRODUCAOLEITE`, `PRODUCAOLEITERATEIO`, `TANQUE`, `TRATAMENTO` e `TRATAMENTOBASE`. A lista confirma que o inventário associa essas tabelas ao módulo; não revela todas as colunas nem prova relações ausentes do diagrama.

| Assunto | Comprovado no artefato | Inferido / limite | Pendente de evidência |
|---|---|---|---|
| Controle individual | `LEITE`: `CDLEITE` (PK), `CDLACTACAO` (FK), `CDANIMAL` (FK), `DTLEITE`, `PESO1` (`DECIMAL`) e `CDRESPONSAVEL` (FK) aparecem no diagrama. O texto define `LEITE` como controle leiteiro diário e `PESO1..3` como ordenhas. | `PESO1`, `PESO2` e `PESO3` parecem representar os registros de cada ordenha no modelo de origem. `PESO` no nome e `DECIMAL` no tipo não comprovam unidade de volume. | Confirmação de unidade (inclusive se são litros), escala, nulabilidade, nomes SQL de `PESO2` e `PESO3`, campos adicionais e vínculo de `CDRESPONSAVEL` ao cadastro de funcionário. Não importar como litros até confirmar a unidade. |
| Lactação | `LACTACAO`: `CDLACTACAO` (PK), `CDANIMAL` (FK), `DTINICIO`, `DTFIM`, `OBSINICIO`, `CDMOVSETORANIMAL` (FK), `CDMOTIVOSECAGEM` (FK) e `CDPRODUTO` (FK). O texto diz que abre no parto e fecha na secagem (`CDMOTIVOSECAGEM`). | O diagrama permite associar controle leiteiro à lactação por `CDLACTACAO`; não detalha todas as regras de vigência. | Tipos/tamanhos integrais, nulabilidade e regras do Firebird para abertura/fechamento e associação histórica. |
| Análise individual | `ANALISELEITE`: `CDANALISELEITE` (PK), `CDANIMAL` (FK), `DTANALISELEITE`, `CCS` (`DECIMAL`) e `GORDURA` (`DECIMAL`) no diagrama. Texto: análise por animal para CCS, gordura e proteína. | A análise é individual porque o texto assim a descreve e o diagrama liga `CDANIMAL`. | Unidade, escala, precisão e nulabilidade de `CCS` e `GORDURA`; nome e tipo do campo de proteína, que não aparece no diagrama reduzido; método e sujeito/identificador de amostra. |
| Análise de tanque e tanque | Inventário lista `ANALISETANQUE` (referência `TANQUE`) e `TANQUE` (referido por cinco tabelas). | A relação entre `ANALISETANQUE` e `TANQUE` é sugerida pelo inventário. | Colunas, data, sujeito exato, relações e unidades. Não atribuir resultados coletivos a `TANQUE` nem presumir entrega/coleta sem catálogo ou exemplo que prove o percurso. |
| CBT | A busca literal por `CBT` no mapa não localizou campo/tabela correspondente. | Ausência no mapa não prova ausência no banco de origem. | Fonte/catálogo integral ou exemplo real que revele campo, sujeito, unidade e escala. |
| Proteína | Proteína é mencionada no texto da seção como parte da análise individual. | Não é possível deduzir seu nome SQL nem unidade a partir dessa descrição. | Nome, tipo, unidade/escala, precisão, nulabilidade e eventual relação a amostra/lote. |
| Funcionário responsável | O campo exato `CDRESPONSAVEL` aparece em `LEITE` como FK; o inventário lista `PESSOA` no domínio de cadastros gerais, mas isso não prova o destino desta FK. | Pode ser uma pessoa responsável pelo registro. Não assumir que seja funcionário, nem mapear para `PESSOA`, sem metadados da FK ou dados conferidos. | Catálogo de constraints, estrutura/cadastro de funcionários e correspondência de identificadores para o sítio e período da carga. |

As unidades realmente provadas neste recorte são de tipo (`INTEGER`, `DATE`, `DECIMAL`, `STRING250`) apenas onde o diagrama as mostra. **Nenhuma unidade física de leite ou unidade laboratorial está comprovada.** Em particular, `PESO1` não comprova litros, e `CCS`/`GORDURA` como `DECIMAL` não informa unidade nem escala. O trecho do diagrama de `ANALISELEITE` não exibe proteína; proteína está apenas no texto descritivo. CBT não foi localizado nesse mapa.

## Estrutura do diagrama reduzido

O diagrama mostra as entidades e campos abaixo; esta transcrição não pretende representar todas as colunas das tabelas.

```text
LEITE
  CDLEITE INTEGER PK
  CDLACTACAO INTEGER FK
  CDANIMAL INTEGER FK
  DTLEITE DATE
  PESO1 DECIMAL
  CDRESPONSAVEL INTEGER FK

LACTACAO
  CDLACTACAO INTEGER PK
  CDANIMAL INTEGER FK
  DTINICIO DATE
  DTFIM DATE
  OBSINICIO STRING250
  CDMOVSETORANIMAL INTEGER FK
  CDMOTIVOSECAGEM INTEGER FK
  CDPRODUTO INTEGER FK

ANALISELEITE
  CDANALISELEITE INTEGER PK
  CDANIMAL INTEGER FK
  DTANALISELEITE DATE
  CCS DECIMAL
  GORDURA DECIMAL
```

O texto da seção também cita `PESO2` e `PESO3`, sem expô-los entre as colunas renderizadas de `LEITE`. Para implementação/carga, consultar a estrutura integral; não ampliar este diagrama por suposição.

## Formato de preparação para funcionários — lote de outubro

O plano V5 propõe corte histórico em **01/10/2026**, sujeito a confirmar ano, sítio e término do lote na prévia. Este é um **modelo vazio de coleta e reconciliação**, não uma amostra de dados reais. Preencher a partir de registros verificados da fazenda; não criar linhas para completar lacunas.

| sítio_origem | funcionário_origem_id | funcionário_nome_conferido | animal_origem_id | identificação_animal_conferida | data (AAAA-MM-DD) | ordenha_origem (manhã/tarde/noite ou rótulo conferido) | campo_origem (nome SQL exato) | valor_origem | unidade_confirmada | origem_do_registro | status_conferência |
|---|---|---|---|---|---|---|---|---|---|---|---|
| [preencher] | [preencher] | [preencher] | [preencher] | [preencher] | [preencher] | [preencher] | [preencher] | [preencher] | [pendente até comprovação] | [arquivo/folha/fonte] | [pendente] |

Manter o identificador e o nome de origem para conferência; só preencher `funcionário_origem_id`/`funcionário_nome_conferido` quando houver cadastro ou documento verificável. A pessoa responsável indicada na fonte pode não ser funcionário. Guardar o nome literal de cada campo importado e sua unidade comprovada. Registrar ausências e conflitos como pendentes, sem interpolar volume. A reconciliação de saldos, vendas e produção preexistente é requisito do percurso de carga e não é resolvida por esta tabela.

## Limite deste documento

Este levantamento é evidência documental do mapa fornecido. Não acessou banco, arquivos de carga, cadastros reais de funcionários, telas do IDEAGRI ou outras fontes. Não define regras clínicas, estoque, unidade de medida, cálculo ou comportamento operacional. As decisões ainda pendentes devem ser fechadas com catálogo integral, constraints ou registros reais autorizados antes de desenhar o mapeamento de qualidade ou a carga histórica.
