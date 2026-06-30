# Конфигурация / Configuration

> **[🇷🇺 Русский](#русский)** | **[🇬🇧 English](#english)**

---

## Русский

### Переменные окружения (`.env`)

#### Обязательные

| Переменная | По умолчанию | Описание |
|-----------|-------------|---------|
| `SECRET_KEY` | — | Django secret key (≥ 50 символов). Генерация: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"` |
| `POSTGRES_PASSWORD` | `bookpass` | Пароль PostgreSQL |

#### База данных

| Переменная | По умолчанию | Описание |
|-----------|-------------|---------|
| `POSTGRES_USER` | `bookuser` | Пользователь PostgreSQL |
| `POSTGRES_DB` | `bookdb` | Имя базы данных PostgreSQL |
| `POSTGRES_HOST` | `db` | Хост PostgreSQL (имя сервиса Docker) |
| `POSTGRES_PORT` | `5432` | Порт PostgreSQL |
| `MONGODB_URL` | `mongodb://mongodb:27017/sbrwdb` | URI подключения MongoDB |
| `MONGODB_DB` | `sbrwdb` | Имя базы данных MongoDB |
| `REDIS_URL` | `redis://redis:6379/0` | URI подключения Redis |

#### Безопасность

| Переменная | По умолчанию | Описание |
|-----------|-------------|---------|
| `FIELD_ENCRYPTION_KEY` | `""` | Base64 32-байтовый ключ для шифрования полей. Генерация: `openssl rand -base64 32` |
| `DEBUG` | `false` | Режим отладки Django. В production — всегда `false` |

#### Файлы и загрузки

| Переменная | По умолчанию | Описание |
|-----------|-------------|---------|
| `UPLOAD_DIR` | `/app/uploads` | Путь к директории хранения файлов внутри контейнера |
| `MAX_UPLOAD_SIZE` | `524288000` | Максимальный размер загружаемого файла (байты). Дефолт = 500 МБ |

#### Очередь событий

| Переменная | По умолчанию | Описание |
|-----------|-------------|---------|
| `KAFKA_BOOTSTRAP_SERVERS` | `kafka:9092` | Адрес Kafka-брокера |

#### ИИ-сервис

| Переменная | По умолчанию | Описание |
|-----------|-------------|---------|
| `LLM_SERVICE_URL` | `http://llm:8100` | URL FastAPI LLM-прокси |
| `OLLAMA_URL` | `http://ollama:11434` | URL Ollama (для LLM-сервиса) |

#### Метаданные книг

| Переменная | По умолчанию | Описание |
|-----------|-------------|---------|
| `GOOGLE_BOOKS_API_KEY` | `""` | API-ключ Google Books (без него работает с ограничениями) |

#### Nginx / Порты

| Переменная | По умолчанию | Описание |
|-----------|-------------|---------|
| `APP_PORT` | `80` | Порт основного сайта |
| `ADMIN_PORT` | `8080` | Порт admin-панели |

---

### Настройки приложения (AppSettings)

Чувствительные настройки хранятся в таблице `core.AppSettings` PostgreSQL в зашифрованном виде (Fernet). Управляются через **Настройки → Основные** в admin-панели.

#### Основные

| Ключ | Описание |
|------|---------|
| `app_name` | Название приложения (отображается в UI и письмах) |

#### SMTP (email)

| Ключ | Описание |
|------|---------|
| `smtp_host` | Адрес SMTP-сервера |
| `smtp_port` | Порт (обычно 587 для TLS, 465 для SSL) |
| `smtp_user` | Логин SMTP |
| `smtp_password` | Пароль SMTP (шифруется) |
| `email_from` | Адрес отправителя |

#### Telegram-бот (2FA и уведомления)

| Ключ | Описание |
|------|---------|
| `telegram_bot_token` | Токен бота (шифруется). Получить у @BotFather |
| `telegram_bot_username` | Username бота без @ |
| `telegram_enabled` | `true` / `false` — включить интеграцию |

#### Telegram-бот загрузки (для администраторов)

| Ключ | Описание |
|------|---------|
| `telegram_upload_bot_token` | Токен бота загрузки (шифруется) |
| `telegram_upload_bot_username` | Username бота загрузки |

#### ИИ-ассистент

| Ключ | Описание |
|------|---------|
| `llm_enabled` | `true` / `false` — включить ИИ |
| `llm_provider` | `local` / `claude` / `openai` / `gemini` / `deepseek` |
| `llm_api_key` | API-ключ для внешнего провайдера (шифруется) |
| `llm_model` | Имя модели (пусто = модель по умолчанию провайдера) |
| `llm_ollama_url` | URL Ollama (по умолчанию `http://ollama:11434`) |

#### VPN

| Ключ | Описание |
|------|---------|
| `wireguard_config` | Конфигурация WireGuard (шифруется) |

---

### Настройка SMTP

1. Перейдите в admin-панель (`http://localhost:8080`)
2. Откройте **Настройки → Email**
3. Заполните поля SMTP-сервера
4. Нажмите **Тест** для проверки подключения

Пример для Gmail:
```
SMTP Host: smtp.gmail.com
Port: 587
User: your@gmail.com
Password: app-specific-password (не основной пароль!)
```

---

### Настройка Telegram-ботов

#### 1. Создайте бота

1. Откройте Telegram → @BotFather
2. `/newbot` → введите имя → введите username
3. Скопируйте токен

#### 2. Настройте webhook

В admin-панели → **Настройки → Telegram**:
1. Введите токен и username
2. Нажмите **Включить**
3. Нажмите **Установить webhook** — приложение само настроит Telegram

Для webhook нужен публичный HTTPS-домен.

---

### Настройка ИИ-ассистента

#### Локальная LLM (Ollama)

1. Admin-панель → **Настройки → ИИ-ассистент**
2. Включите тумблер
3. Провайдер: **Локальная (Ollama)**
4. URL Ollama: `http://ollama:11434` (по умолчанию)
5. В секции «Модели Ollama» → введите имя модели → **Скачать**
6. Рекомендуемые модели:
   - `qwen2.5:1.5b` — быстрая, 1.3 ГБ
   - `phi3.5:mini` — хорошее качество, 2.2 ГБ
   - `llama3.2:3b` — баланс скорости и качества, 2.6 ГБ
7. Сохраните и нажмите **Тест**

#### Внешний провайдер (пример: Claude)

1. Получите API-ключ на console.anthropic.com
2. Admin-панель → **Настройки → ИИ-ассистент**
3. Провайдер: **Claude (Anthropic)**
4. Вставьте API-ключ
5. Модель: `claude-haiku-4-5-20251001` (или другая)
6. Сохраните и нажмите **Тест**

---

## English

### Environment Variables (`.env`)

#### Required

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | — | Django secret key (≥ 50 chars). Generate: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"` |
| `POSTGRES_PASSWORD` | `bookpass` | PostgreSQL password |

#### Database

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_USER` | `bookuser` | PostgreSQL user |
| `POSTGRES_DB` | `bookdb` | PostgreSQL database name |
| `POSTGRES_HOST` | `db` | PostgreSQL host (Docker service name) |
| `POSTGRES_PORT` | `5432` | PostgreSQL port |
| `MONGODB_URL` | `mongodb://mongodb:27017/sbrwdb` | MongoDB connection URI |
| `MONGODB_DB` | `sbrwdb` | MongoDB database name |
| `REDIS_URL` | `redis://redis:6379/0` | Redis connection URI |

#### Security

| Variable | Default | Description |
|----------|---------|-------------|
| `FIELD_ENCRYPTION_KEY` | `""` | Base64 32-byte key for field encryption. Generate: `openssl rand -base64 32` |
| `DEBUG` | `false` | Django debug mode. Always `false` in production |

#### Files & Uploads

| Variable | Default | Description |
|----------|---------|-------------|
| `UPLOAD_DIR` | `/app/uploads` | File storage path inside the container |
| `MAX_UPLOAD_SIZE` | `524288000` | Maximum upload size in bytes (default = 500 MB) |

#### Event Queue

| Variable | Default | Description |
|----------|---------|-------------|
| `KAFKA_BOOTSTRAP_SERVERS` | `kafka:9092` | Kafka broker address |

#### AI Service

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_SERVICE_URL` | `http://llm:8100` | FastAPI LLM proxy URL |
| `OLLAMA_URL` | `http://ollama:11434` | Ollama URL (for the LLM service) |

#### Book Metadata

| Variable | Default | Description |
|----------|---------|-------------|
| `GOOGLE_BOOKS_API_KEY` | `""` | Google Books API key (works with limits without it) |

#### Nginx / Ports

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_PORT` | `80` | Main site port |
| `ADMIN_PORT` | `8080` | Admin panel port |

---

### Application Settings (AppSettings)

Sensitive settings are stored encrypted (Fernet) in the `core.AppSettings` PostgreSQL table. Managed via **Settings** in the admin panel.

#### General

| Key | Description |
|-----|-------------|
| `app_name` | Application name (shown in UI and emails) |

#### SMTP (email)

| Key | Description |
|-----|-------------|
| `smtp_host` | SMTP server address |
| `smtp_port` | Port (587 for TLS, 465 for SSL) |
| `smtp_user` | SMTP login |
| `smtp_password` | SMTP password (encrypted) |
| `email_from` | Sender address |

#### Telegram Bot (2FA and notifications)

| Key | Description |
|-----|-------------|
| `telegram_bot_token` | Bot token (encrypted). Obtain from @BotFather |
| `telegram_bot_username` | Bot username without @ |
| `telegram_enabled` | `true` / `false` — enable integration |

#### Telegram Upload Bot (for admins)

| Key | Description |
|-----|-------------|
| `telegram_upload_bot_token` | Upload bot token (encrypted) |
| `telegram_upload_bot_username` | Upload bot username |

#### AI Assistant

| Key | Description |
|-----|-------------|
| `llm_enabled` | `true` / `false` — enable AI |
| `llm_provider` | `local` / `claude` / `openai` / `gemini` / `deepseek` |
| `llm_api_key` | API key for external provider (encrypted) |
| `llm_model` | Model name (empty = provider default) |
| `llm_ollama_url` | Ollama URL (default `http://ollama:11434`) |

#### VPN

| Key | Description |
|-----|-------------|
| `wireguard_config` | WireGuard configuration (encrypted) |

---

### SMTP Setup

1. Open admin panel (`http://localhost:8080`)
2. Go to **Settings → Email**
3. Fill in the SMTP server details
4. Click **Test** to verify the connection

Example for Gmail:
```
SMTP Host: smtp.gmail.com
Port: 587
User: your@gmail.com
Password: app-specific-password (not your main password!)
```

---

### Telegram Bot Setup

#### 1. Create a bot

1. Open Telegram → @BotFather
2. `/newbot` → enter name → enter username
3. Copy the token

#### 2. Set up webhook

In admin panel → **Settings → Telegram**:
1. Enter token and username
2. Click **Enable**
3. Click **Set Webhook** — the app will configure Telegram automatically

A public HTTPS domain is required for webhooks.

---

### AI Assistant Setup

#### Local LLM (Ollama)

1. Admin panel → **Settings → AI Assistant**
2. Enable the toggle
3. Provider: **Local (Ollama)**
4. Ollama URL: `http://ollama:11434` (default)
5. In the "Ollama Models" section → enter model name → **Pull**
6. Recommended models:
   - `qwen2.5:1.5b` — fast, 1.3 GB
   - `phi3.5:mini` — good quality, 2.2 GB
   - `llama3.2:3b` — balanced speed and quality, 2.6 GB
7. Save and click **Test**

#### External Provider (example: Claude)

1. Obtain an API key at console.anthropic.com
2. Admin panel → **Settings → AI Assistant**
3. Provider: **Claude (Anthropic)**
4. Paste the API key
5. Model: `claude-haiku-4-5-20251001` (or another)
6. Save and click **Test**
