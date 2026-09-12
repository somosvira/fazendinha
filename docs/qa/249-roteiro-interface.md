# QA #249 — roteiro para testar Financeiro pela interface

Use junto da [matriz de efeitos](249-matriz-efeitos.md). Este documento é um roteiro
para execução humana; as caixas começam vazias. Os testes automáticos já
reproduziram três defeitos, mas nenhum fluxo abaixo foi marcado como aprovado
visualmente só por esse motivo.

## 1. Preparar e abrir o ambiente

Na pasta do projeto aberta no VS Code, com Node 22.13+ ou Node 24 e PostgreSQL local:

```sh
pnpm install --frozen-lockfile
pnpm --filter rionovo-server qa249:prepare
pnpm --filter rionovo-server qa249:dev
```

O primeiro comando de QA cria um banco novo, aplica migrations e executa a seed
`server/prisma/seed-qa249.ts`. O segundo inicia API em **42973** e interface em
**42975**, sem trocar o banco do dev habitual. Abra **http://localhost:42975**.
Não use `pnpm dev` para esta rodada: ele usa a configuração habitual do projeto.

- Acesso completo: **qa249@example.test** / **QA249-local-2026!**
- Acesso de consulta: **qa249-consulta@example.test** / **QA249-local-2026!**
- Selecione **QA249 Principal** no seletor de propriedade. Não teste no consolidado.
- Essas senhas pertencem exclusivamente aos usuários fictícios do banco local.
- O banco fica salvo quando você encerra o app. `Ctrl+C` encerra API/interface.

`qa249:prepare` novamente preserva a rodada, inclusive operações feitas por você.
Para repetir tudo do zero, pare o app e execute:

```sh
pnpm --filter rionovo-server qa249:prepare --nova-rodada
pnpm --filter rionovo-server qa249:dev
```

Isso cria **outro** banco e mantém o anterior. Faça logout e limpe os dados do site
`localhost:42975` no navegador (cache, localStorage e IndexedDB) antes do novo login,
para não carregar sessão ou dados da rodada antiga. Não use cancelamento de
operações como forma de zerar a massa: há um defeito conhecido nesse fluxo.

Conexão, IDs, datas de referência e estoque inicial ficam em
`server/.qa249/atual.json` e no `manifesto.json` da pasta da rodada indicada ali.
O XML para anexar fica nessa mesma pasta: **comprovante-qa249.xml** (fictício,
sem valor fiscal). A pasta `.qa249` é local e ignorada pelo Git.

O runner só aceita PostgreSQL local e gera seu próprio nome de banco.
`QA_DATABASE_ADMIN_URL` configura a conexão administrativa, se necessário.
As URLs de banco dos subprocessos são explicitamente sobrescritas; o Prisma CLI
pode carregar outras variáveis de `.env` ao aplicar migrations, mas não substitui
essas URLs. O servidor de QA usa storage local e não recebe chaves de IA, WhatsApp
ou envio de e-mail. Nenhum seed habitual, importação ou reset é executado.

## 2. Quais entidades precisamos para uma operação

| Entidade | Por que precisamos | O que a seed entrega |
|---|---|---|
| Propriedade | Define a origem dos efeitos e o escopo dos saldos | QA249 Principal e QA249 Secundária |
| Usuário e permissões | Login, autorização para lançar e autoria/auditoria | Proprietário ativo e usuário de consulta, com hash de senha |
| Conta financeira | Receber/pagar no ato ou liquidar depois | Um banco de R$ 1.000 para cada U01–U18; caixa destino R$ 200; conta inativa R$ 0; banco secundário R$ 500 |
| Parceiro e papéis | Fornecedor na compra/devolução, cliente na venda, prestador no serviço | Fornecedor, Cliente, Prestador, Múltiplos papéis, Fornecedor inativo e Papel incompatível |
| Grupo de categoria e categoria | Classificar operação e conferir relatórios; opcionais no domínio atual | QA249 Operacional; QA249 Insumos, QA249 Serviços e QA249 Vendas |
| Centro de custo | Classificação gerencial; opcional no domínio atual | QA249 Produção |
| Produto | Item físico exige produto ativo; fornece unidade e custo sugerido | Produto por fluxo em kg a R$ 10; adicional de U16 em un; produto inativo |
| Estoque inicial | Vender/devolver/ajustar exige uma posição física conhecida | 10 kg nos produtos U06, U10 e U11, originados por operações de inventário |
| Período financeiro | Validar datas permitidas e rejeitar lançamentos em mês fechado | Mês anterior fechado na Principal; mês atual sem fechamento (aberto por regra do domínio) |
| Documento | Testar upload, persistência do rascunho e download | XML local para anexar manualmente; não cria um DocumentoFinanceiro antecipado |

