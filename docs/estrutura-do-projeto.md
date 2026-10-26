# Reouvir EN — Estrutura do Projeto

> *Hear it again.*

## 1. Visão geral

**Reouvir EN** é um PWA de **treino de escuta em inglês**. O aluno escolhe uma **playlist**, definida por três eixos:

```
Contexto                                   /  Nível CEFR  /  Tópico gramatical
Entrevista de engenheiro de software Java  /     A1       /   Verbo to be
```

O app toca a playlist inteira, frase por frase, no estilo de um player de música. O uso principal é **mãos livres** (correndo, no spinning, no trânsito): o aluno dá play e escuta o conteúdo todo, repetidas vezes, até as frases ficarem fixas no ouvido.

**Não é um curso.** Não há lições, exercícios nem explicação de gramática. A gramática do CEFR serve apenas para calibrar a complexidade das frases.

O sistema tem dois apps de front-end, independentes, e uma API:

| App | Quem usa | Função |
|---|---|---|
| **App do aluno** (`apps/web`, PWA) | Alunos | Escolher uma playlist publicada e ouvir. |
| **Backoffice** (`apps/admin`) | Administrador | Gerenciar o catálogo e os usuários; **importar** (arquivo JSON da pipeline), revisar e publicar as playlists. |
| **API** (`apps/api`) | Os dois apps | Regras de negócio, banco, importação de playlists e geração de áudio. |

## 2. Princípios de design

1. **O conteúdo é curado e vem de fora.** As frases são produzidas por uma **pipeline externa** (outro projeto) e **importadas** por um administrador no backoffice como arquivo JSON. Ele revisa e publica. O aluno só consome conteúdo publicado. Este sistema não gera frases.
2. **O áudio é o único item lazy.** O áudio de uma frase só é gerado na primeira vez que alguém precisa dele, e fica guardado para sempre.
3. **Gerou uma vez, serve para todos.** O áudio é compartilhado entre todos os alunos. Nenhum áudio é gerado duas vezes.
4. **Playlist, não frase solta.** A unidade de uso é a playlist inteira. O aluno configura só quantas vezes cada frase repete em sequência.
5. **Ritmo fixo de escuta.** Depois de cada audição existe um silêncio proporcional à duração do áudio (seção 6), para o aluno repetir em voz alta ou processar o que ouviu.
6. **Mãos livres.** O player precisa funcionar com a tela bloqueada e com conexão instável.
7. **Custo previsível.** Frases curtas, cache global de áudio e um único modelo de voz no MVP.

## 3. Escopo

### Entra no MVP

**App do aluno**
- Tela de acesso com duas opções: **entrar** com e-mail e senha ou **criar conta** (cadastro aberto, sempre com papel `student`). O administrador é criado por seed.
- Execução **100% local**, em Docker Compose, acessada pela VPN Tailscale (seção 13).
- Navegação por **contexto → nível → tópico**, mostrando apenas playlists **publicadas**. O aluno escolhe primeiro *o que* quer ouvir (o contexto) e depois em que nível e com qual conteúdo gramatical.
- Player de playlist:
  - repetições seguidas de cada frase (configurável),
  - silêncio entre audições calculado pela duração do áudio (regra fixa),
  - velocidade 0,75x / 1x,
  - loop da playlist,
  - controles na tela de bloqueio (Media Session API),
  - retomar de onde parou.
- **Tema claro e escuro** no app do aluno e no backoffice: segue o sistema (`prefers-color-scheme`), com alternância manual lembrada no dispositivo.
- Geração **lazy** do áudio (ElevenLabs) com cache global.
- **Ouvir offline**: baixar a playlist inteira (frases e áudios) para o dispositivo e tocá-la localmente.
- Estatísticas simples por playlist (voltas completas, tempo ouvido).

