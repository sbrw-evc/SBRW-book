# Архитектура / Architecture

> **[🇷🇺 Русский](#русский)** | **[🇬🇧 English](#english)**

---

## Русский

### Обзор системы

```mermaid
graph TB
    subgraph Clients["Клиенты"]
        BROWSER["🌐 Браузер\nосновной UI"]
        ADMINFR["🔧 Браузер\nadmin-панель"]
        EREADER["📖 E-Reader\nOPDS"]
        TGCLIENT["📱 Telegram"]
    end

    subgraph Nginx["Nginx — единая точка входа"]
        P80[":80 — основной сайт"]
        P8080[":8080 — admin-панель"]
    end

    subgraph Frontends["Фронтенды"]
        FE["frontend\nReact 18 + Vite\n:3000"]
        AFE["admin-frontend\nReact 18 + Vite\n:3001"]
    end

    subgraph Backend["Backend — Django 5.1"]
        BE["backend\nDRF + Channels\n:8000"]
        KW["kafka-worker\nasync consumer"]
        BOTS["sbrw-bots\nTelegram боты"]
    end

    subgraph AI["ИИ-слой"]
        LLM["llm-service\nFastAPI\n:8100"]
        OLLAMA["ollama\n:11434"]
        EXTLLM["☁️ Внешние LLM\nClaude / OpenAI\nGemini / DeepSeek"]
    end

    subgraph Data["Слой данных"]
        PG[("PostgreSQL\nпользователи, книги\nнастройки, чат")]
        MDB[("MongoDB\nобсуждения\nрецензии")]
        RDS[("Redis\nкэш, сессии\nTG-очередь")]
        FILES[("book_uploads\nvolume")]
    end

    KAFKA["Apache Kafka\nброкер событий"]

    BROWSER -->|HTTP + WS| P80
    ADMINFR -->|HTTP| P8080
    EREADER -->|OPDS HTTP| P80
    TGCLIENT -->|webhook POST| BE

    P80 --> FE
    P80 -->|/api/| BE
    P80 -->|/ws/| BE
    P80 -->|/opds| BE
    P8080 --> AFE
    P8080 -->|/api/| BE

    BE --> PG & MDB & RDS & FILES
    BE -->|produce| KAFKA
    BE -->|sync call| LLM

    KW -->|consume| KAFKA
    KW --> PG & MDB & FILES
    KW -->|async call| LLM

    BOTS --> PG & RDS

    LLM --> OLLAMA
    LLM -.->|external| EXTLLM

    style Clients fill:#e8f4f8,stroke:#2196F3
    style Nginx fill:#fff3e0,stroke:#FF9800
    style Frontends fill:#f3e5f5,stroke:#9C27B0
    style Backend fill:#e8f5e9,stroke:#4CAF50
    style AI fill:#fce4ec,stroke:#E91E63
    style Data fill:#e3f2fd,stroke:#1565C0
```

### Архитектура Django-приложений

```mermaid
graph LR
    subgraph Config["config/"]
        URLS["urls.py"]
        SETTINGS["settings.py"]
    end

    subgraph Apps["apps/"]
        BOOKS["📚 books/\nКниги, файлы, прогресс\nрейтинги, аннотации"]
        USERS["👤 users/\nАвторизация, 2FA\nсессии, шифрование"]
        CORE["⚙️ core/\nAppSettings, рассылки\nTelegram, VPN, LLM"]
        CHAT["💬 chat/\nWebSocket-чат"]
        DISC["📝 discussions/\nMongoDB — обсуждения"]
        OPDS["📡 opds/\nOPDS 1.1 каталог"]
        TGUP["🤖 telegram_upload/\nAdmin upload-бот"]
    end

    URLS --> BOOKS & USERS & CORE & CHAT & DISC & OPDS & TGUP
```

### Схема базы данных (PostgreSQL)

```mermaid
erDiagram
    User {
        uuid id PK
        string username
        string email_hash "indexed, HMAC"
        string email "encrypted"
        string role "admin|moderator|user"
        bool totp_enabled
        bool telegram_2fa_enabled
    }
    Book {
        uuid id PK
        string title
        string language
        float avg_rating
        int download_count
        bool is_public
        text ai_review
        string ai_review_status "pending|done|error"
    }
    BookFile {
        uuid id PK
        uuid book_id FK
        string format "epub|pdf|fb2|txt"
        string file_path
        string version_label
    }
    Author {
        uuid id PK
        string name
    }
    Series {
        uuid id PK
        string name
    }
    Tag {
        uuid id PK
        string name
    }
    ReadingProgress {
        uuid id PK
        uuid user_id FK
        uuid book_id FK
        string cfi_position
        float percentage
    }
    UserRating {
        uuid id PK
        uuid user_id FK
        uuid book_id FK
        int rating
        text review
    }
    Annotation {
        uuid id PK
        uuid user_id FK
        uuid book_id FK
        string cfi_range
        string color
    }
    Shelf {
        uuid id PK
        uuid user_id FK
        string name
        bool is_public
    }
    AppSettings {
        string key PK
        string value "encrypted"
    }
    TelegramChat {
        uuid user_id FK
        string chat_id "encrypted"
        string chat_id_hash "indexed"
    }

    User ||--o| TelegramChat : linked
    User ||--o{ ReadingProgress : tracks
    User ||--o{ UserRating : rates
    User ||--o{ Annotation : creates
    User ||--o{ Shelf : owns
    Book ||--o{ BookFile : has
    Book }o--o{ Author : written_by
    Book }o--o{ Series : belongs_to
    Book }o--o{ Tag : tagged
    Book ||--o{ ReadingProgress : read_by
    Book ||--o{ UserRating : rated_by
    Book ||--o{ Annotation : annotated
    Shelf }o--o{ Book : contains
```

### Поток событий через Kafka

```mermaid
sequenceDiagram
    participant C as Клиент
    participant BE as Backend
    participant K as Kafka
    participant KW as kafka-worker
    participant LLM as llm-service
    participant DB as PostgreSQL

    rect rgb(232, 245, 232)
        Note over C,DB: Конвертация формата
        C->>BE: POST /books/{id}/convert
        BE->>K: produce(sbrw.book.convert_request)
        BE-->>C: 202 Accepted
        K->>KW: consume
        KW->>KW: конвертация файла
        KW->>DB: сохранить BookFile
    end

    rect rgb(232, 232, 245)
        Note over C,DB: LLM-анализ книги
        C->>BE: POST /books/{id}/analyze
        BE->>DB: ai_review_status = pending
        BE->>K: produce(sbrw.book.llm_analyze)
        BE-->>C: 200 OK
        K->>KW: consume
        KW->>KW: extract_book_text()
        KW->>LLM: POST /analyze
        LLM-->>KW: {review, metadata}
        KW->>DB: ai_review = ..., status = done
    end

    rect rgb(245, 232, 232)
        Note over C,DB: Статистика скачиваний
        C->>BE: GET /books/{id}/download/{fmt}
        BE->>K: produce(sbrw.book.downloaded)
        BE-->>C: file stream
        K->>KW: consume
        KW->>DB: download_count++
    end
```

### Стриминг ИИ-размышлений (SSE)

```mermaid
sequenceDiagram
    participant FE as Frontend (BookEdit)
    participant BE as Backend
    participant LLM as llm-service
    participant PROV as LLM Provider

    FE->>BE: POST /books/{id}/analyze/stream
    BE->>BE: extract_book_text()
    BE-->>FE: data: {"type":"status","message":"Извлечение..."}
    BE->>LLM: POST /analyze-stream (stream=true)
    LLM->>PROV: streaming request
    loop Токены
        PROV-->>LLM: token
        LLM-->>BE: data: {"type":"thinking","content":"token"}
        BE-->>FE: data: {"type":"thinking","content":"token"}
        Note over FE: append to thinking section
    end
    PROV-->>LLM: [DONE]
    LLM-->>BE: data: {"type":"done","review":"..."}
    BE->>BE: Book.update(ai_review=..., status=done)
    BE-->>FE: data: {"type":"done","review":"..."}
    Note over FE: show final review, fill progress to 100%
```

**Таймаут:** 300 секунд на всех уровнях (frontend AbortController → backend requests timeout → LLM service httpx.Timeout). Пользователь может нажать «Остановить» в любой момент.

---

### WebSocket-чат (Django Channels)

```mermaid
graph LR
    B["Браузер\nws://host/ws/chat/{room_id}/"]
    N["Nginx\nUpgrade: websocket"]
    D["Daphne ASGI\nChatConsumer"]
    R["Redis\nChannel Layer"]
    DB["PostgreSQL\nChatMessage"]

    B <-->|WS| N <-->|WS| D
    D <-->|pub/sub| R
    D -->|save| DB
```

---

## English

### System Overview

```mermaid
graph TB
    subgraph Clients["Clients"]
        BROWSER["🌐 Browser\nmain UI"]
        ADMINFR["🔧 Browser\nadmin panel"]
        EREADER["📖 E-Reader\nOPDS"]
        TGCLIENT["📱 Telegram"]
    end

    subgraph Nginx["Nginx — Single Entry Point"]
        P80[":80 — main site"]
        P8080[":8080 — admin panel"]
    end

    subgraph Frontends["Frontends"]
        FE["frontend\nReact 18 + Vite\n:3000"]
        AFE["admin-frontend\nReact 18 + Vite\n:3001"]
    end

    subgraph Backend["Backend — Django 5.1"]
        BE["backend\nDRF + Channels\n:8000"]
        KW["kafka-worker\nasync consumer"]
        BOTS["sbrw-bots\nTelegram bots"]
    end

    subgraph AI["AI Layer"]
        LLM["llm-service\nFastAPI\n:8100"]
        OLLAMA["ollama\n:11434"]
        EXTLLM["☁️ External LLMs\nClaude / OpenAI\nGemini / DeepSeek"]
    end

    subgraph Data["Data Layer"]
        PG[("PostgreSQL\nusers, books\nsettings, chat")]
        MDB[("MongoDB\ndiscussions\nreviews")]
        RDS[("Redis\ncache, sessions\nTG queue")]
        FILES[("book_uploads\nvolume")]
    end

    KAFKA["Apache Kafka\nevent broker"]

    BROWSER -->|HTTP + WS| P80
    ADMINFR -->|HTTP| P8080
    EREADER -->|OPDS HTTP| P80
    TGCLIENT -->|webhook POST| BE

    P80 --> FE
    P80 -->|/api/| BE
    P80 -->|/ws/| BE
    P80 -->|/opds| BE
    P8080 --> AFE
    P8080 -->|/api/| BE

    BE --> PG & MDB & RDS & FILES
    BE -->|produce| KAFKA
    BE -->|sync call| LLM

    KW -->|consume| KAFKA
    KW --> PG & MDB & FILES
    KW -->|async call| LLM

    BOTS --> PG & RDS

    LLM --> OLLAMA
    LLM -.->|external| EXTLLM

    style Clients fill:#e8f4f8,stroke:#2196F3
    style Nginx fill:#fff3e0,stroke:#FF9800
    style Frontends fill:#f3e5f5,stroke:#9C27B0
    style Backend fill:#e8f5e9,stroke:#4CAF50
    style AI fill:#fce4ec,stroke:#E91E63
    style Data fill:#e3f2fd,stroke:#1565C0
```

### Django Application Architecture

```mermaid
graph LR
    subgraph Config["config/"]
        URLS["urls.py"]
        SETTINGS["settings.py"]
    end

    subgraph Apps["apps/"]
        BOOKS["📚 books/\nCatalog, files, progress\nratings, annotations"]
        USERS["👤 users/\nAuth, 2FA\nsessions, encryption"]
        CORE["⚙️ core/\nAppSettings, newsletters\nTelegram, VPN, LLM"]
        CHAT["💬 chat/\nWebSocket chat"]
        DISC["📝 discussions/\nMongoDB discussions"]
        OPDS["📡 opds/\nOPDS 1.1 catalog"]
        TGUP["🤖 telegram_upload/\nAdmin upload bot"]
    end

    URLS --> BOOKS & USERS & CORE & CHAT & DISC & OPDS & TGUP
```

### Database Schema (PostgreSQL)

```mermaid
erDiagram
    User {
        uuid id PK
        string username
        string email_hash "indexed, HMAC"
        string email "encrypted"
        string role "admin|moderator|user"
        bool totp_enabled
        bool telegram_2fa_enabled
    }
    Book {
        uuid id PK
        string title
        string language
        float avg_rating
        int download_count
        bool is_public
        text ai_review
        string ai_review_status "pending|done|error"
    }
    BookFile {
        uuid id PK
        uuid book_id FK
        string format "epub|pdf|fb2|txt"
        string file_path
        string version_label
    }
    Author {
        uuid id PK
        string name
    }
    Series {
        uuid id PK
        string name
    }
    Tag {
        uuid id PK
        string name
    }
    ReadingProgress {
        uuid id PK
        uuid user_id FK
        uuid book_id FK
        string cfi_position
        float percentage
    }
    UserRating {
        uuid id PK
        uuid user_id FK
        uuid book_id FK
        int rating
        text review
    }
    Annotation {
        uuid id PK
        uuid user_id FK
        uuid book_id FK
        string cfi_range
        string color
    }
    Shelf {
        uuid id PK
        uuid user_id FK
        string name
        bool is_public
    }
    AppSettings {
        string key PK
        string value "encrypted"
    }
    TelegramChat {
        uuid user_id FK
        string chat_id "encrypted"
        string chat_id_hash "indexed"
    }

    User ||--o| TelegramChat : linked
    User ||--o{ ReadingProgress : tracks
    User ||--o{ UserRating : rates
    User ||--o{ Annotation : creates
    User ||--o{ Shelf : owns
    Book ||--o{ BookFile : has
    Book }o--o{ Author : written_by
    Book }o--o{ Series : belongs_to
    Book }o--o{ Tag : tagged
    Book ||--o{ ReadingProgress : read_by
    Book ||--o{ UserRating : rated_by
    Book ||--o{ Annotation : annotated
    Shelf }o--o{ Book : contains
```

### Kafka Event Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant BE as Backend
    participant K as Kafka
    participant KW as kafka-worker
    participant LLM as llm-service
    participant DB as PostgreSQL

    rect rgb(232, 245, 232)
        Note over C,DB: Format Conversion
        C->>BE: POST /books/{id}/convert
        BE->>K: produce(sbrw.book.convert_request)
        BE-->>C: 202 Accepted
        K->>KW: consume
        KW->>KW: convert file
        KW->>DB: save BookFile
    end

    rect rgb(232, 232, 245)
        Note over C,DB: LLM Book Analysis
        C->>BE: POST /books/{id}/analyze
        BE->>DB: ai_review_status = pending
        BE->>K: produce(sbrw.book.llm_analyze)
        BE-->>C: 200 OK
        K->>KW: consume
        KW->>KW: extract_book_text()
        KW->>LLM: POST /analyze
        LLM-->>KW: {review, metadata}
        KW->>DB: ai_review = ..., status = done
    end

    rect rgb(245, 232, 232)
        Note over C,DB: Download Statistics
        C->>BE: GET /books/{id}/download/{fmt}
        BE->>K: produce(sbrw.book.downloaded)
        BE-->>C: file stream
        K->>KW: consume
        KW->>DB: download_count++
    end
```

### AI Thinking Stream (SSE)

```mermaid
sequenceDiagram
    participant FE as Frontend (BookEdit)
    participant BE as Backend
    participant LLM as llm-service
    participant PROV as LLM Provider

    FE->>BE: POST /books/{id}/analyze/stream
    BE->>BE: extract_book_text()
    BE-->>FE: data: {"type":"status","message":"Extracting..."}
    BE->>LLM: POST /analyze-stream (stream=true)
    LLM->>PROV: streaming request
    loop Tokens
        PROV-->>LLM: token
        LLM-->>BE: {"type":"thinking","content":"token"}
        BE-->>FE: {"type":"thinking","content":"token"}
        Note over FE: append to thinking section + progress bar
    end
    PROV-->>LLM: done
    LLM-->>BE: {"type":"done","review":"..."}
    BE->>BE: Book.update(ai_review=..., status=done)
    BE-->>FE: {"type":"done","review":"..."}
```

**Timeout:** 300 s at all levels. User can click "Stop" at any time (AbortController).

---

### WebSocket Chat (Django Channels)

```mermaid
graph LR
    B["Browser\nws://host/ws/chat/{room_id}/"]
    N["Nginx\nUpgrade: websocket"]
    D["Daphne ASGI\nChatConsumer"]
    R["Redis\nChannel Layer"]
    DB["PostgreSQL\nChatMessage"]

    B <-->|WS| N <-->|WS| D
    D <-->|pub/sub| R
    D -->|save| DB
```
