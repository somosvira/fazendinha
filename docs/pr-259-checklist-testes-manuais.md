# PR #259 — Checklist de testes manuais

PR: https://github.com/somosvira/fazendinha/pull/259  
Escopo: contas financeiras, parceiros e integração com operações.

Responsável: ____________________  
Data: ____________________  
Branch/commit testado: ____________________  
Navegador: ____________________

Marque `[x]` apenas quando o resultado esperado for confirmado. Se falhar, deixe desmarcado e registre o problema na tabela ao final. Identifique testes não aplicáveis nas observações.

## Preparação

- [ ] Confirmar que estou na branch do PR: `feat/245-cadastro-contas-parceiros`.
- [ ] Confirmar que a aplicação usa o banco local de testes, não produção.
- [ ] Na raiz do projeto já preparado, executar `pnpm dev`.
- [ ] Abrir `http://localhost:41875/financeiro/configuracoes` e selecionar a propriedade de teste.
- [ ] Usar o prefixo `QA` nos cadastros criados. Não executar seed ou reset para estes testes.

## 1. Conta bancária — criação e persistência

Rota: `/financeiro/configuracoes` → Contas financeiras.

- [ ] Criar `QA Banco` com tipo Conta bancária, instituição, agência, número da conta, titular, saldo de abertura de R$ 1.000,00 e data de hoje. **Esperado:** cadastro salvo e visível na lista.
- [ ] Preencher tipo bancário, dígito e identificação. **Esperado:** esses campos adicionais são opcionais e ficam salvos quando informados.
- [ ] Preencher observação/finalidade. **Esperado:** valor salvo.
- [ ] Atualizar a página e reabrir a edição. **Esperado:** todos os dados preenchidos continuam corretos.
- [ ] Alterar o nome e limpar um campo opcional. **Esperado:** a alteração e a remoção persistem após atualizar a página.

## 2. Outros tipos de conta

- [ ] Criar `QA Caixa` como Caixa físico, com saldo zero, local e responsável. **Esperado:** o campo Local sugere `Ex.: Cofre do escritório`; salva sem exigir instituição e saldo zero é válido.
- [ ] Criar `QA Aplicação` como Aplicação financeira, com instituição. **Esperado:** cadastro salvo com os dados básicos.
- [ ] Conferir a lista de tipos de conta. **Esperado:** não existe a opção Dinheiro; existe Caixa físico.
- [ ] Conferir as formas de pagamento de uma operação. **Esperado:** Dinheiro continua disponível como forma de pagamento.

## 3. Validações de conta

- [ ] Tentar salvar sem nome. **Esperado:** bloqueio com mensagem clara.
- [ ] Apagar o saldo de abertura e tentar salvar. **Esperado:** campo vazio bloqueado, diferente do valor zero.
- [ ] Apagar a data de abertura e tentar salvar. **Esperado:** bloqueio com mensagem clara.
- [ ] Tentar salvar Conta bancária e Aplicação financeira sem instituição. **Esperado:** bloqueio nos dois tipos.
- [ ] Tentar salvar Conta bancária sem agência, número da conta ou titular. **Esperado:** cada campo ausente é indicado sem impor formato específico à agência ou conta.
- [ ] Digitar ou colar números no titular. **Esperado:** números não são aceitos e o backend também rejeita um titular numérico enviado diretamente.
- [ ] Conferir o saldo de abertura. **Esperado:** mostra `R$`, usa duas casas decimais e não apresenta setas de incremento/decremento.
- [ ] Tentar criar outra conta com o mesmo nome na mesma propriedade. **Esperado:** duplicidade bloqueada.
- [ ] Deixar detalhes bancários adicionais vazios, mantendo os obrigatórios. **Esperado:** cadastro permitido.

## 4. Edição da abertura e proteção do histórico

- [ ] Antes de movimentar `QA Banco`, alterar saldo/data de abertura e salvar. **Esperado:** alteração permitida. Para os próximos testes, deixar o saldo em R$ 1.000 e data de hoje.
- [ ] Após criar um prestador na seção 7, registrar um serviço de R$ 100 à vista, hoje, usando `QA Banco`. **Esperado:** operação confirmada e saldo da conta em R$ 900, se não houver outros movimentos.
- [ ] Reabrir a edição da conta movimentada. **Esperado:** saldo e data de abertura bloqueados.
- [ ] Editar nome ou observação dessa conta. **Esperado:** alteração permitida, sem modificar os movimentos ou o saldo.

