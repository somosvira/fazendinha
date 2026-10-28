# Colostro — prévia navegável

Data: **27/10/2026**. Estado: **proposta para aprovação visual**, sem aprovação do usuário registrada neste documento.

Abrir a [prévia local](http://127.0.0.1:41997/docs/design/leite/colostro/index.html#banco) com o servidor estático ativo. O desenho explora parto e origem, avaliação Brix, banco de unidades enriquecidas ou não enriquecidas, preparação e fornecimento às crias. É uma extensão visual da prévia V5 existente; não altera os contratos operacionais do sistema.

## Navegação

As rotas são fragmentos da URL da prévia:

| Rota | Percurso |
|---|---|
| `#banco` | Unidades, busca, filtros, paginação e acesso ao congelamento |
| `#unidade/BC001` | Origem e histórico de uma unidade demonstrativa |
| `#producao`, `#partos`, `#parto/P101` | Produção vinculada, partos e separação entre matriz produtora e cria destinatária |
| `#extracao/P101`, `#avaliar/L…`, `#destinar/L…` | Retirada pelo parto → Brix → destinação entre consumo direto e banco, com remanescente explícito |
| `#brix` | Histórico de avaliações e nova leitura em janela |
| `#preparacoes`, `#preparo/novo` | Consulta, preparo e detalhe da composição |
| `#congelar` | Formação de unidades a partir do saldo livre |
| `#fornecimentos`, `#fornecimento/novo` | Consulta e registro de volume efetivamente fornecido |
| `#configuracoes` | Referências de Brix, peso ao nascer e volume da unidade |

## Estado da demonstração e escolhas

Os cenários fictícios e suas alterações ficam em `sessionStorage`, na chave `terrano-colostro-preview-v1`, e sobrevivem ao recarregamento na mesma sessão da aba. Isso não equivale a salvar rascunhos operacionais: campos de formulários em andamento não têm recuperação garantida.

**Avaliar prévia** permite marcar cada percurso e anotar ajustes. Essas escolhas ficam em `localStorage`, na chave `colostro-review-v1`, e podem ser exportadas para `colostro-minhas-escolhas.json`. A marcação local não inicia implementação nem constitui aprovação formal registrada no projeto. **Reiniciar demonstração** restaura os dados fictícios e preserva as escolhas e observações da avaliação.

## Referência visual

Reutiliza a composição da prévia V5 e seus arquivos locais de fontes: DM Sans para leitura e Manrope para títulos. Os tokens efetivamente usados estão em `styles.css`: verde principal (`--primary`, `#006f68`), texto escuro (`--text`, `#263e3b`), fundo sálvia da navegação (`--sage`, `#dce8e5`) e cores semânticas de atenção, erro e confirmação. Tabelas compactas, barra de consulta, ações agrupadas e formulários com conferência lateral mantêm os registros acessíveis antes de filtrar. Em telas estreitas, a navegação vira menu e as tabelas têm rolagem própria. Esta documentação descreve a extensão; não estabelece um novo catálogo ou sistema visual global.

## Como testar

1. Em **Partos e crias → Ver parto → Registrar retirada**, informe o volume e identifique primeira retirada ou seguinte. Continue para Brix e depois escolha consumo direto, banco ou divisão. Exemplo: 6 L retirados, 4 L fornecidos e uma unidade de 2 L congelada; os fatos ficam separados.
2. Em **Congelar unidades**, escolha `L102`, que inicia com 3 L livres além das unidades já embaladas. Congele uma unidade de 2 L e confira a sobra livre de 1 L, sem nova produção.
3. Reinicie e abra **Preparar enriquecimento**. Escolha a origem por dropdown e informe 2 L; adicione outra origem se necessário. Digite um insumo demonstrativo e sua quantidade e informe 2,2 L finais. A confirmação abre a destinação: congele uma unidade de 2 L e verifique 0,2 L livres.
4. Reinicie e registre um fornecimento selecionando duas unidades de 2 L. Informe 3,5 L efetivamente fornecidos e o motivo quando houver origem sem Brix ou abaixo da referência. No banco, aplique **Filtros → Retirada** e confira a sobra identificada de 0,5 L fora do saldo congelado disponível.
5. Abra **Configurações de produção**, altere uma referência e confira os exemplos. Avalie os percursos, salve e exporte as escolhas; reinicie a demonstração e confirme que suas observações continuam disponíveis.
6. Repita a navegação em tela estreita e por teclado, conferindo menu, foco, janelas, mensagens e acesso às colunas das tabelas.

## Evidências e limites

Na revisão desta prévia em 27/10/2026, foram observadas navegação em desktop e celular de 390 px sem transbordamento da página, abertura de Brix e configurações e as simulações de saldo dos passos 2 a 4. Isso é evidência focal do mockup, não aprovação de todos os percursos. A confirmação focal no navegador verificou bloqueio de Brix anterior ao preparo, manutenção da leitura mais recente após lançamento retrospectivo e meta não aplicada no segundo fornecimento. A revisão independente de código e capturas considerou resolvidos os reparos listados e liberou a prévia para revisão do usuário; isso não substitui sua aprovação.

Todos os animais, lotes, unidades, leituras e movimentos são fictícios. Não há backend, conexão com banco, migrations ou escrita no estoque real. O insumo do preparo é texto digitado: não consulta produto nem valida ou baixa seu saldo. A prévia não demonstra atomicidade real, concorrência, idempotência de servidor, permissões ou auditoria. Tampouco comprova homologação da fazenda, validade clínica, receita de enriquecimento ou conservação sanitária. A implementação funcional e sua validação exigem etapa própria após aprovação do desenho.
