# Wise Warrior: modelo de dados

Versão de 22/11/2026, gerada do esquema da branch `develop` (36 migrations aplicadas).

## 1. Visão geral

O Wise Warrior guarda todos os dados num único banco relacional MySQL 8.0. O banco é a única fonte de verdade: a API REST lê e altera o estado, e o canal de tempo real só avisa os dispositivos de que algo mudou.

O esquema tem 26 tabelas, em seis grupos:

| Grupo | Tabelas | Para quê |
|---|---|---|
| Conta e dispositivos | `users`, `sessions`, `session_refresh_token_history` | Cadastro, plano e login em até 5 dispositivos |
| Personagem e cosméticos | `characters`, `cosmetic_items`, `user_cosmetic_items` | Nível, XP, Inventário e itens equipados |
| Sessões de estudo | `study_sessions`, `active_study_sessions` e três tabelas de recibos | Timer contado no servidor, com comandos idempotentes |
| Guildas, Raids e Mural | `guilds`, `guild_memberships`, `guild_chat_messages`, `missions`, `mission_reward_items`, `guild_mission_choices`, `raids`, `raid_participations`, `raid_contributions` | Estudo cooperativo e chat da Guilda |
| Economia e Loja | `coin_balances`, `coin_ledger_entries`, `user_missions` | Moedas, Extrato e Compras |
| Cobrança | `subscriptions`, `packs`, `pack_payments` | Assinatura premium e Pacotes pagos |

## 2. Convenções

- **Definição oficial:** as migrations TypeORM em `apps/backend/src/migrations`. O esquema nunca é sincronizado automaticamente; cada mudança é uma migration testada em subida e descida.
- **Chaves:** quase todas as tabelas usam UUID em `varchar(36)` como chave primária. As tabelas de recibos usam chave composta (`user_id`, `idempotency_key`).
- **Motor e texto:** InnoDB, `utf8mb4` com collation `utf8mb4_0900_ai_ci`.
- **Datas:** `datetime` em UTC; colunas que precisam de ordem fina usam precisão de milissegundos ou microssegundos.
- **Dono de cada tabela:** cada tabela pertence a um módulo do backend, e outro módulo só a altera pelo Service do dono (ADR-001).
- **Regras no banco:** chaves únicas garantem no máximo uma Guilda por usuário, uma sessão ativa por usuário, um lançamento no Extrato por origem e um Pagamento por usuário e Pacote.


## 3. Diagrama entidade-relacionamento

Gerado do banco depois de aplicar todas as migrations. O arquivo editável, com todas as tabelas e colunas num único diagrama, é `dados/modelo-er.mmd` (Mermaid). Nos diagramas por grupo, PK é chave primária, FK é chave estrangeira e UK é coluna única; tabelas de outros grupos aparecem sem colunas.

### 3.1 Visão geral dos relacionamentos

Todas as tabelas, sem colunas. `users` é o centro do modelo: quase todo dado pertence a um usuário.

```mermaid
erDiagram
    direction LR
    study_sessions ||--o| active_study_sessions : ""
    users ||--o| active_study_sessions : ""
    users ||--o| characters : ""
    users ||--o| coin_balances : ""
    users ||--o{ coin_ledger_entries : ""
    guilds ||--o{ guild_chat_messages : ""
    raid_contributions |o--o| guild_chat_messages : ""
    users ||--o{ guild_chat_messages : ""
    guilds ||--o{ guild_memberships : ""
    users ||--o| guild_memberships : ""
    guilds ||--o| guild_mission_choices : ""
    missions ||--o{ guild_mission_choices : ""
    users |o--o{ guild_mission_choices : ""
    users ||--o{ guilds : ""
    cosmetic_items ||--o{ mission_reward_items : ""
    missions ||--o{ mission_reward_items : ""
    packs ||--o{ pack_payments : ""
    users ||--o{ pack_payments : ""
    raids ||--o{ raid_contributions : ""
    study_sessions |o--o| raid_contributions : ""
    users ||--o{ raid_contributions : ""
    raids ||--o{ raid_participations : ""
    users ||--o{ raid_participations : ""
    guilds ||--o{ raids : ""
    missions ||--o{ raids : ""
    sessions ||--o{ session_refresh_token_history : ""
    users ||--o{ sessions : ""
    users ||--o{ study_session_command_keys : ""
    users ||--o{ study_session_start_receipts : ""
    study_sessions ||--o{ study_session_transition_receipts : ""
    users ||--o{ study_session_transition_receipts : ""
    raids |o--o{ study_sessions : ""
    users ||--o{ study_sessions : ""
    users ||--o| subscriptions : ""
    cosmetic_items ||--o{ user_cosmetic_items : ""
    users ||--o{ user_cosmetic_items : ""
    missions ||--o{ user_missions : ""
    users ||--o{ user_missions : ""
```

