# Relatório de planejamento — migração financeira da Rio Novo

**Data:** 01/10/2026  
**Status:** esteira implementada e validada em `dry-run`; carga real bloqueada até chegar a planilha mais recente  
**Escopo deste documento:** decisões, implementação e operação segura da migração do histórico financeiro do Excel para o modelo financeiro atual do Fazendinha

## 1. Objetivo

Popular o financeiro do Fazendinha com o histórico disponível da Rio Novo, preservando o que é confiável na planilha e sem inventar informações que a fonte não possui.

A migração deve reconstruir corretamente:

- fatos financeiros históricos;
- contas a pagar e receber válidas na planilha mais recente;
- pagamentos e recebimentos realizados;
- movimentos por conta financeira;
- transferências entre contas próprias;
- estornos e sua trilha histórica;
- parceiros, categorias e centros de custo necessários ao histórico.

A migração não deve alterar estoque, inventar produtos ou transformar projeções em dívidas reais.

## 2. Resumo executivo

A migração é viável, mas as linhas do Excel não podem ser copiadas diretamente para `Operacao`.

O arquivo mistura, na mesma base:

- competência do fato econômico;
- vencimento da obrigação;
- liquidação do dinheiro;
- duas pontas de transferências;
- lançamentos originais e inversos de estorno;
- projeções recorrentes;
- classificações brutas e classificações gerenciais.

O modelo atual do Fazendinha separa corretamente essas dimensões:

```text
Operacao
  -> CompromissoFinanceiro
      -> Liquidacao
          -> TransacaoFinanceira
              -> MovimentoConta
```

Portanto, a importação deverá interpretar conjuntos de linhas e gerar os objetos correspondentes, em vez de aplicar a regra incorreta de “uma linha do Excel = uma operação completa”.

As duas únicas dependências externas realmente importantes são:

1. receber a planilha mais recente;
2. obter, se possível, saldo e identificação das contas financeiras.

As demais ambiguidades podem ser tratadas com regras conservadoras e uma fila pequena de exceções.

## 3. Fonte analisada

Arquivo analisado:

- `Relatório Rio Novo 2026.05.04.xlsx`;
- a cópia com sufixo `(1)` é idêntica, inclusive no SHA-256;
- SHA-256: `e546c84b362ad4ce35a49e4cfa355faeef64900a474f56938011c60fdacc963a`.

O arquivo contém 25 abas, majoritariamente relatórios e tabelas dinâmicas. A fonte útil está no `pivotCache 3`, originalmente alimentado por um banco Access externo do antigo financeiro terceirizado.

O Access não estará disponível. Essa limitação foi aceita: o Excel será a fonte oficial disponível, ainda que não contenha os identificadores e detalhes completos do sistema de origem.

### 3.1. Recorte Rio Novo

Filtrando estritamente `*Fonte = RIO NOVO`, a planilha atual contém:

| Indicador | Quantidade |
|---|---:|
| Linhas totais | 6.704 |
| Linhas liquidadas | 5.856 |
| Linhas abertas | 848 |
| Linhas abertas com documento `PROJ` | 674 |
| Linhas de transferência | 914 |
| Linhas marcadas como estorno | 1.240 |
| Contas financeiras | 5 |
| Nomes distintos de parceiros | 409 |
| Categorias brutas | 61 |
| Categorias gerenciais preenchidas | 28 |
| Pares de linhas completamente idênticas | 27 |

O nome do arquivo sugere corte em 04/05/2026, mas o cache foi atualizado em 05/05/2026 às 14:12. Há registros posteriores à data nominal. A data de corte deverá ser obtida do conteúdo e dos metadados da planilha nova, não apenas do nome do arquivo.

## 4. Decisões já tomadas

As decisões abaixo estão aprovadas para orientar a futura implementação.

### 4.1. Período

- Importar todo o histórico realizado disponível na planilha mais recente.
- Na planilha atual, isso corresponde aproximadamente a 2024 até maio de 2026.
- A intenção de “últimos três anos” já engloba todo o histórico realizado disponível.
- A planilha mais recente será a fonte canônica se ela for cumulativa.
- A planilha antiga será usada apenas para comparação, nunca somada automaticamente à nova.

### 4.2. Propriedade

- Todo o histórico pertence à mesma propriedade.
- Os dados serão associados à propriedade principal Rio Novo.
- Não haverá tentativa de repartir retroativamente os fatos entre sítios ou propriedades futuras.

