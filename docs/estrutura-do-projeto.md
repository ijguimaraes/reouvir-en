# Reouvir EN — Estrutura do Projeto

> *Hear it again.*

## 1. Visão geral

**Reouvir EN** é um PWA de **treino de escuta em inglês**. O aluno escolhe um **contexto** e, dentro dele, uma **playlist**:

```
Contexto                                   /  Playlist
Entrevista de engenheiro de software Java  /  Apresentação e small talk
```

O app toca a playlist inteira, frase por frase, no estilo de um player de música. O uso principal é **mãos livres** (correndo, no spinning, no trânsito): o aluno dá play e escuta o conteúdo todo, repetidas vezes, até as frases ficarem fixas no ouvido.

**Não é um curso.** Não há lições, exercícios nem explicação de gramática. O que cada playlist treina (um tema, uma estrutura, um momento da conversa) é decidido por quem a monta, sem nível nem tópico fixos.

O sistema tem dois apps de front-end, independentes, e uma API:

| App | Quem usa | Função |
|---|---|---|
| **App do aluno** (`apps/web`, PWA) | Alunos | Escolher uma playlist publicada e ouvir. |
| **Backoffice** (`apps/admin`) | Administrador | Gerenciar contextos e usuários, criar e ordenar as playlists de cada contexto, revisar as frases e publicar. |
| **API** (`apps/api`) | Os dois apps | Regras de negócio, banco e geração de áudio. |
| **MCP** (`apps/mcp`) | Administrador, via Claude Code | Expõe as rotas `/admin` da API como tools (contextos, playlists e frases). |

## 2. Princípios de design

1. **O conteúdo é curado.** O administrador cria contextos e playlists e define a ordem. As frases são escritas **fora do sistema** (numa conversa com o Claude, por exemplo) e gravadas **direto no banco** (seção 8). O administrador revisa e publica. O aluno só consome conteúdo publicado. Este sistema não gera frases.
2. **O áudio é o único item lazy.** O áudio de uma frase só é gerado na primeira vez que alguém precisa dele, e fica guardado para sempre.
3. **Gerou uma vez, serve para todos.** O áudio é compartilhado entre todos os alunos. Nenhum áudio é gerado duas vezes.
4. **Playlist, não frase solta.** A unidade de uso é a playlist inteira. O aluno configura só quantas vezes cada frase repete em sequência.
5. **Ritmo fixo de escuta.** Depois de cada audição existe um silêncio proporcional à duração do áudio (seção 6), para o aluno repetir em voz alta ou processar o que ouviu.
6. **Mãos livres.** O player precisa funcionar com a tela bloqueada e com conexão instável.
7. **Custo previsível.** Frases curtas, cache global de áudio e um único modelo de voz.

## 3. Escopo

### Escopo atual

**App do aluno**
- Tela de acesso com duas opções: **entrar** com e-mail e senha ou **criar conta** (cadastro aberto, sempre com papel `student`). O administrador é criado por seed.
- Execução **100% local**, em Docker Compose, acessada pela VPN Tailscale (seção 13).
- Navegação por **contexto → playlist**, mostrando apenas playlists **publicadas**, na ordem definida pelo administrador.
- Player de playlist:
  - repetições seguidas de cada frase (configurável),
  - silêncio entre audições calculado pela duração do áudio (regra fixa),
  - velocidade 0,75x / 1x,
  - loop da playlist,
  - **tradução em português** abaixo da frase em inglês (pode ser ocultada nas configurações),
  - opção de **manter a tela ligada** enquanto a playlist toca (Screen Wake Lock),
  - controles na tela de bloqueio (Media Session API),
  - retomar de onde parou.
- **Tema claro e escuro** no app do aluno e no backoffice: segue o sistema (`prefers-color-scheme`), com alternância manual lembrada no dispositivo.
- Geração **lazy** do áudio (ElevenLabs) com cache global.
- **Ouvir offline**: baixar a playlist inteira (frases e áudios) para o dispositivo e tocá-la localmente.
- Estatísticas simples por playlist (vezes que ouviu a playlist inteira, tempo ouvido) e **contador de audições por frase**.

**Backoffice (administrador)**
- **Contextos:** cadastro com criar, editar e excluir, incluindo um campo de **detalhamento** livre.
- **Playlists:** criar, renomear, descrever, **reordenar** e excluir (só as vazias) dentro de cada contexto.
- **Usuários:** listar, **bloquear/desbloquear** e **redefinir a senha**.
- **Revisão das frases** por playlist: editar (texto e tradução), remover, reordenar e adicionar à mão.
- **Tradução:** botão "Traduzir pendentes", que gera com a API da Anthropic a tradução das frases que ainda não têm; cada tradução pode ser editada. A frase também pode ser criada já com `translationPt`.
- Publicar, despublicar e arquivar playlists.
- Visão de cobertura de áudio por playlist (quantos áudios já foram gerados) e consumo de caracteres do TTS.

### Fora do escopo

- Geração de frases dentro do sistema (fica numa pipeline à parte).
- Login com Google (entra depois, como provedor extra).
- Storage em nuvem (S3/R2) e CDN.
- Texto livre como contexto.
- Repetição espaçada (SRS).
- Várias vozes e sotaques.
- Versionamento de playlists.
- Gamificação, metas e streaks.
- App nativo.

## 4. Conceitos

| Termo | Definição |
|---|---|
| **Contexto** | Cenário temático (ex.: Entrevista de engenheiro de software Java). Agrupa várias playlists, e todas as frases são ambientadas nele. |
| **Playlist** | Lista ordenada e fixa de frases dentro de um contexto, com título, descrição, slug (único no contexto) e posição definidos pelo administrador. Compartilhada entre todos os alunos. |
| **Frase** | Texto em inglês, único dentro da playlist, com posição fixa. |
| **Áudio** | Arquivo de voz de uma frase. Identificado por hash do texto + voz + modelo + configurações. |
| **Repetições** | Quantas vezes seguidas cada frase toca antes de passar para a próxima. |

### Ciclo de vida da playlist

```
draft (vazia ou preenchida) ──(publicar)──► published
        ▲                                      │
        └────────────(despublicar)─────────────┘
                 archived (fora de uso)
```