**Backoffice (administrador)**
- CRUD de **níveis**, **tópicos gramaticais** e **contextos**.
- **Usuários:** listar, **bloquear/desbloquear** e **redefinir a senha**.
- Criação manual de uma playlist vazia para um par `(tópico, contexto)`, para preencher à mão.
- **Importação de playlists** por arquivo JSON (seção 8), com prévia antes de gravar e histórico.
- Revisão das frases: editar, remover, reordenar e adicionar à mão.
- Publicar, despublicar e arquivar playlists.
- Visão de cobertura de áudio por playlist (quantos áudios já foram gerados) e consumo de caracteres do TTS.

### Fora do MVP

- Geração de frases dentro do sistema (fica numa pipeline à parte).
- Tradução para português.
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
| **Nível** | Nível CEFR, cadastrado no backoffice. O escopo é **A1, A2, B1 e B2** (C1 e C2 ficam fora). |
| **Tópico gramatical** | Item da lista CEFR (ex.: Verbo to be). Pertence a um nível. |
| **Contexto** | Cenário temático (ex.: Entrevista de engenheiro de software Java). É **transversal**: um mesmo contexto tem playlists em todos os níveis (A1–B2) e para todos os tópicos de cada nível, e todas as frases são ambientadas nele. |
| **Playlist** | Lista ordenada e fixa de frases para um par `(tópico, contexto)`. O nível vem do tópico. Compartilhada entre todos os alunos. |
| **Frase** | Texto em inglês, único dentro da playlist, com posição fixa. |
| **Áudio** | Arquivo de voz de uma frase. Identificado por hash do texto + voz + modelo + configurações. |
| **Repetições** | Quantas vezes seguidas cada frase toca antes de passar para a próxima. |

### Ciclo de vida da playlist

```
draft (importada ou vazia) ──(publicar)──► published
        ▲                                      │
        └────────────(despublicar)─────────────┘
                 archived (fora de uso)
```

- **draft:** em preparação (recém-importada ou vazia), invisível para os alunos.
- **published:** visível e tocável pelos alunos.
- **archived:** retirada de uso, sem apagar o histórico.

### Tamanho e ordem

- **Tamanho:** definido pela pipeline (alvo de ~100 frases).
- **Ordem no backoffice:** a lista já vem ordenada por `position`.
  - **Remover** uma frase só deixa uma **lacuna** (as posições das outras não mudam).
  - **Criar** uma frase a coloca na **última posição** (`MAX(position) + 1`).
  - **Reordenar** (arrastar e soltar, ou editar a posição da frase) envia a lista completa de ids na nova ordem, e o servidor **renumera tudo de 1 a n** numa transação, o que também fecha as lacunas. O `UNIQUE (playlist_id, position)` é `DEFERRABLE INITIALLY DEFERRED` para permitir isso.
- **Ordem fixa para o aluno:** a posição de cada frase não muda entre uma volta e outra. A segunda volta da playlist toca as mesmas frases na mesma ordem, e isso ajuda a memorização.
- Editar uma frase de uma playlist publicada é permitido, mas gera outro áudio para o novo texto (seção 9).

## 5. Fluxo do aluno

