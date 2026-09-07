# Pecuária unificada

## Decisão de produto

A fazenda possui um único cadastro de animais. Leite, corte e dupla aptidão são
finalidades produtivas do animal, não setores, fazendas ou módulos diferentes.
Reprodução, sanidade, nutrição, pesagem e movimentação são domínios comuns a
todos os animais. Controle leiteiro só se aplica quando houver produção de leite.

## Modelo canônico

- Área de acesso: `pecuaria`.
- Entidade individual: `Animal`.
- Finalidade: `LEITE`, `CORTE`, `DUPLA_APTIDAO` ou `NAO_INFORMADA`.
- `Animal.setor` continua armazenado por compatibilidade com o IDEagri, mas
  significa localização física/de manejo e aparece como **Localização** na UI.
- Grupo é agrupamento de manejo e não define a finalidade produtiva.

As permissões antigas `rebanho` e `gado_corte` são aceitas e normalizadas para
`pecuaria`, sem retirar acesso de usuários existentes. As URLs canônicas usam
`/pecuaria`; `/rebanho` e `/corte` continuam sendo aliases de leitura.

## Lotes coletivos existentes

O banco possui lotes agregados em `LoteCorte`: cada registro informa a quantidade
de cabeças, mas não contém a identidade de cada animal. Por isso esses dados não
podem ser transformados automaticamente em indivíduos sem inventar brincos,
datas e históricos.

Esses lotes permanecem disponíveis em **Pecuária > Lotes coletivos**, sob
`/pecuaria/lotes`. Novos animais identificados devem entrar no cadastro único
`Animal` com a finalidade apropriada. Uma conversão futura de lote coletivo deve
ser assistida e exigir a relação real de indivíduos.

## Migração de dados

A migração é somente aditiva. Animais já existentes recebem
`NAO_INFORMADA`, evitando classificar dados reais por suposição. A tela de
alteração coletiva permite selecionar vários animais e atribuir a finalidade de
uma vez. Nenhum lote ou histórico é apagado.
