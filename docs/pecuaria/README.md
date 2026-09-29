# Pecuária — base de documentação

Esta pasta concentra o contexto funcional e técnico da reconstrução da pecuária. Ela substitui a dependência de uma sessão privada do Claude: os artefatos originais agora estão versionados no repositório e podem ser consultados por qualquer pessoa ou agente que trabalhe no projeto.

## Estado em 29/09/2026

| Entrega | Estado | Referência |
|---|---|---|
| v1 · Rebanho | mesclada na `main` em 25/09/2026 | [PR #296](https://github.com/somosvira/fazendinha/pull/296) |
| Follow-up da v1 | mesclado na `main` em 28/09/2026 | [PR #306](https://github.com/somosvira/fazendinha/pull/306) |
| v2 · Genética | PR em rascunho, reconciliado com a `main`, aguardando CI e homologação | [PR #305](https://github.com/somosvira/fazendinha/pull/305) |
| Validação da v2 com dados reais | pendente | executar a carga com o dump real do IDEAGRI e confirmar `ANIMAL.CDCENTRALSEMEN` |
| v3 · Sanidade, peso e nutrição | [PR #308](https://github.com/somosvira/fazendinha/pull/308) em rascunho sobre a v2; ainda incompleta e não homologada | [Artefato V3](./artefatos/pecuaria-v3-sanidade-peso-nutricao.html), contrato-alvo do PR |

“Concluída” significa que a implementação e os testes automatizados foram feitos. A v2 só estará disponível para o restante do time depois de sair de rascunho, passar pela validação real, ser revisada e entrar na `main`.

## Ordem de leitura

1. [Pecuária Schema Map — v1](./artefatos/pecuaria-schema-map-v1.html): modelo do Rebanho, invariantes, efeitos das ações e roadmap original.
2. [Pecuária v2 · Genética](./artefatos/pecuaria-v2-genetica.html): decisões da v2, tabelas, regras, telas e integração com estoque.
3. [Roteiro de Testes do Rebanho](./artefatos/roteiro-testes-rebanho-v1-v2.html): QA manual de ponta a ponta para v1, v2 e contrato-alvo da v3. As marcações ficam apenas no navegador de quem executar; o nome histórico do arquivo foi mantido para preservar links.
4. [IDEAGRI Schema Map](./artefatos/ideagri-schema-map.html): inventário do banco legado e relações usadas para preparar a carga inicial.
5. [Pecuária v3 · Sanidade, peso e nutrição](./artefatos/pecuaria-v3-sanidade-peso-nutricao.html): proposta de implementação sobre a v2, com diagramas, contrato de dados, efeitos operacionais, comparação com o IDEAGRI e fases/testes de um único PR.

Os arquivos são snapshots HTML e preservam os diagramas e a interatividade dos artefatos originais. Alguns recursos visuais carregam bibliotecas pela internet. Se o GitHub mostrar apenas o código-fonte, baixe o arquivo e abra-o no navegador.

## Como interpretar os documentos

- O **Fazendinha é a fonte de verdade operacional** depois da carga inicial. O IDEAGRI é apenas origem de migração e referência para reconciliação; não deve virar dependência de execução.
- O mapa do IDEAGRI descreve o legado, não o modelo que o Fazendinha deve copiar.
- O Schema Map da v1 é um retrato anterior à implementação da v2. A seção “Genética” do roadmap nele propõe `Reprodutor`, `CentralSemen` e `EstoqueSemen`, mas foi superada pela decisão documentada na v2: `GenitorExterno`, `MaterialGenetico` e o estoque único do produto.
- O documento da v2 é o contrato de produto e arquitetura do PR #305. Para detalhes exatos de implementação, prevalecem a migration, o schema Prisma e os testes da branch.
- O artefato da v3 é o contrato-alvo, baseado no código do #305 em `e31eb55`. A implementação foi iniciada, mas o artefato ainda não representa recursos prontos ou homologação da carga real. A entrega em um único PR é requisito; os padrões propostos e os pontos de revisão estão explicitados no artefato.
- O PR em rascunho já implementa a base de schema/migration, partidas no estoque genérico, aplicações com dose incluída em Serviço sem Produto obrigatório, carência, ocorrências, protocolos e exames, pesagem coletiva/manejo e o primeiro fluxo de dieta/fechamento nutricional. A interface ainda não cobre todos esses fluxos; reconciliação de partidas, proteções de concorrência, validação integral e importação IDEAGRI permanecem pendentes. Nada disso deve ser anunciado como V3 homologada.
- O roteiro de testes combina v1, v2 e 175 casos-alvo da v3, embora v2 e v3 ainda não estejam na `main`. Cada passo v3 mostra numeração, caminho na aplicação, ação e resultado esperado; caminhos marcados como tela prevista ainda não são navegáveis no PR atual, e os de apoio técnico não são testes de interface. Para executar a v3 inteira, use o PR #308 sobre a base conciliada da v2, depois de completar seus fluxos pendentes. Um caso não executado fica pendente; um fluxo ausente ou incorreto deve ser marcado como falha, nunca como aprovado. A carga histórica requer o dump real do IDEAGRI.

Quando houver divergência, use esta ordem para resolver: invariantes de produto aprovadas → migration/schema → testes automatizados → implementação → documento histórico. Corrija a documentação na mesma PR que alterar o comportamento.

## Decisões centrais preservadas

- O eixo é construído em cascata: v1 Rebanho → v2 Genética → v3 Sanidade, peso e nutrição → v4 Reprodução → v5 Leite.
- Filiação é identidade: mãe e pai podem ser animais da fazenda ou genitores externos, nunca os dois no mesmo lado.
- Receptora gesta, mas não transmite genética.
- Composição racial usa 64 avos e distingue origem informada de calculada.
- Sêmen e embrião são produtos do estoque único; compra e saldo usam o fluxo existente. O consumo será ligado aos eventos reprodutivos na v4.
- Dados com histórico não são sobrescritos silenciosamente. Escritas relevantes são auditadas e respeitam o escopo do sítio.

## Próximos passos recomendados

1. **Acompanhar a CI do PR #305 após a conciliação.** Os conflitos em `Cadastros.tsx`, `DetalheAnimal.tsx`, `DetalheAnimal.test.tsx` e `NovoAnimal.tsx` foram resolvidos preservando a ficha em cards e o datepicker da v1, sem retirar filiação, descendência e composição racial da v2.
2. **Homologar os gaps fechados na conciliação.** O saldo e o histórico do estoque agora permitem navegar até o material genético associado, respeitando a permissão da área de pecuária; avisos não bloqueantes de filiação também permanecem visíveis depois de salvar um animal ou editar sua filiação.
3. **Rodar a carga real da v2.** Confirmar a consulta de genitores externos, especialmente `ANIMAL.CDCENTRALSEMEN`; executar a importação duas vezes para verificar idempotência e depois `validar:pecuaria`.
4. **Executar o roteiro manual completo.** Cobrir filiação, composição calculada versus informada, genitor inativo, animal baixado como genitor, material genético, saldo e os avisos de idade/ciclo.
5. **Tirar o PR #305 de rascunho, revisar e mesclar.** Só então atualizar esta página para marcar a v2 como presente na `main`.
6. **Concluir e homologar o PR #308 da v3 sobre a v2.** Usar o [artefato V3](./artefatos/pecuaria-v3-sanidade-peso-nutricao.html) como contrato e os grupos v3 do [roteiro de testes](./artefatos/roteiro-testes-rebanho-v1-v2.html) como critérios manuais de aceite. Se a v2 ainda estiver aberta, manter a base na branch do #305 e depois ajustar para a `main`. Não liberar a v3 enquanto houver casos obrigatórios não implementados, falhos ou dependentes da carga real.

## Manutenção

Toda PR que altere a pecuária deve:

- atualizar esta página quando mudar estado, sequência ou decisão transversal;
- atualizar ou substituir o artefato do domínio quando mudar contrato, tabelas ou regras;
- registrar o PR associado e a data do retrato;
- evitar depender de links privados do Claude ou de outro chat como única fonte de contexto.

Os quatro HTMLs originais (v1, v2, roteiro de testes e mapa IDEAGRI) foram exportados do Claude em 28/09/2026 e copiados sem alteração de conteúdo. O planejamento da v3 foi elaborado no repositório nessa mesma data e usa diagramas locais, sem bibliotecas externas.
