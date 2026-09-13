# QA #249 — roteiro para testar Financeiro pela interface

Versão interativa: [abrir checklist HTML](249-checklist.html). Abra o arquivo no
navegador para marcar etapas, registrar resultados e exportar o progresso.
Não precisa de servidor para o checklist.

Use junto da [matriz de efeitos](249-matriz-efeitos.md). Este documento é um roteiro
para execução humana; as caixas começam vazias. Os testes automáticos já
reproduziram três defeitos, mas nenhum fluxo abaixo foi marcado como aprovado
visualmente só por esse motivo.

## 1. Usar o ambiente local habitual

Usamos **um único banco: fazendinha_local**, configurado em `server/.env`,
e as portas habituais: API **41873**, interface **41875**. O agente não inicia
os servidores; você controla a execução no terminal do VS Code.

Para abrir o app (a seed desta rodada já está aplicada):

```sh
nvm use 22.21.1
pnpm dev
```

Abra **http://localhost:41875**. Para parar, **Ctrl+C** no mesmo terminal.

Para preparar a massa em outro checkout local, depois de instalar dependências
e sincronizar o schema pelo fluxo normal do projeto:

```sh
pnpm --filter rionovo-server seed:qa249
```

A seed é **aditiva**: mantém dados locais existentes e acrescenta os cadastros
com prefixo QA249. Reexecutá-la não apaga nem restaura testes manuais já feitos.
Não existe mais `qa249:dev`, `qa249:prepare` ou criação de banco por rodada.

- Acesso completo: **qa249@example.test** / **QA249-local-2026!**
- Acesso de consulta: **qa249-consulta@example.test** / **QA249-local-2026!**
- Selecione **QA249 Principal**, não o consolidado nem a Fazenda Demonstração.
- Depois do reset desta rodada, o banco local contém somente a massa QA249. Se a
  seed for aplicada de forma aditiva depois, as contagens deste roteiro continuam
  restritas aos cadastros com prefixo QA249.
- Se aparecerem dados de uma conexão antiga, faça logout e limpe os dados do site
  `localhost:41875` antes do novo login.

Manifesto de IDs/datas: `server/.qa249/local/manifesto.json`. Anexo fictício:
`server/.qa249/local/comprovante-qa249.xml`. Essa pasta é ignorada pelo Git.
A seed só aceita conexão local para fazendinha_local e não reinicializa o banco.
Para repetir um fluxo já executado, use novos cadastros identificados ou faça um
reset local deliberado; não há reset automático. Cancelar não é forma segura de
zerar a massa enquanto o defeito de saldo físico estiver aberto.

Os testes automáticos também usam fazendinha_local, mas suas tabelas ficam em um
schema temporário removido ao final. O schema `public` do app e seus dados são
preservados. Não é criado outro banco ou outro servidor PostgreSQL.

## 2. Quais entidades precisamos para uma operação

| Entidade | Por que precisamos | O que a seed entrega |
|---|---|---|
| Propriedade | Define a origem dos efeitos e o escopo dos saldos | QA249 Principal e QA249 Secundária |
| Usuário e permissões | Login, autorização para lançar e autoria/auditoria | Proprietário ativo e usuário de consulta, com hash de senha |
| Conta financeira | Receber/pagar no ato ou liquidar depois | Corrente operacional, poupança, conta de pagamento, caixa físico, aplicação, conta fora do saldo geral, conta inativa e banco da propriedade secundária |
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

O cadastro dessas categorias e do centro de custo ainda não possui uma tela
administrativa real: a seed os insere diretamente no banco e a conferência manual
ocorre nos seletores de Nova operação. A aba Categorias atual usa dados de
demonstração e não serve como evidência para esta massa.

## 3. Conferir a massa antes de começar

