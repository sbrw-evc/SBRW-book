# Changelog / История изменений

## [1.6.2] — 2026-06-30

### Русский

#### Улучшено
- **Кнопка «Слушать» → возобновление с последней главы:** при нажатии «Слушать» плеер открывается на той главе и позиции, которую пользователь слушал последней. Если история прослушивания ещё не загружена — плеер сам запрашивает её асинхронно. Каждая глава из списка по-прежнему открывается с начала
- **«Продолжить чтение»:** читалка уже восстанавливала CFI-позицию независимо; явных изменений не требовалось

#### Исправлено
- **Прогресс-бары аудиоглав не обновлялись после прослушивания:** при закрытии плеера теперь автоматически сбрасывается кеш `audio-progress` в React Query — бары под главами обновляются сразу
- **Ошибки сохранения прогресса не были видны:** убран `catch(() => {})` в функции `saveProgress`, ошибки теперь логируются в консоль
- **Отступы плеера на мобильных устройствах:** добавлен `viewport-fit=cover` в мета-тег viewport и поддержка `env(safe-area-inset-bottom)` — плеер теперь корректно позиционируется выше home indicator на iPhone; нижний отступ контента также учитывает безопасную зону

### English

#### Improved
- **"Слушать" (Listen) button → resume last chapter:** clicking "Listen" opens the player at the exact chapter and position the user last listened to. The cached audio-progress query is used when available; the player falls back to its own async fetch otherwise. Individual chapter clicks still start from the beginning
- **"Continue reading":** the reader already restores the CFI position independently; no changes required

#### Fixed
- **Audio chapter progress bars not updating after listening:** closing the player now invalidates the `audio-progress` React Query cache so the bars under chapters refresh immediately
- **Save errors were silently swallowed:** removed `catch(() => {})` in `saveProgress`; errors now log to the console for visibility
- **Player margins on mobile:** added `viewport-fit=cover` to the viewport meta tag and `env(safe-area-inset-bottom)` to both the player bottom position and the main content bottom padding — player now floats correctly above the home indicator on iPhone

---

## [1.6.1] — 2026-06-30

### Русский

#### Исправлено
- **Прогресс аудиоглав (per-chapter):** модель `AudioListenProgress` переведена на хранение прогресса отдельно для каждой главы (`unique_together = ('user', 'chapter')`). Миграция 0011 пересоздаёт таблицу. Теперь каждая глава показывает собственный прогресс-бар, а не «всё до текущей главы» (v1.6.0 был некорректен)
- **Обрезанный круг на ползунке плеера:** высота контейнера прогресс-бара увеличена до `h-4`, трек внутри позиционирован абсолютно — круг перестал обрезаться `overflow-hidden` капсулы

#### Добавлено
- **Список текстовых глав:** при выборе вкладки «Текст» отображаются главы epub (из навигации файла через `GET /books/{id}/toc`). Каждая глава содержит прогресс-полоску на основе общего процента прочтения. Полностью прочитанные главы отображаются с заполненным значком и приглушённым текстом
- **Кнопка «Добавить аудиоверсию»** перемещена — теперь показывается только во вкладке «Аудио» (не в тексте)

### English

#### Fixed
- **Per-chapter audio progress:** `AudioListenProgress` model migrated to per-chapter storage (`unique_together = ('user', 'chapter')`). Migration 0011 recreates the table. Each chapter now has its own independent progress bar
- **Clipped scrubber thumb on player:** progress bar container height increased to `h-4`, track positioned absolutely inside — thumb no longer clipped by the capsule's `overflow-hidden`

#### Added
- **Text chapter list:** "Text" tab now shows epub chapters (extracted via `GET /books/{id}/toc`). Each chapter has a progress bar proportional to the overall reading percentage. Fully-read chapters show a filled icon and muted text
- **"Add audio version" button** moved to the "Audio" tab only

---

## [1.6.0] — 2026-06-30

### Русский

