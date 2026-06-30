# Обзор API / API Overview

> **[🇷🇺 Русский](#русский)** | **[🇬🇧 English](#english)**

---

## Русский

### Базовый URL

```
http://localhost/api
```

### Аутентификация

API использует **JWT Bearer токены**.

#### Получить токены

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "user",
  "password": "password"
}
```

Ответ:
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ..."
}
```

#### Использовать токен

```http
GET /api/books
Authorization: Bearer eyJ...
```

#### Обновить access-токен

```http
POST /api/auth/refresh
Content-Type: application/json

{ "refresh_token": "eyJ..." }
```

---

### Основные эндпоинты

#### Книги

| Метод | Путь | Описание |
|-------|------|---------|
| `GET` | `/api/books` | Список книг (фильтры: q, author, series, tag, language) |
| `GET` | `/api/books/recent` | Недавно добавленные |
| `GET` | `/api/books/popular` | По скачиваниям |
| `GET` | `/api/books/top-rated` | По рейтингу |
| `GET` | `/api/books/{id}` | Карточка книги |
| `POST` | `/api/books/upload` | Загрузить книгу (multipart/form-data) |
| `POST` | `/api/books/create-audio` | Создать аудиокнигу без текстового файла |
| `PUT` | `/api/books/{id}` | Обновить метаданные |
| `DELETE` | `/api/books/{id}` | Удалить книгу (admin) |
| `GET` | `/api/books/metadata-search` | Поиск метаданных по тексту |
| `POST` | `/api/books/metadata-search` | Поиск метаданных + AI из файла |
| `POST` | `/api/books/{id}/analyze` | Запустить ИИ-анализ |
| `GET` | `/api/books/{id}/download/{fmt}` | Скачать файл |
| `POST` | `/api/books/{id}/convert` | Конвертировать формат |
| `GET` | `/api/books/{id}/files` | Список файловых версий |
| `POST` | `/api/books/{id}/rate` | Оценить книгу |
| `GET` | `/api/books/{id}/ratings` | Рецензии читателей |
| `GET` | `/api/books/{id}/annotations` | Аннотации пользователя |
| `POST` | `/api/books/{id}/annotations` | Создать аннотацию |
| `GET` | `/api/books/{id}/comments` | Комментарии |
| `POST` | `/api/books/{id}/comments` | Добавить комментарий |
| `GET` | `/api/books/{id}/discussions` | Обсуждения (MongoDB) |
| `GET` | `/api/books/{id}/reviews` | Рецензии (MongoDB) |
| `GET/POST` | `/api/books/{id}/progress` | Прогресс чтения |
| `GET` | `/api/books/{id}/audio` | Список аудиоглав |
| `POST` | `/api/books/{id}/audio` | Загрузить аудиоглаву (admin/moderator, multipart) |
| `DELETE` | `/api/books/{id}/audio/{chapter_id}` | Удалить аудиоглаву |
| `GET` | `/api/books/{id}/audio/{chapter_id}/stream` | Стриминг аудио (Range requests, 206) |
| `GET/POST` | `/api/books/{id}/audio/progress` | Позиция прослушивания (глава + секунда), per-chapter |

#### Авторы, серии, теги

| Метод | Путь | Описание |
|-------|------|---------|
| `GET` | `/api/authors` | Список авторов |
| `GET` | `/api/authors/{id}/books` | Книги автора |
| `GET` | `/api/series` | Список серий |
| `GET` | `/api/series/{id}/books` | Книги серии |
| `POST` | `/api/series/{id}/subscription` | Подписаться на серию |
| `GET` | `/api/tags` | Теги |

#### Пользователи

| Метод | Путь | Описание |
|-------|------|---------|
| `GET` | `/api/auth/me` | Текущий пользователь |
| `PUT` | `/api/users/me` | Обновить профиль |
| `POST` | `/api/users/me/avatar` | Загрузить аватар |
| `GET` | `/api/users/me/library` | Моя библиотека |
| `GET` | `/api/users/me/sessions` | Активные сессии |
| `POST` | `/api/users/me/sessions/{id}` | Отозвать сессию |
| `GET` | `/api/users/{id}/public` | Публичный профиль |

#### Полки

