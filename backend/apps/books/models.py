import uuid
from django.db import models
from django.conf import settings


class Author(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True, db_index=True)
    sort_name = models.CharField(max_length=255, null=True, blank=True)
    bio = models.TextField(null=True, blank=True)
    photo = models.CharField(max_length=500, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'authors'
        ordering = ['name']


class Series(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True, db_index=True)
    description = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'series'
        ordering = ['name']


class Tag(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True, db_index=True)

    class Meta:
        db_table = 'tags'
        ordering = ['name']


class Book(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=500, db_index=True)
    sort_title = models.CharField(max_length=500, null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    cover_path = models.CharField(max_length=500, null=True, blank=True)
    isbn = models.CharField(max_length=20, null=True, blank=True)
    language = models.CharField(max_length=10, null=True, blank=True, default='ru')
    published_year = models.IntegerField(null=True, blank=True)
    publisher = models.CharField(max_length=255, null=True, blank=True)
    page_count = models.IntegerField(null=True, blank=True)
    avg_rating = models.FloatField(default=0.0)
    rating_count = models.IntegerField(default=0)
    download_count = models.IntegerField(default=0)
    view_count = models.IntegerField(default=0)
    is_public = models.BooleanField(default=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='uploaded_books',
    )
    authors = models.ManyToManyField(Author, through='BookAuthor', related_name='books', blank=True)
    series = models.ManyToManyField(Series, through='BookSeries', related_name='books', blank=True)
    tags = models.ManyToManyField(Tag, through='BookTag', related_name='books', blank=True)
    narrator = models.CharField(max_length=255, null=True, blank=True)
    ai_review = models.TextField(null=True, blank=True)
    ai_review_status = models.CharField(max_length=20, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'books'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['is_public', '-created_at'], name='book_public_created_idx'),
            models.Index(fields=['-avg_rating'], name='book_avg_rating_idx'),
            models.Index(fields=['-download_count'], name='book_download_count_idx'),
            models.Index(fields=['language'], name='book_language_idx'),
        ]


class BookAuthor(models.Model):
    book = models.ForeignKey(Book, on_delete=models.CASCADE)
    author = models.ForeignKey(Author, on_delete=models.CASCADE)

    class Meta:
        db_table = 'book_authors'
        unique_together = ('book', 'author')


class BookSeries(models.Model):
    book = models.ForeignKey(Book, on_delete=models.CASCADE)
    series = models.ForeignKey(Series, on_delete=models.CASCADE)
    series_index = models.FloatField(null=True, blank=True)

    class Meta:
        db_table = 'book_series'
        unique_together = ('book', 'series')


class BookTag(models.Model):
    book = models.ForeignKey(Book, on_delete=models.CASCADE)
    tag = models.ForeignKey(Tag, on_delete=models.CASCADE)

    class Meta:
        db_table = 'book_tags'
        unique_together = ('book', 'tag')


class BookFile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name='files')
    format = models.CharField(max_length=20)
    file_path = models.CharField(max_length=500)
    file_size = models.BigIntegerField(null=True, blank=True)
    version_label = models.CharField(max_length=100, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'book_files'


class ReadingProgress(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reading_progress',
    )
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name='reading_progress')
    cfi_position = models.CharField(max_length=500, null=True, blank=True)
    percentage = models.FloatField(default=0.0)
    last_read = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'reading_progress'
        unique_together = ('user', 'book')
        indexes = [
            models.Index(fields=['user', '-last_read'], name='progress_user_last_read_idx'),
        ]


class Shelf(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='shelves',
    )
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    is_public = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'shelves'


class ShelfBook(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    shelf = models.ForeignKey(Shelf, on_delete=models.CASCADE, related_name='shelf_books')
    book = models.ForeignKey(Book, on_delete=models.CASCADE)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'shelf_books'
        unique_together = ('shelf', 'book')


class SeriesSubscription(models.Model):
    """Email notification subscription: «new book in this series»."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='series_subscriptions',
    )
    series = models.ForeignKey(Series, on_delete=models.CASCADE, related_name='subscriptions')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'series_subscriptions'
        unique_together = ('user', 'series')


class UserRating(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='ratings',
    )
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name='ratings')
    rating = models.IntegerField()
    review = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'user_ratings'
        unique_together = ('user', 'book')
        indexes = [
            models.Index(fields=['book', '-created_at'], name='rating_book_created_idx'),
        ]


ANNOTATION_COLORS = [
    ('yellow', 'yellow'),
    ('green', 'green'),
    ('blue', 'blue'),
    ('pink', 'pink'),
]


class Annotation(models.Model):
    """Reader highlight / note on a specific CFI position inside an epub."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='annotations',
    )
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name='annotations')
    cfi_range = models.CharField(max_length=1000)
    selected_text = models.TextField(null=True, blank=True)
    note = models.TextField(null=True, blank=True)
    color = models.CharField(max_length=20, choices=ANNOTATION_COLORS, default='yellow')
    is_public = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'annotations'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['book', 'user'], name='annotation_book_user_idx'),
            models.Index(fields=['book', 'is_public'], name='annotation_book_public_idx'),
        ]


class BookComment(models.Model):
    """Threaded discussion/comments on a book (public only)."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name='comments')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='book_comments',
    )
    parent = models.ForeignKey(
        'self',
        null=True, blank=True,
        on_delete=models.CASCADE,
        related_name='replies',
    )
    text = models.TextField(blank=True, default='')
    media_urls = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'book_comments'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['book', 'created_at'], name='comment_book_created_idx'),
            models.Index(fields=['parent'], name='comment_parent_idx'),
        ]


class AudioChapter(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name='audio_chapters')
    title = models.CharField(max_length=500)
    chapter_number = models.IntegerField(default=1)
    audio_file = models.CharField(max_length=500)
    duration_seconds = models.IntegerField(null=True, blank=True)
    file_size = models.BigIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'audio_chapters'
        ordering = ['chapter_number']
        unique_together = ('book', 'chapter_number')


class AudioListenProgress(models.Model):
    """Per-chapter listen progress so each chapter gets its own progress bar."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='audio_listen_progress',
    )
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name='listen_progress')
    chapter = models.ForeignKey(
        AudioChapter,
        on_delete=models.CASCADE,
        related_name='user_progress',
    )
    position_seconds = models.FloatField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'audio_listen_progress'
        unique_together = ('user', 'chapter')
