from rest_framework import serializers
from apps.users.serializers import compute_online_status
from .models import Book, Author, Series, Tag, BookFile, ReadingProgress, Shelf, ShelfBook, UserRating, Annotation, BookComment, AudioChapter


class AuthorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Author
        fields = ['id', 'name', 'sort_name', 'bio', 'photo', 'created_at']


class SeriesSerializer(serializers.ModelSerializer):
    class Meta:
        model = Series
        fields = ['id', 'name', 'description', 'created_at']


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ['id', 'name']


class BookFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = BookFile
        fields = ['id', 'format', 'file_size', 'version_label', 'created_at']


class BookShortSerializer(serializers.ModelSerializer):
    authors = AuthorSerializer(many=True, read_only=True)
    files = BookFileSerializer(many=True, read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    series = SeriesSerializer(many=True, read_only=True)

    class Meta:
        model = Book
        fields = [
            'id', 'title', 'sort_title', 'cover_path', 'language',
            'avg_rating', 'rating_count', 'download_count', 'view_count',
            'is_public', 'created_at', 'authors', 'files', 'tags', 'series',
        ]


class BookOutSerializer(BookShortSerializer):
    uploaded_by_id = serializers.UUIDField(source='uploaded_by.id', read_only=True, allow_null=True)
    convertible_to = serializers.SerializerMethodField()

    class Meta(BookShortSerializer.Meta):
        fields = BookShortSerializer.Meta.fields + [
            'description', 'isbn', 'published_year', 'publisher',
            'page_count', 'narrator', 'uploaded_by_id', 'updated_at', 'convertible_to',
            'ai_review', 'ai_review_status',
        ]

    def get_convertible_to(self, obj):
        from .services import get_conversion_targets
        existing = {f.format for f in obj.files.all()}
        return get_conversion_targets(existing)


class ProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReadingProgress
        fields = ['id', 'cfi_position', 'percentage', 'last_read']


class ProgressUpdateSerializer(serializers.Serializer):
    cfi_position = serializers.CharField(allow_null=True, required=False, default=None)
    percentage = serializers.FloatField()


class RatingSerializer(serializers.ModelSerializer):
    user_id = serializers.UUIDField(source='user.id', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    avatar = serializers.CharField(source='user.avatar', read_only=True, allow_null=True)
    online_status = serializers.SerializerMethodField()

    class Meta:
        model = UserRating
        fields = ['id', 'user_id', 'username', 'avatar', 'online_status', 'rating', 'review', 'created_at']

    def get_online_status(self, obj):
        return compute_online_status(obj.user)


class RatingCreateSerializer(serializers.Serializer):
    rating = serializers.IntegerField(min_value=1, max_value=5)
    review = serializers.CharField(allow_null=True, required=False, default=None)


class ShelfSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shelf
        fields = ['id', 'name', 'description', 'is_public', 'created_at']


class ShelfCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    description = serializers.CharField(allow_blank=True, required=False, default='')
    is_public = serializers.BooleanField(default=False)


class ShelfWithBooksSerializer(serializers.ModelSerializer):
    books = serializers.SerializerMethodField()

    class Meta:
        model = Shelf
        fields = ['id', 'name', 'description', 'is_public', 'created_at', 'books']

    def get_books(self, obj):
        book_ids = obj.shelf_books.values_list('book_id', flat=True)
        books = Book.objects.filter(id__in=book_ids).prefetch_related(
            'authors', 'files', 'tags', 'series'
        )
        return BookShortSerializer(books, many=True).data


class BookUpdateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=500, required=False)
    description = serializers.CharField(allow_null=True, required=False)
    isbn = serializers.CharField(max_length=20, allow_null=True, required=False)
    language = serializers.CharField(max_length=10, required=False)
    published_year = serializers.IntegerField(allow_null=True, required=False)
    publisher = serializers.CharField(max_length=255, allow_null=True, required=False)
    page_count = serializers.IntegerField(allow_null=True, required=False)
    narrator = serializers.CharField(max_length=255, allow_null=True, required=False)
    is_public = serializers.BooleanField(required=False)
    author_names = serializers.ListField(
        child=serializers.CharField(), required=False, allow_null=True
    )
    tag_names = serializers.ListField(
        child=serializers.CharField(), required=False, allow_null=True
    )
    series_names = serializers.ListField(
        child=serializers.CharField(), required=False, allow_null=True
    )
    cover_url = serializers.URLField(required=False, allow_null=True, allow_blank=True)


class AnnotationSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = Annotation
        fields = ['id', 'book_id', 'user_id', 'username', 'cfi_range', 'selected_text',
                  'note', 'color', 'is_public', 'created_at', 'updated_at']
        read_only_fields = ['id', 'user_id', 'username', 'book_id', 'created_at', 'updated_at']


class AnnotationCreateSerializer(serializers.Serializer):
    cfi_range = serializers.CharField(max_length=1000)
    selected_text = serializers.CharField(required=False, allow_blank=True, allow_null=True, default=None)
    note = serializers.CharField(required=False, allow_blank=True, allow_null=True, default=None)
    color = serializers.ChoiceField(choices=['yellow', 'green', 'blue', 'pink'], default='yellow')
    is_public = serializers.BooleanField(default=False)


class BookCommentSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    avatar = serializers.CharField(source='user.avatar', read_only=True)
    online_status = serializers.SerializerMethodField()
    replies = serializers.SerializerMethodField()

    class Meta:
        model = BookComment
        fields = ['id', 'book_id', 'user_id', 'username', 'avatar', 'online_status',
                  'parent_id', 'text', 'media_urls', 'replies', 'created_at', 'updated_at']
        read_only_fields = ['id', 'user_id', 'username', 'avatar', 'online_status', 'book_id', 'created_at', 'updated_at']

    def get_online_status(self, obj):
        return compute_online_status(obj.user)

    def get_replies(self, obj):
        if obj.parent_id is not None:
            return []
        return BookCommentSerializer(obj.replies.all(), many=True).data


class BookCommentCreateSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=5000, required=False, allow_blank=True, default='')
    media_urls = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    parent_id = serializers.UUIDField(required=False, allow_null=True, default=None)


class AudioChapterSerializer(serializers.ModelSerializer):
    class Meta:
        model = AudioChapter
        fields = ['id', 'title', 'chapter_number', 'duration_seconds', 'file_size', 'created_at']


class AudioChapterCreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=500)
    chapter_number = serializers.IntegerField(min_value=1)
    audio_file = serializers.FileField()
    duration_seconds = serializers.IntegerField(min_value=0, required=False, allow_null=True)