```
Login
  └─ Home: escolhe o contexto → o nível → o tópico (somente playlists publicadas)
       └─ Tela da playlist (ex.: Entrevista Java / A1 / Verbo to be)
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

### 7.1 Catálogo

- **Níveis:** código (rótulo livre e único, ex.: A1), nome, ordem, ativo.
- **Tópicos gramaticais:** nome, slug (único), nível, ordem **dentro do nível**, ativo. A ordem global do currículo é `(ordem do nível, ordem do tópico)` e é a ordem em que o aluno vê os tópicos.
- **Contextos:** nome, slug, descrição, categoria, ativo.
- Itens inativos somem do app do aluno, sem apagar as playlists já criadas.
- A carga inicial vem dos arquivos de seed (seção 15). O arquivo de importação também pode **criar** níveis e tópicos que faltem (seção 8), mas não sobrescreve nomes nem ordem sem confirmação.

### 7.2 Playlists

1. A playlist nasce de uma **importação** (seção 8), sempre em `draft`. Também é possível criar uma playlist vazia à mão.
2. O administrador **revisa** a lista:
   - editar o texto de uma frase,
   - remover uma frase,
   - reordenar (arrastar e soltar, ou digitar a posição de destino),
   - adicionar uma frase manual (vai para o fim da lista).
3. **Publica** a playlist. A partir daí os alunos a veem.
4. Pode **despublicar** ou **arquivar** depois.
5. Para trocar o conteúdo inteiro, reimporta o arquivo (substitui as frases) ou edita à mão.

### 7.3 Painel de acompanhamento

Por playlist: número de frases, status, **cobertura de áudio** (ex.: 63 de 100 já gerados), caracteres consumidos no TTS e número de alunos que a iniciaram.

### 7.4 Usuários

O cadastro é feito pelo próprio aluno na tela de acesso. O backoffice **não cria nem edita** contas, só:

- **Listar** usuários (e-mail, papel, status, data de cadastro, último acesso).
- **Bloquear/desbloquear:** o bloqueio muda `status` para `blocked` e revoga todos os refresh tokens do usuário. Ele perde o acesso assim que o access token expira (até 15 min) e não consegue mais entrar nem renovar a sessão.
- **Redefinir a senha:** gera uma **senha temporária**, exibida uma única vez ao administrador, que a repassa ao aluno. A conta fica com `must_change_password = true` e todas as sessões são revogadas. No próximo login, o aluno é obrigado a trocar a senha. Não há e-mail transacional no MVP, então não existe "esqueci minha senha" automático.
- Um administrador não pode bloquear a si mesmo. Papéis não são alterados pelo backoffice.

## 8. Importação de playlists (backoffice)

**As frases não são geradas neste sistema.** Uma **pipeline externa** (projeto à parte) produz, por contexto, nível e tópico, um arquivo JSON, e o administrador o **importa** pelo backoffice. A pipeline é dona da pedagogia (ordem dos tópicos, regra de gramática por nível, prompts e modelo). Este sistema valida o formato, grava como rascunho e permite a revisão.

### 8.1 Formato do arquivo

Um arquivo traz **um contexto**, com a hierarquia aninhada: **contexto → níveis → tópicos → frases**. O nó do tópico **é** a playlist (o par contexto × tópico). Exemplo completo e válido: [`exemplo-importacao.json`](exemplo-importacao.json).

```json
{
  "schema_version": 1,
  "source": { "pipeline": "...", "pipeline_version": "...", "generated_at": "...", "model": "...", "prompt_version": "..." },
  "context": {
    "slug": "entrevista-de-engenheiro-de-software-java",
    "name": "Entrevista de engenheiro de software (Java)",
    "category": "Trabalho",
    "description": "...",
    "levels": [
      { "code": "A1", "name": "A1", "order": 1,
        "topics": [
          { "slug": "verbo-to-be", "name": "Verbo to be", "order": 1,
            "sentences": [ { "order": 1, "text": "I am a Java developer.", "metadata": { "scene": "introduction" } } ] }
        ] }
    ]
  }
}
```

| Campo | Obrigatório | Regra |
|---|---|---|
| `schema_version` | sim | Inteiro (hoje `1`). Permite evoluir o formato. |
| `source.*` | não | Só rastreabilidade. Fica no registro da importação. |
| `context.slug` | sim | Chave de busca. Existe: é reaproveitado. Não existe: é criado. |
| `context.name`, `category` | sim | Usados quando o contexto é criado. `description` é opcional. |
| `levels[].code` | sim | Rótulo livre e único no arquivo (ex.: `A1`). Não precisa ser CEFR. |
| `levels[].name` | não | Padrão: o `code`. |
| `levels[].order` | sim | Inteiro ≥ 1. Ordem entre os níveis. |
| `topics[].slug` | sim | Único no arquivo **e no catálogo**. Um slug já existente em outro nível é erro. |
| `topics[].name` | sim | Nome exibido. |
| `topics[].order` | sim | Inteiro ≥ 1. Ordem **dentro do nível**. |
| `sentences[].order` | sim | Inteiro ≥ 1, **único** na playlist. Pode ter lacunas no arquivo. |
| `sentences[].text` | sim | Texto em inglês. |
| `sentences[].metadata` | não | Objeto livre (cena, tags…), guardado em `jsonb` e ignorado pelo app. |

**Ordens.** Vale a ordem escrita no arquivo, e não a posição no array. A ordem global do currículo é `(order do nível, order do tópico)`. As frases são ordenadas por `order` e gravadas com posições **renumeradas de 1 a n**. A playlist não tem ordem própria: deriva do nível e do tópico.

### 8.2 Regras da importação

- **Tudo entra como `draft`.** A importação nunca publica.
- **Catálogo:** níveis e tópicos que faltam são **criados**. Se já existem e `name`/`order` diferem, **nada é sobrescrito** por padrão: a prévia mostra a diferença e o administrador pode marcar **"Atualizar nomes e ordem do catálogo"**.
- **Playlist (contexto × tópico) já existente:**
  - conteúdo idêntico: **sem mudanças**;
  - `draft` ou `archived`: as frases são **substituídas** (mantém o status);
  - `published`: **recusada**, a menos que o administrador marque **"Substituir playlists publicadas"**. Nesse caso a prévia informa quantos alunos têm progresso nela (a retomada deles volta ao início, pois `last_sentence_id` fica nulo).
- **Atomicidade:** cada playlist é gravada numa transação. Uma playlist com erro não impede as outras. Erros estruturais do arquivo (JSON inválido, `schema_version` não suportado, `code` ou `slug` repetido) recusam o arquivo inteiro.
- **O áudio continua lazy.** Importar não chama o ElevenLabs. Frases com texto já conhecido reaproveitam o áudio existente (a chave é o hash do texto).

### 8.3 Validação

- **Erro (a playlist não entra):** texto vazio; URL ou emoji; frase duplicada na playlist (`text_hash`); `order` inválida ou repetida; playlist sem frases; tópico que já existe em outro nível.
- **Aviso (entra, mas sinaliza):** número de palavras fora da faixa do nível, quando o `code` é um destes:

| Nível | Palavras por frase |
|---|---|
| A1–A2 | 4–10 |
| B1–B2 | 8–18 |
| C1–C2 | 12–30 |

Para outros rótulos de nível não há aviso de tamanho. A faixa também controla o custo do TTS, que cobra por caractere.

### 8.4 Fluxo no backoffice

1. **Importar** → enviar o arquivo (ou colar o JSON).
2. **Prévia (dry run):** nada é gravado. Mostra contexto novo ou existente, mudanças de catálogo, e por playlist: criar, substituir, sem mudanças, recusada ou erro, com os motivos.
3. **Confirmar** (com as duas opções acima, desmarcadas por padrão).
4. **Relatório** final e registro no **histórico de importações**.

### 8.5 Contrato compartilhado

O schema do arquivo vive em `packages/shared` (zod) e o formato é versionado por `schema_version`. A pipeline pode importar esse schema para validar o arquivo antes de entregá-lo. O limite de tamanho do upload é de 5 MB.

## 9. Geração lazy do áudio

**Chave do áudio:** `audio_key = sha256(texto_normalizado | voice_id | model_id | voice_settings)`.

- A chave usa o **texto**, não o id da frase. Se o mesmo texto aparecer em outra playlist, o áudio é reaproveitado.
- Mudar de voz ou de modelo gera outra chave, de propósito.
- Se o administrador editar uma frase, o novo texto gera outra chave e outro áudio. O áudio antigo fica órfão e pode ser limpo depois.

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
- Frase atual, voltas completas e tempo ouvido são gravados **localmente** a cada frase, com a marca `client_updated_at`.
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
  user_id, repeats, speed, loop_playlist
)

levels (
  id, code,                          -- rótulo livre e único (ex.: 'A1')
  name, sort_order, active                 -- sort_order sem UNIQUE; empate desempata por nome
)

grammar_topics (
  id, level_id, slug, name,          -- slug UNIQUE
  sort_order, active                       -- ordem dentro do nível
)

contexts (
  id, slug, name,                    -- slug UNIQUE
  description, category, active
)

playlists (
  id, grammar_topic_id, context_id,
  status,                            -- 'draft' | 'published' | 'archived'
  created_by, created_at, published_at,
  UNIQUE (grammar_topic_id, context_id)
)

imports (
  id, context_id, filename,
  content_hash,                      -- sha256 do arquivo (avisa se já foi importado)
  status,                            -- 'done' | 'partial' | 'failed'
  options,                           -- jsonb: update_catalog, replace_published
  report,                            -- jsonb: o que foi criado, substituído, recusado, com erros
  source,                            -- jsonb: o bloco "source" do arquivo
  created_by, created_at
)

sentences (
  id, playlist_id, position, text, text_hash, char_count,
  metadata,                          -- jsonb opcional vindo da pipeline (ignorado pelo app)
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
  
  loops_completed, listened_seconds, updated_at,
  PRIMARY KEY (user_id, playlist_id)
)
```