### 4.3. Produção atual

- O financeiro em produção ainda não possui lançamentos reais.
- A massa financeira de teste poderá ser removida e reconstruída de forma controlada.
- O banco inteiro não deverá ser resetado indiscriminadamente, pois usuários, pecuária, produtos e outros módulos podem possuir dados válidos.

### 4.4. Estoque

- A migração será exclusivamente financeira.
- Nenhum registro importado criará `MovimentoEstoque`.
- Não serão inventados produto, quantidade, unidade, recebimento físico ou custo médio.
- Uma despesa histórica de ração continuará sendo uma despesa de ração, sem adicionar quilogramas ao estoque.

### 4.5. Projeções

- Linhas com `tNumeroDocumento = PROJ` não serão importadas como compromissos.
- Elas serão preservadas na camada de preparação para análise futura.
- Não haverá módulo de orçamento ou projeção nesta migração.

### 4.6. Valores divergentes

- Quando o valor original do vencimento for diferente do valor liquidado, o valor efetivamente pago ou recebido será usado como valor da operação histórica.
- O valor original continuará preservado na camada de preparação e na rastreabilidade do lote.
- Essa decisão evita criar saldos pendentes falsos ou pagamentos maiores que a obrigação.

### 4.7. Parcelas

- Será criada uma operação histórica por parcela da fonte.
- Não serão agrupadas parcelas por heurística de parceiro/documento/data.
- Essa escolha pode produzir mais operações, mas evita unir fatos distintos sem uma chave original confiável.
- Documento, número da parcela e total conhecido serão incorporados à descrição histórica.

### 4.8. Grupos de categoria

- O schema atual não será alterado nesta primeira migração apenas para criar `GrupoCategoria`.
- A categoria continuará plana no domínio atual.
- O grupo bruto e o grupo gerencial do Excel serão preservados no artefato de transformação.
- Será mantido um mapa versionado `categoria -> grupo` para permitir uma evolução futura sem reler ou reinterpretar o Excel.

### 4.9. Saldos

- Saldos de abertura não serão inventados.
- Se os saldos forem obtidos durante a visita, serão usados para uma reconciliação com data de referência conhecida.
- Se não forem obtidos, as contas poderão começar provisoriamente com abertura zero e ficar fora do saldo geral até a conciliação.
- Nesse cenário, entradas e saídas históricas estarão corretas, mas a posição absoluta das contas não será apresentada como saldo bancário real.

## 5. O que ainda falta de fato

### 5.1. Obrigatório antes da carga

1. Receber a planilha mais recente.
2. Confirmar se ela contém todo o histórico ou somente linhas novas.
3. Identificar a data real de corte.
4. Comparar a nova planilha com a atual para detectar mudanças de situação, estornos, reclassificações e duplicidades.
5. Confirmar qual cadastro de propriedade será a Rio Novo principal.

### 5.2. Desejável para saldos confiáveis

Para cada conta:

- nome;
- instituição;
- tipo: banco, aplicação ou caixa;
- ativa ou inativa;
- saldo e data/hora de referência;
- se participa do saldo geral;
- agência, número, dígito e titular, quando disponíveis;
- valor físico da caixinha;
- disponibilidade do CDB.

### 5.3. Necessário para os compromissos abertos

- As 174 linhas abertas sem `PROJ` da planilha antiga não serão usadas como posição atual.
- Somente as linhas abertas sem `PROJ` da planilha mais recente serão candidatas a importação.
- Antes da carga, será produzido um resumo dessas linhas para uma revisão rápida.

Não é necessário revisar manualmente milhares de linhas. A revisão deverá se concentrar apenas nos casos ambíguos ou de alto valor.

## 6. Mapeamento para o modelo atual