- **draft:** em preparação (recém-criada, vazia ou já com frases), invisível para os alunos. **Publicar exige ao menos uma frase.**
- **published:** visível e tocável pelos alunos.
- **archived:** retirada de uso, sem apagar o histórico.

### Tamanho e ordem

- **Tamanho:** livre; quem monta a playlist decide quantas frases ela tem (a regra do silêncio dá a duração: ver seção 6).
- **Ordem das playlists no contexto:** cada uma tem uma `position` (1 a n). **Criar** põe a nova no fim, **reordenar** (arrastar ou digitar a posição) envia a lista completa de ids e o servidor renumera tudo de 1 a n numa transação, e **excluir** fecha a lacuna. Só se exclui playlist **vazia**; a que tem frases pode ser arquivada.
- **Ordem no backoffice:** a lista já vem ordenada por `position`.
  - **Remover** uma frase só deixa uma **lacuna** (as posições das outras não mudam).
  - **Criar** uma frase a coloca na **última posição** (`MAX(position) + 1`).
  - **Reordenar** (arrastar e soltar, ou editar a posição da frase) envia a lista completa de ids na nova ordem, e o servidor **renumera tudo de 1 a n** numa transação, o que também fecha as lacunas. O `UNIQUE (playlist_id, position)` é `DEFERRABLE INITIALLY DEFERRED` para permitir isso.
- **Ordem fixa para o aluno:** a posição de cada frase não muda entre uma volta e outra. A segunda volta da playlist toca as mesmas frases na mesma ordem, e isso ajuda a memorização.
- Editar uma frase de uma playlist publicada é permitido, mas gera outro áudio para o novo texto (seção 9).

## 5. Fluxo do aluno

```
Login
  └─ Home: escolhe o contexto → vê as playlists publicadas, na ordem do administrador
       └─ Tela da playlist (ex.: Entrevista Java / Apresentação e small talk)
            ├─ [Baixar offline]  baixa os áudios para o aparelho
            └─ [Play]  toca a playlist com as configurações do aluno
                 └─ retoma da última posição nas próximas vezes
```

## 6. Player de playlist

### Configurações do aluno

| Configuração | Padrão | Faixa |
|---|---|---|
| Repetições seguidas por frase | 2 | 1–5 |
| Velocidade | 1x | 0,75x / 1x |
| Loop da playlist | ligado | — |
| Mostrar a tradução | ligado | — |
| Manter a tela ligada | desligado | — |

O silêncio entre audições **não é configurável**: segue a regra abaixo.

### Regra do silêncio

Depois de cada audição de uma frase (entre repetições e antes de passar para a próxima frase), o player espera:

```
silêncio = (duração do áudio ÷ velocidade) + 1,5 s
```

| Duração do áudio | Velocidade | Áudio toca por | Silêncio depois |
|---|---|---|---|
| 10 s | 1x | 10 s | 11,5 s |
| 10 s | 0,75x | 13,3 s | 14,8 s |
| 4 s | 1x | 4 s | 5,5 s |

- A duração do áudio vem do campo `duration_ms` (e é confirmada pelo `loadedmetadata` do elemento de áudio).
- Os 1,5 s ficam numa constante de configuração do sistema, fácil de ajustar.
- O mesmo silêncio vale depois da **última** repetição, antes da próxima frase.
- Velocidade e silêncio são feitos **no cliente**. Não geram áudio novo nem custo.

### Motor do player

```
para cada frase na posição p (a partir do ponto salvo):
    repetir N vezes:
        tocar áudio da frase na velocidade escolhida
        esperar silêncio = duração / velocidade + 1,5 s
    salvar posição
ao chegar ao fim: voltar à posição 1 e contar uma volta completa
```

Pausar o player durante um silêncio também pausa a contagem do silêncio. Avançar e voltar frase (tela de bloqueio) interrompem o silêncio em curso.

### Duração estimada de uma playlist

Com frases de ~4 s de áudio, 2 repetições e velocidade 1x, cada frase ocupa cerca de 19 s. Uma playlist de 100 frases leva em torno de **30 a 35 minutos**, o que cobre bem uma corrida ou um treino. Em 0,75x, o tempo sobe proporcionalmente.

### Janela de prefetch

Enquanto toca a frase `p`, o cliente garante que as frases `p+1 … p+3` já tenham o áudio pronto e baixado. Se o áudio ainda não existe, o servidor o gera nesse momento (seção 9). Na prática, o aluno só espera no começo da primeira escuta de uma playlist.

### Execução em segundo plano

Correr com o celular no bolso exige que o áudio continue com a tela bloqueada, e agora os silêncios são longos (de 5 a 30 s).

- Usar um elemento `<audio>` com **Media Session API** (play, pause, próxima, anterior na tela de bloqueio).
- Trocar a fonte do áudio para tocar a próxima frase pode falhar com a tela bloqueada, principalmente no iOS. Por isso o player trabalha com áudios **já baixados** no dispositivo.
- Timers de JavaScript podem ser reduzidos ou suspensos em segundo plano, e uma sessão de áudio parada por muito tempo pode ser encerrada pelo sistema. Possível tratamento: **tocar uma faixa silenciosa em loop durante os silêncios**, para manter a sessão de áudio ativa.
- **Risco a validar cedo:** testar em iPhone e Android, com a tela bloqueada, uma playlist real com a regra de silêncio completa, antes de investir no resto do app.

## 7. Backoffice

Acesso restrito a usuários com papel `admin`.

### 7.1 Contextos

- **Contextos:** nome, slug, categoria, **descrição** (curta, exibida ao aluno) e **detalhamento** (texto livre e longo, **só para o administrador**: cenário, situações, objetivos ou qualquer orientação sobre como o contexto será montado). O detalhamento aparece na tela do contexto e não é exposto ao aluno.
  - **Criar** um contexto não gera playlists: ele nasce vazio.
  - **Excluir** apaga o contexto e as playlists dele, **desde que todas estejam vazias**; se alguma tiver frases, a exclusão é recusada (desative o contexto em vez disso).