**Não precisamos cadastrar previamente operação, item, compromisso, pagamento ou
movimento de conta para começar uma compra.** Eles são efeitos criados pela
confirmação. A seed só antecipa três operações de inventário, para estabelecer os
estoques de saída, sem gerar dinheiro ou compromissos. Rascunhos também começam
vazios. Parcelas/vencimentos e condição de pagamento são informados no formulário.

Parceiros, produtos, categorias e centros são catálogos compartilhados no modelo
atual; não espere que desapareçam ao trocar propriedade. Já contas, operações e
saldos físicos devem respeitar o escopo selecionado.

## 3. Conferir a massa antes de começar

- [ ] Login completo funciona e permite abrir Financeiro e Pecuária/Estoque.
- [ ] Principal: 18 bancos de R$ 1.000, caixa de R$ 200 e conta inativa zerada.
- [ ] Saldo geral inicial da Principal: **R$ 18.200**. Secundária: **R$ 500**.
- [ ] Estoque U06, U10 e U11: **10 kg cada**; demais produtos ativos: zero.
- [ ] Operações: **3 inventários** com descrição `SEED QA249 ... estoque inicial`.
- [ ] Compromissos e extratos: nenhum pagamento/recebimento inicial.
- [ ] Configurações: 6 parceiros, 3 categorias, 1 centro de custo.

A seed contém 21 contas ao todo e 18 produtos (17 ativos e 1 inativo). U05 e U18
não têm produto próprio. Os três inventários valem R$ 100 cada: podem aparecer
como **R$ 300 de volume de operações**, mas não são R$ 300 de entrada de dinheiro.

## 4. Telas e procedimento comum

| Tela | Caminho |
|---|---|
| Visão geral | `/financeiro` |
| Nova operação | `/financeiro/operacoes/nova` |
| Operações e detalhe | `/financeiro/operacoes` — abra a descrição do teste |
| Compromissos | `/financeiro/compromissos` — A pagar, A receber, Liquidados |
| Contas/extratos | `/financeiro/contas` — use o seletor do extrato, não só os três cards |
| Contas/parceiros | `/financeiro/configuracoes` |
| Categorias | `/financeiro/configuracoes/categorias` |
| Estoque | `/pecuaria/estoque` — filtre o produto do fluxo |
| Relatórios | `/financeiro/relatorios` |

Para cada teste Uxx:

1. Confirme Principal e registre saldo do **QA249 Uxx Banco** e do **QA249 Uxx Produto**.
2. Abra Nova operação. Descrição: `QA249 Uxx — <nome do fluxo>`; data: hoje.
3. Se houver produto: selecione o do fluxo, quantidade **10**, base **Valor unitário**,
   valor **10**. Confira unidade **kg** e total **R$ 100**. Não aceite cegamente um
   valor sugerido pelo cadastro.
4. Categoria **QA249 Insumos** e centro **QA249 Produção**, salvo indicação diferente.
5. Selecione parceiro conforme fluxo. Para operações físicas sem financeiro, deixe
   parceiro vazio se o formulário não o solicitar. No serviço use **QA249 Serviços**;
   na venda, **QA249 Vendas**.
6. Configure a condição. Quando houver conta, use a do próprio Uxx e forma **Pix**.
   Para prazo use vencimento hoje + 30 dias, também registrado no manifesto.
7. Leia a revisão de efeitos antes de **Confirmar operação**; anote o número OP gerado.
8. Visite detalhe, compromissos, extrato e estoque; confira valores. Recarregue as
   telas para distinguir estado persistido de atualização visual atrasada.