#### Добавлено
- **История прослушивания:** модель `AudioListenProgress` (миграция 0010) сохраняет позицию прослушивания (глава + секунда) для каждого пользователя. API: `GET/POST /books/{id}/audio/progress`. Плеер автоматически сохраняет позицию каждые 10 секунд, при смене главы и при закрытии. При повторном открытии книги через «Слушать» плеер возобновляет воспроизведение с сохранённого места
- **Плеер-капсула:** плеер переработан из полноэкранной нижней полосы в центрированную закруглённую карточку (`max-w-xl`, `rounded-2xl`, `shadow-2xl`) с отступом от нижнего края экрана
- **Анимации плеера:** анимация появления (slide-up + scale), анимация закрытия (slide-down + fade-out), реакция кнопок на нажатие (`active:scale-90`), список глав появляется с `animate-scale-up`; прогресс-бар плавно обновляется (`transition: width 0.25s`)
- **Кнопка чатов:** при открытом плеере кнопка мессенджера поднимается выше (`bottom: 9rem`) с CSS-переходом; когда плеер закрыт — возвращается в обычное положение
- **Переключатель Текст/Аудио на странице книги:** при выборе «Текст» скрываются «Слушать», список аудиоглав; при выборе «Аудио» скрываются «Читать», форматы файлов, конвертер и показываются только аудио-материалы

### English

#### Added
- **Listening history:** `AudioListenProgress` model (migration 0010) stores per-user playback position (chapter + seconds). API: `GET/POST /books/{id}/audio/progress`. The player auto-saves every 10 s, on chapter change, and on close. Re-opening a book via "Listen" resumes from the saved position
- **Capsule player:** player redesigned from a full-width bottom bar into a centered rounded card (`max-w-xl`, `rounded-2xl`, `shadow-2xl`) floating above the bottom edge
- **Player animations:** enter animation (slide-up + scale), exit animation (slide-down + fade-out), button press feedback (`active:scale-90`), chapter list appears with `animate-scale-up`; progress bar updates smoothly (`transition: width 0.25s`)
- **Chat button:** when the player is open the chat button rises above it (`bottom: 9rem`) with a CSS transition; returns to normal when player closes
- **Text/Audio toggle on book page:** selecting "Text" hides "Listen" and the audio chapter list; selecting "Audio" hides "Read", file formats, converter and shows only audio content

---

## [1.5.2] — 2026-06-30

### Русский

#### Исправлено
- **Аудиостриминг:** `AudioChapterStreamView` теперь помечен `permission_classes = []` — без этого DRF блокировал запросы браузерного тега `<audio>` (без заголовка `Authorization`) до вызова обработчика, возвращая 401, несмотря на собственную проверку токена через `?token=` внутри метода. Теперь «Аудиофайл недоступен» не появляется для публичных книг
- **Разрешения на загрузку глав:** `AudioChapterListView.post()` и `AudioChapterDetailView.delete()` теперь разрешают загрузку/удаление не только admin/moderator, но и владельцу книги (`uploaded_by`)
- **Автовоспроизведение:** плеер теперь немедленно начинает воспроизведение при нажатии на главу (исправлен вызов `loadChapter` с `autoPlay = false`)
- **Кнопка загрузки аудиокниги:** режим «К существующей книге» теперь корректно устанавливает состояние загрузки и показывает тост при ошибке

### English

#### Fixed
- **Audio streaming:** `AudioChapterStreamView` is now annotated with `permission_classes = []` — without this DRF rejected browser `<audio>` requests (no `Authorization` header) before the handler ran, even though the `?token=` query-param fallback was implemented inside the method. "Audio file unavailable" no longer appears for public books
- **Chapter upload permissions:** `AudioChapterListView.post()` and `AudioChapterDetailView.delete()` now also allow the book owner (`uploaded_by`) in addition to admin/moderator
- **Autoplay:** player now starts playback immediately when a chapter is clicked (fixed `loadChapter` call with `autoPlay = false`)
- **Audiobook upload button:** «Attach to existing book» mode now correctly sets loading state and shows an error toast on failure

---

## [1.5.1] — 2026-06-30

### Русский

#### Добавлено
- **Загрузка аудиокниг по одной главе:** в режиме «К существующей книге» форма загрузки теперь показывает уже загруженные главы с кнопкой удаления. Новые файлы автоматически нумеруются с (последняя глава + 1). После загрузки страница не закрывается — можно сразу добавить следующую главу. Отображается баннер «Главы загружены» с кнопкой «Перейти к книге»

### English

