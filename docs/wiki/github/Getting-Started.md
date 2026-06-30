# Начало работы / Getting Started

> **[🇷🇺 Русский](#русский)** | **[🇬🇧 English](#english)**

---

## Русский

### Предварительные требования

| Компонент | Минимум | Рекомендуется |
|-----------|---------|--------------|
| Docker Engine | 24.0 | последняя стабильная |
| Docker Compose | 2.20 (plugin) | последняя стабильная |
| RAM | 4 ГБ | 8 ГБ (с локальной LLM — 12 ГБ) |
| CPU | 2 ядра | 4+ ядра |
| Диск | 20 ГБ | 100+ ГБ для большой библиотеки |
| ОС | Linux / macOS / Windows + WSL2 | Ubuntu 22.04+ |

### Установка

#### 1. Клонирование репозитория

```bash
git clone https://github.com/sbrw-evc/SBRW-book.git sbrw-book
cd sbrw-book
```

#### 2. Настройка окружения

```bash
cp .env.example .env
```

Заполните обязательные переменные в `.env`:

```env
# Обязательно
SECRET_KEY=замените-на-длинную-случайную-строку-минимум-50-символов
POSTGRES_PASSWORD=надёжный-пароль

# Рекомендуется для production
FIELD_ENCRYPTION_KEY=    # openssl rand -base64 32
```

Полный список переменных — в разделе [Конфигурация](Configuration).

#### 3. Запуск

```bash
docker compose up -d
```

При первом запуске Docker скачает все образы (~3 ГБ включая Ollama). Последующие запуски занимают несколько секунд.

#### 4. Проверка работоспособности

```bash
docker compose ps           # все сервисы должны быть Up
curl http://localhost/api/health   # {"status": "ok"}
```

### Мастер настройки (первый запуск)

При первом открытии `http://localhost` вы будете перенаправлены на `/setup`. Мастер поможет:

1. Создать учётную запись администратора
2. Указать название приложения
3. Настроить SMTP (опционально, для верификации email)

После завершения мастера эндпоинт `/setup` автоматически отключается.

### Структура каталогов

```
sbrw-book/
├── backend/           # Django REST API + Kafka worker + Telegram bots
│   ├── apps/
│   │   ├── books/         # Каталог, файлы, прогресс, рейтинги, аннотации
│   │   ├── users/         # Пользователи, сессии, 2FA, шифрование
│   │   ├── core/          # Настройки, рассылки, Telegram, VPN, LLM-клиент
│   │   ├── chat/          # WebSocket-чат
│   │   ├── discussions/   # MongoDB — обсуждения и рецензии
│   │   ├── opds/          # OPDS 1.1 каталог
│   │   └── telegram_upload/ # Бот загрузки
│   └── config/            # Django settings и URL-роутер
├── frontend/          # Пользовательский интерфейс (React + Vite)
├── admin-frontend/    # Панель администратора (React + Vite)
├── llm-service/       # FastAPI LLM-прокси
├── nginx/             # Конфигурация Nginx
├── docs/wiki/         # Исходники wiki
├── docker-compose.yml
├── .env.example
└── k8s.yaml           # Kubernetes манифест
```

### Обновление

```bash
git pull
docker compose build
docker compose up -d
docker exec sbrw_backend python manage.py migrate
```

### Полезные команды

```bash
# Логи конкретного сервиса
docker compose logs -f backend

# Применить миграции вручную
docker exec sbrw_backend python manage.py migrate

# Django shell
docker exec -it sbrw_backend python manage.py shell

# Скачать Ollama-модель
docker exec sbrw_ollama ollama pull qwen2.5:1.5b

# Перезапустить сервис
docker compose restart backend
```

### Остановка

```bash
docker compose down          # остановить без удаления данных
docker compose down -v       # остановить и удалить все данные (необратимо!)
```

---

## English

### Prerequisites

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Docker Engine | 24.0 | latest stable |
| Docker Compose | 2.20 (plugin) | latest stable |
| RAM | 4 GB | 8 GB (12 GB with local LLM) |
| CPU | 2 cores | 4+ cores |
| Disk | 20 GB | 100+ GB for a large library |
| OS | Linux / macOS / Windows + WSL2 | Ubuntu 22.04+ |

### Installation

#### 1. Clone the repository

```bash
git clone https://github.com/sbrw-evc/SBRW-book.git sbrw-book
cd sbrw-book
```

#### 2. Configure environment

```bash
cp .env.example .env
```

Set the required variables in `.env`:

```env
# Required
SECRET_KEY=replace-with-a-long-random-string-at-least-50-chars
POSTGRES_PASSWORD=strong-password

# Recommended for production
FIELD_ENCRYPTION_KEY=    # openssl rand -base64 32
```

Full variable list in the [Configuration](Configuration) section.

#### 3. Start

```bash
docker compose up -d
```

On the first run, Docker will download all images (~3 GB including Ollama). Subsequent starts take a few seconds.

#### 4. Health check

```bash
docker compose ps           # all services should be Up
curl http://localhost/api/health   # {"status": "ok"}
```

### Setup Wizard (first run)

On the first visit to `http://localhost` you will be redirected to `/setup`. The wizard will guide you through:

1. Creating an administrator account
2. Setting the application name
3. Configuring SMTP (optional, for email verification)

After completing the wizard, the `/setup` endpoint is automatically disabled.

### Directory Structure

```
sbrw-book/
├── backend/           # Django REST API + Kafka worker + Telegram bots
│   ├── apps/
│   │   ├── books/         # Catalog, files, progress, ratings, annotations
│   │   ├── users/         # Users, sessions, 2FA, encryption
│   │   ├── core/          # Settings, newsletters, Telegram, VPN, LLM client
│   │   ├── chat/          # WebSocket chat
│   │   ├── discussions/   # MongoDB — discussions and reviews
│   │   ├── opds/          # OPDS 1.1 catalog
│   │   └── telegram_upload/ # Upload bot
│   └── config/            # Django settings and URL router
├── frontend/          # User interface (React + Vite)
├── admin-frontend/    # Administration panel (React + Vite)
├── llm-service/       # FastAPI LLM proxy
├── nginx/             # Nginx configuration
├── docs/wiki/         # Wiki source files
├── docker-compose.yml
├── .env.example
└── k8s.yaml           # Kubernetes manifest
```

### Updating

```bash
git pull
docker compose build
docker compose up -d
docker exec sbrw_backend python manage.py migrate
```

### Useful Commands

```bash
# View logs for a specific service
docker compose logs -f backend

# Run migrations manually
docker exec sbrw_backend python manage.py migrate

# Open Django shell
docker exec -it sbrw_backend python manage.py shell

# Download an Ollama model
docker exec sbrw_ollama ollama pull qwen2.5:1.5b

# Restart a service
docker compose restart backend
```

### Stopping

```bash
docker compose down          # stop without deleting data
docker compose down -v       # stop and delete all data (irreversible!)
```