- Itens inativos (contexto desativado) somem do app do aluno, sem apagar as playlists.
- Não há seed de contextos nem de playlists: `pnpm seed` cria só o administrador.

### 7.2 Playlists

1. Na **tela do contexto**, o administrador **cria** playlists (título e descrição opcional; o slug sai do título e pode ser editado, único dentro do contexto). Cada uma entra no fim da lista.
2. **Edita** título, slug e descrição (renomear não sobe a `version`: ela acompanha as frases), **reordena** (arrastar e soltar, ou digitar a posição de destino) e **exclui** as vazias.
3. As frases chegam direto no banco (seção 8) ou são adicionadas à mão. Na **tela da playlist**, o administrador **revisa** a lista:
   - editar o texto de uma frase,
   - remover uma frase,
   - reordenar (arrastar e soltar, ou digitar a posição de destino),
   - adicionar uma frase manual (vai para o fim da lista).
4. **Publica** a playlist (exige ao menos uma frase). A partir daí os alunos a veem.
5. Pode **despublicar** ou **arquivar** depois.

### 7.3 Painel de acompanhamento

Por playlist: número de frases, status, **cobertura de áudio** (ex.: 63 de 100 já gerados), caracteres consumidos no TTS e número de alunos que a iniciaram.

### 7.4 Usuários

O cadastro é feito pelo próprio aluno na tela de acesso. O backoffice **não cria nem edita** contas, só:

- **Listar** usuários (e-mail, papel, status, data de cadastro, último acesso).
- **Bloquear/desbloquear:** o bloqueio muda `status` para `blocked` e revoga todos os refresh tokens do usuário. Ele perde o acesso assim que o access token expira (até 15 min) e não consegue mais entrar nem renovar a sessão.
- **Redefinir a senha:** gera uma **senha temporária**, exibida uma única vez ao administrador, que a repassa ao aluno. A conta fica com `must_change_password = true` e todas as sessões são revogadas. No próximo login, o aluno é obrigado a trocar a senha. Não há e-mail transacional, então não existe "esqueci minha senha" automático.
- Um administrador não pode bloquear a si mesmo. Papéis não são alterados pelo backoffice.

## 8. Carga de frases (direto no banco)

**Não há importação por arquivo.** As frases são escritas **fora do sistema** (numa conversa com o Claude, por exemplo, seguindo o que o administrador definir para cada playlist) e gravadas **diretamente no Postgres**. O backoffice cria as playlists, revisa as frases e publica.

A gravação é feita por [`pipeline/src/write_db.py`](../pipeline/src/write_db.py), que localiza a playlist por `(slug do contexto, slug da playlist)` e **exige que ela exista** (contextos e playlists são criados no backoffice). Ele recusa texto inválido, faz *diff* por hash (frases idênticas mantêm o mesmo id e, portanto, o áudio já gerado), protege playlist publicada (`--allow-published`) e playlist com frases (`--replace`), tem `--dry-run` e confere o resultado no banco antes de confirmar.

### 8.1 O que se grava

| Tabela | Colunas que quem grava preenche | Observações |
|---|---|---|
| `sentences` | `playlist_id`, `position`, `text`, `metadata` (opcional) | A playlist **já existe**. |

Para `sentences`, o banco cuida do resto (ver 8.2): normaliza `text`, calcula `text_hash` e `char_count` e sobe a `version` da playlist. Quem grava **não precisa** (nem deve) calcular nada disso.

Exemplo, trocando as frases de uma playlist:

```sql
BEGIN;
DELETE FROM sentences WHERE playlist_id = $1;
INSERT INTO sentences (playlist_id, position, text)
SELECT $1, o.pos, o.text FROM unnest($2::text[]) WITH ORDINALITY AS o(text, pos);
COMMIT;
```

### 8.2 O que o banco garante (triggers)

- **Normalização e hash:** ao inserir ou alterar `text`, o banco aplica a mesma normalização do código (`normalizeText`: NFC, aspas retas, `...`, espaços únicos e sem bordas) e preenche `text_hash` (sha256 do texto normalizado) e `char_count`. Texto vazio é recusado. Há teste que compara a função SQL com a do código.
- **Tradução:** quem grava direto pode incluir `translation_pt` no `INSERT`. O banco aplica a mesma normalização, converte vazio em `NULL` e a `version` da playlist sobe como em qualquer mudança de frase. A tradução não entra no `text_hash` nem na chave do áudio.
- **Duplicatas:** `UNIQUE (playlist_id, text_hash)` recusa a mesma frase duas vezes na playlist, e `UNIQUE (playlist_id, position)` recusa posições repetidas.
- **Versão:** qualquer INSERT, UPDATE ou DELETE em `sentences` sobe a `version` da playlist (uma vez por comando). É isso que faz o app do aluno oferecer "Atualizar download".
- **Playlist publicada:** trocar as frases de uma playlist publicada vale na hora para os alunos. Frases removidas zeram `last_sentence_id` de quem estava nelas (a retomada volta ao início).
- **O áudio continua lazy.** Gravar frases não chama o ElevenLabs. Frases com texto já conhecido reaproveitam o áudio existente (a chave é o hash do texto).

### 8.3 Responsabilidade de quem escreve as frases

O banco **não** valida o conteúdo pedagógico. Fica com quem escreve: texto sem URL nem emoji, sem dígitos (o TTS lê mal), tamanho coerente com o objetivo da playlist (frases curtas também controlam o custo do TTS, cobrado por caractere), gramática e tom adequados, e a ordem das frases. O `write_db.py` aplica as regras de texto como última defesa e aceita uma faixa de palavras opcional (`--words MIN-MAX`). A revisão do administrador antes de publicar é a rede de proteção.

## 9. Geração lazy do áudio

**Chave do áudio:** `audio_key = sha256(texto_normalizado | voice_id | model_id | voice_settings)`. Na implementação, o texto entra pelo seu hash: `audio_key = sha256(text_hash | voice_id | model_id | settings_hash)`, o que equivale à fórmula e permite ligar `sentences` a `audios` por SQL (`text_hash` + voz + modelo + `settings_hash`), usado na cobertura de áudio do backoffice.