9. Registre resultado e capturas. Termine ou descarte explicitamente o rascunho
   antes do próximo fluxo: existe apenas um por usuário/propriedade.

Usar contas/produtos distintos permite executar os fluxos fora de ordem. Somente
as etapas internas de cada fluxo são sequenciais. Não use o saldo geral acumulado
como gabarito dos próximos testes; compare sempre a conta/produto do próprio Uxx.

## 5. Fluxos principais

### U01 — rascunho, documento e compra à vista (M01, R01–R02)

1. Prepare compra para estoque com **QA249 Fornecedor**, produto U01 e condição
   **Liquidação integral na operação**. Conta U01; total 100.
2. Anexe o XML fornecido. Selecione tipo Justificativa e número `QA249-001`.
3. Aguarde a indicação de rascunho salvo. Navegue para outra tela e reabra Nova
   operação; depois recarregue a página. Campos e anexo devem permanecer.
4. Antes de confirmar: conta 1.000, estoque 0, nenhum compromisso/operação confirmada.
5. Confirme uma vez. Esperado: conta **900**, estoque **10**, nenhum compromisso;
   uma operação, um movimento físico e um pagamento.
6. No detalhe baixe o documento: nome/conteúdo corretos. Nova operação deve estar
   vazia, sem reutilizar os itens/anexos já confirmados.

- [ ] Passou / [ ] Falhou / [ ] Bloqueado — OP: ____ Evidência: ____

### U02 — compra a prazo e duas liquidações (M02, M04–M05)

1. Compra para estoque, Fornecedor, produto U02. Condição **Liquidação integral a prazo**,
   uma parcela de 100, vencimento +30 dias. Não informe pagamento imediato.
2. Confirme: conta **1.000**, estoque **10**, A pagar **100**, status pendente.
3. Em Compromissos > A pagar, localize a descrição U02 e abra Registrar pagamento.
   Conta U02, valor **40**; confirme. Conta **960**, pendente **60**, estoque **10**.
4. Tente informar **61** na liquidação seguinte: confirmação deve ser bloqueada,
   sem alterar os saldos. Cancele o modal.
5. Liquide **60**. Conta **900**, pendente **0**, compromisso em Liquidados; estoque
   continua **10**, com uma entrada física no total e dois pagamentos no extrato.

- [ ] Passou / [ ] Falhou / [ ] Bloqueado — OP: ____ Evidência: ____

### U03 — pagamento parcial no ato (M03)

1. Compra para estoque, Fornecedor, produto U03. Condição **Liquidação parcial com
   saldo a prazo**, conta U03, valor liquidado **40**, uma parcela de **60** em +30 dias.
2. Confirme: conta **960**, estoque **10**, compromisso de **60**, não de 100.
3. Liquide os 60 em Compromissos usando conta U03: conta **900**, pendente zero;
   estoque continua 10. Esta última etapa amplia a cobertura automática existente.

- [ ] Passou / [ ] Falhou / [ ] Bloqueado — OP: ____ Evidência: ____

### U04 — compra para consumo direto (M06)

1. Tipo Compra para consumo direto; Fornecedor; produto U04; à vista, conta U04.
2. Confirme: conta **900**, estoque **0**, nenhum compromisso ou movimento físico.
   Vincular produto na descrição não deve transformar consumo direto em entrada.

- [ ] Passou / [ ] Falhou / [ ] Bloqueado — OP: ____ Evidência: ____

### U05 — serviço puro (M07)

1. Tipo Serviço; parceiro **QA249 Prestador**; categoria Serviços; descrição de
   manutenção; valor total **100**, à vista, conta U05.
2. Produto/quantidade não devem ser obrigatórios. Confirme: conta **900**, nenhum
   compromisso, nenhum movimento físico; nenhum produto teve saldo alterado.

- [ ] Passou / [ ] Falhou / [ ] Bloqueado — OP: ____ Evidência: ____

### U06 — venda estocável (M08)

1. Estoque U06 inicia em 10. Venda; **QA249 Cliente**; produto U06; 10 × 10;
   categoria Vendas; à vista, conta U06.