### 3.2 Conta e dispositivos

```mermaid
erDiagram
    sessions ||--o{ session_refresh_token_history : "session_id"
    users ||--o{ sessions : "user_id"
    users {
        varchar id PK
        varchar email UK
        varchar password_hash
        varchar display_name
        varchar plan_tier
        datetime created_at
    }
    sessions {
        varchar id PK
        varchar user_id FK
        varchar refresh_token_hash
        varchar device_label
        varchar user_agent
        datetime created_at
        datetime last_used_at
        datetime revoked_at
    }
    session_refresh_token_history {
        varchar session_id PK,FK
        varchar token_hash PK
        datetime consumed_at
        datetime retain_until
    }
```

### 3.3 Personagem e cosméticos

```mermaid
erDiagram
    users ||--o| characters : "user_id"
    cosmetic_items ||--o{ user_cosmetic_items : "cosmetic_item_id"
    users ||--o{ user_cosmetic_items : "user_id"
    characters {
        varchar id PK
        varchar user_id FK,UK
        int level
        bigint xp_total
        varchar companion_id
    }
    cosmetic_items {
        varchar id PK
        varchar category
        varchar name
        varchar unlock_condition
        tinyint requires_premium
        int price
        tinyint for_sale
    }
    user_cosmetic_items {
        varchar id PK
        varchar user_id FK
        varchar cosmetic_item_id FK
        tinyint equipped
        datetime unlocked_at
    }
```

### 3.4 Sessões de estudo

```mermaid
erDiagram
    study_sessions ||--o| active_study_sessions : "study_session_id"
    users ||--o| active_study_sessions : "user_id"
    users ||--o{ study_session_command_keys : "user_id"
    users ||--o{ study_session_start_receipts : "user_id"
    study_sessions ||--o{ study_session_transition_receipts : "study_session_id"
    users ||--o{ study_session_transition_receipts : "user_id"
    raids |o--o{ study_sessions : "raid_id"
    users ||--o{ study_sessions : "user_id"
    study_sessions {
        varchar id PK
        varchar user_id FK
        varchar subject
        varchar mode
        varchar raid_id FK
        datetime started_at
        datetime ended_at
        datetime last_heartbeat_at
        int duration_valid_seconds
        int xp_awarded
        varchar discarded_reason
        int planned_duration_seconds
        varchar state
        datetime run_deadline_at
        datetime paused_at
        int paused_total_seconds
        bigint paused_total_milliseconds
        int version
        varchar terminal_reason
        varchar initiating_session_id
        varchar active_user_id UK
        varchar capped_reason
        varchar kind
        int pause_count
    }
    active_study_sessions {
        varchar user_id PK,FK
        varchar study_session_id FK,UK
    }
    study_session_start_receipts {
        varchar user_id PK,FK
        varchar idempotency_key PK
        int planned_duration_seconds
        varchar subject
        varchar initiating_session_id
        json response_json
    }
    study_session_transition_receipts {
        varchar user_id PK,FK
        varchar study_session_id FK
        varchar idempotency_key PK
        varchar action
        int expected_version
        json response_json
        datetime created_at
    }
    study_session_command_keys {
        varchar user_id PK,FK
        varchar idempotency_key PK
        varchar command_kind
        datetime created_at
    }
```

### 3.5 Guildas, Raids e Mural

