# Seed única de desenvolvimento

`prisma/seed.ts` é a única entrada demonstrativa. Instala um cenário integrado dos domínios ativos: Financeiro, Estoque, Pecuária V1–V5, Sítios e Acessos. Os módulos internos reaproveitam os contratos e serviços das versões anteriores. Importadores de dados reais permanecem separados.

## Ambiente e execução

Aceita exclusivamente PostgreSQL de loopback `fazendinha_seedatev3`, fora de produção, com namespace `dev`/`test`, baseline canônica inicial e todas as migrations incrementais aplicadas, com checksums idênticos aos arquivos. Migrações pendentes, desconhecidas ou com aplicação ativa duplicada são recusadas; a identidade do manifesto permanece baseada na mesma baseline após evoluções válidas. Não aplica migrations, reinicializa banco ou apaga dados. Configurações de serviços vêm do ambiente normal; o preflight não depende de R2.

```sh
pnpm --filter rionovo-server run seed --preflight
pnpm --filter rionovo-server run seed
pnpm --filter rionovo-server run seed --verificar
pnpm --filter rionovo-server run seed:typecheck
```

O manifesto `server/.seed/manifesto.json` guarda identidade do banco, checksum, data-base Brasil, IDs, ações e etapas. Reexecutar retoma sem duplicar fatos ou restaurar alterações legítimas da interface. IDs removidos, referências desconhecidas ou identidade incompatível interrompem a carga antes de novas escritas. `--interromper-apos=estoque` permite testar retomada; a interrupção retorna erro de propósito.

`--preflight` e `--verificar` usam conexões somente de leitura. O modo de verificação não modifica manifesto ou guia. Ao concluir a execução normal, `server/.seed/guia.html` e `verificacao.json` apresentam o cenário e links de consulta.

## Cenário

| Sítio | Animais ativos | Finalidade |
|---|---:|---|
| Sítio principal | 72 | Leite e matrizes de reprodução, com oito crias geradas por partos |
| Sítio arrendado | 36 | 12 receptoras, 14 novilhas, um touro e nove Nelore de corte |
| Sítio test | 24 | Somente Nelore de corte |

São 36 lactantes no principal, 12 secas, dez novilhas, oito crias e seis matrizes de reprodução. O cenário inclui tentativas terceira/quarta com avaliações negativas anteriores, partos/gêmeos/natimorto, aborto/perda, TE, protocolos, visitas, exames, 36 vacinações, carências informadas e desconhecida. Fatos históricos documentados permanecem distintos de baixas atuais de estoque.

Financeiro contém quatro bancos, clientes/fornecedores/prestadores, grupos/categorias/centros, compras com partidas nos três sítios, compromissos, recebimentos, transferências e estornos. Quantidades e preços são sintéticos; os serviços mantêm autoria, vínculo e auditoria.

A produção geral cobre o mês anterior e o atual até a data-base, com hoje parcial. As três ordenhas, tanques, régua manual e litros têm fatos próprios. Carências e partos orientam Descarte/Colostro; controles mensais individuais não duplicam os totais gerais. Coletas diárias, operações, vendas, aceites, demonstrativos, qualidade individual/coletiva, alimentação, descarte, nutrição/R07 e emissões preservadas usam os mesmos fatos. Custos/vínculos desconhecidos continuam a apurar.

Acessos exclusivamente demonstrativos: `fellipe@test.com` e `rafael@test.com`, senha inicial `test1234`, ambos proprietários com acesso completo. A senha é armazenada por hash, nunca em texto no banco ou nos logs. O executor recusa destinos remotos e produção.

## Cobertura complementar de parcelas

O pacote posterior `leite:cobertura-parcelas` acrescenta fatos próprios sem regravar as etapas anteriores. No Principal, prepara hoje uma parcela direta não comercial com origem individual desconhecida, zero explícito e inclusão posterior em recipiente distinto. Outra parcela passa pelo fluxo completo de 9 L confirmados, anulação da entrada sem consumo, correção para 8 L e nova confirmação na versão 2. A entrada original e sua reversão permanecem auditáveis; as parcelas apenas salvas não geram estoque.

A alternativa histórica de colostro usa a matriz `DEV-035` durante sua localização comprovada no Arrendado. Registra parto natimorto em D−680, lactação histórica encerrada entre D−680 e D−665 e uma parcela de primeira ordenha em D−679, com vigência `PRIMEIRA_ORDENHA` própria desde D−690. Não cria animal ativo, não sobrepõe a lactação atual e não confirma estoque histórico. Essa produção histórica de colostro no Arrendado **não representa uma rotina atual de leite**. Configuração preexistente nesse sítio ou localização divergente interrompe o pacote; nenhum trigger é desativado.

## Arquivos e limites

`--arquivos-r2` executa uma etapa opcional explícita de upload, confirmação e download real. Sem a flag, o guia conserva essa cobertura como pendente; nenhum arquivo remoto é presumido. A seed não chama IA nem reativa bot/WhatsApp.

Os dados não são recomendação clínica ou nutricional e não representam homologação da fazenda. A aplicação local da baseline, a execução da seed, a idempotência, os testes automatizados, a CI e a homologação manual exigem evidências separadas.

Substituir uma base anterior é manutenção distinta, com backup, API parada e autorização explícita. O histórico anterior fica no Git e nos backups/manifestos locais preservados; a seed normal nunca o elimina. Consulte `docs/desenvolvimento.md`.