2. Confirme: estoque **0**, conta **1.100**, nenhum compromisso. Confira saída
   física e recebimento; inventário inicial permanece no histórico de operações.

- [ ] Passou / [ ] Falhou / [ ] Bloqueado — OP: ____ Evidência: ____

### U07–U09 — inventário, bonificação e produção (M11, M12, M15)

Execute um teste independente por linha, usando conta/produto com o mesmo código:

| Fluxo | Tipo | Estoque antes → depois | Conta | Compromisso |
|---|---|---|---|---|
| U07 | Inventário inicial | 0 → 10 | 1.000, sem alteração | Nenhum |
| U08 | Bonificação | 0 → 10 | 1.000, sem alteração | Nenhum |
| U09 | Produção | 0 → 10 | 1.000, sem alteração | Nenhum |

1. Preencha produto, quantidade 10, unitário 10 e justificativa na descrição.
2. Revise **Sem movimentação financeira**; não deve exigir conta/prazo.
3. Confirme e confira a linha correspondente. Produção aqui é entrada simples;
   não valida composição, baixa de matérias-primas ou custo de fabricação.

- U07: [ ] Passou / [ ] Falhou / [ ] Bloqueado — OP: ____
- U08: [ ] Passou / [ ] Falhou / [ ] Bloqueado — OP: ____
- U09: [ ] Passou / [ ] Falhou / [ ] Bloqueado — OP: ____

### U10 — ajuste positivo e negativo (M09–M10)

1. Estoque U10 inicia em 10. Em Nova operação escolha Ajuste de estoque, produto
   U10, quantidade 10, unitário 10, descrição `QA249 U10 conferência positiva`.
2. Confirme sem financeiro: estoque **20**, conta U10 **1.000**, nenhum compromisso.
3. Em Estoque > Registrar movimento escolha **Ajuste (inventário)**, produto U10,
   quantidade **-10**, data hoje e observação `QA249 U10 correção de contagem`.
4. Salve: estoque deve voltar a **10**, conta continua 1.000. Não tente inserir
   negativo no formulário financeiro atual, que exige quantidade positiva.

- [ ] Passou / [ ] Falhou / [ ] Bloqueado — IDs: ____ Evidência: ____

### U11 — devolução ao fornecedor (M13)

1. Estoque U11 inicia em 10. Tipo Devolução; **QA249 Fornecedor**; produto U11;
   10 × 10; liquidação integral na operação, conta U11.
2. Confirme: estoque **0**, conta **1.100** (restituição recebida), sem compromisso.
3. A massa usa inventário para disponibilizar o produto. Este cenário NÃO valida
   abatimento de compra não paga nem vínculo obrigatório à compra original.

- [ ] Passou / [ ] Falhou / [ ] Bloqueado — OP: ____ Evidência: ____

## 6. Cancelamentos — executar com atenção ao resultado esperado

### U12–U14 — cancelar compras em três condições (R03–R05, R07)

Crie uma compra de 100 com Fornecedor/produto do próprio fluxo:

| Fluxo | Condição inicial | Conta após criar | Pendente após criar | Depois de cancelar, esperado |
|---|---|---:|---:|---|
| U12 | À vista | 900 | 0 | Conta 1.000; estoque 0 |
| U13 | A prazo, uma parcela 100 | 1.000 | 100 | Conta 1.000; estoque 0; compromisso cancelado |
| U14 | Parcial, 40 agora e 60 a prazo | 960 | 60 | Conta 1.000; estoque 0; compromisso cancelado |

1. Após criar, confirme estoque 10 em cada fluxo e os saldos da tabela.
2. No detalhe, clique **Cancelar operação**. Sem motivo, o botão de confirmar deve
   ficar desabilitado. Clique Manter operação e confira que nada mudou.
3. Abra novamente, informe `QA249 cancelamento de conferência` e confirme.
4. Confira operação CANCELADA, reversões no extrato, valores finais da tabela e
   preservação do registro original. Se houver anexo, deve continuar disponível.
5. Reabra o detalhe: não deve permitir aplicar o cancelamento outra vez.

**Falha conhecida na base:** o estoque retorna **-10**, não zero. Se acontecer,
marque Falhou e registre evidência; não mude o gabarito para -10. Conta/produto do
próximo fluxo são independentes, então é possível continuar os outros testes.