- [ ] Login completo funciona e permite abrir Financeiro e Pecuária/Estoque.
- [ ] Principal: cinco contas ativas incluídas no saldo geral — Banco Operacional **R$ 10.000**, Poupança Reserva **R$ 3.000**, Conta Pagamento **R$ 1.000**, Caixa Escritório **R$ 1.200** e Aplicação CDB **R$ 3.000**.
- [ ] Principal também possui Conta fora do saldo geral **R$ 500** e Conta inativa **R$ 250**; nenhuma das duas entra nos **R$ 18.200**.
- [ ] Selecione **QA249 Principal**: saldo geral inicial **R$ 18.200**. **QA249 Secundária**: **R$ 500**. No banco recém-resetado, **Consolidado** começa em **R$ 18.700**, pois soma somente as contas ativas incluídas das duas propriedades.
- [ ] Estoque U06, U10 e U11: **10 kg cada**; demais produtos ativos: zero.
- [ ] Operações: **3 inventários** com descrição `SEED QA249 ... estoque inicial`.
- [ ] Compromissos e extratos: nenhum pagamento/recebimento inicial.
- [ ] Em Nova operação, o seletor Categoria mostra o grupo **QA249 Operacional**
  com **QA249 Insumos**, **QA249 Serviços** e **QA249 Vendas**; o seletor Centro
  de custo mostra **QA249 Produção**.

A seed contém 8 contas ao todo e 18 produtos (17 ativos e 1 inativo). U05 e U18
não têm produto próprio. As contas cobrem os tipos Banco, Caixa e Aplicação; os
bancos cobrem Corrente, Poupança e Pagamento, além dos estados fora do saldo geral,
inativo e pertencente a outra propriedade. Os três inventários valem R$ 100 cada: podem aparecer
como **R$ 300 de volume de operações**, mas não são R$ 300 de entrada de dinheiro.

## 4. Telas e procedimento comum

| Tela | Caminho |
|---|---|
| Visão geral | `/financeiro` |
| Nova operação | `/financeiro/operacoes/nova` |
| Operações e detalhe | `/financeiro/operacoes` — abra a descrição do teste |
| Compromissos | `/financeiro/compromissos` — A pagar, A receber, Liquidados |
| Contas/extratos | `/financeiro/contas` — use “Ver conta” na tabela para abrir dados e extrato |
| Contas/parceiros | `/financeiro/configuracoes` |
| Categorias | `/financeiro/configuracoes/categorias` |
| Estoque | `/pecuaria/estoque` — filtre o produto do fluxo |
| Relatórios | `/financeiro/relatorios` |

Para cada teste Uxx:

1. Confirme Principal e registre o saldo atual da **conta indicada no fluxo** e do
   **QA249 Uxx Produto**. Alguns fluxos reutilizam a mesma conta, então o valor
   anterior depende dos testes já executados.
2. Abra Nova operação. Descrição: `QA249 Uxx — <nome do fluxo>`; data: hoje.
3. Se houver produto: selecione o do fluxo, quantidade **10**, base **Valor unitário**,
   valor **10**. Confira unidade **kg** e total **R$ 100**. Não aceite cegamente um
   valor sugerido pelo cadastro.
4. Categoria **QA249 Insumos** e centro **QA249 Produção**, salvo indicação diferente.
5. Selecione parceiro conforme fluxo. Para operações físicas sem financeiro, deixe
   parceiro vazio se o formulário não o solicitar. No serviço use **QA249 Serviços**;
   na venda, **QA249 Vendas**.
6. Configure a condição. Quando houver conta, use a indicada no fluxo e forma **Pix**.
   Para prazo use vencimento hoje + 30 dias, também registrado no manifesto.
7. Leia a revisão de efeitos antes de **Confirmar operação**; anote o número OP gerado.
8. Visite detalhe, compromissos, extrato e estoque; confira valores. Recarregue as
   telas para distinguir estado persistido de atualização visual atrasada.
9. Registre resultado e capturas. Termine ou descarte explicitamente o rascunho
   antes do próximo fluxo: existe apenas um por usuário/propriedade.

