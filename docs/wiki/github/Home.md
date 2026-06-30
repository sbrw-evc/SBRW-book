# SBRW-Book Wiki

> **[🇷🇺 Русский](#русский)**  |  **[🇬🇧 English](#english)**

---

## Русский

**SBRW-Book** — самохостируемая цифровая библиотека с онлайн-читалкой, ИИ-рецензиями, OPDS-каталогом и Telegram-интеграцией. Развёртывается одной командой `docker compose up -d`.

### Скриншоты

<p align="center">
  <img src="https://raw.githubusercontent.com/sbrw-evc/SBRW-book/main/docs/screenshots/home.png" width="49%" alt="Главная страница" />
  <img src="https://raw.githubusercontent.com/sbrw-evc/SBRW-book/main/docs/screenshots/library.png" width="49%" alt="Библиотека" />
</p>
<p align="center">
  <img src="https://raw.githubusercontent.com/sbrw-evc/SBRW-book/main/docs/screenshots/book-detail.png" width="49%" alt="Страница книги" />
  <img src="https://raw.githubusercontent.com/sbrw-evc/SBRW-book/main/docs/screenshots/login.png" width="49%" alt="Вход в аккаунт" />
</p>

### Разделы документации

| Раздел | Описание |
|--------|---------|
| [Начало работы](Getting-Started) | Установка, первый запуск, мастер настройки |
| [Системные требования](System-Requirements) | Железо, ОС, версии Docker |
| [Стек технологий](Technology-Stack) | Все используемые технологии и библиотеки |
| [Архитектура](Architecture) | Схемы системы, бэкенда, баз данных и потоков данных |
| [Бизнес-процессы](Business-Processes) | Диаграммы ключевых сценариев работы |
| [Конфигурация](Configuration) | Переменные окружения, AppSettings, SMTP, Telegram, LLM |
| [Обзор API](API-Overview) | Ключевые эндпоинты и схема аутентификации |

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

### Screenshots

<p align="center">
  <img src="https://raw.githubusercontent.com/sbrw-evc/SBRW-book/main/docs/screenshots/home_en.png" width="49%" alt="Home page" />
  <img src="https://raw.githubusercontent.com/sbrw-evc/SBRW-book/main/docs/screenshots/library_en.png" width="49%" alt="Library" />
</p>
<p align="center">
  <img src="https://raw.githubusercontent.com/sbrw-evc/SBRW-book/main/docs/screenshots/book-detail_en.png" width="49%" alt="Book detail" />
  <img src="https://raw.githubusercontent.com/sbrw-evc/SBRW-book/main/docs/screenshots/login_en.png" width="49%" alt="Login" />
</p>

### Documentation Sections

| Section | Description |
|---------|-------------|
| [Getting Started](Getting-Started) | Installation, first run, setup wizard |
| [System Requirements](System-Requirements) | Hardware, OS, Docker versions |
| [Technology Stack](Technology-Stack) | All technologies and libraries used |
| [Architecture](Architecture) | System, backend, database, and data-flow diagrams |
| [Business Processes](Business-Processes) | Diagrams of key user scenarios |
| [Configuration](Configuration) | Environment variables, AppSettings, SMTP, Telegram, LLM |
| [API Overview](API-Overview) | Key endpoints and authentication scheme |

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