```mermaid
erDiagram
    guilds ||--o{ guild_chat_messages : "guild_id"
    raid_contributions |o--o| guild_chat_messages : "contribution_id"
    users ||--o{ guild_chat_messages : "user_id"
    guilds ||--o{ guild_memberships : "guild_id"
    users ||--o| guild_memberships : "user_id"
    guilds ||--o| guild_mission_choices : "guild_id"
    missions ||--o{ guild_mission_choices : "mission_id"
    users |o--o{ guild_mission_choices : "owner_user_id"
    users ||--o{ guilds : "created_by"
    cosmetic_items ||--o{ mission_reward_items : "cosmetic_item_id"
    missions ||--o{ mission_reward_items : "mission_id"
    raids ||--o{ raid_contributions : "raid_id"
    study_sessions |o--o| raid_contributions : "study_session_id"
    users ||--o{ raid_contributions : "user_id"
    raids ||--o{ raid_participations : "raid_id"
    users ||--o{ raid_participations : "user_id"
    guilds ||--o{ raids : "guild_id"
    missions ||--o{ raids : "mission_id"
    guilds {
        varchar id PK
        varchar name UK
        int level
        varchar created_by FK
        datetime created_at
    }
    guild_memberships {
        varchar id PK
        varchar guild_id FK
        varchar user_id FK,UK
        varchar role
        datetime joined_at
    }
    guild_chat_messages {
        varchar id PK
        varchar guild_id FK
        varchar user_id FK
        text body
        datetime sent_at
        bigint seq UK
        varchar kind
        varchar contribution_id FK,UK
        int xp
    }
    missions {
        varchar id PK
        varchar slug UK
        varchar name
        varchar description
        varchar image_url
        int rotation_order UK
        int price
    }
    mission_reward_items {
        varchar mission_id PK,FK
        varchar cosmetic_item_id PK,FK
    }
    guild_mission_choices {
        varchar guild_id PK,FK
        varchar mission_id FK
        varchar owner_user_id FK
        datetime chosen_at
    }
    raids {
        varchar id PK
        varchar guild_id FK
        varchar mission_id FK
        int goal_xp
        int progress_xp
        datetime starts_at
        datetime ends_at
        varchar status
        datetime goal_reached_at
        int regenerated_xp
        varchar fury_through
        datetime opened_at
        varchar mission_owner_user_id
    }
    raid_participations {
        varchar id PK
        varchar raid_id FK
        varchar user_id FK
        datetime created_at
    }
    raid_contributions {
        varchar id PK
        varchar raid_id FK
        varchar user_id FK
        varchar study_session_id FK,UK
        int xp_contributed
        datetime created_at
    }
```

### 3.6 Economia e Loja

```mermaid
erDiagram
    users ||--o| coin_balances : "user_id"
    users ||--o{ coin_ledger_entries : "user_id"
    missions ||--o{ user_missions : "mission_id"
    users ||--o{ user_missions : "user_id"
    coin_balances {
        varchar user_id PK,FK
        int balance
        datetime updated_at
    }
    coin_ledger_entries {
        varchar id PK
        varchar user_id FK
        int amount
        int balance_after
        enum origin_type
        varchar origin_ref
        datetime created_at
    }
    user_missions {
        varchar id PK
        varchar user_id FK
        varchar mission_id FK
        datetime acquired_at
    }
```

### 3.7 Cobrança

```mermaid
erDiagram
    packs ||--o{ pack_payments : "pack_id"
    users ||--o{ pack_payments : "user_id"
    users ||--o| subscriptions : "user_id"
    subscriptions {
        varchar id PK
        varchar user_id FK,UK
        varchar stripe_customer_id UK
        varchar stripe_subscription_id UK
        varchar status
        datetime current_period_end
        datetime cancel_at
        datetime created_at
        datetime updated_at
    }
    packs {
        varchar id PK
        varchar slug UK
        varchar name
        varchar description
        int price_cents
        char currency
        tinyint for_sale
        datetime created_at
    }
    pack_payments {
        varchar id PK
        varchar user_id FK
        varchar pack_id FK
        varchar stripe_checkout_session_id UK
        int amount_cents
        char currency
        datetime paid_at
    }
```