| Campo da planilha | Significado | Destino principal |
|---|---|---|
| `dCompetencia` | Data do fato econômico | `Operacao.data` |
| `dVencto` | Data de vencimento | `CompromissoFinanceiro.dataVencimento` |
| `vVencto` | Valor original da obrigação | Preservado na origem; usado quando não divergir do realizado |
| `dLiquidacao` | Data do pagamento/recebimento | `TransacaoFinanceira.data` |
| `vLiquidacao` | Valor efetivamente movimentado | `TransacaoFinanceira.valorTotal` e `MovimentoConta.valor` |
| `eSituacao` | Aberto ou liquidado | Status/efeitos do compromisso |
| `eCreditoDebito` | Entrada ou saída | Tipo da transação e direção do movimento |
| `eTipoLancto` | Classe no sistema de origem | Roteamento da transformação |
| `tContaBancaria` | Conta movimentada | `ContaFinanceira` |
| `tClienteFornecedor` | Contraparte | `Parceiro` |
| `tNumeroDocumento` | Identificação textual | Descrição e rastreabilidade, não anexo fictício |
| `tNumeroParcela` | Parcela | `numeroParcela` e descrição |
| `tMeioPagamento` | Meio utilizado | `FormaPagamento` |
| `*CCusto` | Centro gerencial tratado | `CentroCusto` |
| `*Categoria` | Categoria gerencial tratada | `Categoria` |
| `*Grupo Categoria` | Grupo gerencial | Preservado no mapa de transformação |
| `eEstorno` | Original/inverso de estorno | Transação revertida + transação de reversão |

`*Valor` é uma medida de relatório. A migração deverá preservar separadamente `vVencto` e `vLiquidacao`, usando o realizado conforme a decisão deste documento.

## 7. Roteamento das categorias

Antes da carga será gerada uma matriz de transformação. Ela não altera o schema; apenas instrui o importador.

Cada categoria será encaminhada para uma das seguintes rotas:

| Rota | Uso |
|---|---|
| `OPERACAO` | Compra, serviço, venda, aporte ou retirada identificável |
| `TRANSFERENCIA` | Duas contas próprias com pontas pareáveis |
| `TRANSACAO_AVULSA` | Tarifa, rendimento ou outro movimento puramente financeiro |
| `PROJECAO` | Linha `PROJ`, preservada mas não importada |
| `REVISAO` | Origem ou finalidade insuficiente |

Exemplos iniciais:

| Categoria/origem | Tratamento sugerido |
|---|---|
| Venda de Leite / Venda de Café | `VENDA` |
| Veterinário / Contabilidade / BPO / Internet | `SERVICO` |
| Ração / Medicamento / Animal Aquisição | `COMPRA_CONSUMO_DIRETO`, sem estoque |
| Transferência entre contas próprias | `TRANSFERENCIA_FINANCEIRA` |
| Aporte explícito / AFAC | `APORTE`, preservando o rótulo original |
| Pagamento de lucros / retirada de proprietário | `RETIRADA` |
| Empréstimo histórico realizado | Transação avulsa identificada como empréstimo |
| Aplicação banco <-> CDB com duas pontas | Transferência financeira |
| Rendimento de aplicação sem contraparte | Recebimento avulso |
| Tarifa bancária | Pagamento avulso |
| Saldo inicial | Abertura de conta ou revisão; nunca receita |
| `Identificar` / `Diversos` sem contexto | Revisão |

A matriz completa das 61 categorias será produzida automaticamente para revisão. Somente exceções relevantes precisarão de decisão humana.

## 8. Regras especiais

### 8.1. Transferências

As duas pontas do Excel deverão resultar em:

- uma `Operacao` de transferência;
- uma `TransacaoFinanceira`;
- um `MovimentoConta` de saída;
- um `MovimentoConta` de entrada;
- mesmo valor nas duas pontas.

As 914 linhas atuais não representam 914 transferências. Na planilha analisada, 810 linhas recompõem 405 transferências ativas; outras 104 linhas representam conjuntos estornados.

### 8.2. Estornos

O Excel marca tanto o original quanto o inverso com `eEstorno = Sim`.

A importação deverá criar:

- transação original com status revertido;
- transação inversa de tipo reversão;
- vínculo `reversaoDeId`;
- movimentos de conta opostos;
- auditoria de importação.

As linhas não poderão ser interpretadas individualmente como novos cancelamentos.

### 8.3. Parceiros

- Parceiros poderão ser históricos e não possuir CPF/CNPJ.
- O nome original será preservado.
- Espaços e variações simples serão normalizados para busca.
- Nomes apenas parecidos não serão fundidos automaticamente.
- Fluxo a pagar sugere papel de fornecedor.
- Fluxo a receber sugere papel de cliente.
- O mesmo parceiro poderá acumular mais de um papel.

### 8.4. Documentos

