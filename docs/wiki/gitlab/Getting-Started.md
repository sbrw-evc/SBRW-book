# Начало работы / Getting Started

> **[🇷🇺 Русский](#русский)** | **[🇬🇧 English](#english)**
>
> ← [Главная / Home](home)

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
SECRET_KEY=замените-на-длинную-случайную-строку-минимум-50-символов
POSTGRES_PASSWORD=надёжный-пароль
FIELD_ENCRYPTION_KEY=    # openssl rand -base64 32
```

Полный список — в разделе [[Configuration]].

#### 3. Запуск

```bash
docker compose up -d
```

#### 4. Проверка работоспособности

```bash
docker compose ps
curl http://localhost/api/health   # {"status": "ok"}
```

### Мастер настройки (первый запуск)

Откройте `http://localhost` — вы будете перенаправлены на `/setup`. Мастер создаст администратора и настроит приложение.

### Структура каталогов

```
sbrw-book/
├── backend/           # Django REST API + Kafka worker + Telegram bots
│   ├── apps/
│   │   ├── books/         # Каталог, файлы, прогресс, рейтинги
│   │   ├── users/         # Пользователи, сессии, 2FA
│   │   ├── core/          # Настройки, Telegram, VPN, LLM
│   │   ├── chat/          # WebSocket-чат
│   │   ├── discussions/   # MongoDB — обсуждения
│   │   ├── opds/          # OPDS 1.1
│   │   └── telegram_upload/ # Бот загрузки
│   └── config/
├── frontend/          # Пользовательский интерфейс (React + Vite)
├── admin-frontend/    # Панель администратора (React + Vite)
├── llm-service/       # FastAPI LLM-прокси
├── nginx/
├── docker-compose.yml
└── k8s.yaml
```

### Полезные команды

```bash
docker compose logs -f backend
docker exec sbrw_backend python manage.py migrate
docker exec -it sbrw_backend python manage.py shell
docker exec sbrw_ollama ollama pull qwen2.5:1.5b
docker compose restart backend
docker compose down          # без удаления данных
docker compose down -v       # удалить все данные
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
SECRET_KEY=replace-with-a-long-random-string-at-least-50-chars
POSTGRES_PASSWORD=strong-password
FIELD_ENCRYPTION_KEY=    # openssl rand -base64 32
```

Full list in [[Configuration]].

#### 3. Start

```bash
docker compose up -d
```

#### 4. Health check

```bash
docker compose ps
curl http://localhost/api/health   # {"status": "ok"}
```

### Setup Wizard (first run)

Open `http://localhost` — you will be redirected to `/setup`. The wizard will create an admin account and configure the application.

### Directory Structure

```
sbrw-book/
├── backend/           # Django REST API + Kafka worker + Telegram bots
│   ├── apps/
│   │   ├── books/         # Catalog, files, progress, ratings
│   │   ├── users/         # Users, sessions, 2FA
│   │   ├── core/          # Settings, Telegram, VPN, LLM
│   │   ├── chat/          # WebSocket chat
│   │   ├── discussions/   # MongoDB discussions
│   │   ├── opds/          # OPDS 1.1
│   │   └── telegram_upload/ # Upload bot
│   └── config/
├── frontend/          # User interface (React + Vite)
├── admin-frontend/    # Administration panel (React + Vite)
├── llm-service/       # FastAPI LLM proxy
├── nginx/
├── docker-compose.yml
└── k8s.yaml
```

### Useful Commands

```bash
docker compose logs -f backend
docker exec sbrw_backend python manage.py migrate
docker exec -it sbrw_backend python manage.py shell
docker exec sbrw_ollama ollama pull qwen2.5:1.5b
docker compose restart backend
docker compose down          # stop without deleting data
docker compose down -v       # delete all data
```