- U12: [ ] Passou / [ ] Falhou / [ ] Bloqueado — OP: ____
- U13: [ ] Passou / [ ] Falhou / [ ] Bloqueado — OP: ____
- U14: [ ] Passou / [ ] Falhou / [ ] Bloqueado — OP: ____

### U15 — cancelar após liquidação posterior (R06)

1. Compra a prazo U15 de 100, uma parcela. Confirme e depois liquide integralmente
   com a conta U15: conta 900, estoque 10, compromisso liquidado.
2. Cancele **a operação inteira** no detalhe, com motivo.
3. Esperado: conta **1.000**, estoque **0**, compromisso cancelado; histórico de
   compra e pagamento/reversão preservado. Anote especialmente o histórico visível.
4. O estorno isolado de liquidação não tem botão implementado nessa interface:
   esta ação não substitui R08. A preservação do vínculo Liquidacao precisa também
   da inspeção automatizada do banco, que já identificou sua exclusão.

- [ ] Passou / [ ] Falhou / [ ] Bloqueado — OP: ____ Evidência: ____

## 7. Combinações e bloqueios

### U16 — múltiplos itens e parcelas

1. Compra para estoque com Fornecedor; **U16 Produto**, 2,5 kg × 10 = **25**;
   adicione **U16 Produto adicional**, 3 un × 10 = **30**. Total **55**.
2. No segundo item alterne Base do valor para **Valor total do item** e informe
   **30**; total da operação deve continuar 55.
3. A prazo: duas parcelas, **25** em +30 dias e **30** em +60 dias.
4. Confirme: conta U16 **1.000**, estoques **2,5 kg** e **3 un**, dois compromissos
   com valores/vencimentos corretos e duas entradas físicas vinculadas aos itens.
5. Liquide somente a parcela 25 na conta U16: saldo **975**, pendente total **30**;
   estoques não mudam. Fracionamento e múltiplos itens ampliam a suíte inicial.

- [ ] Passou / [ ] Falhou / [ ] Bloqueado — OP: ____ Evidência: ____

### U17 — validações, preferências e cadastros

Use somente U17; antes de cada tentativa bloqueada, conta 1.000 e estoque 0:

1. Na compra, verifique que Cliente/Papel incompatível não são opções válidas de
   fornecedor e que Fornecedor inativo e Produto inativo não podem ser usados.
2. Escolha Fornecedor. Sua preferência é boleto a prazo em 30/60 dias. Verifique
   que selecionar o parceiro **não aplica isso automaticamente**. Configure Pix
   à vista; use **Usar sugestão**, cancele a confirmação e confira preservação.
   Repita aceitando a sugestão e confira os campos; ajuste-os antes de continuar.
3. No pagamento imediato, Conta inativa e Secundária Banco não devem ser opções
   válidas na Principal. Em Configurações a inativa deve continuar consultável.
4. Em compra a prazo de 100, informe parcela 90: confirmação bloqueada. Corrija
   para 100. Em parcial, informe pago 40 e parcela 70: bloqueado; corrija para 60.
5. Use a **dataPeriodoFechado** do manifesto (mês anterior). Tente confirmar uma
   compra à vista: deve rejeitar sem criar compra/estoque/pagamento. Volte para hoje.
6. Aguarde salvar o rascunho. Em outra aba, desative **QA249 Fornecedor** nas
   Configurações. Recarregue Nova operação e tente confirmar: deve bloquear por
   parceiro inativo. Reative o parceiro ao terminar, para não afetar outros fluxos.
7. Descarte o rascunho U17. Confirme conta 1.000 e estoque zero; não deve existir
   operação confirmada desse fluxo. Se um bloqueio falhar, registre e não use
   esse estado como início das demais tentativas — comece outra rodada.

- [ ] Passou / [ ] Falhou / [ ] Bloqueado — Evidência: ____

### U18 — transferência entre contas (regressão financeira)

1. Em Contas/extratos clique **Transferir**; origem U18 Banco (1.000), destino
   **QA249 U18 Caixa destino** (200), valor **100**.
