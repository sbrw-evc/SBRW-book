# Обзор API / API Overview
> ← [Главная / Home](home)


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
| `GET/POST` | `/api/books/metadata-search` | Поиск метаданных (GET — по тексту, POST — из файла) |
| `POST` | `/api/upload/media` | Загрузить медиафайл (аватар и т.д.) |
| `POST` | `/api/books/{id}/analyze` | Запустить ИИ-анализ (синхронно) |
| `GET` | `/api/books/{id}/analyze/stream` | Запустить ИИ-анализ (SSE-поток) |
| `GET` | `/api/books/{id}/read` | Получить файл для чтения в браузере |
| `GET` | `/api/books/{id}/cover` | Обложка книги |
| `GET` | `/api/books/{id}/download/{fmt}` | Скачать файл |
| `POST` | `/api/books/{id}/convert` | Конвертировать формат |
| `GET` | `/api/books/{id}/files` | Список файловых версий |
| `DELETE` | `/api/books/{id}/files/{file_id}` | Удалить файловую версию |
| `PATCH` | `/api/books/{id}/visibility` | Сменить видимость (is_public) |
| `POST` | `/api/books/{id}/rate` | Оценить книгу |
| `GET` | `/api/books/{id}/ratings` | Рецензии читателей |
| `DELETE` | `/api/books/{id}/ratings/{rating_id}` | Удалить рецензию |
| `GET/POST` | `/api/books/{id}/progress` | Прогресс чтения |
| `GET` | `/api/books/{id}/audio` | Список аудиоглав |
| `POST` | `/api/books/{id}/audio` | Загрузить аудиоглаву (admin/moderator, multipart) |
| `DELETE` | `/api/books/{id}/audio/{chapter_id}` | Удалить аудиоглаву |
| `GET` | `/api/books/{id}/audio/{chapter_id}/stream` | Стриминг аудио (Range requests, 206) |
| `GET/POST` | `/api/books/{id}/audio/progress` | Позиция прослушивания (глава + секунда), per-chapter |
| `GET` | `/api/books/{id}/annotations` | Аннотации пользователя |
| `POST` | `/api/books/{id}/annotations` | Создать аннотацию |
| `DELETE` | `/api/books/{id}/annotations/{ann_id}` | Удалить аннотацию |
| `GET` | `/api/books/{id}/comments` | Комментарии |
| `POST` | `/api/books/{id}/comments` | Добавить комментарий |
| `DELETE` | `/api/books/{id}/comments/{comment_id}` | Удалить комментарий |
| `GET` | `/api/books/{id}/discussions` | Обсуждения (MongoDB) |
| `GET` | `/api/books/{id}/reviews` | Рецензии (MongoDB) |

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

#### OPDS-каталог (версия 1.2)

| Путь | Описание |
|------|---------|
| `/opds/` | Корневой навигационный фид |
| `/opds/books` | Все книги (acquisition feed) |
| `/opds/search?q=...` | Полнотекстовый поиск |
| `/opds/opensearch.xml` | OpenSearch-дескриптор |
| `/opds/authors` | Список авторов |
| `/opds/authors/{id}/books` | Книги автора |
| `/opds/series` | Список серий |
| `/opds/series/{id}/books` | Книги серии |
| `/opds/genres` | Список жанров/тегов |
| `/opds/genres/{id}/books` | Книги по жанру |

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
  "items": [
    {
      "id": "uuid",
      "title": "Название книги",
      "authors": [{"id": "uuid", "name": "Автор"}],
      "cover_url": "/uploads/covers/uuid.jpg",
      "avg_rating": 4.5,
      "language": "ru",
      "ai_review": "ИИ-рецензия...",
      "ai_review_status": "done"
    }
  ],
  "total": 100,
  "page": 1,
  "page_size": 24,
  "pages": 5
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
| `GET/POST` | `/api/books/metadata-search` | Metadata search (GET — by text, POST — from file) |
| `POST` | `/api/upload/media` | Upload media file (avatar etc.) |
| `POST` | `/api/books/{id}/analyze` | Trigger AI analysis (synchronous) |
| `GET` | `/api/books/{id}/analyze/stream` | Trigger AI analysis (SSE stream) |
| `GET` | `/api/books/{id}/read` | Get file for in-browser reading |
| `GET` | `/api/books/{id}/cover` | Book cover image |
| `GET` | `/api/books/{id}/download/{fmt}` | Download file |
| `POST` | `/api/books/{id}/convert` | Convert format |
| `GET` | `/api/books/{id}/files` | List file versions |
| `DELETE` | `/api/books/{id}/files/{file_id}` | Delete a file version |
| `PATCH` | `/api/books/{id}/visibility` | Toggle visibility (is_public) |
| `POST` | `/api/books/{id}/rate` | Rate a book |
| `GET` | `/api/books/{id}/ratings` | Reader reviews |
| `DELETE` | `/api/books/{id}/ratings/{rating_id}` | Delete a review |
| `GET/POST` | `/api/books/{id}/progress` | Reading progress |
| `GET` | `/api/books/{id}/audio` | Audio chapter list |
| `POST` | `/api/books/{id}/audio` | Upload audio chapter (admin/moderator, multipart) |
| `DELETE` | `/api/books/{id}/audio/{chapter_id}` | Delete audio chapter |
| `GET` | `/api/books/{id}/audio/{chapter_id}/stream` | Stream audio (Range requests, 206 Partial Content) |
| `GET/POST` | `/api/books/{id}/audio/progress` | Listening position (chapter + second), per-chapter |
| `GET` | `/api/books/{id}/annotations` | User annotations |
| `POST` | `/api/books/{id}/annotations` | Create annotation |
| `DELETE` | `/api/books/{id}/annotations/{ann_id}` | Delete annotation |
| `GET` | `/api/books/{id}/comments` | Comments |
| `POST` | `/api/books/{id}/comments` | Post a comment |
| `DELETE` | `/api/books/{id}/comments/{comment_id}` | Delete comment |
| `GET` | `/api/books/{id}/discussions` | Discussions (MongoDB) |
| `GET` | `/api/books/{id}/reviews` | Reviews (MongoDB) |

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

#### OPDS Catalog (version 1.2)

| Path | Description |
|------|-------------|
| `/opds/` | Root navigation feed |
| `/opds/books` | All books (acquisition feed) |
| `/opds/search?q=...` | Full-text search |
| `/opds/opensearch.xml` | OpenSearch descriptor |
| `/opds/authors` | Author list |
| `/opds/authors/{id}/books` | Books by author |
| `/opds/series` | Series list |
| `/opds/series/{id}/books` | Books in series |
| `/opds/genres` | Genre/tag list |
| `/opds/genres/{id}/books` | Books by genre |

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
  "items": [
    {
      "id": "uuid",
      "title": "Book Title",
      "authors": [{"id": "uuid", "name": "Author Name"}],
      "cover_url": "/uploads/covers/uuid.jpg",
      "avg_rating": 4.5,
      "language": "en",
      "ai_review": "AI-generated review text...",
      "ai_review_status": "done"
    }
  ],
  "total": 100,
  "page": 1,
  "page_size": 24,
  "pages": 5
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