## 4. Dicionário de dados

Tipos como estão no MySQL 8. A coluna Chave usa PK, FK (com a tabela referenciada) e UK.

### 4.1 Conta e dispositivos

Cadastro, plano e sessões de login por dispositivo (ADR-009).

#### `users`

Conta do usuário: e-mail, hash Argon2id da senha, nome do guerreiro e plano (`plan_tier`: free ou premium).

| Coluna | Tipo | Nulo | Chave |
|---|---|---|---|
| `id` | varchar(36) | não | PK |
| `email` | varchar(255) | não | UK |
| `password_hash` | varchar(255) | não |  |
| `display_name` | varchar(255) | não |  |
| `plan_tier` | varchar(255) | não |  |
| `created_at` | datetime(6) | não |  |

#### `sessions`

Um dispositivo conectado: hash do refresh token, rótulo do dispositivo, último uso e revogação. Até 5 por usuário.

| Coluna | Tipo | Nulo | Chave |
|---|---|---|---|
| `id` | varchar(36) | não | PK |
| `user_id` | varchar(36) | não | FK → `users` |
| `refresh_token_hash` | varchar(255) | não |  |
| `device_label` | varchar(255) | sim |  |
| `user_agent` | varchar(255) | sim |  |
| `created_at` | datetime(6) | não |  |
| `last_used_at` | datetime | não |  |
| `revoked_at` | datetime | sim |  |

#### `session_refresh_token_history`

Hashes de refresh tokens já usados, guardados por um tempo para detectar reuso.

| Coluna | Tipo | Nulo | Chave |
|---|---|---|---|
| `session_id` | varchar(36) | não | PK, FK → `sessions` |
| `token_hash` | varchar(255) | não | PK |
| `consumed_at` | datetime(6) | não |  |
| `retain_until` | datetime | não |  |

Índices compostos: `IDX_session_refresh_token_history_session_id_retain_until` (session_id, retain_until).

### 4.2 Personagem e cosméticos

Progressão RPG e Inventário do Herói em camadas (ADR-010, ADR-013).

#### `characters`

Personagem do usuário: nível e XP total. Um por usuário.

| Coluna | Tipo | Nulo | Chave |
|---|---|---|---|
| `id` | varchar(36) | não | PK |
| `user_id` | varchar(36) | não | FK → `users`, UK |
| `level` | int | não |  |
| `xp_total` | bigint | não |  |
| `companion_id` | varchar(36) | sim |  |

#### `cosmetic_items`

Catálogo de itens (Avatar, Arma, Acessório, Título ou Badge): condição de desbloqueio, se é premium, preço em Moedas e se está À venda.

| Coluna | Tipo | Nulo | Chave |
|---|---|---|---|
| `id` | varchar(36) | não | PK |
| `category` | varchar(255) | não |  |
| `name` | varchar(255) | não |  |
| `unlock_condition` | varchar(255) | não |  |
| `requires_premium` | tinyint(1) | não |  |
| `price` | int unsigned | sim |  |
| `for_sale` | tinyint(1) | não |  |

#### `user_cosmetic_items`

Inventário: itens que cada usuário tem e quais estão equipados.

| Coluna | Tipo | Nulo | Chave |
|---|---|---|---|
| `id` | varchar(36) | não | PK |
| `user_id` | varchar(36) | não | FK → `users` |
| `cosmetic_item_id` | varchar(36) | não | FK → `cosmetic_items` |
| `equipped` | tinyint(1) | não |  |
| `unlocked_at` | datetime(6) | não |  |

Índices compostos: `UQ_user_cosmetic_items_user_id_cosmetic_item_id` (user_id, cosmetic_item_id) único.

### 4.3 Sessões de estudo

Timer contado pelo servidor, com comandos idempotentes e antifraude (ADR-011).

#### `study_sessions`

Sessão de estudo: matéria, modo (solo ou guilda), tipo (Ciclo ou Foco livre), estado, prazo, pausas, foco válido, XP concedido e motivo de truncamento ou descarte.