#### Added
- **Chapter-by-chapter audiobook upload:** in «Attach to existing book» mode the upload form now shows already-uploaded chapters with a delete button. New files are auto-numbered starting from (last chapter + 1). After upload the page stays open so the next chapter can be added immediately. A success banner with a «Go to book» button is shown

---

## [1.5.0] — 2026-06-30

### Русский

#### Добавлено
- **Поддержка аудиокниг:** новая модель `AudioChapter` (миграция 0009), поле `narrator` в модели `Book`
- **Audio API:**
  - `GET/POST /api/books/{id}/audio` — список глав / загрузка главы (admin/moderator)
  - `GET /api/books/{id}/audio/{chapter_id}/stream` — стриминг с поддержкой Range requests (RFC 7233, 206 Partial Content)
  - `DELETE /api/books/{id}/audio/{chapter_id}` — удалить главу
  - `POST /api/books/create-audio` — создать аудиокнигу без текстового файла
- **Аудиоплеер:** sticky bottom-панель с воспроизведением/паузой, перемоткой ±30 с, выбором скорости (0.75×–2×), громкостью, progress bar с seek, списком глав
- **Страница книги:** переключатель «Текст/Аудио», трёхколоночный layout, табы (О книге / Отзывы / Обсуждения / На полках), сетка метаданных, список аудиоглав
- **Форма загрузки:** переключатель режимов «Книга» / «Аудиокнига»; в режиме аудиокниги — выбор «Новая» (метаданные + рассказчик) или «К существующей книге» (live-поиск); мультифайловый drag-and-drop с редактируемыми номерами и названиями глав, пакетная загрузка с прогресс-баром
- **Редактирование книги:** поле «Рассказчик»

### English

#### Added
- **Audiobook support:** new `AudioChapter` model (migration 0009), `narrator` field on `Book`
- **Audio API:**
  - `GET/POST /api/books/{id}/audio` — chapter list / upload chapter (admin/moderator)
  - `GET /api/books/{id}/audio/{chapter_id}/stream` — streaming with Range request support (RFC 7233, 206 Partial Content)
  - `DELETE /api/books/{id}/audio/{chapter_id}` — delete chapter
  - `POST /api/books/create-audio` — create audiobook without a text file
- **Audio player:** sticky bottom bar with play/pause, ±30 s skip, speed control (0.75×–2×), volume, seekable progress bar, chapter list panel
- **Book detail page:** Text/Audio version toggle, 3-column layout, tab navigation (About / Reviews / Discussions / Shelves), metadata grid, audio chapter list
- **Upload form:** Book / Audiobook mode toggle; in audiobook mode — choice of New (metadata + narrator) or Attach to existing book (live search); multi-file drag-and-drop with editable chapter numbers and titles, batch upload with progress bar
- **Book edit:** Narrator field

---

## [1.4.4] — 2026-06-28

### Русский

#### Добавлено
- **Страница книги — прогресс чтения:** под кнопкой «Читать» отображается прогресс-бар с процентом прочитанного для авторизованного пользователя. Кнопка меняет текст на «Продолжить чтение» при наличии сохранённого прогресса

#### Исправлено
- **Читалка — потеря прогресса при выходе:** `setTimeout` отменялся в cleanup-функции эффекта раньше, чем успевал сработать → данные терялись при быстрой навигации. Теперь при размонтировании компонента ожидающее сохранение немедленно отправляется в API
- **Читалка — защита от NaN:** добавлена проверка `typeof pct !== 'number' || isNaN(pct)` перед вызовом save, чтобы не отправлять невалидный процент
- **Инвалидация кэша:** после успешного сохранения прогресса инвалидируется React Query кэш прогресса, чтобы страница книги всегда показывала актуальные данные

### English

#### Added
- **Book page — reading progress bar:** progress bar with percentage shown below the Read button for authenticated users. Button changes to "Continue reading" when saved progress exists

#### Fixed
- **Reader — progress lost on exit:** `setTimeout` was cancelled in the effect cleanup before it fired → data lost on quick navigation. On component unmount any pending save is now immediately flushed to the API
- **Reader — NaN guard:** added `typeof pct !== 'number' || isNaN(pct)` check before saving to prevent sending invalid percentage values
- **Cache invalidation:** after a successful progress save, the React Query progress cache is invalidated so the book page always shows up-to-date data

