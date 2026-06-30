# Стек технологий / Technology Stack

> **[🇷🇺 Русский](#русский)** | **[🇬🇧 English](#english)**

---

## Русский

### Схема стека

```
┌──────────────────────────────────────────────────────────────────┐
│                       SBRW-Book v1.0.0                           │
├──────────────────┬──────────────────┬────────────────────────────┤
│  Frontend        │  Admin Frontend  │  LLM Service               │
│  React 18 + Vite │  React 18 + Vite │  FastAPI + httpx           │
├──────────────────┴──────────────────┴────────────────────────────┤
│                    Backend — Django 5.1                           │
│        DRF · Django Channels · Kafka Consumer · Daphne           │
├──────────┬──────────┬──────────────┬────────────┬────────────────┤
│PostgreSQL│ MongoDB  │    Redis     │   Kafka    │   Ollama       │
│   16     │    7     │      7       │  (latest)  │  (latest)      │
└──────────┴──────────┴──────────────┴────────────┴────────────────┘
                     Nginx (:80 / :8080)
```

### Backend

#### Основной фреймворк

| Библиотека | Версия | Назначение |
|------------|--------|-----------|
| **Django** | 5.1.4 | Web-фреймворк, ORM, миграции |
| **djangorestframework** | 3.15.2 | REST API, сериализаторы |
| **djangorestframework-simplejwt** | 5.3.1 | JWT-аутентификация |
| **django-cors-headers** | 4.6.0 | CORS |
| **daphne** | 4.1.2 | ASGI-сервер (HTTP + WebSocket) |
| **channels** | 4.2.0 | WebSocket (чат, обсуждения) |
| **channels-redis** | 4.2.1 | Redis channel layer |
| **gunicorn** | 23.0.0 | WSGI production-сервер |

#### Базы данных и кэш

| Библиотека | Версия | Назначение |
|------------|--------|-----------|
| **psycopg2-binary** | 2.9.10 | Драйвер PostgreSQL |
| **django-redis** | 5.4.0 | Redis-кэш Django |
| **redis** | 5.2.1 | Redis клиент |
| **pymongo** | 4.10.1 | MongoDB (обсуждения) |

#### Файловая обработка

| Библиотека | Версия | Назначение |
|------------|--------|-----------|
| **ebooklib** | 0.18 | Разбор EPUB |
| **pypdf** | 5.1.0 | Разбор PDF |
| **Pillow** | 11.0.0 | Обработка изображений |

#### Интеграции и безопасность

| Библиотека | Версия | Назначение |
|------------|--------|-----------|
| **confluent-kafka** | 2.6.1 | Kafka producer/consumer |
| **requests** | 2.32.3 | HTTP-запросы (метаданные) |
| **cryptography** | 44.0.0 | Шифрование полей (Fernet/AES) |
| **pyotp** | 2.9.0 | TOTP-генератор для 2FA |
| **qrcode** | 8.8 | QR-код для Authenticator |

### LLM Service (FastAPI)

| Библиотека | Версия | Назначение |
|------------|--------|-----------|
| **fastapi** | 0.115.5 | REST API |
| **uvicorn[standard]** | 0.32.1 | ASGI-сервер |
| **httpx** | 0.28.0 | Async HTTP к LLM-провайдерам |
| **pydantic** | 2.10.3 | Валидация запросов/ответов |

#### LLM-провайдеры

| Провайдер | Модель по умолчанию | Протокол |
|-----------|-------------------|---------|
| **Ollama** (локально) | qwen2.5:1.5b | Ollama HTTP API |
| **Claude** | claude-haiku-4-5-20251001 | Anthropic Messages API |
| **OpenAI** | gpt-4o-mini | Chat Completions API |
| **Gemini** | gemini-2.0-flash | Google generateContent API |
| **DeepSeek** | deepseek-chat | OpenAI-совместимый API |

### Frontend (пользовательский)

| Библиотека | Версия | Назначение |
|------------|--------|-----------|
| **React** | 18.3.1 | UI-фреймворк |
| **Vite** | latest | Сборщик |
| **React Router DOM** | 6.28.0 | SPA-роутинг |
| **Zustand** | 5.0.2 | Глобальное состояние |
| **TanStack Query** | 5.62.9 | Серверное состояние и кэш |
| **axios** | 1.7.9 | HTTP-клиент с JWT interceptors |
| **epub.js** | 0.3.93 | EPUB-читалка в браузере |
| **pdfjs-dist** | 4.9.155 | PDF-читалка в браузере |
| **react-dropzone** | 14.3.5 | Drag-and-drop загрузка |
| **react-easy-crop** | 6.0.2 | Обрезка изображений |
| **lucide-react** | 0.468.0 | Иконки |
| **react-hot-toast** | 2.4.1 | Уведомления |
| **emoji-picker-react** | 4.19.1 | Пикер эмодзи в чате |

### Admin Frontend (дополнительно)

| Библиотека | Версия | Назначение |
|------------|--------|-----------|
| **recharts** | 2.15.0 | Графики аналитики |

### Инфраструктура

| Компонент | Образ | Назначение |
|-----------|-------|-----------|
| **PostgreSQL** | postgres:16-alpine | Основная реляционная БД |
| **MongoDB** | mongo:7 | Обсуждения и рецензии |
| **Redis** | redis:7-alpine | Кэш, WebSocket channel layer, TG-очередь |
| **Apache Kafka** | apache/kafka:latest | Очередь событий |
| **Ollama** | ollama/ollama:latest | Хостинг локальных LLM |
| **Nginx** | nginx:alpine | Обратный прокси |

### Протоколы и стандарты

| Протокол | Применение |
|---------|-----------|
| **OPDS 1.1** | Каталог для e-reader |
| **WebSocket (RFC 6455)** | Чат в реальном времени |
| **SSE** | Прогресс загрузки LLM-модели |
| **JWT (RFC 7519)** | API-аутентификация |
| **TOTP (RFC 6238)** | Двухфакторная аутентификация |
| **CFI (EPUB 3.0)** | Позиции в EPUB (прогресс, аннотации) |
| **WireGuard** | VPN-конфигурации |

---

## English

### Stack Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                       SBRW-Book v1.0.0                           │
├──────────────────┬──────────────────┬────────────────────────────┤
│  Frontend        │  Admin Frontend  │  LLM Service               │
│  React 18 + Vite │  React 18 + Vite │  FastAPI + httpx           │
├──────────────────┴──────────────────┴────────────────────────────┤
│                    Backend — Django 5.1                           │
│        DRF · Django Channels · Kafka Consumer · Daphne           │
├──────────┬──────────┬──────────────┬────────────┬────────────────┤
│PostgreSQL│ MongoDB  │    Redis     │   Kafka    │   Ollama       │
│   16     │    7     │      7       │  (latest)  │  (latest)      │
└──────────┴──────────┴──────────────┴────────────┴────────────────┘
                     Nginx (:80 / :8080)
```

### Backend

#### Core Framework

| Library | Version | Purpose |
|---------|---------|---------|
| **Django** | 5.1.4 | Web framework, ORM, migrations |
| **djangorestframework** | 3.15.2 | REST API, serializers |
| **djangorestframework-simplejwt** | 5.3.1 | JWT authentication |
| **django-cors-headers** | 4.6.0 | CORS |
| **daphne** | 4.1.2 | ASGI server (HTTP + WebSocket) |
| **channels** | 4.2.0 | WebSocket (chat, discussions) |
| **channels-redis** | 4.2.1 | Redis channel layer |
| **gunicorn** | 23.0.0 | WSGI production server |

#### Databases & Cache

| Library | Version | Purpose |
|---------|---------|---------|
| **psycopg2-binary** | 2.9.10 | PostgreSQL driver |
| **django-redis** | 5.4.0 | Django Redis cache |
| **redis** | 5.2.1 | Redis client |
| **pymongo** | 4.10.1 | MongoDB (discussions) |

#### File Processing

| Library | Version | Purpose |
|---------|---------|---------|
| **ebooklib** | 0.18 | EPUB parsing |
| **pypdf** | 5.1.0 | PDF parsing |
| **Pillow** | 11.0.0 | Image processing |

#### Integrations & Security

| Library | Version | Purpose |
|---------|---------|---------|
| **confluent-kafka** | 2.6.1 | Kafka producer/consumer |
| **requests** | 2.32.3 | HTTP requests (metadata APIs) |
| **cryptography** | 44.0.0 | Field-level encryption (Fernet/AES) |
| **pyotp** | 2.9.0 | TOTP generator for 2FA |
| **qrcode** | 8.8 | QR code for Authenticator setup |

### LLM Service (FastAPI)

| Library | Version | Purpose |
|---------|---------|---------|
| **fastapi** | 0.115.5 | REST API |
| **uvicorn[standard]** | 0.32.1 | ASGI server |
| **httpx** | 0.28.0 | Async HTTP to LLM providers |
| **pydantic** | 2.10.3 | Request/response validation |

#### Supported LLM Providers

| Provider | Default Model | Protocol |
|----------|--------------|---------|
| **Ollama** (local) | qwen2.5:1.5b | Ollama HTTP API |
| **Claude** | claude-haiku-4-5-20251001 | Anthropic Messages API |
| **OpenAI** | gpt-4o-mini | Chat Completions API |
| **Gemini** | gemini-2.0-flash | Google generateContent API |
| **DeepSeek** | deepseek-chat | OpenAI-compatible API |

### User Frontend

| Library | Version | Purpose |
|---------|---------|---------|
| **React** | 18.3.1 | UI framework |
| **Vite** | latest | Build tool |
| **React Router DOM** | 6.28.0 | SPA routing |
| **Zustand** | 5.0.2 | Global state |
| **TanStack Query** | 5.62.9 | Server state and caching |
| **axios** | 1.7.9 | HTTP client with JWT interceptors |
| **epub.js** | 0.3.93 | In-browser EPUB reader |
| **pdfjs-dist** | 4.9.155 | In-browser PDF reader |
| **react-dropzone** | 14.3.5 | Drag-and-drop file upload |
| **react-easy-crop** | 6.0.2 | Image cropping |
| **lucide-react** | 0.468.0 | Icons |
| **react-hot-toast** | 2.4.1 | Toast notifications |
| **emoji-picker-react** | 4.19.1 | Emoji picker in chat |

### Admin Frontend (additional)

| Library | Version | Purpose |
|---------|---------|---------|
| **recharts** | 2.15.0 | Analytics charts |

### Infrastructure

| Component | Image | Purpose |
|-----------|-------|---------|
| **PostgreSQL** | postgres:16-alpine | Primary relational database |
| **MongoDB** | mongo:7 | Discussions and reviews |
| **Redis** | redis:7-alpine | Cache, WebSocket channel layer, TG queue |
| **Apache Kafka** | apache/kafka:latest | Event queue |
| **Ollama** | ollama/ollama:latest | Local LLM hosting |
| **Nginx** | nginx:alpine | Reverse proxy |

### Protocols & Standards

| Protocol | Usage |
|---------|-------|
| **OPDS 1.1** | E-reader catalog |
| **WebSocket (RFC 6455)** | Real-time chat |
| **SSE** | LLM model download progress |
| **JWT (RFC 7519)** | API authentication |
| **TOTP (RFC 6238)** | Two-factor authentication |
| **CFI (EPUB 3.0)** | EPUB positions (progress, annotations) |
| **WireGuard** | VPN configurations |