| Coluna | Tipo | Nulo | Chave |
|---|---|---|---|
| `id` | varchar(36) | não | PK |
| `user_id` | varchar(36) | não | FK → `users` |
| `subject` | varchar(255) | sim |  |
| `mode` | varchar(255) | não |  |
| `raid_id` | varchar(36) | sim | FK → `raids` |
| `started_at` | datetime(6) | não |  |
| `ended_at` | datetime(3) | sim |  |
| `last_heartbeat_at` | datetime | sim |  |
| `duration_valid_seconds` | int | não |  |
| `xp_awarded` | int | não |  |
| `discarded_reason` | varchar(255) | sim |  |
| `planned_duration_seconds` | int | sim |  |
| `state` | varchar(24) | sim |  |
| `run_deadline_at` | datetime(3) | sim |  |
| `paused_at` | datetime(3) | sim |  |
| `paused_total_seconds` | int | não |  |
| `paused_total_milliseconds` | bigint unsigned | não |  |
| `version` | int | não |  |
| `terminal_reason` | varchar(120) | sim |  |
| `initiating_session_id` | varchar(36) | sim |  |
| `active_user_id` | varchar(36) | sim | UK |
| `capped_reason` | varchar(24) | sim |  |
| `kind` | varchar(8) | não |  |
| `pause_count` | int | não |  |

Índices compostos: `IDX_study_sessions_user_id_ended_at_id` (user_id, ended_at, id); `IDX_study_sessions_user_id_started_at` (user_id, started_at).

#### `active_study_sessions`

Ponteiro para a única sessão ativa de cada usuário.

| Coluna | Tipo | Nulo | Chave |
|---|---|---|---|
| `user_id` | varchar(36) | não | PK, FK → `users` |
| `study_session_id` | varchar(36) | não | FK → `study_sessions`, UK |

#### `study_session_start_receipts`

Recibo do comando de início, por chave de idempotência, para repetir a mesma resposta.

| Coluna | Tipo | Nulo | Chave |
|---|---|---|---|
| `user_id` | varchar(36) | não | PK, FK → `users` |
| `idempotency_key` | varchar(128) | não | PK |
| `planned_duration_seconds` | int | sim |  |
| `subject` | varchar(255) | sim |  |
| `initiating_session_id` | varchar(36) | não |  |
| `response_json` | json | não |  |

#### `study_session_transition_receipts`

Recibo de pausa, retomada, parada e conclusão, por chave de idempotência.

| Coluna | Tipo | Nulo | Chave |
|---|---|---|---|
| `user_id` | varchar(36) | não | PK, FK → `users` |
| `study_session_id` | varchar(36) | não | FK → `study_sessions` |
| `idempotency_key` | varchar(128) | não | PK |
| `action` | varchar(16) | não |  |
| `expected_version` | int | não |  |
| `response_json` | json | não |  |
| `created_at` | datetime(3) | não |  |

#### `study_session_command_keys`

Chaves de idempotência já usadas por usuário, em qualquer comando de sessão.

| Coluna | Tipo | Nulo | Chave |
|---|---|---|---|
| `user_id` | varchar(36) | não | PK, FK → `users` |
| `idempotency_key` | varchar(128) | não | PK |
| `command_kind` | varchar(16) | não |  |
| `created_at` | datetime(3) | não |  |

### 4.4 Guildas, Raids e Mural

Estudo cooperativo: Raid semanal contra o chefe da Missão e chat da Guilda.

#### `guilds`

Guilda: nome, nível e criador.

| Coluna | Tipo | Nulo | Chave |
|---|---|---|---|
| `id` | varchar(36) | não | PK |
| `name` | varchar(255) | não | UK |
| `level` | int | não |  |
| `created_by` | varchar(36) | não | FK → `users` |
| `created_at` | datetime(6) | não |  |

#### `guild_memberships`

Membros de cada Guilda e o papel (Líder ou membro). No máximo uma Guilda por usuário.