---

## [1.4.3] — 2026-06-28

### Русский

#### Исправлено
- **ИИ-рецензия — "Не удалось извлечь текст из файла":** `extract_book_text` вызывала `epub.read_epub(BytesIO(...))` — ebooklib требует путь к файлу, не BytesIO. Аналогичный баг уже был исправлен в `extract_epub_metadata`, здесь пропустили. Теперь используется временный файл
- **Страница книги — отступ блока ИИ-рецензии:** блок прилегал вплотную к описанию, добавлен `mt-5`

### English

#### Fixed
- **AI review — "Failed to extract text from file":** `extract_book_text` called `epub.read_epub(BytesIO(...))` — ebooklib requires a file path, not BytesIO. Same bug was already fixed in `extract_epub_metadata`, missed here. Now uses a temp file
- **Book page — AI review block spacing:** block was flush against the description text, added `mt-5` top margin

---

## [1.4.2] — 2026-06-28

### Русский

#### Исправлено
- **ИИ-рецензии — смешанный язык:** рецензия содержала смесь русского и английского текста
  - Причина: системный промпт на английском + расплывчатая инструкция «respond in the book's language» — малые модели (qwen2.5:7b) её игнорировали
  - Добавлено автоматическое определение языка книги по соотношению кирилличных/латинских символов
  - В пользовательский промпт добавлена явная директива языка: `Write the review in Russian only.`
  - Добавлена повторная проверка: после получения рецензии проверяется, что ≥ 60 % символов соответствуют ожидаемому скрипту
  - При несовпадении — повторный запрос с усиленной директивой на языке книги: `ПИШИ РЕЦЕНЗИЮ ИСКЛЮЧИТЕЛЬНО НА РУССКОМ ЯЗЫКЕ`
  - Работает для обоих режимов: batch (`/analyze`) и стриминг (`/analyze-stream`)

### English

#### Fixed
- **AI reviews — mixed language output:** reviews contained a mix of Russian and English text
  - Root cause: English system prompt + vague "respond in the book's language" instruction — small models (qwen2.5:7b) ignored it
  - Added automatic language detection by Cyrillic/Latin character ratio
  - Added explicit language directive in the user prompt: `Write the review in Russian only.`
  - Added post-generation language check: verifies ≥ 60 % of characters match the expected script
  - On mismatch: retries with a stronger native-language directive: `ПИШИ РЕЦЕНЗИЮ ИСКЛЮЧИТЕЛЬНО НА РУССКОМ ЯЗЫКЕ`
  - Works for both batch (`/analyze`) and streaming (`/analyze-stream`) modes

---

## [1.4.1] — 2026-06-28

### Русский

#### Добавлено
- **Читалка — мобильная навигация:** весь экран разделён на три невидимые зоны касания
  - Левые 20% → предыдущая страница
  - Правые 20% → следующая страница
  - Центральные 60% → скрыть / показать интерфейс (тулбар + прогресс-бар)
- **Читалка — скрытие UI:** при скрытом интерфейсе кнопка чата тоже исчезает; при уходе со страницы состояние сбрасывается
- **Читалка — десктоп:** стрелки `←` `→` на клавиатуре переключают страницы; визуальные кнопки ChevronLeft/Right показываются только на экранах ≥ 768 px

#### Исправлено
- **CI: teardown тестовой БД:** `django.db.utils.OperationalError: database "bookdb_test" is being accessed by other users` после успешных 75 тестов — добавлен флаг `--keepdb`, очистка БД вынесена в `before_script` следующего запуска

### English

#### Added
- **Reader — mobile navigation:** full screen split into three invisible tap zones
  - Left 20% → previous page
  - Right 20% → next page
  - Center 60% → toggle UI (toolbar + progress bar fade out/in)
- **Reader — UI hide:** chat floating button is also hidden while reader UI is hidden; flag is reset on page leave
- **Reader — desktop:** `←` `→` keyboard arrows navigate pages; visual ChevronLeft/Right buttons shown only on screens ≥ 768 px

#### Fixed
- **CI: test DB teardown:** `django.db.utils.OperationalError: database "bookdb_test" is being accessed by other users` after all 75 tests pass — added `--keepdb` flag, DB cleanup delegated to the next run's `before_script`

