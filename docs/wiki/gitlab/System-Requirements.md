# Системные требования / System Requirements
> ← [Главная / Home](home)


> **[🇷🇺 Русский](#русский)** | **[🇬🇧 English](#english)**

---

## Русский

### Минимальные требования

| Компонент | Значение |
|-----------|---------|
| CPU | 2 ядра x86_64 или arm64 |
| RAM | 4 ГБ |
| Диск | 20 ГБ (ОС + Docker-образы + начальный объём библиотеки) |
| ОС | Linux (ядро ≥ 4.15), macOS 13+, Windows 11 + WSL2 |
| Docker Engine | ≥ 24.0 |
| Docker Compose | ≥ 2.20 (Compose Plugin) |

### Рекомендуемые требования (production)

| Компонент | Значение |
|-----------|---------|
| CPU | 4+ ядра |
| RAM | 8 ГБ |
| Диск | 100+ ГБ SSD |
| ОС | Ubuntu 22.04 LTS / Debian 12 |

### С локальной LLM (Ollama)

| Модель | RAM / VRAM | Размер образа |
|--------|-----------|--------------|
| `qwen2.5:1.5b` | 1.5 ГБ | 1.3 ГБ |
| `phi3.5:mini` | 2.5 ГБ | 2.2 ГБ |
| `llama3.2:3b` | 3 ГБ | 2.6 ГБ |
| `qwen2.5:7b` | 6 ГБ | 5 ГБ |
| `llama3.1:8b` | 8 ГБ | 4.5 ГБ |

Для GPU (NVIDIA) раскомментируйте секцию `deploy` в сервисе `ollama` в `docker-compose.yml`:

```yaml
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: 1
          capabilities: [gpu]
```

> При использовании внешних провайдеров (Claude, OpenAI, Gemini, DeepSeek) GPU не нужен.

### Порты

| Порт | Сервис | Назначение |
|------|--------|-----------|
| **80** | Nginx | Основная библиотека |
| **8080** | Nginx | Панель администратора |
| 443 | (внешний прокси) | HTTPS |

Для HTTPS используйте Nginx Proxy Manager, Traefik или Caddy перед стеком.

### Диск

- PostgreSQL, Redis, Kafka → предпочтительно SSD (случайный доступ)
- Volume `book_uploads` (файлы книг) → может быть HDD
- Рекомендуется отдельный диск/раздел под Docker volumes

### Безопасность

- Задайте `FIELD_ENCRYPTION_KEY` — без него персональные данные не шифруются
- Используйте `SECRET_KEY` не менее 50 символов
- Не открывайте наружу порты: 5432 (PostgreSQL), 27017 (MongoDB), 6379 (Redis), 9092 (Kafka)
- Для публичного доступа — только 80/443 через обратный прокси с TLS

---

## English

### Minimum Requirements

| Component | Value |
|-----------|-------|
| CPU | 2 cores x86_64 or arm64 |
| RAM | 4 GB |
| Disk | 20 GB (OS + Docker images + initial library) |
| OS | Linux (kernel ≥ 4.15), macOS 13+, Windows 11 + WSL2 |
| Docker Engine | ≥ 24.0 |
| Docker Compose | ≥ 2.20 (Compose Plugin) |

### Recommended Requirements (production)

| Component | Value |
|-----------|-------|
| CPU | 4+ cores |
| RAM | 8 GB |
| Disk | 100+ GB SSD |
| OS | Ubuntu 22.04 LTS / Debian 12 |

### With Local LLM (Ollama)

| Model | RAM / VRAM | Image size |
|-------|-----------|-----------|
| `qwen2.5:1.5b` | 1.5 GB | 1.3 GB |
| `phi3.5:mini` | 2.5 GB | 2.2 GB |
| `llama3.2:3b` | 3 GB | 2.6 GB |
| `qwen2.5:7b` | 6 GB | 5 GB |
| `llama3.1:8b` | 8 GB | 4.5 GB |

For NVIDIA GPU support, uncomment the `deploy` section under the `ollama` service in `docker-compose.yml`:

```yaml
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: 1
          capabilities: [gpu]
```

> GPU is not required when using external providers (Claude, OpenAI, Gemini, DeepSeek).

### Ports

| Port | Service | Purpose |
|------|---------|---------|
| **80** | Nginx | Main library interface |
| **8080** | Nginx | Administration panel |
| 443 | (external proxy) | HTTPS |

For HTTPS, place Nginx Proxy Manager, Traefik, or Caddy in front of the stack.

### Disk

- PostgreSQL, Redis, Kafka → prefer SSD (random I/O)
- `book_uploads` volume (book files) → HDD is fine
- A dedicated disk/partition for Docker volumes is recommended

### Security Notes

- Set `FIELD_ENCRYPTION_KEY` — without it, personal data is stored unencrypted
- Use a `SECRET_KEY` of at least 50 characters
- Do not expose ports 5432 (PostgreSQL), 27017 (MongoDB), 6379 (Redis), 9092 (Kafka) to the internet
- For public access — only ports 80/443 via a reverse proxy with TLS