| Coluna | Tipo | Nulo | Chave |
|---|---|---|---|
| `id` | varchar(36) | não | PK |
| `guild_id` | varchar(36) | não | FK → `guilds` |
| `user_id` | varchar(36) | não | FK → `users`, UK |
| `role` | varchar(255) | não |  |
| `joined_at` | datetime(6) | não |  |

Índices compostos: `UQ_guild_memberships_guild_id_user_id` (guild_id, user_id) único.

#### `guild_chat_messages`

Mensagens do Mural e avisos automáticos dos golpes da Raid, em sequência por Guilda.

| Coluna | Tipo | Nulo | Chave |
|---|---|---|---|
| `id` | varchar(36) | não | PK |
| `guild_id` | varchar(36) | não | FK → `guilds` |
| `user_id` | varchar(36) | não | FK → `users` |
| `body` | text | não |  |
| `sent_at` | datetime(6) | não |  |
| `seq` | bigint | não | UK |
| `kind` | varchar(16) | não |  |
| `contribution_id` | varchar(36) | sim | FK → `raid_contributions`, UK |
| `xp` | int | sim |  |

Índices compostos: `IDX_guild_chat_messages_guild_id_seq` (guild_id, seq).

#### `missions`

Missões de Raid: nome, descrição, arte, ordem no rodízio e preço na Loja.

| Coluna | Tipo | Nulo | Chave |
|---|---|---|---|
| `id` | varchar(36) | não | PK |
| `slug` | varchar(255) | não | UK |
| `name` | varchar(255) | não |  |
| `description` | varchar(140) | não |  |
| `image_url` | varchar(255) | sim |  |
| `rotation_order` | int | sim | UK |
| `price` | int unsigned | sim |  |

#### `mission_reward_items`

Itens que cada Missão dá como recompensa.

| Coluna | Tipo | Nulo | Chave |
|---|---|---|---|
| `mission_id` | varchar(36) | não | PK, FK → `missions` |
| `cosmetic_item_id` | varchar(36) | não | PK, FK → `cosmetic_items` |

#### `guild_mission_choices`

Missão escolhida pelo Líder para a próxima Raid.

| Coluna | Tipo | Nulo | Chave |
|---|---|---|---|
| `guild_id` | varchar(36) | não | PK, FK → `guilds` |
| `mission_id` | varchar(36) | não | FK → `missions` |
| `owner_user_id` | varchar(36) | sim | FK → `users` |
| `chosen_at` | datetime(6) | não |  |

#### `raids`

Raid semanal de uma Guilda: Missão, meta, progresso, vida regenerada pela Fúria do dragão, datas e situação.

| Coluna | Tipo | Nulo | Chave |
|---|---|---|---|
| `id` | varchar(36) | não | PK |
| `guild_id` | varchar(36) | não | FK → `guilds` |
| `mission_id` | varchar(36) | não | FK → `missions` |
| `goal_xp` | int | não |  |
| `progress_xp` | int | não |  |
| `starts_at` | datetime | não |  |
| `ends_at` | datetime | não |  |
| `status` | varchar(255) | não |  |
| `goal_reached_at` | datetime(3) | sim |  |
| `regenerated_xp` | int | não |  |
| `fury_through` | varchar(10) | sim |  |
| `opened_at` | datetime(3) | sim |  |
| `mission_owner_user_id` | varchar(36) | sim |  |

#### `raid_participations`

Usuários que entraram em cada Raid.

| Coluna | Tipo | Nulo | Chave |
|---|---|---|---|
| `id` | varchar(36) | não | PK |
| `raid_id` | varchar(36) | não | FK → `raids` |
| `user_id` | varchar(36) | não | FK → `users` |
| `created_at` | datetime(6) | não |  |

Índices compostos: `UQ_raid_participations_raid_id_user_id` (raid_id, user_id) único.

#### `raid_contributions`

Contribuição de cada sessão de estudo para a Raid (base do Ranking interno).