---

## [1.4.0] — 2026-06-28

### Русский

#### Добавлено
- **Тесты:** комплексное покрытие всего приложения — 95 тестов (75 backend + 20 LLM-сервис)
  - `apps/users/tests/test_auth.py` — 16 тестов: регистрация, вход, JWT, refresh-токены, профиль, публичный профиль
  - `apps/books/tests/test_books_api.py` — 19 тестов: CRUD книг, рейтинги, видимость, список файлов
  - `apps/books/tests/test_services.py` — 20 тестов: определение формата файла, извлечение метаданных FB2/EPUB
  - `llm-service/tests/test_main.py` — 20 тестов: /health, extract_json, /analyze с mock-провайдером, промпты
  - `config/test_settings.py` — изолированные настройки для тестов (PostgreSQL, in-memory channels, Fernet)
- **CI/CD:** добавлена стадия `test` — тесты запускаются на свежих образах (после build, до deploy)
  - `test:backend` — Django test runner с PostgreSQL, флаг `--failfast`
  - `test:llm` — pytest на LLM-сервисе

#### Исправлено (найдено тестами)
- **EPUB-метаданные (критично):** `extract_epub_metadata` всегда возвращала `{}` из-за `KeyError` на calibre-namespace — метаданные автора/названия никогда не извлекались из EPUB
- **EPUB-парсинг:** `epub.read_epub()` не принимает BytesIO — переделано на запись во временный файл
- **NullPointerError в EPUB:** цикл поиска обложки падал на `None`-элементах из `book.get_items()`
- **`BookFilesView.get`:** `BookFileSerializer` не был импортирован в views.py — эндпоинт `GET /api/books/{id}/files` всегда падал с `NameError`

### English

#### Added
- **Tests:** comprehensive coverage across the full application — 95 tests (75 backend + 20 LLM service)
  - `apps/users/tests/test_auth.py` — 16 tests: registration, login, JWT, refresh tokens, profile, public profile
  - `apps/books/tests/test_books_api.py` — 19 tests: book CRUD, ratings, visibility, file list
  - `apps/books/tests/test_services.py` — 20 tests: file format detection, FB2/EPUB metadata extraction
  - `llm-service/tests/test_main.py` — 20 tests: /health, extract_json, /analyze with mocked provider, prompts
  - `config/test_settings.py` — isolated test settings (PostgreSQL, in-memory channels, Fernet key)
- **CI/CD:** added `test` stage — tests run on fresh images (after build, before deploy)
  - `test:backend` — Django test runner with PostgreSQL, `--failfast` flag
  - `test:llm` — pytest on LLM service

#### Fixed (discovered by tests)
- **EPUB metadata (critical):** `extract_epub_metadata` always returned `{}` due to `KeyError` on calibre namespace — author/title were never extracted from EPUB files
- **EPUB parsing:** `epub.read_epub()` does not accept BytesIO — rewrote to write to a temp file first
- **NullPointerError in EPUB:** cover search loop crashed on `None` items from `book.get_items()`
- **`BookFilesView.get`:** `BookFileSerializer` was not imported in views.py — `GET /api/books/{id}/files` always crashed with `NameError`

---

## [1.3.0] — 2026-06-28

### Русский

#### Исправлено
- **ИИ-рецензии:** устранён баг, при котором модель копировала/конвертировала текст книги вместо написания рецензии
  - Переписан системный промпт — явный запрет копировать текст книги, единственный формат ответа — JSON
  - Убрана фраза «Проанализируй и верни JSON» из user-промпта — малые модели воспринимали её как «сконвертируй текст в JSON»
  - Системный промпт переведён на английский (улучшает понимание у большинства Ollama-моделей)
  - Дефолтная Ollama-модель повышена с `qwen2.5:1.5b` до `qwen2.5:7b` — 1.5b слишком мала для структурированного вывода
  - Лимит контекста для локальных моделей снижен до 4 000 символов (18 000 для облачных) — маленькие модели теряют фокус на задаче при большом контексте

### English

