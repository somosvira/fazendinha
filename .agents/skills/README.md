# Skills do projeto

## Impeccable

Skill de revisão e implementação de interfaces, instalada localmente em `impeccable/` para os agentes deste repositório. Não é uma dependência do client nem é enviada no bundle de produção.

- Origem: https://github.com/pbakaus/impeccable/tree/db0f2dfb47f12f7ff02ec98a81de1933ad22b8a4/.agents/skills/impeccable
- Versão declarada: 4.5.2; revisão fixada: `db0f2dfb47f12f7ff02ec98a81de1933ad22b8a4`.
- Licença e avisos do upstream preservados em `impeccable/LICENSE` e `impeccable/NOTICE.md`.
- Instalação: helper `install-skill-from-github.py`, origem e revisão acima, destino `.agents/skills`.

Use `$impeccable` com o comando desejado. O launcher fica em `impeccable/scripts/impeccable`; no WSL, execute com `sh`. Em tarefas do frontend, o diretório de trabalho é `client/`; o launcher resolve a referência a partir da pasta da skill. Na primeira execução ele pode obter o binário versionado para o cache do usuário, fora do código da aplicação.

`AGENTS.md`, contratos de domínio, permissões e escopo do pedido continuam prevalecendo. Uma avaliação não autoriza mudanças na interface, no banco ou em ambientes. Não foram habilitados hooks, extensões ou atualização automática.
