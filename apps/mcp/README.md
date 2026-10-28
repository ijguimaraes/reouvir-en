# @reouvir/mcp

Servidor MCP (stdio) que expõe as rotas `/admin` da API como tools: contextos, playlists e frases.
Entra com e-mail e senha de um administrador e mantém a sessão por cookie (renova sozinho).

## Variáveis

- `REOUVIR_URL`: base da API, ex.: `https://igor-inspiron-7580.tail6b6a0b.ts.net/api`
- `REOUVIR_EMAIL` e `REOUVIR_PASSWORD`: um administrador (de preferência um dedicado ao MCP)

## Registrar no Claude Code

```
claude mcp add reouvir \
  -e REOUVIR_URL=https://igor-inspiron-7580.tail6b6a0b.ts.net/api \
  -e REOUVIR_EMAIL=... -e REOUVIR_PASSWORD=... \
  -- /caminho/do/repo/apps/mcp/node_modules/.bin/tsx /caminho/do/repo/apps/mcp/src/index.ts
```

Não expõe de propósito: excluir playlist ou contexto, despublicar e arquivar.
`add_sentences` faz uma chamada por frase (a API não tem rota em lote); cada frase aceita `translationPt` (em camelCase; chave desconhecida, como `translation_pt`, dá erro em vez de ser ignorada). `translate_playlist` gera a tradução das frases que ainda não têm.