## 5. Listagem, saldo geral e extratos

Rotas: `/financeiro/contas` e `/financeiro`.

- [ ] Ter pelo menos quatro contas ativas e usar as setas da lista para movê-las para cima e para baixo. **Esperado:** a ordem muda imediatamente e permanece após atualizar a página.
- [ ] Conferir o formulário da conta. **Esperado:** não existe campo numérico livre para ordem de exibição.
- [ ] Selecionar a quarta conta no seletor de contas/extratos. **Esperado:** conta acessível, sem limitação às três primeiras.
- [ ] Desmarcar Incluir no saldo geral em uma conta com saldo conhecido. **Esperado:** sua contribuição deixa de compor o saldo geral.
- [ ] Consultar o extrato dessa conta. **Esperado:** continua acessível, mesmo fora do saldo geral.
- [ ] Marcar novamente Incluir no saldo geral. **Esperado:** contribuição volta ao total.

## 6. Desativação e reativação de conta

- [ ] Solicitar desativação de uma conta e cancelar a confirmação. **Esperado:** conta permanece ativa.
- [ ] Confirmar a desativação de uma conta com movimentos. **Esperado:** conta fica inativa, sem apagar o histórico.
- [ ] Selecionar a conta inativa no extrato. **Esperado:** movimentos antigos continuam disponíveis.
- [ ] Abrir nova operação e transferência. **Esperado:** conta inativa não pode ser usada em novos movimentos.
- [ ] Reativar a conta. **Esperado:** volta a estar disponível para novos movimentos.

## 7. Parceiro — cadastro completo e múltiplos papéis

Rota: `/financeiro/configuracoes` → Clientes e fornecedores.

- [ ] Criar `QA Oficina` com papel Prestador de serviço. **Esperado:** cadastro salvo.
- [ ] Criar um parceiro com os papéis Cliente e Fornecedor simultaneamente. **Esperado:** ambos são preservados após salvar e recarregar.
- [ ] Preencher documento de teste válido, pessoa de contato, telefone, indicação de WhatsApp e e-mail. **Esperado:** dados persistem corretamente.
- [ ] Testar um cadastro com CNPJ e nome fantasia. **Esperado:** nome fantasia disponível e persistido.
- [ ] Preencher CEP, logradouro, número, complemento, bairro, cidade, UF e referência. **Esperado:** endereço persistido após recarregar.
- [ ] Preencher observações; depois editar e limpar um campo opcional. **Esperado:** alteração e remoção persistem.
- [ ] Adicionar e remover papéis de um parceiro. **Esperado:** seleção salva corretamente, mantendo pelo menos um papel.

## 8. Validações de parceiro

- [ ] Tentar salvar sem nome. **Esperado:** bloqueio com indicação do campo.
- [ ] Remover todos os papéis e tentar salvar. **Esperado:** exige pelo menos um papel.
- [ ] Deixar CPF/CNPJ vazio. **Esperado:** cadastro permitido, pois o documento é opcional.
- [ ] Informar CPF/CNPJ com 11 ou 14 dígitos, mesmo sem dígito verificador válido. **Esperado:** cadastro permitido; o sistema não consulta nem certifica a situação cadastral.
- [ ] Informar CPF/CNPJ incompleto, com quantidade diferente de 11 ou 14 dígitos. **Esperado:** formulário pede o tamanho esperado antes do envio.
- [ ] Usar um documento já cadastrado. **Esperado:** duplicidade bloqueada.
- [ ] Informar e-mail inválido. **Esperado:** erro de validação.
- [ ] Informar CEP ou UF inválidos. **Esperado:** erro de validação.
- [ ] Selecionar condição sugerida A prazo sem prazos. **Esperado:** salvamento bloqueado.
- [ ] Testar prazos `60/30`, `30/30` e `0/30`. **Esperado:** todos rejeitados.
- [ ] Informar `30/60`. **Esperado:** prazos aceitos e preservados após salvar.