- Número de documento será preservado na descrição e no manifesto da importação.
- Não será criado `DocumentoFinanceiro` sem arquivo real.
- PDF, XML, boleto e comprovante não existem na fonte analisada.

### 8.5. Idempotência

A importação precisa poder ser executada novamente sem duplicar fatos.

Cada lote deverá possuir:

- hash do arquivo;
- identificador do lote;
- posição original da linha;
- chave determinística das entidades geradas;
- resultado: importada, agrupada, ignorada, em revisão ou rejeitada.

As 27 duplicidades exatas da planilha deverão ser preservadas na preparação e não descartadas automaticamente.

## 9. Etapas da execução

### Etapa 1 — Receber e auditar a planilha nova

- calcular hash;
- identificar caches e campos;
- confirmar `*Fonte = RIO NOVO`;
- identificar corte real;
- comparar com a planilha anterior;
- confirmar se a nova fonte é cumulativa.

### Etapa 2 — Preparar a base normalizada

- preservar todos os campos originais;
- usar decimais monetários com duas casas;
- manter índice da linha e lote;
- separar bruto, gerencial e decisão de importação;
- produzir relatórios de duplicidade e inconsistência.

### Etapa 3 — Preparar cadastros

- propriedade Rio Novo;
- cinco contas financeiras;
- parceiros conservadoramente deduplicados;
- categorias planas;
- centros de custo;
- formas de pagamento;
- usuário técnico “Importação histórica” ou autoria equivalente.

### Etapa 4 — Aplicar a matriz de transformação

- excluir `PROJ` do domínio financeiro;
- criar uma operação por parcela;
- usar o valor realizado nas divergências;
- parear transferências;
- parear estornos;
- separar operação, compromisso, transação e movimento;
- não criar movimentos de estoque.

### Etapa 5 — Ensaio local

- usar banco local ou clone seguro;
- remover apenas a massa financeira de teste aprovada;
- executar a importação completa;
- gerar manifesto de resultados;
- não tocar no banco de produção.

### Etapa 6 — Reconciliação

Comparar fonte e destino por:

- conta;
- dia e mês de liquidação;
- entradas;
- saídas;
- resultado líquido;
- categoria;
- centro de custo;
- compromissos pendentes;
- transferências;
- estornos;
- registros em revisão.

### Etapa 7 — Carga de produção

- backup/PITR imediatamente anterior;
- inventário de contagens e saldos;
- janela sem lançamentos concorrentes;
- execução única do lote aprovado;
- reconciliação automática;
- conferência humana;
- liberação do financeiro.

### Etapa 8 — Fechamento dos períodos

- manter períodos históricos abertos durante a conferência;
- corrigir classificações aprovadas;
- fechar cada mês após o aceite;
- impedir alterações acidentais posteriores.

## 10. Critérios de aceite

A migração só estará aprovada quando:

- a soma por conta e mês coincidir com a fonte, salvo exceções documentadas;
- entradas e saídas realizadas coincidirem com a planilha;
- transferências entre contas próprias tiverem duas pontas iguais;
- transferências não aparecerem como receita ou despesa;
- estornos tiverem efeito líquido zero e histórico preservado;
- nenhuma linha `PROJ` aparecer como dívida;
- nenhum movimento de estoque for criado;
- todos os registros tiverem propriedade Rio Novo;
- nenhuma linha for descartada silenciosamente;
- abertos importados vierem apenas da planilha mais recente;
- saldo geral só seja apresentado como confiável após conciliação;
- a reexecução do mesmo lote não produza duplicidade.

## 11. Lista para a visita

Perguntas curtas para cada conta:

1. Qual é o nome da conta?
2. É banco, aplicação ou caixinha?
3. Continua ativa?
4. Qual é o saldo e de qual data/hora?
5. Entra no dinheiro disponível da fazenda?
6. Qual é a instituição, agência, conta e titular?
7. O CDB pode ser considerado disponível?
8. Quanto existe fisicamente na caixinha?

Perguntas sobre o relatório:

1. `PROJ` significa projeção ou orçamento?
2. As linhas abertas sem `PROJ` representam dívidas reais?
3. A planilha nova contém todo o histórico?
4. Qual é a data de corte da planilha nova?
5. Aplicação Automática é transferência entre banco e CDB ou rendimento?
6. Transferência entre empresas precisa ser devolvida ou é aporte?

Se nem todas as respostas estiverem disponíveis, a migração do realizado poderá continuar. As dúvidas permanecerão em revisão sem bloquear o histórico confiável.

