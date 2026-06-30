# SBRW-Book Wiki

> **[🇷🇺 Русский](#русский)**  |  **[🇬🇧 English](#english)**

---

## Русский

**SBRW-Book** — самохостируемая цифровая библиотека с онлайн-читалкой, ИИ-рецензиями, OPDS-каталогом и Telegram-интеграцией. Развёртывается одной командой `docker compose up -d`.

### Разделы документации

| Раздел | Описание |
|--------|---------|
| [[Getting-Started]] | Установка, первый запуск, мастер настройки |
| [[System-Requirements]] | Железо, ОС, версии Docker |
| [[Technology-Stack]] | Все используемые технологии и библиотеки |
| [[Architecture]] | Схемы системы, бэкенда, баз данных и потоков данных |
| [[Business-Processes]] | Диаграммы ключевых сценариев работы |
| [[Configuration]] | Переменные окружения, AppSettings, SMTP, Telegram, LLM |
| [[API-Overview]] | Ключевые эндпоинты и схема аутентификации |

### Быстрый старт

```bash
git clone https://github.com/sbrw-evc/SBRW-book.git sbrw-book && cd sbrw-book
cp .env.example .env   # задайте SECRET_KEY и POSTGRES_PASSWORD
docker compose up -d
# http://localhost      — библиотека
# http://localhost:8080 — администрирование
```

### Ключевые возможности

- **Мультиформатная библиотека** — EPUB, PDF, FB2, TXT с конвертацией форматов
- **Онлайн-читалка** — EPUB (epub.js), PDF (pdf.js), синхронизация позиции по CFI
- **Поиск метаданных** — Google Books, Open Library, ЛитРес, Author.Today, Fantlab
- **ИИ-рецензии** — локально (Ollama) или облачно (Claude, OpenAI, Gemini, DeepSeek)
- **OPDS** — каталог для KOReader, Moonreader, Marvin и других e-reader
- **Telegram-боты** — 2FA-бот и бот загрузки книг для администраторов
- **WebSocket-чат** — встроенный мессенджер с историей и вложениями
- **Шифрование данных** — персональные данные шифруются на уровне полей БД

---

## English

**SBRW-Book** is a self-hosted digital library with an online reader, AI-generated reviews, an OPDS catalog, and Telegram integration. Deploy with `docker compose up -d`.

### Documentation Sections

| Section | Description |
|---------|-------------|
| [[Getting-Started]] | Installation, first run, setup wizard |
| [[System-Requirements]] | Hardware, OS, Docker versions |
| [[Technology-Stack]] | All technologies and libraries used |
| [[Architecture]] | System, backend, database, and data-flow diagrams |
| [[Business-Processes]] | Diagrams of key user scenarios |
| [[Configuration]] | Environment variables, AppSettings, SMTP, Telegram, LLM |
| [[API-Overview]] | Key endpoints and authentication scheme |

### Quick Start

```bash
git clone https://github.com/sbrw-evc/SBRW-book.git sbrw-book && cd sbrw-book
cp .env.example .env   # set SECRET_KEY and POSTGRES_PASSWORD
docker compose up -d
# http://localhost      — library
# http://localhost:8080 — administration
```

### Key Features

- **Multi-format library** — EPUB, PDF, FB2, TXT with format conversion
- **Online reader** — EPUB (epub.js), PDF (pdf.js), progress sync via CFI
- **Metadata search** — Google Books, Open Library, LitRes, Author.Today, Fantlab
- **AI reviews** — locally (Ollama) or cloud-based (Claude, OpenAI, Gemini, DeepSeek)
- **OPDS catalog** — for KOReader, Moonreader, Marvin, and other e-readers
- **Telegram bots** — 2FA bot and admin book upload bot
- **WebSocket chat** — built-in messenger with history and attachments
- **Data encryption** — personal data encrypted at the database field level

---

> **Примечание / Note:** Mermaid-диаграммы поддерживаются в GitLab Wiki нативно (GitLab ≥ 14.7).
> Mermaid diagrams are natively supported in GitLab Wiki (GitLab ≥ 14.7).