Os produtos continuam isolados por fluxo, mas as contas representam o uso real e
são compartilhadas. Os fluxos podem ser executados fora de ordem quando o saldo da
conta for anotado antes: valide sempre a diferença esperada, não um valor absoluto.
Somente as etapas internas de cada fluxo são sequenciais.

## 5. Fluxos principais

### U01 — rascunho, documento e compra à vista (M01, R01–R02)

1. Prepare compra para estoque com **QA249 Fornecedor**, produto U01 e condição
   **Liquidação integral na operação**. Conta **QA249 Banco Operacional**; total 100.
2. Anexe o XML fornecido. Selecione tipo Justificativa e número `QA249-001`.
3. Aguarde a indicação de rascunho salvo. Navegue para outra tela e reabra Nova
   operação; depois recarregue a página. Campos e anexo devem permanecer.
4. Antes de confirmar: anote o saldo da conta; estoque 0 e nenhuma operação U01 confirmada.
5. Confirme uma vez. Esperado: conta **saldo anterior − R$ 100**, estoque **10**, nenhum compromisso;
   uma operação, um movimento físico e um pagamento.
6. No detalhe baixe o documento: nome/conteúdo corretos. Nova operação deve estar
   vazia, sem reutilizar os itens/anexos já confirmados.

- [ ] Passou / [ ] Falhou / [ ] Bloqueado — OP: ____ Evidência: ____

### U02 — compra a prazo e duas liquidações (M02, M04–M05)

1. Compra para estoque, Fornecedor, produto U02. Condição **Liquidação integral a prazo**,
   uma parcela de 100, vencimento +30 dias. Não informe pagamento imediato.
2. Use **QA249 Poupança Reserva** e anote seu saldo. Confirme: conta **sem alteração**,
   estoque **10**, A pagar **100**, status pendente.
3. Em Compromissos > A pagar, localize a descrição U02 e abra Registrar pagamento.
   Use a Poupança Reserva, valor **40**; confirme. Conta **saldo anterior − R$ 40**,
   pendente **60**, estoque **10**.
4. Tente informar **61** na liquidação seguinte: confirmação deve ser bloqueada,
   sem alterar os saldos. Cancele o modal.
5. Liquide **60**. Conta **mais R$ 60 abaixo**, pendente **0**, compromisso em Liquidados; estoque
   continua **10**, com uma entrada física no total e dois pagamentos no extrato.

- [ ] Passou / [ ] Falhou / [ ] Bloqueado — OP: ____ Evidência: ____

### U03 — pagamento parcial no ato (M03)

1. Compra para estoque, Fornecedor, produto U03. Condição **Liquidação parcial com
   saldo a prazo**, conta **QA249 Conta Pagamento**, valor liquidado **40**, uma parcela de **60** em +30 dias.
2. Anote o saldo da conta. Confirme: conta **saldo anterior − R$ 40**, estoque **10**,
   compromisso de **60**, não de 100.
3. Liquide os 60 em Compromissos usando a mesma conta: saldo **mais R$ 60 abaixo**, pendente zero;
   estoque continua 10. Esta última etapa amplia a cobertura automática existente.

- [ ] Passou / [ ] Falhou / [ ] Bloqueado — OP: ____ Evidência: ____

### U04 — compra para consumo direto (M06)

1. Tipo Compra para consumo direto; Fornecedor; produto U04; à vista, conta
   **QA249 Caixa Escritório**. Anote o saldo antes.
2. Confirme: conta **saldo anterior − R$ 100**, estoque **0**, nenhum compromisso ou movimento físico.
   Vincular produto na descrição não deve transformar consumo direto em entrada.

- [ ] Passou / [ ] Falhou / [ ] Bloqueado — OP: ____ Evidência: ____

### U05 — serviço puro (M07)

1. Tipo Serviço; parceiro **QA249 Prestador**; categoria Serviços; descrição de
   manutenção; valor total **100**, à vista, conta **QA249 Banco Operacional**.