O nível de uma playlist é obtido por `playlists → grammar_topics → levels`. O consumo de caracteres do TTS vem de `SUM(audios.char_count)` dos áudios `ready`, o que inclui os órfãos.

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
| GET | `/catalog` | Árvore **contexto → nível → tópico** com as playlists publicadas (id, tópico, estado de download fica no cliente) |
| GET | `/playlists/:id` | Playlist publicada com as frases e o estado do aluno |
| GET | `/sentences/:id/audio` | Garante o áudio (lazy) e devolve URL e duração |
| POST | `/playlists/:id/prepare` | Garante todos os áudios e devolve o **manifesto offline**: frases (id, posição, texto, `audioUrl`, `durationMs`) e a versão da playlist |
| PUT | `/playlists/:id/state` | Salva frase atual, voltas e tempo ouvido (com `client_updated_at`; vale o mais recente) |
| GET/PUT | `/me/settings` | Configurações do player |

### Backoffice (`admin`)

| Método | Rota | Função |
|---|---|---|
| CRUD | `/admin/levels` | Níveis |
| CRUD | `/admin/topics` | Tópicos gramaticais |
| CRUD | `/admin/contexts` | Contextos |
| GET/POST | `/admin/playlists` | Listar (filtro por contexto) e criar playlist vazia |
| POST | `/admin/imports` | Importa o JSON (`?dry_run=true` devolve só a prévia). Opções: `update_catalog`, `replace_published` |
| GET | `/admin/imports` | Histórico de importações com o relatório de cada uma |
| PATCH/DELETE | `/admin/sentences/:id` | Editar ou remover uma frase |
| PUT | `/admin/playlists/:id/order` | Reordenar: recebe a lista completa de ids na nova ordem e renumera de 1 a n |
| POST | `/admin/playlists/:id/sentences` | Adicionar frase manual (última posição) |
| POST | `/admin/playlists/:id/publish` | Publicar |
| POST | `/admin/playlists/:id/unpublish` | Despublicar |
| POST | `/admin/playlists/:id/archive` | Arquivar |
| GET | `/admin/playlists/:id/stats` | Cobertura de áudio e consumo do TTS |
| GET | `/admin/users` | Listar usuários |
| POST | `/admin/users/:id/block` | Bloquear (revoga os refresh tokens) |
| POST | `/admin/users/:id/unblock` | Desbloquear |
| POST | `/admin/users/:id/reset-password` | Gerar senha temporária (exibida uma vez) |