| Метод | Путь | Описание |
|-------|------|---------|
| `GET` | `/api/shelves` | Мои полки |
| `GET` | `/api/shelves/{id}` | Содержимое полки |
| `POST` | `/api/shelves/{id}/books/{book_id}` | Добавить/убрать книгу |

#### Чат

| Метод | Путь | Описание |
|-------|------|---------|
| `GET` | `/api/chat` | Список чат-комнат |
| `GET` | `/api/chat/{id}/messages` | История сообщений |
| `WS` | `/ws/chat/{id}/` | WebSocket подключение |

#### OPDS-каталог

| Путь | Описание |
|------|---------|
| `/opds/` | Корневой фид |
| `/opds/books` | Все книги |
| `/opds/search?q=...` | Поиск |
| `/opds/authors/{id}/books` | Книги автора |
| `/opds/series/{id}/books` | Книги серии |

#### Admin API (требует роль admin)

| Метод | Путь | Описание |
|-------|------|---------|
| `GET` | `/api/admin/stats` | Статистика платформы |
| `GET` | `/api/admin/analytics` | Аналитика посещаемости |
| `GET` | `/api/admin/settings` | Все AppSettings |
| `PUT` | `/api/admin/settings/{key}` | Обновить настройку |
| `POST` | `/api/admin/smtp/test` | Тест SMTP |
| `GET` | `/api/admin/llm/status` | Статус LLM-сервиса |
| `POST` | `/api/admin/llm/test` | Тест LLM |
| `GET` | `/api/admin/llm/ollama-models` | Список моделей Ollama |
| `POST` | `/api/admin/llm/ollama-pull` | Скачать модель Ollama (SSE) |
| `POST` | `/api/admin/llm/analyze/{book_id}` | Запустить ИИ-анализ книги |
| `GET` | `/api/admin/docker/containers` | Список Docker-контейнеров |
| `POST` | `/api/admin/docker/containers/{name}/restart` | Перезапустить контейнер |
| `GET` | `/api/admin/docker/containers/{name}/logs` | Логи контейнера |

---

### Форматы ответов

#### Список книг

```json
{
  "results": [
    {
      "id": "uuid",
      "title": "Название книги",
      "authors": [{"id": "uuid", "name": "Автор"}],
      "cover_url": "/api/books/uuid/cover",
      "avg_rating": 4.5,
      "language": "ru",
      "ai_review": "ИИ-рецензия...",
      "ai_review_status": "done"
    }
  ],
  "count": 100,
  "next": "/api/books?page=2",
  "previous": null
}
```

#### Коды ошибок

| HTTP-код | Описание |
|----------|---------|
| `400` | Неверный запрос / ошибка валидации |
| `401` | Токен не передан или истёк |
| `403` | Недостаточно прав |
| `404` | Ресурс не найден |
| `413` | Файл слишком большой |
| `500` | Внутренняя ошибка сервера |

---

## English

### Base URL

```
http://localhost/api
```

### Authentication

The API uses **JWT Bearer tokens**.

#### Get tokens

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "user",
  "password": "password"
}
```

Response:
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ..."
}
```

#### Use the token

```http
GET /api/books
Authorization: Bearer eyJ...
```

#### Refresh access token

```http
POST /api/auth/refresh
Content-Type: application/json

{ "refresh_token": "eyJ..." }
```

---

### Key Endpoints