## 9. Compatibilidade dos papéis com operações

Rota: `/financeiro/operacoes/nova`. Criar parceiros ativos separados para Cliente, Fornecedor, Prestador de serviço e Cliente + Fornecedor.

- [ ] Selecionar Venda. **Esperado:** parceiros com papel Cliente disponíveis.
- [ ] Selecionar Compra para estoque. **Esperado:** parceiros com papel Fornecedor disponíveis.
- [ ] Selecionar Compra para consumo direto. **Esperado:** parceiros com papel Fornecedor disponíveis.
- [ ] Selecionar Devolução. **Esperado:** parceiros com papel Fornecedor disponíveis.
- [ ] Selecionar Serviço. **Esperado:** Prestador de serviço e Fornecedor disponíveis.
- [ ] Conferir o parceiro Cliente + Fornecedor nos tipos correspondentes. **Esperado:** pode ser usado em ambos os contextos.
- [ ] Conferir parceiros com apenas Funcionário, Sócio/proprietário ou Outro. **Esperado:** não são elegíveis nos tipos acima somente por esses papéis.
- [ ] Selecionar um parceiro e mudar para um tipo de operação incompatível. **Esperado:** seleção incompatível limpa e necessidade de nova seleção indicada.

Observação: Sócio/proprietário é um papel financeiro; não concede permissões de acesso ao sistema.

## 10. Pagamento sugerido, nunca obrigatório

Configurar `QA Oficina` com forma sugerida Boleto, condição A prazo e prazos `30/60`.

- [ ] Selecionar o parceiro em uma operação de Serviço. **Esperado:** preferência exibida, sem alterar automaticamente o pagamento preenchido.
- [ ] Clicar em Usar sugestão e cancelar. **Esperado:** campos de pagamento permanecem como estavam.
- [ ] Clicar em Usar sugestão e confirmar. **Esperado:** sugestão aplicada aos campos correspondentes.
- [ ] Após aplicar, escolher outra forma de pagamento ou condição. **Esperado:** alteração livre, sem obrigar a preferência do parceiro.
- [ ] Selecionar outro parceiro. **Esperado:** pagamento não é sobrescrito automaticamente.
- [ ] Tentar aplicar sugestão a prazo sem valor/data válidos. **Esperado:** aplicação bloqueada até preencher os dados necessários.

## 11. Parcelas, datas e centavos

- [ ] Criar Serviço de R$ 100,01 com data conhecida e aplicar sugestão `30/60`. **Esperado:** duas parcelas somando exatamente R$ 100,01.
- [ ] Conferir os vencimentos. **Esperado:** 30 e 60 dias após a data da operação.
- [ ] Editar manualmente valores e vencimentos, mantendo o total correto. **Esperado:** edição permitida.
- [ ] Confirmar a operação e abrir `/financeiro/compromissos`. **Esperado:** compromissos correspondem ao que foi confirmado.

## 12. Rascunho com parceiro que deixou de ser válido

- [ ] Preencher uma operação e aguardar o rascunho ser salvo. Em outra aba, desativar o parceiro. Recarregar e retomar o rascunho. **Esperado:** parceiro inválido sinalizado e confirmação bloqueada.
- [ ] Selecionar outro parceiro ativo e compatível. **Esperado:** problema resolvido e confirmação liberada quando os demais campos estiverem válidos.
- [ ] Repetir o teste removendo o papel necessário do parceiro, em vez de desativá-lo. **Esperado:** mesma proteção contra parceiro incompatível.

## 13. Histórico e compromissos existentes

Rotas: `/financeiro/operacoes`, `/financeiro/operacoes/:id` e `/financeiro/compromissos`.

- [ ] Criar operação a prazo e depois desativar o parceiro. **Esperado:** operação e compromissos continuam visíveis, com o vínculo ao parceiro.
- [ ] Liquidar um compromisso existente desse parceiro usando conta ativa. **Esperado:** liquidação permitida, apesar da desativação posterior do parceiro.
- [ ] Consultar uma operação antiga após editar o cadastro do parceiro. **Esperado:** vínculo e dados financeiros preservados.
- [ ] Estornar uma operação de teste elegível. **Esperado:** estorno registrado e histórico preservado, sem exclusão da operação original.
- [ ] Reativar o parceiro. **Esperado:** volta a ser selecionável em operações compatíveis.