## 13. Arquitetura e stack

```
apps/web (Vite + React, PWA)          apps/admin (Vite + React, backoffice)
  ├─ Catálogo e tela da playlist        ├─ CRUD de níveis, tópicos e contextos
  ├─ Service Worker: cache de áudios    ├─ Playlists: importar, revisar, publicar
  └─ Player: <audio> + Media Session    └─ Painel de acompanhamento
            │                                       │
            └──────────────┬────────────────────────┘
                           │  HTTP/JSON (packages/api-client)
                           ▼
              apps/api (Node.js / TypeScript / Fastify)
                ├─ Postgres ............. catálogo, playlists, frases, áudios, progresso
                ├─ ElevenLabs API ....... geração de áudio (1 voz, 1 modelo)
                └─ Storage (disco local)  arquivos MP3 em um volume
```

- **Monorepo:** workspace **pnpm** com `apps/web`, `apps/admin`, `apps/api`, `packages/shared` e `packages/api-client`. Uma instalação, um lockfile e scripts na raiz (`pnpm dev` sobe os três apps juntos).
- **App do aluno (`apps/web`):** Vite + React + TypeScript, como SPA/PWA (`vite-plugin-pwa` para o service worker).
- **Tema:** variáveis CSS (design tokens) para cores, com a paleta escura em `@media (prefers-color-scheme: dark)` e em `[data-theme="dark"]`. A escolha manual vai para o `localStorage`. O manifesto do PWA e a `theme-color` também precisam ter variante escura. Os tokens ficam compartilhados entre `web` e `admin`.
- **Backoffice (`apps/admin`):** Vite + React + TypeScript, **sem service worker** (não precisa ser PWA nem funcionar offline). É um app à parte, com bundle e deploy próprios, então nada do backoffice pesa no app do aluno.
- **API (`apps/api`):** Node + TypeScript com **Fastify**, validação com **zod**.
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
  - O login com Google fica fora do MVP: exige uma URI de redirecionamento pública com HTTPS, e depois entra como provedor extra só por configuração.