- A chave usa o **texto**, não o id da frase. Se o mesmo texto aparecer em outra playlist, o áudio é reaproveitado.
- Mudar de voz ou de modelo gera outra chave, de propósito.
- Se o administrador editar uma frase, o novo texto gera outra chave e outro áudio. O áudio antigo fica órfão. Ele **não é apagado automaticamente nem pelo painel** (já foi pago ao TTS e é reaproveitado se a mesma frase voltar, com a mesma voz e o mesmo modelo). A limpeza é só manual, pelo CLI `pnpm --filter @reouvir/api cleanup:audio`.

```
GET /sentences/:id/audio
  ├─ audio_key existe com status = ready?   → devolve URL e duração (custo zero)
  ├─ existe com status = pending?           → espera até ficar ready (single-flight)
  └─ não existe:
        1. INSERT audios (audio_key, status = pending)  — UNIQUE garante um só vencedor
        2. chama ElevenLabs
        3. grava o arquivo no storage (disco local) e mede a duração
        4. UPDATE status = ready, storage_key, duration_ms
        5. devolve URL e duração
```

- **Single-flight:** o `UNIQUE(audio_key)` decide quem gera. Quem perde a disputa espera o status mudar.
- **Falha:** status `failed` com mensagem. A próxima requisição tenta de novo, com limite de tentativas.
- **Normalização do texto:** remover espaços extras e padronizar aspas e pontuação antes do hash.
- **Duração:** guardada em `duration_ms`, porque o player precisa dela para calcular o silêncio.
- **Entrega:** o arquivo fica em `<AUDIO_DIR>/<audio_key>.mp3` e o Caddy o serve em `/audio/<audio_key>.mp3`, com cache longo (o nome é o hash do conteúdo, então o arquivo nunca muda). Como o acesso é só dentro da tailnet, não há URL assinada nem CDN.
- **Licença:** confirmar que o plano do ElevenLabs permite uso comercial e a distribuição dos áudios aos alunos.

## 10. Baixar a playlist para ouvir offline

Botão **"Baixar playlist"** na tela da playlist. Depois de baixada, a playlist **roda localmente**, sem chamar o back-end.

**Download**
1. O cliente chama `POST /playlists/:id/prepare`. O servidor gera os áudios que ainda não existem (lazy, disparado pelo aluno) e devolve o **manifesto** (frases, `audioUrl`, `durationMs`, versão).
2. O cliente guarda o manifesto no **IndexedDB** e os MP3 no **Cache Storage** (service worker).
3. A tela mostra o progresso e avisa quando a playlist está pronta. Uma playlist baixada ganha o selo "disponível offline".

**Reprodução offline**
- O player lê frases e durações do manifesto local e os MP3 do cache. Não usa `GET /sentences/:id/audio`.
- Com a playlist baixada, o aluno consegue tocar sem rede. Sem ela, o app avisa que precisa baixar antes.
- Se a playlist mudou no servidor (versão diferente), o app oferece **"Atualizar download"** quando estiver online.

**Sincronização do progresso**
- Frase atual, voltas completas, tempo ouvido e audições por frase são gravados **localmente**, com a marca `client_updated_at`.
- **Contadores:** uma audição por frase é contada quando o áudio termina de tocar (cada repetição conta; pular ou interromper não). A playlist conta como ouvida inteira quando a última frase termina naturalmente, com ou sem loop; pular com "próxima" não conta. O cliente envia o **total acumulado** por frase e o servidor guarda o maior (`GREATEST`), então reenviar não duplica; sem rede, o total fica no aparelho e o app usa o maior entre ele e o do servidor.
- Online, o cliente envia `PUT /playlists/:id/state` direto. Offline, deixa o estado como **pendente**.
- Na **primeira oportunidade de rede** (evento `online` ou próxima abertura do app), o cliente envia o estado pendente. Em conflito entre aparelhos, vale o `client_updated_at` mais recente.

Como a geração de áudio tem limite de chamadas por minuto, o download de uma playlist nova é feito em pequenos grupos paralelos.

## 11. Modelo de dados

```sql
users (
  id, email,                         -- UNIQUE (case-insensitive)
  name, password_hash,               -- argon2id
  role,                              -- 'student' | 'admin'
  status,                            -- 'active' | 'blocked'
  must_change_password,              -- true após redefinição pelo admin
  created_at, last_login_at
)

refresh_tokens (
  id, user_id, token_hash,           -- UNIQUE; o token em si nunca é guardado
  family_id,                         -- agrupa a cadeia de rotação
  expires_at, revoked_at, replaced_by,
  user_agent, created_at
)

user_settings (
  user_id, repeats, speed, loop_playlist,
  show_translation (default true), keep_screen_on (default false)
)

contexts (
  id, slug, name,                    -- slug UNIQUE
  description,                       -- curta, exibida ao aluno
  details,                           -- detalhamento livre, só para o administrador
  category, active
)

playlists (
  id, context_id,
  title,                             -- nome livre, definido pelo administrador
  slug,                              -- único dentro do contexto (CHECK ^[a-z0-9-]+$)
  description,                       -- curta, exibida ao aluno
  position,                          -- ordem dentro do contexto (1 a n)
  status,                            -- 'draft' | 'published' | 'archived'
  version,                           -- sobe a cada mudança de frases; o app offline compara com o manifesto baixado
  created_by, created_at, published_at, updated_at,
  UNIQUE (context_id, slug),
  UNIQUE (context_id, position)      -- DEFERRABLE INITIALLY DEFERRED, para renumerar numa transação
)

sentences (
  id, playlist_id, position, text, text_hash, char_count,
  translation_pt,                    -- tradução em português, opcional; fora da chave do áudio (trigger a normaliza)
  metadata,                          -- jsonb opcional vindo da pipeline (ignorado pelo app)
                                     -- text, text_hash e char_count são mantidos por trigger (seção 8.2)
  created_at, updated_at,
  UNIQUE (playlist_id, position),
  UNIQUE (playlist_id, text_hash)
)

audios (
  id, audio_key,                     -- UNIQUE
  text_hash, voice_id, model_id, settings_hash,
  storage_key, duration_ms, char_count,
  status,                            -- 'pending' | 'ready' | 'failed'
  error, attempts, created_at, updated_at
)

user_playlist_state (
  user_id, playlist_id, last_sentence_id,   -- FK ON DELETE SET NULL; sem ela, retoma do início
  loops_completed, listened_seconds,
  client_updated_at,                 -- marca do aparelho; em conflito vale a mais recente
  updated_at,
  PRIMARY KEY (user_id, playlist_id)
)

user_sentence_stats (
  user_id, sentence_id,              -- FKs ON DELETE CASCADE
  listen_count,                      -- audições completas; o servidor guarda o maior total recebido
  updated_at,
  PRIMARY KEY (user_id, sentence_id)
)
```