2. Anote o saldo. Produto/quantidade não devem ser obrigatórios. Confirme: conta
   **saldo anterior − R$ 100**, nenhum
   compromisso, nenhum movimento físico; nenhum produto teve saldo alterado.

- [ ] Passou / [ ] Falhou / [ ] Bloqueado — OP: ____ Evidência: ____

### U06 — venda estocável (M08)

1. Estoque U06 inicia em 10. Venda; **QA249 Cliente**; produto U06; 10 × 10;
   categoria Vendas; à vista, conta **QA249 Conta Pagamento**.
2. Anote o saldo. Confirme: estoque **0**, conta **saldo anterior + R$ 100**, nenhum compromisso. Confira saída
   física e recebimento; inventário inicial permanece no histórico de operações.

- [ ] Passou / [ ] Falhou / [ ] Bloqueado — OP: ____ Evidência: ____

### U07–U09 — inventário, bonificação e produção (M11, M12, M15)

Execute um teste independente por linha. Nenhum deles solicita conta financeira:

| Fluxo | Tipo | Estoque antes → depois | Conta | Compromisso |
|---|---|---|---|---|
| U07 | Inventário inicial | 0 → 10 | Todas sem alteração | Nenhum |
| U08 | Bonificação | 0 → 10 | Todas sem alteração | Nenhum |
| U09 | Produção | 0 → 10 | Todas sem alteração | Nenhum |

1. Preencha produto, quantidade 10, unitário 10 e justificativa na descrição.
2. Revise **Sem movimentação financeira**; não deve exigir conta/prazo.
3. Confirme e confira a linha correspondente. Produção aqui é entrada simples;
   não valida composição, baixa de matérias-primas ou custo de fabricação.

- U07: [ ] Passou / [ ] Falhou / [ ] Bloqueado — OP: ____
- U08: [ ] Passou / [ ] Falhou / [ ] Bloqueado — OP: ____
- U09: [ ] Passou / [ ] Falhou / [ ] Bloqueado — OP: ____

### U10 — ajustar a quantidade contada no Estoque (M09–M10)

1. Abra Estoque > **Ajustar quantidade**. Selecione **QA249 U10 Produto**, cujo
   saldo inicial é 10 kg. Ajuste de estoque não deve aparecer em Nova operação.
2. Informe **20** em Quantidade encontrada na contagem e a justificativa
   `QA249 U10 contagem positiva`. Revise **diferença +10 kg** e estoque final 20.
3. Confirme: estoque **20**, todas as contas sem alteração, nenhum compromisso ou pagamento.
4. Abra novo ajuste do mesmo produto e informe **10** (não -10), com justificativa
   `QA249 U10 recontagem`. Revise **diferença -10 kg** e confirme: estoque **10**.
5. Verifique que informar novamente 10 mostra Nenhum ajuste necessário e bloqueia
   confirmação. Informe **0**, justifique e revise a diferença -10: zerar é válido.
   Confirme e confira estoque zero, contas sem alteração e histórico dos três ajustes.
6. Se aparecer aviso de saldo alterado, use **Atualizar saldo**, confira novamente
   a diferença e só então confirme. Não deve sobrescrever movimentos concorrentes.

- [ ] Passou / [ ] Falhou / [ ] Bloqueado — IDs: ____ Evidência: ____

### U11 — devolução ao fornecedor (M13)

1. Estoque U11 inicia em 10. Tipo Devolução; **QA249 Fornecedor**; produto U11;
   10 × 10; liquidação integral na operação, conta **QA249 Conta Pagamento**.
2. Anote o saldo. Confirme: estoque **0**, conta **saldo anterior + R$ 100**
   (restituição recebida), sem compromisso.
3. A massa usa inventário para disponibilizar o produto. Este cenário NÃO valida
   abatimento de compra não paga nem vínculo obrigatório à compra original.

- [ ] Passou / [ ] Falhou / [ ] Bloqueado — OP: ____ Evidência: ____

## 6. Cancelamentos — executar com atenção ao resultado esperado