#### Books

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/books` | Book list (filters: q, author, series, tag, language) |
| `GET` | `/api/books/recent` | Recently added |
| `GET` | `/api/books/popular` | By download count |
| `GET` | `/api/books/top-rated` | By rating |
| `GET` | `/api/books/{id}` | Book detail |
| `POST` | `/api/books/upload` | Upload a book (multipart/form-data) |
| `POST` | `/api/books/create-audio` | Create an audiobook without a text file |
| `PUT` | `/api/books/{id}` | Update metadata |
| `DELETE` | `/api/books/{id}` | Delete book (admin) |
| `GET` | `/api/books/metadata-search` | Text-based metadata search |
| `POST` | `/api/books/metadata-search` | Metadata search + AI from file |
| `POST` | `/api/books/{id}/analyze` | Trigger AI analysis |
| `GET` | `/api/books/{id}/download/{fmt}` | Download file |
| `POST` | `/api/books/{id}/convert` | Convert format |
| `GET` | `/api/books/{id}/files` | List file versions |
| `POST` | `/api/books/{id}/rate` | Rate a book |
| `GET` | `/api/books/{id}/ratings` | Reader reviews |
| `GET` | `/api/books/{id}/annotations` | User annotations |
| `POST` | `/api/books/{id}/annotations` | Create annotation |
| `GET` | `/api/books/{id}/comments` | Comments |
| `POST` | `/api/books/{id}/comments` | Post a comment |
| `GET` | `/api/books/{id}/discussions` | Discussions (MongoDB) |
| `GET` | `/api/books/{id}/reviews` | Reviews (MongoDB) |
| `GET/POST` | `/api/books/{id}/progress` | Reading progress |
| `GET` | `/api/books/{id}/audio` | Audio chapter list |
| `POST` | `/api/books/{id}/audio` | Upload audio chapter (admin/moderator, multipart) |
| `DELETE` | `/api/books/{id}/audio/{chapter_id}` | Delete audio chapter |
| `GET` | `/api/books/{id}/audio/{chapter_id}/stream` | Stream audio (Range requests, 206 Partial Content) |
| `GET/POST` | `/api/books/{id}/audio/progress` | Listening position (chapter + second), per-chapter |

#### Authors, Series, Tags

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/authors` | Author list |
| `GET` | `/api/authors/{id}/books` | Books by author |
| `GET` | `/api/series` | Series list |
| `GET` | `/api/series/{id}/books` | Books in a series |
| `POST` | `/api/series/{id}/subscription` | Subscribe to a series |
| `GET` | `/api/tags` | Tags |

#### Users

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/auth/me` | Current user |
| `PUT` | `/api/users/me` | Update profile |
| `POST` | `/api/users/me/avatar` | Upload avatar |
| `GET` | `/api/users/me/library` | My library |
| `GET` | `/api/users/me/sessions` | Active sessions |
| `POST` | `/api/users/me/sessions/{id}` | Revoke a session |
| `GET` | `/api/users/{id}/public` | Public profile |

#### Shelves

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/shelves` | My shelves |
| `GET` | `/api/shelves/{id}` | Shelf contents |
| `POST` | `/api/shelves/{id}/books/{book_id}` | Add/remove book |

#### Chat

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/chat` | Chat room list |
| `GET` | `/api/chat/{id}/messages` | Message history |
| `WS` | `/ws/chat/{id}/` | WebSocket connection |

#### OPDS Catalog

| Path | Description |
|------|-------------|
| `/opds/` | Root feed |
| `/opds/books` | All books |
| `/opds/search?q=...` | Search |
| `/opds/authors/{id}/books` | Books by author |
| `/opds/series/{id}/books` | Books in series |

#### Admin API (requires admin role)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/admin/stats` | Platform statistics |
| `GET` | `/api/admin/analytics` | Visit analytics |
| `GET` | `/api/admin/settings` | All AppSettings |
| `PUT` | `/api/admin/settings/{key}` | Update a setting |
| `POST` | `/api/admin/smtp/test` | Test SMTP |
| `GET` | `/api/admin/llm/status` | LLM service status |
| `POST` | `/api/admin/llm/test` | Test LLM |
| `GET` | `/api/admin/llm/ollama-models` | List Ollama models |
| `POST` | `/api/admin/llm/ollama-pull` | Pull Ollama model (SSE stream) |
| `POST` | `/api/admin/llm/analyze/{book_id}` | Trigger AI analysis for book |
| `GET` | `/api/admin/docker/containers` | Docker container list |
| `POST` | `/api/admin/docker/containers/{name}/restart` | Restart container |
| `GET` | `/api/admin/docker/containers/{name}/logs` | Container logs |

---

### Response Formats

#### Book list

```json
{
  "results": [
    {
      "id": "uuid",
      "title": "Book Title",
      "authors": [{"id": "uuid", "name": "Author Name"}],
      "cover_url": "/api/books/uuid/cover",
      "avg_rating": 4.5,
      "language": "en",
      "ai_review": "AI-generated review text...",
      "ai_review_status": "done"
    }
  ],
  "count": 100,
  "next": "/api/books?page=2",
  "previous": null
}
```

#### Error codes

| HTTP code | Description |
|-----------|-------------|
| `400` | Bad request / validation error |
| `401` | Token missing or expired |
| `403` | Insufficient permissions |
| `404` | Resource not found |
| `413` | File too large |
| `500` | Internal server error |