O consumo de caracteres do TTS vem de `SUM(audios.char_count)` dos áudios `ready`, o que inclui os órfãos.

## 12. API (rascunho)

### Autenticação (pública, exceto onde indicado)

| Método | Rota | Função |
|---|---|---|
| POST | `/auth/register` | Cria conta (`student`) e já abre a sessão |
| POST | `/auth/login` | Valida e-mail e senha; emite access token e refresh token |
| POST | `/auth/refresh` | Troca o refresh token por um par novo (rotação) |
| POST | `/auth/logout` | Revoga o refresh token atual e limpa os cookies |
| POST | `/auth/logout-all` | Revoga todas as sessões do usuário (autenticada) |
| GET | `/auth/me` | Usuário atual, papel e `must_change_password` (autenticada) |
| POST | `/auth/change-password` | Troca a senha, informando a atual; revoga as outras sessões (autenticada) |

Convenções: tokens em cookies `httpOnly`, `Secure`, `SameSite=Lax`; erros de credencial sempre com a mesma mensagem genérica; limite de tentativas por IP e por e-mail em `login` e `register`.

### App do aluno

| Método | Rota | Função |
|---|---|---|
| GET | `/catalog` | Árvore **contexto → playlists** publicadas, na ordem do administrador (id, slug, título, descrição, posição, nº de frases; o estado de download fica no cliente) |
| GET | `/playlists/:id` | Playlist publicada com as frases e o estado do aluno |
| GET | `/sentences/:id/audio` | Garante o áudio (lazy) e devolve URL e duração |
| POST | `/playlists/:id/prepare` | Garante todos os áudios e devolve o **manifesto offline**: frases (id, posição, texto, `translationPt`, `audioUrl`, `durationMs`) e a versão da playlist |
| PUT | `/playlists/:id/state` | Salva frase atual, voltas e tempo ouvido (com `client_updated_at`; vale o mais recente) e, opcional, `listenCounts` (id da frase → total de audições; vale o maior) |
| GET/PUT | `/me/settings` | Configurações do player |

### Backoffice (`admin`)

| Método | Rota | Função |
|---|---|---|
| GET/POST/PUT/DELETE | `/admin/contexts` | Contextos. Criar não gera playlists; excluir apaga as vazias e recusa se houver frases |
| POST | `/admin/contexts/:id/playlists` | Criar playlist no fim do contexto (`title`, `description`, `slug` opcional) |
| PUT | `/admin/contexts/:id/playlists/order` | Reordenar as playlists: recebe a lista completa de ids e renumera de 1 a n |
| PUT | `/admin/playlists/:id` | Editar título, slug e descrição (só o que vier no corpo) |
| DELETE | `/admin/playlists/:id` | Excluir; recusa (409) se tiver frases |
| GET | `/admin/playlists` | Listar (filtro `?contextId=`) |
| PATCH/DELETE | `/admin/sentences/:id` | Editar (`text` e/ou `translationPt`; `null` apaga a tradução) ou remover uma frase |
| PUT | `/admin/playlists/:id/order` | Reordenar: recebe a lista completa de ids na nova ordem e renumera de 1 a n |
| POST | `/admin/playlists/:id/sentences` | Adicionar frase manual (última posição), com `translationPt` opcional. O corpo é **estrito**: chave desconhecida (ex.: `translation_pt`) responde 400 com o nome da chave, em vez de ser ignorada |
| POST | `/admin/playlists/:id/translate` | Gera a tradução das frases sem tradução (`overwrite: true` refaz todas) com a API da Anthropic, em lotes de 40, e grava. Responde 503 sem `ANTHROPIC_API_KEY` |
| POST | `/admin/playlists/:id/publish` | Publicar |
| POST | `/admin/playlists/:id/unpublish` | Despublicar |
| POST | `/admin/playlists/:id/archive` | Arquivar |
| GET | `/admin/playlists/:id` | Playlist com as frases (e se cada uma já tem áudio) |
| GET | `/admin/playlists/:id/stats` | Cobertura de áudio e consumo do TTS |
| GET | `/admin/users` | Listar usuários |
| POST | `/admin/users/:id/block` | Bloquear (revoga os refresh tokens) |
| POST | `/admin/users/:id/unblock` | Desbloquear |
| POST | `/admin/users/:id/reset-password` | Gerar senha temporária (exibida uma vez) |
| GET | `/admin/overview` | Totais do painel: playlists por status, alunos, áudios (inclui órfãos, só contagem) e caracteres do TTS |

## 13. Arquitetura e stack

```
apps/web (Vite + React, PWA)          apps/admin (Vite + React, backoffice)
  ├─ Contextos e tela da playlist       ├─ CRUD de contextos e playlists (ordenar)
  ├─ Service Worker: cache de áudios    ├─ Frases: revisar, publicar
  └─ Player: <audio> + Media Session    └─ Painel de acompanhamento
            │                                       │
            └──────────────┬────────────────────────┘
                           │  HTTP/JSON (packages/api-client)
                           ▼
              apps/api (Node.js / TypeScript / Fastify)
                ├─ Postgres ............. contextos, playlists, frases, áudios, progresso
                ├─ ElevenLabs API ....... geração de áudio (1 voz, 1 modelo)
                └─ Storage (disco local)  arquivos MP3 em um volume
```