## 12. Fora de escopo

- reconstrução de estoque histórico;
- produtos, quantidades e unidades históricas;
- anexos não existentes no Excel;
- orçamento e projeções `PROJ`;
- módulo de empréstimos;
- conciliação bancária automática;
- separação retroativa por várias propriedades;
- criação imediata de `GrupoCategoria`;
- importação direta no banco de produção durante desenvolvimento.

## 13. Implementação entregue

A implementação possui três camadas independentes:

1. `scripts/extract_financeiro_rio_novo.py` lê o `pivotCache 3` somente com a biblioteca padrão do Python, calcula o SHA-256 e gera um artefato normalizado sem perder os 32 campos originais;
2. `importacao-rio-novo.ts` valida o artefato, aplica a matriz versionada, pareia transferências e estornos e produz um plano determinístico sem acessar o banco;
3. `aplicar-importacao-rio-novo.ts` persiste somente os eventos prontos, registra a origem linha a linha e reconcilia o destino antes de concluir o lote.

A migration `20261001020000_importacao_financeira_rastreavel` adiciona somente as tabelas técnicas `ImportacaoFinanceira` e `LinhaImportacaoFinanceira`. Ela não altera a estrutura de categorias, não cria grupos e não modifica o estoque.

### 13.1. Travas operacionais

- o comando é `dry-run` por padrão e não abre conexão com o banco;
- a aplicação exige `--aplicar`, confirmação exata do SHA-256 e do nome da propriedade;
- títulos abertos exigem simultaneamente `--incluir-abertos` e `--confirmar-fonte-mais-recente`;
- qualquer linha rejeitada bloqueia a aplicação;
- linhas em revisão exigem aceite explícito e continuam fora do domínio financeiro;
- banco remoto é bloqueado sem `--permitir-banco-remoto`;
- a mesma planilha não pode ser aplicada duas vezes;
- lote interrompido só continua com `--retomar`;
- cada evento é atômico e usa IDs determinísticos;
- a conclusão exige reconciliação de operações, compromissos, transações, contas, datas e valores;
- a reconciliação falha se surgir qualquer `MovimentoEstoque`.

### 13.2. Ensaio com a planilha de maio de 2026

O ensaio local, sem banco, produziu:

| Resultado | Quantidade |
|---|---:|
| Linhas da Rio Novo | 6.704 |
| Eventos financeiros prontos | 4.314 |
| Linhas principais prontas | 4.314 |
| Linhas agrupadas em outro evento | 860 |
| Linhas ignoradas | 848 |
| Linhas em revisão | 682 |
| Linhas rejeitadas | 0 |

As 848 linhas ignoradas são exatamente 674 projeções `PROJ` e 174 títulos abertos da planilha antiga. As 682 linhas em revisão pertencem a categorias explicitamente ambíguas, principalmente `Diversos (-)`, `Transferência` usada fora da transferência bancária e `Identificar (+/-)`.

O planejador reconheceu 405 transferências ativas e 26 transferências estornadas, com todas as pontas agrupadas. Descrições truncadas pelo Excel não impedem o pareamento de estornos, pois documento, parceiro, conta, data e valor são as chaves estruturadas.

### 13.3. Comandos de preparação

Executar a partir de `server/`:

```bash
npm run extrair:financeiro -- "../Relatório Rio Novo 2026.05.04.xlsx" /tmp/rio-novo-financeiro.json
npm run import:financeiro -- --artefato /tmp/rio-novo-financeiro.json --saida-plano /tmp/rio-novo-plano.json
```

Esses comandos não aplicam a migration nem escrevem no banco. A forma de aplicação existe, mas só deverá ser usada na janela aprovada, com a planilha nova, a migration aplicada, backup/PITR e todas as confirmações descritas pela ajuda do comando.

## 14. Próximo passo

Não falta outra decisão extensa para continuar o trabalho técnico. Antes da carga real:

1. receber a planilha mais recente;
2. confirmar que ela é cumulativa e identificar sua data de corte;
3. executar extração e `dry-run` novamente;
4. revisar somente a nova fila de ambiguidades e os títulos abertos;
5. obter, se possível, os saldos e dados das contas;
6. ensaiar a aplicação em banco local ou clone seguro;
7. aplicar a migration e o lote em produção somente durante a janela aprovada.