#### Fixed
- **AI reviews:** fixed bug where the model was copying/converting book text instead of writing a review
  - Rewrote system prompt — explicit prohibition on copying book text, only JSON output allowed
  - Removed "Проанализируй и верни JSON" from user prompt — small models interpreted it as "convert text to JSON"
  - System prompt translated to English (improves instruction-following for most Ollama models)
  - Default Ollama model upgraded from `qwen2.5:1.5b` to `qwen2.5:7b` — 1.5b too small for structured output
  - Context limit for local models reduced to 4 000 chars (18 000 for cloud) — small models lose task focus with large context

---

## [1.2.0] — 2026-06-28

### Русский

#### Добавлено
- **CI/CD:** `.gitlab-ci.yml` — автоматическая сборка и деплой при пуше в `main`
  - Две стадии: `build` (`docker compose build --pull`) и `deploy` (`docker compose up -d`)
  - GitLab Runner с shell executor на сервере 192.168.0.203 — сборка прямо на хосте, без Docker-in-Docker
  - `COMPOSE_PROJECT_NAME=sbrw-book` фиксирует имя проекта: Runner видит существующие контейнеры вне зависимости от рабочей директории
  - `.env` с секретами хранится на сервере в `/srv/sbrw-book/.env` — никогда не попадает в git
  - `scripts/setup-runner.sh` — скрипт одноразовой настройки Runner'а на 192.168.0.203

### English

#### Added
- **CI/CD:** `.gitlab-ci.yml` — automatic build and deploy on push to `main`
  - Two stages: `build` (`docker compose build --pull`) and `deploy` (`docker compose up -d`)
  - GitLab Runner with shell executor on 192.168.0.203 — builds run directly on host, no Docker-in-Docker
  - `COMPOSE_PROJECT_NAME=sbrw-book` pins the project name so the runner finds existing containers regardless of working directory
  - `.env` with secrets lives on the server at `/srv/sbrw-book/.env` — never committed to git
  - `scripts/setup-runner.sh` — one-shot runner setup script for 192.168.0.203

---

## [1.1.1] — 2026-06-28

### Русский

#### Исправлено
- **Поиск метаданных (критично):** полностью устранено зависание запроса при загрузке книги
  - Удалён синхронный LLM-вызов из `BookMetadataSearchView` — он занимал до 180 с и превышал 20-секундный таймаут фронтенда, из-за чего Daphne убивала задачу
  - `ThreadPoolExecutor` в `search_all()` теперь завершается без ожидания зависших потоков (`shutdown(wait=False, cancel_futures=True)`) — LitRes/Author.Today делают последовательные HTTP-запросы и могли блокировать выход из пула
  - Таймаут парсеров снижен с 15 с до 8 с — гарантированно укладывается в 20-секундный таймаут axios

### English

#### Fixed
- **Metadata search (critical):** eliminated request hang on book upload
  - Removed synchronous LLM call from `BookMetadataSearchView` — it blocked up to 180 s and exceeded the 20 s frontend axios timeout, causing Daphne to kill the task
  - `ThreadPoolExecutor` in `search_all()` now exits without waiting for stuck threads (`shutdown(wait=False, cancel_futures=True)`) — LitRes/Author.Today make sequential HTTP requests that could block pool exit
  - Parser timeout reduced from 15 s to 8 s — guaranteed to fit within the 20 s axios timeout

---

## [1.1.0] — 2026-06-28

### Русский

#### Добавлено
- **ИИ — стриминг размышлений:** новый SSE-эндпоинт `POST /api/books/{id}/analyze/stream` — токены приходят в реальном времени (вместо ожидания Kafka)
- **ИИ — прогресс-бар размышлений:** линейный прогресс 0→97% за 300 с, мгновенно 100% при завершении
- **ИИ — лимит времени:** жёсткий таймаут 300 с на всех уровнях (frontend, backend, LLM service)
- **ИИ — блок «Размышления»:** скроллируемая секция с монопространственным шрифтом, автоматически скроллится к последнему токену
- **ИИ — кнопка «Остановить»:** прерывает стриминг в любой момент через AbortController
- **LLM service — стриминговые провайдеры:** `/analyze-stream` эндпоинт с нативным стримингом для Ollama, Claude, OpenAI, Gemini, DeepSeek
- **Счётчик времени:** `N s / 300 s` рядом с прогресс-баром во время анализа

#### Исправлено
- LLM-анализ больше не висит бесконечно — добавлены таймауты на всех уровнях

### English