- **Monorepo:** workspace **pnpm** com `apps/web`, `apps/admin`, `apps/api`, `apps/mcp`, `packages/shared` e `packages/api-client`. Uma instalação, um lockfile e scripts na raiz (`pnpm dev` sobe os três apps juntos).
- **App do aluno (`apps/web`):** Vite + React + TypeScript, como SPA/PWA (`vite-plugin-pwa` para o service worker).
- **Tema:** variáveis CSS (design tokens) para cores, com a paleta escura em `@media (prefers-color-scheme: dark)` e em `[data-theme="dark"]`. A escolha manual vai para o `localStorage`. O manifesto do PWA e a `theme-color` também precisam ter variante escura. Os tokens ficam compartilhados entre `web` e `admin`.
- **Backoffice (`apps/admin`):** Vite + React + TypeScript, **sem service worker** (não precisa ser PWA nem funcionar offline). É um app à parte, com bundle e deploy próprios, então nada do backoffice pesa no app do aluno.
- **API (`apps/api`):** Node + TypeScript com **Fastify**, validação com **zod**.
- **MCP (`apps/mcp`):** servidor MCP por stdio (`@modelcontextprotocol/sdk`) que chama as rotas `/admin` da API. Não é implantado: roda na máquina de quem usa o Claude Code e fala com a API pela URL do Tailscale. A API só aceita sessão por cookie httpOnly, então ele reaproveita o `createApiClient` com um `fetch` que guarda os cookies e entra de novo se o refresh falhar. Variáveis: `REOUVIR_URL`, `REOUVIR_EMAIL` e `REOUVIR_PASSWORD` (de preferência um administrador dedicado). Tools: listar e criar contextos; listar, detalhar, criar e editar playlists; adicionar (uma ou várias, com `translationPt` opcional), editar e remover frases; gerar a tradução das pendentes (`translate_playlist`); publicar. De propósito não expõe excluir contexto ou playlist, despublicar nem arquivar. Não há rota em lote para frases, então `add_sentences` faz uma chamada por frase; para lotes grandes o caminho continua sendo o `pipeline/src/write_db.py`.
- **Código compartilhado:**
  - `packages/shared`: tipos, schemas zod dos contratos da API e regras usadas pelos dois lados, como a regra do silêncio (`calcularSilencioMs`) e o padding de 1,5 s.
  - `packages/api-client`: cliente HTTP tipado, usado pelo `web` e pelo `admin`.
- **Banco:** Postgres, **sem ORM**. Todos os repositórios usam **SQL nativo**, com o driver `pg` (node-postgres) e consultas parametrizadas. Cada módulo tem seu repositório (`*.repository.ts`) com as queries, e os tipos das linhas são escritos à mão e validados na borda com zod, quando necessário. As migrações são arquivos `.sql` puros e versionados, aplicados pelo **dbmate**. Cada arquivo tem duas seções, `-- migrate:up` e `-- migrate:down`, e a ferramenta registra no banco quais já foram aplicadas. O dbmate é um binário único (instalável como dependência de desenvolvimento via pnpm), com comandos como `dbmate new`, `dbmate up`, `dbmate rollback` e `dbmate status`.
- **Testes:** Vitest nos pacotes e apps. Os testes de repositório rodam contra um Postgres real (container), e não contra mocks.
- **Storage:** disco local, atrás de uma interface (`put`, `exists`, `url`) com o driver `local`. Os MP3 ficam em um volume Docker e são servidos pelo Caddy. Se o projeto for publicado um dia, basta criar um driver `s3` (S3 ou R2), sem alterar o resto do código.
- **Auth:** **e-mail e senha**, tratado na API, no padrão de mercado de **access token + refresh token**. Cadastro aberto pela tela de acesso. Senhas com **argon2id**.
  - **Access token:** JWT curto (15 min), com `sub` e `role`, em cookie `httpOnly`.
  - **Refresh token:** opaco e aleatório (30 dias), em cookie `httpOnly` restrito à rota `/api/auth`. Só o **hash** vai para `refresh_tokens`. A cada `refresh` o token é **rotacionado**; se um token já usado reaparecer, toda a família (`family_id`) é revogada.
  - O `refresh` e o `login` consultam `users.status`, então um usuário bloqueado não renova a sessão.
  - O front tenta `refresh` uma vez ao receber 401 e, se falhar, volta para a tela de acesso. O service worker do PWA não guarda respostas de `/api/auth`.
  - O papel `admin` nunca vem do cadastro: o primeiro administrador é criado por seed ou comando, usando o e-mail de `.env`. Biblioteca (por exemplo Better Auth) ou implementação própria com `jose` e `argon2`, desde que siga este contrato.
  - O login com Google fica fora do escopo: exige uma URI de redirecionamento pública com HTTPS, e depois entra como provedor extra só por configuração.
- **Origem única:** em produção, os três ficam sob o mesmo domínio, por caminho: `/` para o app do aluno, `/admin` para o backoffice (`base: '/admin/'` no Vite) e `/api` para a API, via proxy reverso. Isso evita problemas de CORS e permite compartilhar o cookie de sessão. Em desenvolvimento, cada app roda em sua porta e o Vite faz proxy de `/api` para a API.
- **Concorrência:** `UNIQUE(audio_key)` para o áudio. A troca das frases de uma playlist deve ser feita numa transação.

### Deploy local (Docker Compose + Tailscale)

O sistema roda 100% local, em uma máquina que fica ligada (desktop, mini PC ou servidor caseiro), e é acessado pelo celular e pelo notebook através da VPN Tailscale.

```
Celular / notebook (na tailnet)
        │  https://<maquina>.<tailnet>.ts.net
        ▼
tailscale serve   (HTTPS com certificado do Tailscale, só dentro da tailnet)
        │
        ▼
Caddy (proxy reverso, escutando só em 127.0.0.1)
  ├─ /        → arquivos estáticos do apps/web
  ├─ /admin   → arquivos estáticos do apps/admin
  ├─ /api     → container da API (Fastify)
  └─ /audio   → volume com os MP3

Docker Compose:  postgres · migrate (dbmate, executa e sai) · api · caddy
```

**HTTPS é obrigatório.** O PWA só registra service worker e funciona offline em contexto seguro. Pelo celular, `http://100.x.x.x` ou `http://maquina:porta` não conta, e sem isso o "Baixar playlist" não funciona. A solução é habilitar o MagicDNS e os certificados HTTPS no painel do Tailscale e publicar o Caddy com `tailscale serve` (o comando exato varia com a versão do Tailscale). O Caddy escuta só em `127.0.0.1`, então a única porta de entrada é o `tailscale serve`.