2. Confira revisão e registre: origem **900**, destino **300**, soma **1.200**.
   Nenhum compromisso/estoque; duas pontas no extrato.
3. Isso é transferência **financeira**. Não valida transferência de estoque M16.

- [ ] Passou / [ ] Falhou / [ ] Bloqueado — Evidência: ____

## 8. Escopo, acesso, relatórios e apresentação

- [ ] Troque para Secundária: banco **500**, sem operações/compromissos e sem saldos
  físicos da Principal. Catálogos de produto/parceiro podem continuar aparecendo.
- [ ] Retorne à Principal. Em Contas/extratos selecione bancos além dos três cards:
  todos os bancos de cenário devem estar acessíveis no seletor.
- [ ] Faça logout e entre com o usuário de consulta: não deve conseguir lançar
  operações nem administrar acessos. Volte ao login completo para continuar.
- [ ] Gere relatório gerencial no período atual; compare realizado com pagamentos
  efetivos e previsto com pendências dos fluxos executados. Inventário/bonificação/
  produção não são receita de caixa; transferência não infla receita/despesa.
- [ ] Confira cancelamentos no relatório e no extrato, preservando reversões e
  histórico. Use os resultados anotados dos fluxos, não uma soma fixa para toda a
  rodada, porque você pode ter executado apenas parte deles.
- [ ] Repita inspeção de formulário, revisão e modal de cancelamento em largura
  de celular (~390 px). Botões devem ser acessíveis; rótulos/valores sem cortes.
- [ ] Se uma tela só atualiza após recarregar, registre como falha de atualização;
  confirme o valor persistido separadamente.

## 9. Cenários que não devem ser simulados como aprovação visual

| Cenário | Como tratar |
|---|---|
| Transferência de estoque | Fluxo completo ausente; registrar Bloqueado por funcionalidade, não usar Transferir das contas |
| Devolução de venda | Direção própria não suportada; não usar devolução ao fornecedor como substituto |
| Compra confirmada sem recebimento físico | Não há separação de recebimento validada; registrar lacuna |
| Estorno isolado de liquidação | Sem CTA atual; teste de backend R08 e verificação de histórico necessária |
| Falha no meio da transação | Teste automático com trigger. Desconectar internet não prova rollback interno |
| Liquidações concorrentes | Teste automático R13 reproduz a falha; clique duplo manual não garante a intercalação |
| Estoque insuficiente | Política precisa ser definida; não aprovar negativo nem presumir bloqueio universal |
| Offline/UUID | PRs ainda separados da base deste roteiro; nova rodada após integração |

## 10. Registro de resultados

Copie este bloco para cada fluxo e mantenha junto das capturas:

```text
Fluxo / linha da matriz:
Data, navegador, largura da tela:
Commit e banco/rodada (nome do manifesto):
Usuário e propriedade:
OP / compromisso / produto / conta:
Antes: conta __; estoque __; pendente __
Ação e valores informados:
Esperado: conta __; estoque __; pendente __
Obtido: conta __; estoque __; pendente __
Após recarregar ficou igual?:
Resultado: Passou / Falhou / Bloqueado / Não executado
Captura do formulário/revisão:
Captura do detalhe + extrato + compromisso + estoque:
Issue de defeito / observações:
```

Não encerrar a #249 somente porque a seed foi criada ou o app abriu. A conclusão
exige a matriz executada, lacunas tratadas, defeitos vinculados e evidências dos
fluxos aplicáveis. As falhas conhecidas devem permanecer visíveis no registro.

## Validação da preparação (12/09/2026)

- Migrations aplicadas em banco local novo; seed executada com validação das
  contas, saldos físicos e ausência de pagamentos/compromissos pelo Prisma real.
- Autenticação dos dois usuários validada; repetição da preparação preservou
  a rodada existente.
- API e Vite iniciados nas portas dedicadas. Smoke HTTP pelo proxy da interface
  validou login, configurações da Principal (20 contas, 6 parceiros, 17 produtos
  ativos, R$ 18.200), compromissos vazios e entrega da página de Nova operação.
- TypeScript da seed e suíte dedicada aprovado. Isso valida a preparação;
  os checklists manuais acima continuam sem execução visual.