## 14. Formulários, teclado e proteção contra duplicidade

- [ ] Abrir criação e edição de conta/parceiro, alterar campos e cancelar. **Esperado:** mudanças não persistem.
- [ ] Navegar com Tab e acionar botões internos das linhas com Enter/Espaço. **Esperado:** apenas a ação do botão é executada, sem abrir edição indevidamente.
- [ ] Com conexão lenta, clicar repetidamente em Salvar. **Esperado:** um único cadastro/uma única alteração.
- [ ] Durante o salvamento, tentar cancelar ou fechar o painel. **Esperado:** ações conflitantes bloqueadas até a resposta.
- [ ] Repetir cliques de ativação/desativação enquanto a requisição estiver pendente. **Esperado:** sem requisições duplicadas ou estado inconsistente.

## 15. Layout e acesso aos botões

- [ ] Testar os painéis em janela larga e estreita. **Esperado:** campos legíveis, sem corte que impeça preenchimento.
- [ ] Rolar um cadastro completo até os campos finais. **Esperado:** todos os campos e ações acessíveis.
- [ ] Abrir o assistente junto ao cadastro e à confirmação. **Esperado:** assistente não encobre Salvar, Cancelar ou os botões de confirmação.

## 16. Verificações técnicas complementares

Esta seção exige API ou banco descartável. Não reverter migrations nem criar dados legados artificialmente no banco de trabalho para testar conversão.

- [ ] `GET /api/financeiro/configuracoes`: conferir novos campos, papéis e cadastros inativos.
- [ ] `GET /api/financeiro/contas` e `?inativas=true`: conferir filtro, ordenação e informações de movimentação/saldo.
- [ ] `POST /api/financeiro/contas`: enviar campos obrigatórios ausentes. **Esperado:** rejeição também pelo backend.
- [ ] `PATCH /api/financeiro/contas/:id`: tentar alterar abertura de conta movimentada. **Esperado:** rejeição pelo backend.
- [ ] `GET /api/financeiro/parceiros` e `?inativos=true`: conferir papéis, novos campos e filtro de inativos.
- [ ] `POST /api/financeiro/parceiros`: enviar papéis vazios ou documento duplicado. **Esperado:** rejeição pelo backend.
- [ ] Nos PATCH de contas e parceiros, enviar somente `ativo`. **Esperado:** nenhum outro campo é apagado ou redefinido.
- [ ] `POST /api/financeiro/operacoes` e `/api/financeiro/operacoes/rascunho/confirmacao`: enviar parceiro inativo/incompatível. **Esperado:** rejeição sem efeitos financeiros parciais.
- [ ] `POST /api/financeiro/transacoes`: enviar parceiro inativo. **Esperado:** rejeição.
- [ ] `POST /api/rebanho/fornecedores`: conferir criação dos papéis equivalentes ao tipo legado.
- [ ] `PATCH /api/rebanho/fornecedores/:id`: conferir preservação de papéis adicionais e de campos não enviados.
- [ ] Em banco descartável, conferir migração de DINHEIRO para CAIXA e dos tipos legados de parceiro para papéis, preservando IDs e histórico.
- [ ] Em banco descartável, executar o backfill novamente. **Esperado:** não duplica papéis nem altera indevidamente cadastros já convertidos.

## Problemas encontrados

| Teste/seção | Passos para reproduzir | Esperado x ocorrido | Evidência | Status |
|---|---|---|---|---|
| | | | | |
| | | | | |
| | | | | |

## Conclusão

- [ ] Testes de interface concluídos.
- [ ] Verificações técnicas concluídas ou responsáveis definidos.
- [ ] Problemas encontrados registrados acima.
- [ ] Correções retestadas, quando aplicável.
- [ ] PR aprovado para o próximo passo.

Observações finais: ____________________

Fora do escopo: vínculo direto parceiro–produto, gestão avançada de aplicações financeiras e exclusão definitiva de cadastros.