**Serviços do Compose**
- `postgres`: imagem oficial, com volume próprio para os dados.
- `migrate`: roda `dbmate up` ao subir e termina. A `api` só inicia depois que ele conclui.
- `api`: imagem construída por um `Dockerfile` em `apps/api`.
- `caddy`: serve os estáticos do `web` e do `admin` (gerados por `pnpm build`), faz proxy de `/api` e serve `/audio` direto do volume.

**Configuração e segredos.** Ficam em um `.env` fora do Git (com um `.env.example` versionado): chave do ElevenLabs, URL e senha do banco, segredo de sessão, `AUDIO_DIR`, e-mail do administrador inicial.

**Tráfego de rede.** Só saem para a internet as chamadas ao ElevenLabs. Nada entra, exceto pela tailnet.

**Limites configuráveis (`.env`).** `TTS_MAX_PER_MINUTE`, `TTS_MAX_PER_USER_PER_MINUTE` (geração de áudio, inclui o "Baixar playlist") e `AUTH_LOGIN_MAX_PER_IP`, `AUTH_LOGIN_MAX_PER_EMAIL`, `AUTH_REGISTER_MAX_PER_IP` (tentativas de acesso). Os contadores ficam em memória da API, o que basta para uma única instância.

**Desenvolvimento e deploy.** No dia a dia, `pnpm dev` sobe `web`, `admin` e `api` em portas locais, com o Postgres em container. O "deploy" é `pnpm build` seguido de `docker compose up -d --build` na máquina de produção.

**Backup.** Além do `pg_dump` agendado do banco, fazer cópia periódica da pasta de áudio para outro disco. Cada MP3 consumiu créditos do ElevenLabs, então perdê-los significa pagar de novo para regenerar.

**Uso fora de casa.** O Tailscale no celular só precisa estar conectado para abrir o app e para "Baixar playlist". Depois que a playlist está baixada no aparelho, ela toca offline durante a corrida.

**Limitação.** Com a máquina desligada, ninguém abre o app nem baixa playlists novas. As já preparadas no celular continuam tocando.

## 14. Estrutura de pastas

```
reouvir-en/
├─ package.json              # scripts da raiz (dev, build, test, lint)
├─ pnpm-workspace.yaml       # apps/* e packages/*
├─ tsconfig.base.json
├─ docs/
│  ├─ estrutura-do-projeto.md
├─ prototipo/                # protótipo HTML navegável (referência de UX, não é código de produção)
├─ apps/
│  ├─ web/                   # Vite + React (PWA do aluno)
│  │  ├─ index.html
│  │  ├─ vite.config.ts
│  │  └─ src/
│  │     ├─ main.tsx
│  │     ├─ routes/          # acesso (entrar/criar conta), catálogo, tela da playlist, configurações
│  │     ├─ components/
│  │     ├─ player/          # motor da playlist, silêncio, prefetch, media session
│  │     └─ sw/              # service worker (cache de áudios)
│  ├─ admin/                 # Vite + React (backoffice, servido em /admin)
│  │  ├─ index.html
│  │  ├─ vite.config.ts      # base: '/admin/'
│  │  └─ src/
│  │     ├─ main.tsx
│  │     ├─ routes/          # contextos, playlists, revisão de frases, usuários, painel
│  │     └─ components/
│  └─ api/                   # Fastify + TypeScript
│     └─ src/
│        ├─ server.ts
│        ├─ modules/
│        │  ├─ auth/         # cadastro, login, refresh, logout, papéis, tokens
│        │  ├─ users/        # gestão de usuários (bloquear, redefinir senha)
│        │  ├─ catalog/      # contextos (rotas, repositório SQL)
│        │  ├─ playlists/    # playlists (criar, editar, ordenar), frases, publicação
│        │  ├─ sentences/    # frases da playlist: edição manual, reordenação
│        │  └─ audio/        # chave, single-flight, ElevenLabs
│        ├─ storage/         # interface de storage + driver local (driver s3 no futuro)
│        └─ db/
│           ├─ pool.ts       # conexão (pg)
│           └─ migrations/   # arquivos .sql do dbmate (up/down)
├─ packages/
│  ├─ shared/                # tipos, schemas zod, regra do silêncio, constantes
│  └─ api-client/            # cliente HTTP tipado (web e admin)
├─ infra/
│  ├─ docker-compose.yml     # postgres, migrate, api, caddy
│  ├─ Caddyfile              # /, /admin, /api, /audio
│  └─ api.Dockerfile
├─ .env.example
└─ README.md
```

## 15. Referência de conteúdo (não é carregada pelo sistema)

Esta seção é só **referência** para quem monta o conteúdo. O sistema **não carrega** contextos, playlists nem frases: contextos e playlists são criados no backoffice e as frases são gravadas no banco (seção 8).

Níveis CEFR e tópicos gramaticais **deixaram de fazer parte do sistema** (não há mais tabelas nem seed). Os currículos antigos (A1 a B2) continuam em [`docs/pipeline/`](pipeline/) como ideias de roteiro para playlists e como entrada das ferramentas legadas da pipeline ([`docs/pipeline.md`](pipeline.md)); nada disso é obrigatório.

### Contextos sugeridos

- Software engineer interview (Java)
- Software team daily stand-up
- Code review
- Team meeting
- Project presentation
- Job interview (general)
- Airport and air travel
- Hotel and accommodation
- Restaurant
- Supermarket and shopping
- Doctor's appointment
- Gym and exercise
- Daily routine
- Meeting people (small talk)

## 16. Custos e limites

- **Frases:** o custo de gerá-las fica na pipeline externa e não passa por este sistema.
- **Áudio (ElevenLabs, por caractere):** o custo vem só da **primeira** escuta de cada frase no mundo. Com 100 frases de ~60 caracteres, uma playlist usa cerca de 6.000 caracteres, uma única vez, para todos os alunos.
- **Armazenamento:** áudio de frase curta pesa poucas dezenas de KB, então a pasta de áudio cresce devagar e cabe com folga em um disco local.
- **Limites de proteção:** limite de chamadas ao TTS por minuto e por aluno, para evitar abuso e custo inesperado. O "Baixar playlist" também entra nesse limite.

