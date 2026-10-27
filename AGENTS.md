# Reouvir EN

PWA de **treino de escuta em inglês** (não é um curso). O aluno ouve playlists de frases dentro de um **contexto** (ex.: `Entrevista de engenheiro de software Java / Apresentação e small talk`). O aluno escolhe o contexto e depois a playlist; o administrador cria, nomeia e ordena as playlists livremente, sem nível nem tópico fixos. O app é no estilo de um player de música, para uso mãos livres (corrida, spinning). Slogan: *Hear it again.*

Responder ao usuário sempre em **português** (com acentuação correta). Identificadores de código e termos técnicos ficam em inglês.

## Fonte da verdade

`docs/estrutura-do-projeto.md` tem o desenho completo (escopo, regras, modelo de dados, API, stack, estrutura de pastas, deploy, riscos, premissas e fases). Leia antes de implementar qualquer coisa. Se uma decisão mudar, atualize o documento.

## Estado atual

- Existem o documento, o protótipo HTML (`prototipo/`, referência de UX, não é código de produção) e o código das fases 1 a 8, em monorepo pnpm. Portas de dev: API 3711, web 5273, admin 5274.
- **Fase 1 (Fundação) validada:** typecheck, testes (unitários e de integração contra Postgres real), migrações, seed do admin e build.
- Fases 3 a 8 implementadas em seguida (ver `README.md` para o que foi validado e o que depende de teste manual).
- **Fase 2 (spike do player) depende de teste manual** em iPhone/Android com a tela bloqueada e a regra de silêncio. Nenhum agente consegue validar isso.
- Para rodar: `cp .env.example .env`, `pnpm install`, `pnpm db:up`, `pnpm db:migrate`, `pnpm seed`, `pnpm dev`. **O seed cria só o administrador.** Não há seed de contextos, playlists nem frases: contextos e playlists nascem no backoffice e as frases são gravadas no banco por `pipeline/src/write_db.py`. Testes de integração usam `DATABASE_URL_TEST`.

## Decisões já tomadas

- **Conteúdo curado:** contextos e playlists são geridos no backoffice. Os alunos só veem playlists publicadas. **Não existem níveis nem tópicos gramaticais** (foram removidos; o histórico está no git).
- **As frases NÃO são geradas aqui, e não há importação por arquivo.** Elas são escritas fora do sistema (numa conversa com o Claude, seguindo o que o administrador definir para cada playlist) e gravadas **direto no Postgres** por `pipeline/src/write_db.py`, que localiza a playlist por `(slug do contexto, slug da playlist)` e exige que ela exista. O backoffice cria as playlists, revisa frases (editar, remover, reordenar, adicionar) e publica. Triggers do banco garantem a integridade de quem escreve direto: normalizam `text`, derivam `text_hash`/`char_count` e sobem `playlists.version` (seção 8 do documento). As ferramentas de currículo da pipeline (`build_prompt.py`, `select_final.py`, `curriculum-*.yaml`...) ficaram como **legado opcional**.
- **Contextos** (criar, editar, excluir): nome, slug, categoria, descrição (curta, exibida ao aluno) e **detalhamento** (texto livre só para o admin, nunca exposto ao aluno). Criar um contexto **não gera playlists**; excluir apaga as playlists vazias e recusa se alguma tiver frases.
- **Playlists** (dentro de um contexto): título, slug (único no contexto), descrição e posição, criadas, editadas, reordenadas e excluídas (só vazias) no backoffice. Renomear não sobe a `version`, que acompanha só as frases.
- **Áudio já gerado é patrimônio (custa crédito do ElevenLabs): não apague nem limpe órfãos.** O painel não tem limpeza; só o CLI `cleanup:audio` (prévia por padrão). A chave usa texto normalizado + voz + modelo + configurações, então trocar a voz ou o modelo invalida o reaproveitamento (os áudios antigos viram órfãos).
- **Só o áudio é lazy:** gerado no ElevenLabs na primeira escuta, guardado e reaproveitado por todos. Chave: `sha256(texto normalizado | voice_id | model_id | voice_settings)`. Single-flight com `UNIQUE(audio_key)`.
- **Frases da playlist:** ordem fixa e tamanho livre. Reordenar no backoffice renumera tudo de 1 a n; remover deixa lacuna; adicionar vai para o fim.
- **Ordem das playlists:** `position` dentro do contexto, definida pelo administrador (renumerada de 1 a n ao reordenar ou excluir). É a ordem em que o aluno as vê.
- **Offline:** o aluno baixa a playlist inteira (IndexedDB + Cache Storage) e ela toca localmente; o progresso (`last_sentence_id`, voltas, tempo) sincroniza na primeira rede.
- **Regra do silêncio (fixa, não configurável):** `silêncio = duração do áudio ÷ velocidade + 1,5 s`, depois de cada audição, inclusive a última repetição antes da próxima frase. Ex.: 10 s a 0,75x → 14,8 s. A regra vive em `packages/shared`.
- **Configurações do aluno:** só repetições seguidas (padrão 2), velocidade (0,75x/1x) e loop.
- **Tema claro e escuro** nos dois apps (segue o sistema, com alternância manual), feito com variáveis CSS.
- **Sem tradução, sem SRS, sem texto livre de contexto** no MVP.
- **Stack:** monorepo **pnpm** com `apps/web` (Vite + React, PWA), `apps/admin` (Vite + React, backoffice, sem service worker, servido em `/admin`), `apps/api` (Node + TypeScript + Fastify + zod), `packages/shared` e `packages/api-client`.
- **Banco:** Postgres com **SQL nativo, sem ORM** (driver `pg`, repositórios `*.repository.ts`). Migrações em `.sql` com **dbmate** (`-- migrate:up` / `-- migrate:down`). Sem fila de jobs. Testes com Vitest, e os de repositório rodam contra Postgres real.
- **Auth:** e-mail e senha na API, com **access token (JWT 15 min) + refresh token rotativo** em cookies httpOnly. Telas de entrar e criar conta (cadastro aberto, papel `student`). O backoffice só bloqueia usuários e redefine senhas (senha temporária). **Google fica fora do MVP.**
- **Storage:** disco local atrás de uma interface com driver `local` (driver `s3` só no futuro). Sem bucket e sem CDN.
- **Deploy 100% local:** Docker Compose (`postgres`, `migrate`, `api`, `caddy`) numa máquina ligada, acessado pela VPN **Tailscale**. Origem única por caminho: `/` (web), `/admin` (admin), `/api` (API), `/audio` (MP3). **HTTPS é obrigatório** para o PWA (service worker), via MagicDNS + `tailscale serve`.
- **Next.js foi descartado:** não há necessidade de SEO nem de SSR.

## Pontos a validar durante a implementação

- Comportamento do áudio com a tela bloqueada (principalmente iOS) com silêncios longos. Tratamento previsto: áudios já baixados, Media Session API e faixa silenciosa durante os silêncios.
- Se o plano do ElevenLabs permite o uso comercial e a distribuição dos áudios, antes de abrir o app para outras pessoas.
- Backup da pasta de áudio (regenerar custa créditos) além do `pg_dump`.

## Preferências do usuário

- Respostas diretas. Quando o usuário escreve "APENAS RESPONDA", não faça alterações, só responda.
- Decide as tecnologias com base em fatos (ex.: escolheu o dbmate pela comunidade maior). Justifique escolhas com dados quando possível.
- Sem ORM, sem Next.js, backoffice como app separado.
- Mensagens de commit **sem** `Co-Authored-By` (regra global do usuário).
