# Mockup — configuração de alertas (G2)

Referência visual navegável aprovada pelo usuário para a implementação G2. O comportamento vigente e os gates de liberação ficam no [contrato de alertas](../../../pecuaria/alertas.md). Extensão pontual do [mockup de consulta](../mockup-v1/README.md), com os mesmos tokens, fontes locais, barra de consulta, filtros com aplicação explícita e modos tabela/cartões. Modo operacional: listagem horizontal no desktop, formulário em colunas, confirmação de impacto antes de ativar. Não define nova identidade visual.

## Abrir

Servir **o diretório pai** preserva o acesso aos assets locais compartilhados:

```sh
python3 -m http.server 41922 --bind 127.0.0.1 --directory docs/design/alertas
```

[Regras](http://127.0.0.1:41922/mockup-configuracao/index.html#regras), [novo cadastro](http://127.0.0.1:41922/mockup-configuracao/index.html#nova) e [prévia](http://127.0.0.1:41922/mockup-configuracao/index.html#previa).

## Percursos para avaliar

- Lista: buscar regra/produto, alternar cartões/tabela, filtrar situação e abrir Filtros. Cancelar descarta o rascunho; Limpar apenas edita o rascunho; Aplicar confirma.
- Nova regra: escolher produto/protocolo existente ou verificação sem produto; configurar idade OU data fixa, vigência, antecedência, prazo, sítios, sexo e faixa etária. Salvar começa inativa. Dados são fictícios e não sugerem orientação clínica.
- Prévia: conferir elegíveis, próximos, dados insuficientes e conferência inicial. Nascimento estimado permanece identificado. Condição anterior à adoção não recebe atraso retroativo. Ativação exige confirmar revisão, base e impacto; Simular mudança na base bloqueia a confirmação até Gerar nova prévia.
- Regra ativa: editar abre revisão de impacto; escolher destino explícito e motivo para as abertas. Inativar também exige ambos. As concluídas conservam história, sem reinício.
- Conferência inicial: Conferir histórico abre decisões separadas de confirmar necessidade, vincular aplicação candidata, adiar com nova data e dispensar; todas exigem motivo. Vincular exige conferir o fato candidato. O resultado permanece visível ao reabrir a conferência nesta sessão.
- Calendário: a regra mensal permanece bloqueada, com dia a definir e pendências de programação/execução. O PDF não ativa regras; verificação sem produto não dispensa executor válido. Tipos futuros e peso não são gatilhos disponíveis.

## Revisão e limites

Revisão de código guiada por `impeccable` e `frontend-design`, preservando a direção visual do artefato existente. Não houve nova entrevista de identidade: a tarefa é uma extensão expressamente delimitada pelo contexto e pelos padrões vivos `BarraConsulta`, `PainelFiltros` e `VisualizacaoConsulta`.

`node --check configuracao.js` passou. O detector mecânico foi executado uma vez; [resultado](detector.json). O aviso de 11px foi corrigido para 12px no rodapé e link móvel. O aviso do `dialog` ignora os insets de seus filhos: cabeçalho, corpo e rodapé possuem padding próprio. Inspeção do agente principal no navegador em desktop e celular e revisão independente Sol foram realizadas. As correções de decisões por animal e preservação dos campos da regra foram reconferidas; parecer SHIP restrito ao mockup demonstrativo. O usuário aprovou a prévia G2 e autorizou sua implementação. Essa aprovação visual não homologa a operação da fazenda nem ativa regras reais.

As contagens e exemplos de prévia são fixos, para avaliação de layout; editar o formulário não executa o motor de elegibilidade. As simulações usam apenas memória da página, sem `fetch`, APIs, banco, armazenamento ou processamento periódico. Nenhum dado da fazenda, aplicação, consumo, tarefa ou regra real foi criado. O histórico de decisões é demonstrativo e não representa trilha de auditoria implementada. Essas verificações pertencem ao artefato demonstrativo e não comprovam testes da aplicação, integração, CI ou deploy. Consulte o contrato vigente para a implementação e sua validação.