- **Origem única:** em produção, os três ficam sob o mesmo domínio, por caminho: `/` para o app do aluno, `/admin` para o backoffice (`base: '/admin/'` no Vite) e `/api` para a API, via proxy reverso. Isso evita problemas de CORS e permite compartilhar o cookie de sessão. Em desenvolvimento, cada app roda em sua porta e o Vite faz proxy de `/api` para a API.
- **Concorrência:** `UNIQUE(audio_key)` para o áudio. Cada playlist importada é gravada numa transação.

### Deploy local (Docker Compose + Tailscale)

O MVP roda 100% local, em uma máquina que fica ligada (desktop, mini PC ou servidor caseiro), e é acessado pelo celular e pelo notebook através da VPN Tailscale.

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
│  └─ exemplo-importacao.json  # arquivo de exemplo no formato da seção 8
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
│  │     ├─ routes/          # catálogo, playlists, revisão de frases, usuários, painel
│  │     └─ components/
│  └─ api/                   # Fastify + TypeScript
│     └─ src/
│        ├─ server.ts
│        ├─ modules/
│        │  ├─ auth/         # cadastro, login, refresh, logout, papéis, tokens
│        │  ├─ users/        # gestão de usuários (bloquear, redefinir senha)
│        │  ├─ catalog/      # níveis, tópicos e contextos (rotas, serviço, repositório SQL)
│        │  ├─ playlists/    # playlists, estado do aluno, publicação
│        │  ├─ sentences/    # frases da playlist: edição manual, reordenação
│        │  ├─ imports/      # importação do JSON da pipeline (validação, prévia, relatório)
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
├─ seeds/
│  ├─ levels.json
│  ├─ grammar-topics.json    # carga inicial; depois, gerenciado no backoffice
│  └─ contexts.json          # carga inicial; depois, gerenciado no backoffice
└─ README.md
```

## 15. Carga inicial do catálogo

Estes itens entram como seed e passam a ser gerenciados no backoffice. A pipeline de frases é dona do currículo: o arquivo de importação pode complementar níveis e tópicos (seção 8), e a ordem do seed é só um ponto de partida.

### Níveis

A1, A2, B1 e B2. **C1 e C2 estão fora do escopo**: não entram no seed nem na pipeline.

### Tópicos gramaticais (conforme a lista CEFR)

**A1:** Verbo to be · pronomes pessoais e possessivos · artigos a/an/the · plural dos substantivos · this/that/these/those · there is/there are · Present Simple · can (habilidade) · imperativo · preposições in, on, at · números, datas e horas

**A2:** Past Simple (regulares e irregulares) · Present Continuous · futuro com going to e will · comparativos e superlativos · countable/uncountable (some, any, much, many) · advérbios de frequência e de modo · have to/must/should · pronomes objeto · conectores simples (and, but, because, so) · question words · verbo + -ing/to

**B1:** Present Perfect (for, since, already, yet, ever) · Present Perfect vs. Past Simple · Past Continuous vs. Past Simple · primeira e segunda condicional · voz passiva (presente e passado) · modais de possibilidade e dedução · orações relativas · discurso indireto básico · used to / be used to · gerúndio vs. infinitivo · phrasal verbs comuns · conectores (although, however, while, in order to)

**B2:** Terceira condicional e condicionais mistas · wish/if only · Past Perfect e Past Perfect Continuous · Present Perfect Continuous · voz passiva avançada · discurso indireto completo · modais no passado · orações relativas não restritivas · inversão para ênfase · Future Perfect e Future Continuous · phrasal verbs e collocations avançados · conectores formais · registro formal vs. informal

> **Fora do escopo:** C1 e C2. As listas abaixo ficam só como referência, caso o escopo seja ampliado.

**C1:** Inversão formal · condicionais formais · subjuntivo · orações clivadas · modais avançados · passiva complexa e impessoal · nominalização · orações reduzidas · coesão avançada · hedging · collocations, idioms e phrasal verbs de registro alto · pontuação em textos longos · adaptação de registro ao público

**C2:** Domínio flexível das estruturas · nuances semânticas · ironia, eufemismo e ambiguidade intencional · idioms e figuras de linguagem · variação regional (US, UK, AU) · elipse e substituição avançadas · ordem de palavras marcada · estrutura retórica e argumentativa · paráfrase e resumo precisos · edição: concisão e clareza · terminologia especializada e convenções de gênero · linguagem implícita e referências culturais

### Contextos sugeridos

- Entrevista de engenheiro de software (Java)
- Daily stand-up de equipe de software
- Code review
- Reunião de equipe
- Apresentação de projeto
- Entrevista de emprego (geral)
- Aeroporto e viagem de avião
- Hotel e hospedagem
- Restaurante
- Supermercado e compras
- Consulta médica
- Academia e exercícios
- Rotina diária
- Conhecendo pessoas (small talk)

## 16. Custos e limites

- **Frases:** o custo de gerá-las fica na pipeline externa e não passa por este sistema.
- **Áudio (ElevenLabs, por caractere):** o custo vem só da **primeira** escuta de cada frase no mundo. Com 100 frases de ~60 caracteres, uma playlist usa cerca de 6.000 caracteres, uma única vez, para todos os alunos.
- **Armazenamento:** áudio de frase curta pesa poucas dezenas de KB, então a pasta de áudio cresce devagar e cabe com folga em um disco local.
- **Limites de proteção:** limite de chamadas ao TTS por minuto e por aluno, para evitar abuso e custo inesperado. O "Baixar playlist" também entra nesse limite.

## 17. Riscos

| Risco | Tratamento |
|---|---|
| Áudio parar com a tela bloqueada, principalmente no iOS, agora com silêncios longos | Spike do player no início, áudios já baixados, Media Session API e faixa silenciosa durante os silêncios. |
| Frase fora do nível ou com gramática errada | Responsabilidade da pipeline. Aqui: avisos de tamanho na importação e revisão do administrador antes de publicar. |
| Arquivo de importação malformado ou que sobrescreve conteúdo publicado | Validação com prévia (dry run), tudo entra como rascunho, playlist publicada só é substituída com confirmação explícita, histórico de importações. |
| Espera na primeira escuta por áudio ainda não gerado | Prefetch de 3 frases à frente e botão "Baixar playlist". |
| Dois alunos gerando o mesmo áudio | `UNIQUE(audio_key)` com single-flight. |
| Pronúncia ruim de siglas e termos técnicos (Java, JVM, API) | Revisão pontual e, se necessário, campo opcional de pronúncia por frase. |
| Edição de frase em playlist publicada deixa áudio órfão | Rotina de limpeza de áudios sem frase associada. |
| Licença do ElevenLabs não cobrir o uso | Conferir os termos do plano antes de abrir para outros alunos. |
| Cookie de sessão e CORS com front, backoffice e API separados | Servir os três sob o mesmo domínio (`/`, `/admin` e `/api`) e usar proxy no Vite em desenvolvimento. |
| SQL nativo sem ORM: queries espalhadas e erros de digitação em colunas | Repositórios por módulo, tipos das linhas explícitos e testes de repositório contra Postgres real. |
| Sem HTTPS, o PWA não registra service worker no celular | Publicar o Caddy com `tailscale serve` e certificado do Tailscale (MagicDNS + HTTPS habilitados). |
| Perda da pasta de áudio obriga a pagar o ElevenLabs de novo | Backup periódico da pasta de áudio, além do `pg_dump`. |
| Cadastro aberto permite criar contas à vontade, e sem e-mail não há recuperação de senha | A rede é só a tailnet; limite de tentativas em `register`/`login`; redefinição pelo administrador; bloqueio de usuários. |
| Máquina desligada deixa o app indisponível | Aceito no MVP; playlists já preparadas no celular tocam offline. |

## 18. Premissas assumidas (validar)

Pontos em que escolhi um padrão. Todos são fáceis de mudar.

1. **O silêncio é contado depois do fim do áudio**, e não do início. Com áudio de 10 s a 1x, o ciclo completo de uma repetição dura 21,5 s (10 s de áudio + 11,5 s de silêncio).
2. **O silêncio também vale depois da última repetição**, antes de passar para a próxima frase.
3. **Playlist única por `(tópico, contexto)`**, sem versões. Para trocar o conteúdo, o administrador reimporta o arquivo, edita as frases ou arquiva a playlist.
4. **Tamanho da playlist definido pela pipeline** (alvo de ~100 frases). Este sistema não impõe quantidade.
5. **Padrão de 2 repetições** por frase.
6. **Uma voz americana** no MVP.
7. **"Baixar playlist" entra no MVP**, porque correr com conexão instável é o caso de uso principal.
8. **Cadastro aberto** pela tela de acesso (e-mail e senha), com access token + refresh token. O administrador inicial vem de seed. O backoffice só bloqueia usuários e redefine senhas (senha temporária, sem e-mail).
9. **Qualquer tópico combina com qualquer contexto.** A pipeline decide quais playlists produzir; a regra de gramática por nível (nunca usar estrutura de tópico posterior) fica inteira nela.
10. **Sem SRS.** O progresso é medido por voltas completas e tempo ouvido.
11. **Tudo local, uma única máquina**, acessada pela tailnet em um único nome (`<maquina>.<tailnet>.ts.net`). Não há bucket nem CDN.

## 19. Fases de implementação

1. **Fundação:** workspace pnpm (`apps/web`, `apps/admin`, `apps/api`, `packages/shared`, `packages/api-client`), Docker Compose com Postgres, migrações em SQL puro com dbmate, autenticação completa (cadastro, login, refresh, logout, troca de senha), papéis (`student` e `admin`), seed do administrador e limite de tentativas.
2. **Spike do player:** `<audio>` com Media Session, repetições, regra de silêncio e faixa silenciosa, testado com áudios fixos em iPhone e Android com a tela bloqueada.
3. **Backoffice do catálogo (`apps/admin`):** estrutura do app, tela de login (reaproveitando a auth da fase 1, só para `admin`), CRUD de níveis, tópicos e contextos, **gestão de usuários** (listar, bloquear, redefinir senha) e carga inicial por seed.
4. **Backoffice das playlists e importação:** schema do JSON em `packages/shared`, `POST /admin/imports` com prévia e histórico, tela de importação, revisão manual (editar, remover, reordenar, adicionar), publicação.
5. **Geração de áudio lazy:** chave, single-flight, ElevenLabs, storage em disco local servido pelo Caddy e `duration_ms`.
6. **App do aluno:** catálogo publicado, player completo, prefetch, retomada de posição e configurações.
7. **Offline:** "Baixar playlist" com service worker e Cache Storage.
8. **Acabamento:** painel de acompanhamento, limites de proteção, limpeza de áudios órfãos, backups, README e deploy local (Compose + Caddy + `tailscale serve`).