| Coluna | Tipo | Nulo | Chave |
|---|---|---|---|
| `id` | varchar(36) | não | PK |
| `raid_id` | varchar(36) | não | FK → `raids` |
| `user_id` | varchar(36) | não | FK → `users` |
| `study_session_id` | varchar(36) | sim | FK → `study_sessions`, UK |
| `xp_contributed` | int | não |  |
| `created_at` | datetime(6) | não |  |

Índices compostos: `IDX_raid_contributions_raid_id_user_id` (raid_id, user_id).

### 4.5 Economia e Loja

Moeda do jogo, ganha com foco, Raids e Objetivos e gasta na Loja (ADR-012).

#### `coin_balances`

Saldo de Moedas de cada usuário.

| Coluna | Tipo | Nulo | Chave |
|---|---|---|---|
| `user_id` | varchar(36) | não | PK, FK → `users` |
| `balance` | int unsigned | não |  |
| `updated_at` | datetime(3) | não |  |

#### `coin_ledger_entries`

Extrato: cada crédito e débito de Moedas, uma vez por origem, com o saldo resultante.

| Coluna | Tipo | Nulo | Chave |
|---|---|---|---|
| `id` | varchar(36) | não | PK |
| `user_id` | varchar(36) | não | FK → `users` |
| `amount` | int | não |  |
| `balance_after` | int unsigned | não |  |
| `origin_type` | enum('study-session','raid-win','purchase','signup','migration','objective') | não |  |
| `origin_ref` | varchar(64) | não |  |
| `created_at` | datetime(3) | não |  |

Índices compostos: `IDX_coin_ledger_entries_user_id_created_at_id` (user_id, created_at, id); `UQ_coin_ledger_entries_user_id_origin_type_origin_ref` (user_id, origin_type, origin_ref) único.

#### `user_missions`

Missões compradas por cada usuário na Loja.

| Coluna | Tipo | Nulo | Chave |
|---|---|---|---|
| `id` | varchar(36) | não | PK |
| `user_id` | varchar(36) | não | FK → `users` |
| `mission_id` | varchar(36) | não | FK → `missions` |
| `acquired_at` | datetime(6) | não |  |

Índices compostos: `UQ_user_missions_user_id_mission_id` (user_id, mission_id) único.

### 4.6 Cobrança

Assinatura premium e Pacotes pagos com Stripe em modo de teste (ADR-015).

#### `subscriptions`

Assinatura premium do usuário no Stripe: Customer, assinatura, status e fim do período.

| Coluna | Tipo | Nulo | Chave |
|---|---|---|---|
| `id` | varchar(36) | não | PK |
| `user_id` | varchar(36) | não | FK → `users`, UK |
| `stripe_customer_id` | varchar(255) | não | UK |
| `stripe_subscription_id` | varchar(255) | sim | UK |
| `status` | varchar(32) | sim |  |
| `current_period_end` | datetime | sim |  |
| `cancel_at` | datetime | sim |  |
| `created_at` | datetime(6) | não |  |
| `updated_at` | datetime(6) | não |  |

#### `packs`

Pacotes de itens vendidos por dinheiro (ex.: Pacote do Dragão, R$ 4,90).

| Coluna | Tipo | Nulo | Chave |
|---|---|---|---|
| `id` | varchar(36) | não | PK |
| `slug` | varchar(64) | não | UK |
| `name` | varchar(80) | não |  |
| `description` | varchar(255) | não |  |
| `price_cents` | int | não |  |
| `currency` | char(3) | não |  |
| `for_sale` | tinyint(1) | não |  |
| `created_at` | datetime(6) | não |  |

#### `pack_payments`

Pagamento de um Pacote por um usuário, um por sessão do Checkout.

| Coluna | Tipo | Nulo | Chave |
|---|---|---|---|
| `id` | varchar(36) | não | PK |
| `user_id` | varchar(36) | não | FK → `users` |
| `pack_id` | varchar(36) | não | FK → `packs` |
| `stripe_checkout_session_id` | varchar(255) | não | UK |
| `amount_cents` | int | não |  |
| `currency` | char(3) | não |  |
| `paid_at` | datetime | não |  |

Índices compostos: `UQ_pack_payments_user_id_pack_id` (user_id, pack_id) único.
