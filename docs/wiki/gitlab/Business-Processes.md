# Бизнес-процессы / Business Processes
> ← [Главная / Home](home)


> **[🇷🇺 Русский](#русский)** | **[🇬🇧 English](#english)**

---

## Русский

### 1. Регистрация и аутентификация

```mermaid
flowchart TD
    A([Пользователь]) --> REG[Регистрация\nusername + email + password]
    REG --> VERIFY[Письмо с ссылкой верификации]
    VERIFY --> EMAIL_OK{Email\nверифицирован?}
    EMAIL_OK -->|Нет| RESEND[Переотправить письмо]
    RESEND --> EMAIL_OK
    EMAIL_OK -->|Да| LOGIN[Вход]
    LOGIN --> CREDS{Учётные данные\nверны?}
    CREDS -->|Нет| ERR[Ошибка входа]
    CREDS -->|Да| TFA{2FA\nвключена?}
    TFA -->|Нет| TOKENS[JWT access + refresh\nTokens выданы]
    TFA -->|TOTP| TOTP_INPUT[Введите 6-значный код]
    TFA -->|Telegram| TG_CODE[Код в Telegram]
    TOTP_INPUT --> TFA_OK{Код\nверен?}
    TG_CODE --> TFA_OK
    TFA_OK -->|Нет| ERR2[Неверный код]
    TFA_OK -->|Да| TOKENS
    TOKENS --> SESSION[Сессия создана\nIP + устройство + гео]
    SESSION --> APP([Приложение])
```

### 2. Загрузка книги

```mermaid
flowchart TD
    A([Пользователь]) --> UPLOAD[Загрузить файл\nEPUB / PDF / FB2 / TXT]
    UPLOAD --> VALIDATE{Формат и\nразмер OK?}
    VALIDATE -->|Нет| ERR[Ошибка валидации]
    VALIDATE -->|Да| EXTRACT[Извлечь метаданные\nиз файла]
    EXTRACT --> META_SEARCH[Параллельный поиск\nGoogle Books · Open Library\nЛитРес · Author.Today · Fantlab]
    META_SEARCH --> LLM_ON{ИИ-ассистент\nвключён?}
    LLM_ON -->|Да| LLM_SYNC[Синхронно:\nExtract text → LLM /analyze\nДобавить источник AI]
    LLM_ON -->|Нет| PANEL
    LLM_SYNC --> PANEL[MetadataPanel:\nвыбрать вариант метаданных]
    PANEL --> SAVE[Книга сохранена в PostgreSQL\nФайл в volume book_uploads]
    SAVE --> KAFKA{ИИ-рецензия\n нужна?}
    KAFKA -->|Да| PRODUCE[produce: sbrw.book.llm_analyze\nai_review_status = pending]
    KAFKA -->|Нет| DONE
    PRODUCE --> CONSUMER[kafka-worker:\nextract_book_text → LLM /analyze]
    CONSUMER --> REVIEW_SAVE[Сохранить ai_review\nстатус = done]
    REVIEW_SAVE --> DONE([Книга опубликована])
```

### 3. Загрузка аудиокниги

```mermaid
flowchart TD
    A([Пользователь]) --> FORM[Загрузить книгу →\nрежим «Аудиокнига»]
    FORM --> TARGET{Куда добавить?}

    TARGET -->|Новая аудиокнига| META[Заполнить метаданные\nназвание, автор, рассказчик, язык…]
    META --> CREATE[POST /books/create-audio\nКнига без файла создана]

    TARGET -->|К существующей книге| SEARCH[Поиск по названию\nlivesearch GET /books?q=…]
    SEARCH --> SELECT[Выбрать книгу\nпоказать уже загруженные главы]
    SELECT --> CREATE

    CREATE --> FILES[Выбрать аудиофайлы\nдетали каждой главы: номер + название]
    FILES --> UPLOAD_LOOP{Для каждой главы}
    UPLOAD_LOOP --> POST_CHAPTER[POST /books/id/audio\nмultipart/form-data]
    POST_CHAPTER --> NEXT{Ещё главы?}
    NEXT -->|Да| UPLOAD_LOOP
    NEXT -->|Нет| DONE

    DONE -->|Новая книга| NAV[Перейти на страницу книги]
    DONE -->|Существующая книга| STAY[Остаться на форме\nбаннер «Загружено» + кнопка «Перейти к книге»\nможно добавить ещё главы]
```

### 4. Прослушивание аудиокниги

```mermaid
flowchart TD
    A([Пользователь]) --> DETAIL[Страница книги\nпереключатель Текст / Аудио]
    DETAIL --> CHAPTERS[Список аудиоглав\nпрогресс-бар под каждой главой]
    CHAPTERS --> PLAY[Нажать Слушать]
    PLAY --> RESUME[GET /books/id/audio/progress\nвозобновление с последней главы и позиции]
    RESUME --> PLAYER[AudioPlayer: капсула\nцентрированная, плавающая над низом экрана]

    PLAYER --> STREAM[GET /books/id/audio/chapter_id/stream\nRange requests, 206 Partial Content]
    STREAM --> HTML5[HTML5 audio element]

    HTML5 --> CONTROLS{Управление}
    CONTROLS -->|Play/Pause| PLAYPAUSE[HTMLAudioElement.play / pause]
    CONTROLS -->|±30 сек| SKIP[currentTime ± 30]
    CONTROLS -->|Перемотка| SEEK[progressbar seek]
    CONTROLS -->|Скорость| RATE[playbackRate 0.75x / 1x / 1.25x / 1.5x / 2x]
    CONTROLS -->|Громкость| VOL[volume + mute]
    CONTROLS -->|Следующая глава| NEXT_CH[loadChapter: idx+1]
    CONTROLS -->|Список глав| LIST[Панель выбора главы]

    HTML5 -. каждые 10 сек, смена главы, закрытие .-> SAVE[POST /books/id/audio/progress\nchapter_id + position_seconds]
    PLAYER -->|Закрыть плеер| CLOSE[Кеш audio-progress инвалидируется\nпрогресс-бары глав обновляются]
```

### 5. Чтение книги

```mermaid
flowchart TD
    A([Пользователь]) --> LIST[Каталог книг\n или поиск]
    LIST --> DETAIL[Страница книги\nметаданные, рейтинг, рецензия, комментарии]
    DETAIL --> CHOICE{Действие}
    CHOICE -->|Читать онлайн| READER[Открыть читалку]
    CHOICE -->|Скачать| DOWNLOAD[Скачать в нужном формате]
    CHOICE -->|Другой формат| CONVERT[POST /books/id/convert\n→ Kafka → конвертация]

    READER --> FMT{Формат}
    FMT -->|EPUB| EPUBJS[epub.js рендеринг\nпо главам]
    FMT -->|PDF| PDFJS[pdf.js рендеринг\nпо страницам]

    EPUBJS --> NAV{Навигация}
    NAV -->|Мобильный\n касание слева/справа| PAGE[Перелистывание страницы]
    NAV -->|Мобильный\n касание по центру| TOGGLE[Скрыть / показать UI\nтулбар + прогресс-бар + кнопка чата]
    NAV -->|Десктоп| KEYS[← → клавиши\nили кнопки ChevronLeft/Right]
    PAGE --> PROGRESS
    TOGGLE --> PROGRESS
    KEYS --> PROGRESS

    EPUBJS --> PROGRESS[Сохранение прогресса\nCFI позиция]
    PDFJS --> PROGRESS
    PROGRESS --> ANNO{Аннотация?}
    ANNO -->|Да| CREATE_ANNO[Выделить текст →\nСоздать аннотацию\nцвет + заметка]
    ANNO -->|Нет| CONTINUE[Продолжить чтение]
    CREATE_ANNO --> CONTINUE
```

### 4. ИИ-анализ книги

```mermaid
flowchart TD
    TRIGGER([Триггер]) --> SRC{Источник}
    SRC -->|Загрузка книги| AUTO[Автоматически\nпосле загрузки]
    SRC -->|Редактирование| BTN[Кнопка ИИ-рецензия\nна странице редактирования]
    SRC -->|Админ-панель| ADMIN[POST /admin/llm/analyze/id]

    AUTO --> KAFKA_P[produce: sbrw.book.llm_analyze]
    BTN --> API[POST /books/id/analyze]
    ADMIN --> API
    API --> KAFKA_P

    KAFKA_P --> STATUS[ai_review_status = pending]
    STATUS --> KW[kafka-worker потребляет]
    KW --> READ[Прочитать файл книги\nдо 10 МБ]
    READ --> EXTRACT[extract_book_text\nEPUB / PDF / FB2 / TXT\nдо 18 000 символов]
    EXTRACT --> SETTINGS[Прочитать AppSettings:\nprovider, api_key, model, ollama_url]
    SETTINGS --> PROV{Провайдер}
    PROV -->|local| OLLAMA[Ollama API\nollama:11434]
    PROV -->|claude| CLAUDE[Anthropic API]
    PROV -->|openai| OPENAI[OpenAI API]
    PROV -->|gemini| GEMINI[Google Gemini API]
    PROV -->|deepseek| DS[DeepSeek API]

    OLLAMA --> LLM_RESP[JSON: review + metadata]
    CLAUDE --> LLM_RESP
    OPENAI --> LLM_RESP
    GEMINI --> LLM_RESP
    DS --> LLM_RESP

    LLM_RESP --> OK{Успех?}
    OK -->|Да| SAVE_REVIEW[Сохранить ai_review\nстатус = done]
    OK -->|Нет| ERR_STATUS[статус = error]

    SAVE_REVIEW --> DISPLAY[Отображение на странице книги\nблок ИИ-рецензия]
```

### 5. Telegram-бот загрузки (администратор)

```mermaid
flowchart TD
    A([Администратор]) --> TG[Отправить файл\nили архив боту]
    TG --> AUTH{Аккаунт\nпривязан?}
    AUTH -->|Нет| LINK[Привязать аккаунт:\nАдмин-панель → код → боту]
    LINK --> AUTH
    AUTH -->|Да| ROLE{Роль = admin?}
    ROLE -->|Нет| DENY[Доступ запрещён]
    ROLE -->|Да| DOWNLOAD[Скачать файл\nиз Telegram]
    DOWNLOAD --> EXTRACT[Извлечь метаданные\nиз файла]
    EXTRACT --> PREVIEW[Показать предпросмотр\nв Telegram inline-клавиатура]
    PREVIEW --> EDIT{Редактировать?}
    EDIT -->|Да| INLINE[Inline-редактирование\nнazвание / автор / год]
    INLINE --> PREVIEW
    EDIT -->|Подтвердить| CREATE[Создать книгу\nв системе]
    CREATE --> NOTIFY[Уведомление об успехе]
    CREATE --> KAFKA2[Если ИИ включён:\nproduce llm_analyze]
```

### 6. Настройка ИИ-провайдера в админ-панели

```mermaid
flowchart TD
    A([Администратор]) --> SETTINGS[Настройки → ИИ-ассистент]
    SETTINGS --> TOGGLE{Включить ИИ}
    TOGGLE -->|Вкл| PROV[Выбрать провайдер]
    TOGGLE -->|Выкл| SAVE_OFF[Сохранить: llm_enabled=false]

    PROV --> LOCAL{Провайдер}
    LOCAL -->|Локальный| OLLAMA_CFG[Указать URL Ollama\nВыбрать или скачать модель]
    LOCAL -->|Внешний| EXT_CFG[Ввести API-ключ\nУказать модель]

    OLLAMA_CFG --> PULL{Нужна\nновая модель?}
    PULL -->|Да| PULL_START[Ввести имя модели\nНажать Скачать]
    PULL_START --> SSE[SSE прогресс-бар\nстатус + % + ГБ]
    SSE --> PULL_DONE[Модель загружена\nсписок обновлён]
    PULL --> SAVE_CFG
    PULL_DONE --> SAVE_CFG

    EXT_CFG --> SAVE_CFG[Сохранить в AppSettings\nшифрование Fernet]
    SAVE_CFG --> TEST[Кнопка Тест → POST /admin/llm/test]
    TEST --> RESULT{Результат}
    RESULT -->|OK| OK_MSG[Зелёный бейдж: сервис работает]
    RESULT -->|Error| ERR_MSG[Красный бейдж: ошибка]
```

---

## English

### 1. Registration and Authentication

```mermaid
flowchart TD
    A([User]) --> REG[Register\nusername + email + password]
    REG --> VERIFY[Verification email sent]
    VERIFY --> EMAIL_OK{Email\nverified?}
    EMAIL_OK -->|No| RESEND[Resend email]
    RESEND --> EMAIL_OK
    EMAIL_OK -->|Yes| LOGIN[Login]
    LOGIN --> CREDS{Credentials\nvalid?}
    CREDS -->|No| ERR[Login error]
    CREDS -->|Yes| TFA{2FA\nenabled?}
    TFA -->|No| TOKENS[JWT access + refresh\ntokens issued]
    TFA -->|TOTP| TOTP_INPUT[Enter 6-digit code]
    TFA -->|Telegram| TG_CODE[Code via Telegram bot]
    TOTP_INPUT --> TFA_OK{Code\nvalid?}
    TG_CODE --> TFA_OK
    TFA_OK -->|No| ERR2[Invalid code]
    TFA_OK -->|Yes| TOKENS
    TOKENS --> SESSION[Session created\nIP + device + geo]
    SESSION --> APP([Application])
```

### 2. Book Upload

```mermaid
flowchart TD
    A([User]) --> UPLOAD[Upload file\nEPUB / PDF / FB2 / TXT]
    UPLOAD --> VALIDATE{Format and\nsize OK?}
    VALIDATE -->|No| ERR[Validation error]
    VALIDATE -->|Yes| EXTRACT[Extract metadata\nfrom file]
    EXTRACT --> META_SEARCH[Parallel metadata search\nGoogle Books · Open Library\nLitRes · Author.Today · Fantlab]
    META_SEARCH --> LLM_ON{AI assistant\nenabled?}
    LLM_ON -->|Yes| LLM_SYNC[Synchronous:\nExtract text → LLM /analyze\nAdd AI source to results]
    LLM_ON -->|No| PANEL
    LLM_SYNC --> PANEL[MetadataPanel:\nselect metadata variant]
    PANEL --> SAVE[Book saved to PostgreSQL\nFile saved to book_uploads volume]
    SAVE --> KAFKA{AI review\nneeded?}
    KAFKA -->|Yes| PRODUCE[produce: sbrw.book.llm_analyze\nai_review_status = pending]
    KAFKA -->|No| DONE
    PRODUCE --> CONSUMER[kafka-worker:\nextract_book_text → LLM /analyze]
    CONSUMER --> REVIEW_SAVE[Save ai_review\nstatus = done]
    REVIEW_SAVE --> DONE([Book published])
```

### 3. Uploading an Audiobook

```mermaid
flowchart TD
    A([User]) --> FORM[Upload Book →\nAudiobook mode]
    FORM --> TARGET{Where to add?}

    TARGET -->|New audiobook| META[Fill in metadata\ntitle, author, narrator, language…]
    META --> CREATE[POST /books/create-audio\nBook record created without a file]

    TARGET -->|Attach to existing book| SEARCH[Search by title\nlivesearch GET /books?q=…]
    SEARCH --> SELECT[Select book\nshow already-uploaded chapters]
    SELECT --> CREATE

    CREATE --> FILES[Select audio files\nper-chapter: number + title]
    FILES --> UPLOAD_LOOP{For each chapter}
    UPLOAD_LOOP --> POST_CHAPTER[POST /books/id/audio\nmultipart/form-data]
    POST_CHAPTER --> NEXT{More chapters?}
    NEXT -->|Yes| UPLOAD_LOOP
    NEXT -->|No| DONE

    DONE -->|New book| NAV[Navigate to book page]
    DONE -->|Existing book| STAY[Stay on form\n'Uploaded' banner + 'Go to book' button\nadd more chapters if needed]
```

### 4. Listening to an Audiobook

```mermaid
flowchart TD
    A([User]) --> DETAIL[Book page\nText / Audio toggle]
    DETAIL --> CHAPTERS[Audio chapter list\nprogress bar under each chapter]
    CHAPTERS --> PLAY[Click Listen]
    PLAY --> RESUME[GET /books/id/audio/progress\nresumes last chapter and position]
    RESUME --> PLAYER[AudioPlayer: capsule\ncentered, floating above the bottom edge]

    PLAYER --> STREAM[GET /books/id/audio/chapter_id/stream\nRange requests → 206 Partial Content]
    STREAM --> HTML5[HTML5 audio element]

    HTML5 --> CONTROLS{Controls}
    CONTROLS -->|Play/Pause| PLAYPAUSE[HTMLAudioElement.play / pause]
    CONTROLS -->|±30 sec| SKIP[currentTime ± 30]
    CONTROLS -->|Seek| SEEK[progress bar seek]
    CONTROLS -->|Speed| RATE[playbackRate 0.75 / 1 / 1.25 / 1.5 / 2×]
    CONTROLS -->|Volume| VOL[volume + mute]
    CONTROLS -->|Next chapter| NEXT_CH[loadChapter(idx + 1)]
    CONTROLS -->|Chapter list| LIST[Chapter selector panel]

    HTML5 -.every 10 sec / chapter change / close.-> SAVE[POST /books/id/audio/progress\nchapter_id + position_seconds]
    PLAYER -->|Close player| CLOSE[audio-progress cache invalidated\nchapter progress bars refresh]
```

### 5. Reading a Book

```mermaid
flowchart TD
    A([User]) --> LIST[Book catalog\nor search]
    LIST --> DETAIL[Book page\nmetadata, rating, AI review, comments]
    DETAIL --> CHOICE{Action}
    CHOICE -->|Read online| READER[Open reader]
    CHOICE -->|Download| DOWNLOAD[Download in selected format]
    CHOICE -->|Other format| CONVERT[POST /books/id/convert\n→ Kafka → conversion]

    READER --> FMT{Format}
    FMT -->|EPUB| EPUBJS[epub.js rendering\nchapter by chapter]
    FMT -->|PDF| PDFJS[pdf.js rendering\npage by page]

    EPUBJS --> PROGRESS[Save reading progress\nCFI position]
    PDFJS --> PROGRESS
    PROGRESS --> ANNO{Annotation?}
    ANNO -->|Yes| CREATE_ANNO[Select text →\nCreate annotation\ncolor + note]
    ANNO -->|No| CONTINUE[Continue reading]
    CREATE_ANNO --> CONTINUE
```

### 4. AI Book Analysis

```mermaid
flowchart TD
    TRIGGER([Trigger]) --> SRC{Source}
    SRC -->|Book upload| AUTO[Automatically\nafter upload]
    SRC -->|Book edit page| BTN[AI Review button]
    SRC -->|Admin panel| ADMIN[POST /admin/llm/analyze/id]

    AUTO --> KAFKA_P[produce: sbrw.book.llm_analyze]
    BTN --> API[POST /books/id/analyze]
    ADMIN --> API
    API --> KAFKA_P

    KAFKA_P --> STATUS[ai_review_status = pending]
    STATUS --> KW[kafka-worker consumes]
    KW --> READ[Read book file\nup to 10 MB]
    READ --> EXTRACT[extract_book_text()\nEPUB / PDF / FB2 / TXT\nup to 18 000 chars]
    EXTRACT --> SETTINGS[Read AppSettings:\nprovider, api_key, model, ollama_url]
    SETTINGS --> PROV{Provider}
    PROV -->|local| OLLAMA[Ollama API\nhttp://ollama:11434]
    PROV -->|claude| CLAUDE[Anthropic API]
    PROV -->|openai| OPENAI[OpenAI API]
    PROV -->|gemini| GEMINI[Google Gemini API]
    PROV -->|deepseek| DS[DeepSeek API]

    OLLAMA --> LLM_RESP[JSON: review + metadata]
    CLAUDE --> LLM_RESP
    OPENAI --> LLM_RESP
    GEMINI --> LLM_RESP
    DS --> LLM_RESP

    LLM_RESP --> OK{Success?}
    OK -->|Yes| SAVE_REVIEW[Save ai_review\nstatus = done]
    OK -->|No| ERR_STATUS[status = error]

    SAVE_REVIEW --> DISPLAY[Displayed on book page\nin the AI Review block]
```

### 5. Telegram Admin Upload Bot

```mermaid
flowchart TD
    A([Admin]) --> TG[Send file or archive\nto the bot]
    TG --> AUTH{Account\nlinked?}
    AUTH -->|No| LINK[Link account:\nAdmin panel → code → send to bot]
    LINK --> AUTH
    AUTH -->|Yes| ROLE{Role = admin?}
    ROLE -->|No| DENY[Access denied]
    ROLE -->|Yes| DOWNLOAD[Download file\nfrom Telegram]
    DOWNLOAD --> EXTRACT[Extract metadata\nfrom file]
    EXTRACT --> PREVIEW[Show preview\nwith inline keyboard]
    PREVIEW --> EDIT{Edit?}
    EDIT -->|Yes| INLINE[Inline editing\ntitle / author / year]
    INLINE --> PREVIEW
    EDIT -->|Confirm| CREATE[Create book\nin the system]
    CREATE --> NOTIFY[Success notification]
    CREATE --> KAFKA2[If AI enabled:\nproduce llm_analyze]
```

### 6. AI Provider Configuration in Admin Panel

```mermaid
flowchart TD
    A([Admin]) --> SETTINGS[Settings → AI Assistant]
    SETTINGS --> TOGGLE{Enable AI}
    TOGGLE -->|On| PROV[Select provider]
    TOGGLE -->|Off| SAVE_OFF[Save: llm_enabled=false]

    PROV --> LOCAL{Provider}
    LOCAL -->|Local| OLLAMA_CFG[Set Ollama URL\nSelect or pull model]
    LOCAL -->|External| EXT_CFG[Enter API key\nSet model name]

    OLLAMA_CFG --> PULL{Need a\nnew model?}
    PULL -->|Yes| PULL_START[Enter model name\nClick Pull]
    PULL_START --> SSE[SSE progress bar\nstatus + % + GB]
    SSE --> PULL_DONE[Model downloaded\nlist refreshed]
    PULL --> SAVE_CFG
    PULL_DONE --> SAVE_CFG

    EXT_CFG --> SAVE_CFG[Save to AppSettings\nFernet encryption]
    SAVE_CFG --> TEST[Test button → POST /admin/llm/test]
    TEST --> RESULT{Result}
    RESULT -->|OK| OK_MSG[Green badge: service healthy]
    RESULT -->|Error| ERR_MSG[Red badge: error details]
```