### U12–U14 — cancelar compras em três condições (R03–R05, R07)

Crie uma compra de 100 com Fornecedor/produto do próprio fluxo:

| Fluxo | Conta | Condição inicial | Efeito ao criar | Depois de cancelar, esperado |
|---|---|---:|---:|---|
| U12 | Banco Operacional | À vista | Saldo −100; pendente 0 | Saldo volta ao anterior; estoque 0 |
| U13 | Poupança Reserva | A prazo, uma parcela 100 | Saldo inalterado; pendente 100 | Saldo anterior; estoque 0; compromisso cancelado |
| U14 | Conta Pagamento | Parcial, 40 agora e 60 a prazo | Saldo −40; pendente 60 | Saldo volta ao anterior; estoque 0; compromisso cancelado |

1. Após criar, confirme estoque 10 em cada fluxo e os saldos da tabela.
2. No detalhe, clique **Cancelar operação**. Sem motivo, o botão de confirmar deve
   ficar desabilitado. Clique Manter operação e confira que nada mudou.
3. Abra novamente, informe `QA249 cancelamento de conferência` e confirme.
4. Confira operação CANCELADA, reversões no extrato, valores finais da tabela e
   preservação do registro original. Se houver anexo, deve continuar disponível.
5. Reabra o detalhe: não deve permitir aplicar o cancelamento outra vez.

**Falha conhecida na base:** o estoque retorna **-10**, não zero. Se acontecer,
marque Falhou e registre evidência; não mude o gabarito para -10. O produto do
próximo fluxo é independente, então é possível continuar os outros testes.

- U12: [ ] Passou / [ ] Falhou / [ ] Bloqueado — OP: ____
- U13: [ ] Passou / [ ] Falhou / [ ] Bloqueado — OP: ____
- U14: [ ] Passou / [ ] Falhou / [ ] Bloqueado — OP: ____

### U15 — cancelar após liquidação posterior (R06)

1. Compra a prazo U15 de 100, uma parcela. Confirme e depois liquide integralmente
   com **QA249 Aplicação CDB**: saldo da conta **− R$ 100**, estoque 10,
   compromisso liquidado.
2. Cancele **a operação inteira** no detalhe, com motivo.
3. Esperado: conta volta ao **saldo anterior**, estoque **0**, compromisso cancelado; histórico de
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
4. Anote o saldo de **QA249 Poupança Reserva**. Confirme: saldo sem alteração,
   estoques **2,5 kg** e **3 un**, dois compromissos
   com valores/vencimentos corretos e duas entradas físicas vinculadas aos itens.
5. Liquide somente a parcela 25 na Poupança Reserva: saldo **anterior − R$ 25**,
   pendente total **30**;
   estoques não mudam. Fracionamento e múltiplos itens ampliam a suíte inicial.

- [ ] Passou / [ ] Falhou / [ ] Bloqueado — OP: ____ Evidência: ____

### U17 — validações, preferências e cadastros

Use somente U17; anote o saldo de **QA249 Banco Operacional** antes de cada
tentativa bloqueada e confirme estoque 0:

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
7. Descarte o rascunho U17. Confirme saldo da conta inalterado e estoque zero; não deve existir
   operação confirmada desse fluxo. Se um bloqueio falhar, registre e não use
   esse estado como início das demais tentativas — prepare um novo conjunto de cadastros para esse fluxo.

- [ ] Passou / [ ] Falhou / [ ] Bloqueado — Evidência: ____

### U18 — transferência entre contas (regressão financeira)

1. Em Contas/extratos clique **Transferir**; origem **QA249 Banco Operacional**,
   destino **QA249 Caixa Escritório**, valor **100**. Anote ambos os saldos.
2. Confira revisão e registre: origem **saldo anterior − R$ 100**, destino
   **saldo anterior + R$ 100** e soma das duas contas sem alteração.
   Nenhum compromisso/estoque; duas pontas no extrato.
3. Isso é transferência **financeira**. Não valida transferência de estoque M16.