## 17. Riscos

| Risco | Tratamento |
|---|---|
| Áudio parar com a tela bloqueada, principalmente no iOS, agora com silêncios longos | Spike do player no início, áudios já baixados, Media Session API e faixa silenciosa durante os silêncios. |
| Frase com gramática errada ou fora do tom da playlist | Responsabilidade de quem escreve. Aqui: revisão do administrador antes de publicar. |
| Gravar direto no banco dados inconsistentes (hash, versão) | Triggers no banco normalizam o texto, derivam `text_hash` e `char_count` e sobem a `version`; `UNIQUE` recusa duplicatas; `write_db.py` valida o texto e confere o resultado; testes comparam SQL e código. |
| Espera na primeira escuta por áudio ainda não gerado | Prefetch de 3 frases à frente e botão "Baixar playlist". |
| Dois alunos gerando o mesmo áudio | `UNIQUE(audio_key)` com single-flight. |
| Pronúncia ruim de siglas e termos técnicos (Java, JVM, API) | Revisão pontual e, se necessário, campo opcional de pronúncia por frase. |
| Edição de frase em playlist publicada deixa áudio órfão | Sem limpeza no painel (evita apagar áudio já pago). O painel só conta os órfãos; a limpeza é manual, por CLI, com prévia por padrão. |
| Licença do ElevenLabs não cobrir o uso | Conferir os termos do plano antes de abrir para outros alunos. |
| Cookie de sessão e CORS com front, backoffice e API separados | Servir os três sob o mesmo domínio (`/`, `/admin` e `/api`) e usar proxy no Vite em desenvolvimento. |
| SQL nativo sem ORM: queries espalhadas e erros de digitação em colunas | Repositórios por módulo, tipos das linhas explícitos e testes de repositório contra Postgres real. |
| Sem HTTPS, o PWA não registra service worker no celular | Publicar o Caddy com `tailscale serve` e certificado do Tailscale (MagicDNS + HTTPS habilitados). |
| Perda da pasta de áudio obriga a pagar o ElevenLabs de novo | Backup periódico da pasta de áudio, além do `pg_dump`. |
| Cadastro aberto permite criar contas à vontade, e sem e-mail não há recuperação de senha | A rede é só a tailnet; limite de tentativas em `register`/`login`; redefinição pelo administrador; bloqueio de usuários. |
| Máquina desligada deixa o app indisponível | Risco aceito; playlists já preparadas no celular tocam offline. |

## 18. Premissas assumidas (validar)

Pontos em que escolhi um padrão. Todos são fáceis de mudar.

1. **O silêncio é contado depois do fim do áudio**, e não do início. Com áudio de 10 s a 1x, o ciclo completo de uma repetição dura 21,5 s (10 s de áudio + 11,5 s de silêncio).
2. **O silêncio também vale depois da última repetição**, antes de passar para a próxima frase.
3. **Playlists livres dentro de um contexto**, sem versões de conteúdo. Para trocar o conteúdo, regravam-se as frases (ou o administrador edita à mão), ou arquiva-se a playlist.
4. **Tamanho da playlist livre.** Este sistema não impõe quantidade de frases.
5. **Padrão de 2 repetições** por frase.
6. **Uma voz americana.**
7. **"Baixar playlist" faz parte do produto**, porque correr com conexão instável é o caso de uso principal.
8. **Cadastro aberto** pela tela de acesso (e-mail e senha), com access token + refresh token. O administrador inicial vem de seed. O backoffice só bloqueia usuários e redefine senhas (senha temporária, sem e-mail).
9. **Sem nível nem tópico.** O administrador decide quantas playlists cada contexto tem, o nome e a ordem de cada uma; adequação de gramática e de dificuldade fica com quem escreve as frases.
10. **Sem SRS.** O progresso é medido por voltas completas, audições por frase e tempo ouvido.
11. **Tudo local, uma única máquina**, acessada pela tailnet em um único nome (`<maquina>.<tailnet>.ts.net`). Não há bucket nem CDN.

## 19. Fases de implementação

1. **Fundação:** workspace pnpm (`apps/web`, `apps/admin`, `apps/api`, `packages/shared`, `packages/api-client`), Docker Compose com Postgres, migrações em SQL puro com dbmate, autenticação completa (cadastro, login, refresh, logout, troca de senha), papéis (`student` e `admin`), seed do administrador e limite de tentativas.
2. **Spike do player:** `<audio>` com Media Session, repetições, regra de silêncio e faixa silenciosa, testado com áudios fixos em iPhone e Android com a tela bloqueada.
3. **Backoffice do catálogo (`apps/admin`):** estrutura do app, tela de login (reaproveitando a auth da fase 1, só para `admin`), CRUD de contextos (com geração das playlists vazias), níveis e tópicos somente leitura, **gestão de usuários** (listar, bloquear, redefinir senha) e carga inicial por seed.
4. **Backoffice das playlists:** lista de tópicos do contexto, revisão manual (editar, remover, reordenar, adicionar), publicação, e os triggers do banco que sustentam a carga direta pela pipeline (seção 8).
5. **Geração de áudio lazy:** chave, single-flight, ElevenLabs, storage em disco local servido pelo Caddy e `duration_ms`.
6. **App do aluno:** catálogo publicado, player completo, prefetch, retomada de posição e configurações.
7. **Offline:** "Baixar playlist" com service worker e Cache Storage.
8. **Acabamento:** painel de acompanhamento, limites de proteção, backups, README e deploy local (Compose + Caddy + `tailscale serve`).
9. **Playlists livres:** remoção de níveis e tópicos gramaticais. A playlist passa a pertencer só a um contexto, com título, descrição, slug e posição próprios; o backoffice cria, edita, reordena e exclui playlists; o catálogo do aluno vira contexto → playlists; o `write_db.py` grava por (contexto, playlist). As fases 3 e 4 acima descrevem o modelo anterior (playlist por tópico).