#### Added
- **AI — thinking stream:** new SSE endpoint `POST /api/books/{id}/analyze/stream` — tokens arrive in real time (replacing Kafka-only flow)
- **AI — thinking progress bar:** linear 0→97% over 300 s, instantly 100% on completion
- **AI — timeout:** hard 300 s limit enforced at frontend, backend, and LLM service levels
- **AI — Thinking section:** scrollable monospace block that auto-scrolls to the latest token
- **AI — Stop button:** cancels the stream at any time via AbortController
- **LLM service — streaming providers:** `/analyze-stream` endpoint with native streaming for Ollama, Claude, OpenAI, Gemini, DeepSeek
- **Elapsed timer:** `N s / 300 s` displayed next to the progress bar during analysis

#### Fixed
- LLM analysis no longer hangs indefinitely — timeouts enforced at all layers

---


> **[🇷🇺 Русский](#русский)** | **[🇬🇧 English](#english)**

All notable changes to this project are documented in this file.
Все заметные изменения в этом проекте документируются в данном файле.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

---

## Русский

## [1.0.0] — 2026-06-28

Первый публичный релиз SBRW-Book — самохостируемой цифровой библиотеки.

### Добавлено

#### Библиотека и контент
- Загрузка книг в форматах EPUB, PDF, FB2, TXT с валидацией
- Хранение нескольких файловых версий одной книги (`version_label`)
- Автоматическое извлечение метаданных из файла при загрузке
- Онлайн-поиск метаданных: Google Books, Open Library, ЛитРес, Author.Today, Fantlab
- Конвертация форматов через Kafka-очередь (EPUB ↔ FB2 ↔ MOBI и др.)
- Обложки книг с загрузкой/обрезкой; автогенерация из файла
- Авторы, серии, теги — связи M2M с собственными страницами
- Сортировка по популярности, рейтингу, дате добавления
- Управление публичностью книги (открытая / приватная)

#### Читалка
- Встроенная EPUB-читалка на базе epub.js с рендерингом глав
- Встроенная PDF-читалка на базе pdf.js
- Синхронизация позиции чтения по CFI (Canonical Fragment Identifier)
- Аннотации и закладки с цветовой маркировкой и публичностью
- Скачивание книг в нужном формате

#### Пользователи и безопасность
- Регистрация и вход с JWT (access + refresh токены)
- Верификация email, восстановление пароля
- TOTP 2FA (Google Authenticator, Яндекс.Ключ)
- Telegram 2FA — одноразовые коды через бота
- Управление сессиями: список устройств, отзыв, геопозиция
- Шифрование персональных данных на уровне полей (Fernet + HMAC-SHA256 для индексов)
- Ролевая модель: admin, moderator, user

#### Социальные функции
- Оценки книг (1–5 звёзд) с текстовыми рецензиями
- Комментарии к книгам (вложенные треды) с медиавложениями
- Обсуждения книг на MongoDB
- Личные полки — приватные и публичные коллекции
- Подписки на серии с уведомлениями о новых книгах
- Публичные профили пользователей

#### Telegram-интеграция
- Бот-уведомитель: привязка аккаунта, 2FA, оповещения о новых логинах и книгах
- Бот загрузки книг для администраторов: файл → метаданные → редактирование → публикация
- Redis-очередь исходящих сообщений (`tg:outbox`)

#### OPDS-каталог
- Стандарт OPDS 1.1 для KOReader, Moonreader, Marvin и других e-reader
- Разделы: все книги, поиск, по авторам, по сериям, по жанрам/тегам

#### Чат
- Групповые и личные чат-комнаты на WebSocket (Django Channels + Redis)
- Вложения (медиафайлы), история сообщений
- Список участников, создание комнаты

#### ИИ-ассистент
- Отдельный FastAPI LLM-прокси (`sbrw_llm`, порт 8100)
- Провайдеры: Ollama (локально), Claude, OpenAI, Gemini, DeepSeek
- Генерация рецензий на книгу (4–6 предложений) после загрузки — async via Kafka
- ИИ-предложения метаданных при поиске (источник «AI» в панели)
- Ручной запуск анализа из карточки редактирования и из админ-панели
- Pull Ollama-моделей с прогресс-баром в реальном времени (SSE-стриминг)
- Настройка провайдера без перезапуска контейнеров

#### Администрирование
- Отдельный React-дашборд на порту 8080
- Аналитика: посещаемость, DAU, статистика загрузок (Recharts)
- Управление пользователями и ролями
- Настройки с шифрованием (SMTP, Telegram-токены, API-ключи)
- Редактор email-шаблонов (верификация, сброс пароля, 2FA, рассылки)
- Массовые рассылки с предпросмотром
- Docker-менеджер: логи и перезапуск контейнеров из UI
- VPN/WireGuard: загрузка, хранение и тестирование конфигураций

#### Инфраструктура
- 12 сервисов в Docker Compose: 3 БД + backend + workers + bots + LLM + frontends + proxy
- Healthcheck для ключевых сервисов
- Kubernetes-манифест (`k8s.yaml`)
- Шифрование чувствительных настроек в БД (`AppSettings`)

---

## English

## [1.0.0] — 2026-06-28

First public release of SBRW-Book — a self-hosted digital library platform.

### Added

#### Library & Content
- Book uploads in EPUB, PDF, FB2, TXT formats with validation
- Multiple file versions per book (`version_label`)
- Automatic metadata extraction from uploaded files
- Online metadata search: Google Books, Open Library, LitRes, Author.Today, Fantlab
- Format conversion via Kafka queue (EPUB ↔ FB2 ↔ MOBI, etc.)
- Book covers with upload/crop; auto-generation from file
- Authors, series, tags — M2M relations with dedicated pages
- Sorting by popularity, rating, date added
- Book visibility control (public / private)

#### Reader
- Built-in EPUB reader powered by epub.js with chapter rendering
- Built-in PDF reader powered by pdf.js
- Reading position sync via CFI (Canonical Fragment Identifier)
- Annotations and bookmarks with color coding and public/private visibility
- Book download in any available format

#### Users & Security
- Registration and login with JWT (access + refresh tokens)
- Email verification and password recovery
- TOTP 2FA (Google Authenticator, Yandex.Key)
- Telegram 2FA — one-time codes delivered via bot
- Session management: device list, revocation, geolocation
- Field-level encryption of personal data (Fernet + HMAC-SHA256 for indexed lookups)
- Role model: admin, moderator, user

#### Social Features
- Book ratings (1–5 stars) with written reviews
- Nested comment threads with media attachments
- Book discussions on MongoDB
- Personal shelves — private and public collections
- Series subscriptions with new-book notifications
- Public user profiles

#### Telegram Integration
- Notification bot: account linking, 2FA codes, new login alerts, series updates
- Admin upload bot: send file → preview metadata → edit inline → publish
- Redis outbox queue (`tg:outbox`) for reliable delivery

#### OPDS Catalog
- OPDS 1.1 standard for KOReader, Moonreader, Marvin, and other e-readers
- Sections: all books, search, by author, by series, by genre/tag

#### Chat
- Group and private chat rooms over WebSocket (Django Channels + Redis)
- Media attachments, full message history
- Member list, room creation

#### AI Assistant
- Dedicated FastAPI LLM proxy (`sbrw_llm`, port 8100)
- Providers: Ollama (local), Claude, OpenAI, Gemini, DeepSeek
- Book review generation (4–6 sentences) after upload — async via Kafka
- AI metadata suggestions during search (displayed as "AI" source in metadata panel)
- Manual analysis trigger from book edit page and admin panel
- Ollama model pull with real-time progress bar (SSE streaming)
- Provider configuration without container restarts

#### Administration
- Separate React dashboard on port 8080
- Analytics: site visits, DAU, download stats (Recharts charts)
- User and role management
- Encrypted settings (SMTP, Telegram tokens, API keys)
- Email template editor (verification, password reset, 2FA, newsletters)
- Mass newsletters with preview
- Docker manager: container logs and restarts from the UI
- VPN/WireGuard: upload, store and test configs

#### Infrastructure
- 12 Docker Compose services: 3 DBs + backend + workers + bots + LLM + frontends + proxy
- Healthchecks for all critical services
- Kubernetes manifest (`k8s.yaml`)
- Sensitive settings encrypted at rest in DB (`AppSettings`)

---

[1.0.0]: https://github.com/example/sbrw-book/releases/tag/v1.0.0