- [ ] Passou / [ ] Falhou / [ ] Bloqueado — Evidência: ____

## 8. Escopo, acesso, relatórios e apresentação

- [ ] Troque para Secundária: banco **500**, sem operações/compromissos e sem saldos
  físicos da Principal. Catálogos de produto/parceiro podem continuar aparecendo.
- [ ] Retorne à Principal. Em Contas/extratos abra “Ver conta” em diferentes linhas da tabela e confira os dados e o extrato:
  corrente, poupança, pagamento, caixa e aplicação devem estar acessíveis na tabela;
  a conta fora do saldo geral aparece sem compor o card e a inativa permanece consultável em Configurações.
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
Commit e manifesto da massa local:
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

## Validação da preparação

O único banco local `fazendinha_local` foi salvo em backup, resetado e preenchido
somente com a massa QA249. A seed verificou pelos serviços reais as 8 contas, os
saldos de abertura, os estoques e o login dos dois usuários. O estado inicial tem
3 inventários, nenhum compromisso, nenhum pagamento e nenhum rascunho.

A Principal inicia com R$ 18.200 nas cinco contas ativas incluídas no saldo geral;
a Secundária inicia com R$ 500 e o Consolidado com R$ 18.700. Os servidores
permanecem parados para você iniciar com `pnpm dev`. O checklist visual continua
pendente de execução humana.

## Extrato geral e localização de movimentação

- [ ] No card de saldo, confira **Ver extrato geral** alinhado verticalmente com o valor; ao clicar, a página deve rolar para o extrato geral.
- [ ] Antes da tabela de contas, confira o título **Contas**. A tabela deve separar **Conta** e **Tipo**, centralizar cabeçalhos/valores e não repetir “Banco”, “Caixa” ou “Aplicação” abaixo do nome.
- [ ] Combine os filtros da lista por busca, tipo, instituição e situação; confira também uma combinação sem resultados.
- [ ] Em Contas e extratos, clique **Ver extrato geral** no card de saldo: a página deve rolar para a tabela abaixo das contas, sem trocar de rota.
- [ ] Confira movimentos de contas diferentes da fazenda selecionada, do mais recente ao mais antigo, inclusive contas inativas com histórico.
- [ ] Combine data inicial/final, conta e instituição; datas-limite são inclusivas. Teste também “Sem instituição” e um intervalo sem resultados.
- [ ] Clique em uma movimentação: deve abrir `/financeiro/contas/:id#movimento-:id`, carregar o extrato da conta, rolar e destacar exatamente o registro escolhido.
- [ ] Recarregue esse endereço e repita em celular: o movimento deve continuar localizável. Volte para a lista e troque a fazenda; o extrato geral deve respeitar o novo escopo.
- [ ] Em Configurações financeiras > Contas, confira nome sem subtítulo, instituição em coluna própria e Abertura exibindo somente a data. O valor de abertura deve aparecer apenas ao abrir os detalhes/edição da conta.

## Cadastros gerenciais e identificação das parcelas

- [ ] Em **Financeiro > Configurações financeiras > Categorias**, crie um grupo e uma categoria vinculada a ele; recarregue e confirme a persistência.
- [ ] Edite e desative a categoria. Ela permanece visível como inativa na configuração e deixa de aparecer em novas operações.
- [ ] Tente desativar um grupo com categoria ativa. O sistema deve bloquear a ação e orientar a desativação das categorias primeiro.
- [ ] Em **Centros de custo**, crie um centro operacional e outro de investimento; edite e desative um deles, preservando referências históricas.
- [ ] Crie uma operação de R$ 100 em duas parcelas de R$ 50. Compromissos, detalhe da operação, modal de liquidação e relatório devem identificar os títulos como **(1/2) descrição** e **(2/2) descrição**.
- [ ] Entre com um usuário sem a permissão `lancar`: os cadastros devem estar disponíveis apenas para consulta, sem ações de criação ou alteração.
