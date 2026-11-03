# Ficha animal — proposta de organização

Prévia interativa baseada no [README do frontend](../../README.md), com a DEV-001 do ambiente local como referência em 30/10/2026. A ficha real e seus serviços não foram alterados.

## Composição proposta

- Identificação, idade, peso e data compactos no cabeçalho.
- Ocorrência aberta diretamente visível, separada dos estados produtivo e reprodutivo.
- Resumo com peso/evolução e situação atual; histórico logo abaixo.
- Sete abas com conteúdo: Resumo, Histórico, Produção, Reprodução, Sanidade, Nutrição e Cadastro.
- Metadados e evidências em detalhes laterais; sem repetir auditoria em todos os cartões.
- Primitivas existentes Radix/shadcn para abas, menus, diálogos, detalhes, campos e calendário.

## Interações

Troca de abas, histórico filtrável e pesquisável, alternância linha do tempo/tabela, seletor de período do peso, detalhes dos registros, menu de eventos, simulação de pesagem e busca demonstrativa. No celular a navegação global abre pelo menu.

Nenhuma ação escreve na API. A pesagem valida campos e conclui uma simulação, sem alterar indicadores, histórico ou banco. Os outros registros demonstram o acesso, preservando o formulário completo como requisito para a implementação; não são formulários funcionais de todos os domínios.

## Dados e limites

Dados conferidos na ficha e nas abas locais: DEV-001, Sítio principal/Lactantes, 5a 5m, último peso 510 kg em 26/10/2026, pesagens anteriores de 508 e 500 kg, GMD retornado 0,400 kg/dia, retenção de placenta aberta, vazia, lactante há 4 dias, último parto em 26/10/2026, PEV original em 25/11/2026 e aptidão clínica não determinada. Produção individual sem aferições no recorte: não foi inventada curva de leite. Genealogia parental não informada e duas crias vinculadas. Nutrição apresenta atribuição por permanência no lote, não ingestão medida.

O histórico proposto reúne fatos dos contextos consultados e deve validar cobertura, deduplicação, permissões e destinos antes de implementação. A referência de situação é fixa, não deve ser interpretada como avaliação clínica atual fora do cenário. A ilustração é o ativo genérico existente, sem representar uma foto individual.

## Abrir

Com o Vite local: `/mockups/ficha-animal-ideal/`. Os arquivos usam a resolução de módulos do Vite e não são um HTML autônomo para abrir diretamente no disco.
