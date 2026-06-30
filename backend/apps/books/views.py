import json
import math
import os

from django.core.serializers.json import DjangoJSONEncoder

from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.db.models import Q, Avg, Count
from django.http import FileResponse, Http404
from django.conf import settings
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

from apps.users.permissions import IsAdmin, IsModerator
from apps.core import cache as book_cache
from apps.core import kafka_client
from .models import (
    Book, Author, Series, Tag, BookFile, ReadingProgress,
    Shelf, ShelfBook, UserRating, SeriesSubscription,
    Annotation, BookComment, AudioChapter, AudioListenProgress,
)
from .serializers import (
    BookOutSerializer, BookShortSerializer, BookUpdateSerializer,
    BookFileSerializer,
    AuthorSerializer, SeriesSerializer, TagSerializer,
    ProgressSerializer, ProgressUpdateSerializer,
    RatingSerializer, RatingCreateSerializer,
    ShelfSerializer, ShelfCreateSerializer, ShelfWithBooksSerializer,
    AnnotationSerializer, AnnotationCreateSerializer,
    BookCommentSerializer, BookCommentCreateSerializer,
    AudioChapterSerializer, AudioChapterCreateSerializer,
)
from .services import (
    get_file_format, save_book_file, save_cover, extract_metadata, extract_book_text,
    delete_book_files, download_cover_from_url, convert_book_file, conversion_available,
    djvu_conversion_available, pick_conversion_source, get_conversion_targets, CONVERT_OUTPUT_FORMATS,
)
from .llm_client import llm_is_enabled, call_llm_service


def _broadcast_discussion(book_id, event_type, data):
    """Broadcast a discussion event to all WebSocket subscribers for this book."""
    layer = get_channel_layer()
    if layer:
                                                                                        
        safe_data = json.loads(json.dumps(data, cls=DjangoJSONEncoder))
        async_to_sync(layer.group_send)(
            f'book_{book_id}_discussions',
            {'type': event_type, 'data': safe_data},
        )


def _notify_series_subscribers(book, series, request):
    """Email everyone subscribed to this series about the new book."""
    from apps.core.email import smtp_is_configured, send_new_book_in_series_email, get_site_url
    if not smtp_is_configured():
        return
    site_url = get_site_url(request)
    subs = SeriesSubscription.objects.filter(series=series).select_related('user')
    for sub in subs:
        if sub.user.is_active and sub.user_id != getattr(request.user, 'id', None):
            send_new_book_in_series_email(sub.user, book, series, site_url)


BOOK_PREFETCH = ['authors', 'files', 'series', 'tags']

SORT_FIELDS = {
    'created_at', 'title', 'avg_rating', 'download_count', 'view_count', 'published_year'
}


class OptionalJWTAuthentication(JWTAuthentication):
    """Returns None (anonymous) on any auth failure instead of raising."""
    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except (InvalidToken, TokenError, Exception):
            return None



class BookListView(APIView):
    authentication_classes = [OptionalJWTAuthentication]
    permission_classes = [AllowAny]

    def get(self, request):
        page = int(request.query_params.get('page', 1))
        page_size = min(int(request.query_params.get('page_size', 24)), 100)
        search = request.query_params.get('search')
        author_id = request.query_params.get('author_id')
        series_id = request.query_params.get('series_id')
        tag_id = request.query_params.get('tag_id')
        language = request.query_params.get('language')
        fmt = request.query_params.get('format')
        sort = request.query_params.get('sort', 'created_at')
        order = request.query_params.get('order', 'desc')

        qs = Book.objects.prefetch_related(*BOOK_PREFETCH)

        if not (request.user and request.user.is_authenticated and request.user.role != 'user'):
            qs = qs.filter(is_public=True)

        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(authors__name__icontains=search)).distinct()
        if author_id:
            qs = qs.filter(authors__id=author_id)
        if series_id:
            qs = qs.filter(series__id=series_id)
        if tag_id:
            qs = qs.filter(tags__id=tag_id)
        if language:
            qs = qs.filter(language=language)
        if fmt:
            qs = qs.filter(files__format=fmt.lower()).distinct()

        sort_field = sort if sort in SORT_FIELDS else 'created_at'
        qs = qs.order_by(f'-{sort_field}' if order == 'desc' else sort_field)

        total = qs.count()
        offset = (page - 1) * page_size
        books = list(qs[offset:offset + page_size])

        return Response({
            'items': BookShortSerializer(books, many=True).data,
            'total': total,
            'page': page,
            'page_size': page_size,
            'pages': math.ceil(total / page_size) if total else 0,
        })


class RecentBooksView(APIView):
    authentication_classes = [OptionalJWTAuthentication]
    permission_classes = [AllowAny]

    def get(self, request):
        limit = min(int(request.query_params.get('limit', 12)), 50)
        cached = book_cache.get_recent(limit)
        if cached is not None:
            return Response(cached)
        books = Book.objects.filter(is_public=True).prefetch_related(*BOOK_PREFETCH).order_by('-created_at')[:limit]
        data = BookShortSerializer(books, many=True).data
        book_cache.set_recent(limit, data)
        return Response(data)


class PopularBooksView(APIView):
    authentication_classes = [OptionalJWTAuthentication]
    permission_classes = [AllowAny]

    def get(self, request):
        limit = min(int(request.query_params.get('limit', 12)), 50)
        cached = book_cache.get_popular(limit)
        if cached is not None:
            return Response(cached)
        books = Book.objects.filter(is_public=True).prefetch_related(*BOOK_PREFETCH).order_by('-download_count')[:limit]
        data = BookShortSerializer(books, many=True).data
        book_cache.set_popular(limit, data)
        return Response(data)


class TopRatedBooksView(APIView):
    authentication_classes = [OptionalJWTAuthentication]
    permission_classes = [AllowAny]

    def get(self, request):
        limit = min(int(request.query_params.get('limit', 12)), 50)
        cached = book_cache.get_top_rated(limit)
        if cached is not None:
            return Response(cached)
        books = (
            Book.objects.filter(is_public=True, rating_count__gte=1)
            .prefetch_related(*BOOK_PREFETCH)
            .order_by('-avg_rating')[:limit]
        )
        data = BookShortSerializer(books, many=True).data
        book_cache.set_top_rated(limit, data)
        return Response(data)


class BookDetailView(APIView):
    authentication_classes = [OptionalJWTAuthentication]
    permission_classes = [AllowAny]

    def get(self, request, book_id):
        cached = book_cache.get_book(book_id)
        if cached is not None:
                                                                
            try:
                Book.objects.filter(id=book_id).update(view_count=cached.get('view_count', 0) + 1)
                cached['view_count'] = cached.get('view_count', 0) + 1
                book_cache.set_book(book_id, cached)
            except Exception:
                pass
            return Response(cached)

        try:
            book = Book.objects.prefetch_related(*BOOK_PREFETCH).get(id=book_id)
        except Book.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)

        if not book.is_public:
            if not (request.user and request.user.is_authenticated and request.user.role != 'user'):
                return Response({'detail': 'Access denied'}, status=403)

        Book.objects.filter(id=book_id).update(view_count=book.view_count + 1)
        book.refresh_from_db(fields=['view_count'])
        data = BookOutSerializer(book).data
        book_cache.set_book(book_id, data)
        return Response(data)

    def put(self, request, book_id):
        if not request.user.is_authenticated:
            return Response({'detail': 'Authentication required'}, status=401)
        try:
            book = Book.objects.prefetch_related(*BOOK_PREFETCH).get(id=book_id)
        except Book.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)

        if str(book.uploaded_by_id) != str(request.user.id) and request.user.role not in ('admin', 'moderator'):
            return Response({'detail': 'Forbidden'}, status=403)

        serializer = BookUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        update_fields = []
        for field in ('title', 'description', 'isbn', 'language', 'published_year', 'publisher', 'page_count', 'narrator', 'is_public'):
            if field in d:
                setattr(book, field, d[field])
                update_fields.append(field)
        if update_fields:
            book.save(update_fields=update_fields)

        if 'author_names' in d and d['author_names'] is not None:
            book.authors.clear()
            for name in d['author_names']:
                author, _ = Author.objects.get_or_create(name=name.strip(), defaults={'sort_name': name.strip()})
                book.authors.add(author)

        if 'tag_names' in d and d['tag_names'] is not None:
            book.tags.clear()
            for name in d['tag_names']:
                tag, _ = Tag.objects.get_or_create(name=name.strip().lower())
                book.tags.add(tag)

        if 'series_names' in d and d['series_names'] is not None:
            book.series.clear()
            for name in d['series_names']:
                s, _ = Series.objects.get_or_create(name=name.strip())
                book.series.add(s)

        if d.get('cover_url'):
            if download_cover_from_url(d['cover_url'], str(book_id)):
                book.cover_path = f'/uploads/covers/{book_id}.jpg'
                book.save(update_fields=['cover_path'])

        book.refresh_from_db()
        data = BookOutSerializer(Book.objects.prefetch_related(*BOOK_PREFETCH).get(id=book_id)).data
        book_cache.invalidate_book(book_id)
        book_cache.invalidate_lists()
        return Response(data)

    def delete(self, request, book_id):
        if not request.user.is_authenticated:
            return Response({'detail': 'Authentication required'}, status=401)
        try:
            book = Book.objects.get(id=book_id)
        except Book.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)

        if str(book.uploaded_by_id) != str(request.user.id) and request.user.role not in ('admin', 'moderator'):
            return Response({'detail': 'Forbidden'}, status=403)

        delete_book_files(str(book_id))
        cover = os.path.join(settings.MEDIA_ROOT, 'covers', f'{book_id}.jpg')
        if os.path.exists(cover):
            os.remove(cover)
        book.delete()
        book_cache.invalidate_book(book_id)
        book_cache.invalidate_lists()
        return Response({'success': True})


class BookVisibilityView(APIView):
    """PATCH — toggle or set is_public on a book (admin/moderator only)."""

    def patch(self, request, book_id):
        if not request.user.is_authenticated or request.user.role not in ('admin', 'moderator'):
            return Response({'detail': 'Forbidden'}, status=403)
        try:
            book = Book.objects.get(id=book_id)
        except Book.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)

        if 'is_public' in request.data:
            book.is_public = bool(request.data['is_public'])
        else:
            book.is_public = not book.is_public

        book.save(update_fields=['is_public'])
        book_cache.invalidate_book(book_id)
        book_cache.invalidate_lists()
        return Response({'id': str(book.id), 'is_public': book.is_public})


class BookMetadataSearchView(APIView):
    """
    GET  ?title=...&authors=...  — search online only (no file).
    POST multipart file           — extract from file, then search online.
    """
    authentication_classes = [OptionalJWTAuthentication]
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        from .metadata_parsers import search_all
        title = request.query_params.get('title', '').strip()
        authors_raw = request.query_params.get('authors', '').strip()
        if not title and not authors_raw:
            return Response({'detail': 'title or authors required'}, status=400)
        authors = [a.strip() for a in authors_raw.split(',') if a.strip()]
        return Response(search_all(title, authors))

    def post(self, request):
        from .metadata_parsers import search_all
        file_obj = request.FILES.get('file')
        file_meta: dict = {}
        file_data: bytes = b''

        if file_obj:
            fmt = get_file_format(file_obj.name or '')
            if fmt:
                file_data = file_obj.read(10 * 1024 * 1024)
                file_meta = extract_metadata(file_data, fmt)

        title = (request.data.get('title') or file_meta.get('title') or '').strip()
        authors_raw = request.data.get('authors', '')
        authors = (
            [a.strip() for a in authors_raw.split(',') if a.strip()]
            if authors_raw
            else file_meta.get('authors', [])
        )

        search_result: dict = {}
        if title or authors:
            search_result = search_all(title, authors)


        return Response({
            'file_meta': {
                'title': file_meta.get('title', ''),
                'authors': file_meta.get('authors', []),
                'description': file_meta.get('description', ''),
                'language': file_meta.get('language', ''),
                'publisher': file_meta.get('publisher', ''),
                'isbn': file_meta.get('isbn', ''),
                'page_count': file_meta.get('page_count'),
                'published_year': file_meta.get('published_year'),
                'has_cover': bool(file_meta.get('cover_data')),
            },
            **search_result,
        })


class BookUploadView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'detail': 'No file provided'}, status=400)

        file_data = file_obj.read()
        if len(file_data) > settings.MAX_UPLOAD_SIZE:
            return Response({'detail': 'File too large'}, status=413)

        fmt = get_file_format(file_obj.name or '')
        if not fmt:
            return Response(
                {'detail': 'Unsupported format. Allowed: epub, pdf, mobi, fb2, txt, djvu, doc, docx, rtf'},
                status=400,
            )

        meta = extract_metadata(file_data, fmt)
        raw_filename = (file_obj.name or 'Unknown').rsplit('.', 1)[0]
                                                                        
        if ' - ' in raw_filename:
            filename_base = raw_filename.split(' - ', 1)[1].strip()
        else:
            filename_base = raw_filename.replace('_', ' ').strip()

                                                                    
        def _coerce_int(val):
            try:
                return int(val) if val else None
            except (TypeError, ValueError):
                return None

        title = request.data.get('title') or meta.get('title') or filename_base
        language = request.data.get('language') or meta.get('language') or 'ru'
        description = request.data.get('description') or meta.get('description')
        publisher = request.data.get('publisher') or meta.get('publisher')
        isbn = request.data.get('isbn') or meta.get('isbn')
        page_count = _coerce_int(request.data.get('page_count')) or meta.get('page_count')
        published_year = _coerce_int(request.data.get('published_year')) or meta.get('published_year')

        book = Book.objects.create(
            title=title,
            sort_title=title.lower(),
            description=description,
            language=language,
            publisher=publisher,
            isbn=isbn,
            page_count=page_count,
            published_year=published_year,
            uploaded_by=request.user,
        )

        file_path, file_size = save_book_file(file_data, str(book.id), fmt)
        BookFile.objects.create(book=book, format=fmt, file_path=file_path, file_size=file_size)

                                                                             
        cover_url = (request.data.get('cover_url') or '').strip()
        cover_saved = False
        if cover_url:
            cover_saved = bool(download_cover_from_url(cover_url, str(book.id)))
        if not cover_saved and meta.get('cover_data'):
            cover_saved = bool(save_cover(meta['cover_data'], str(book.id)))
        if cover_saved:
            book.cover_path = f'/uploads/covers/{book.id}.jpg'
            book.save(update_fields=['cover_path'])

        author_str = request.data.get('author', '')
        author_names = (
            [a.strip() for a in author_str.split(',') if a.strip()]
            if author_str
            else meta.get('authors', [])
        )
        for name in author_names:
            author, _ = Author.objects.get_or_create(name=name, defaults={'sort_name': name})
            book.authors.add(author)

        series_name = (request.data.get('series') or meta.get('series') or '').strip()
        if series_name:
            s, created = Series.objects.get_or_create(name=series_name)
            book.series.add(s)
            if not created:
                _notify_series_subscribers(book, s, request)

        tags_str = request.data.get('tags', '')
        if tags_str:
            for tag_name in [t.strip().lower() for t in tags_str.split(',') if t.strip()]:
                tag, _ = Tag.objects.get_or_create(name=tag_name)
                book.tags.add(tag)

                                                              
        book_cache.invalidate_lists()
        book_cache.invalidate_tags()

                                                        
        if llm_is_enabled():
            book.ai_review_status = 'pending'
            book.save(update_fields=['ai_review_status'])
            kafka_client.produce(kafka_client.TOPIC_LLM_ANALYZE, {
                'book_id': str(book.id),
                'file_path': file_path,
                'title': title,
                'authors': author_names,
            }, key=str(book.id))

        return Response(
            BookOutSerializer(Book.objects.prefetch_related(*BOOK_PREFETCH).get(id=book.id)).data,
            status=201,
        )


class AudioBookCreateView(APIView):
    """POST — create a Book entry for a standalone or attached audiobook (no text file required)."""

    def post(self, request):
        if not request.user.is_authenticated:
            return Response({'detail': 'Authentication required'}, status=401)

        def _int(v):
            try:
                return int(v) if v else None
            except (TypeError, ValueError):
                return None

        title = (request.data.get('title') or '').strip()
        if not title:
            return Response({'detail': 'title is required'}, status=400)

        language = (request.data.get('language') or 'ru').strip()
        book = Book.objects.create(
            title=title,
            sort_title=title.lower(),
            description=(request.data.get('description') or '').strip() or None,
            language=language,
            publisher=(request.data.get('publisher') or '').strip() or None,
            isbn=(request.data.get('isbn') or '').strip() or None,
            page_count=_int(request.data.get('page_count')),
            published_year=_int(request.data.get('published_year')),
            narrator=(request.data.get('narrator') or '').strip() or None,
            uploaded_by=request.user,
        )

        cover_url = (request.data.get('cover_url') or '').strip()
        if cover_url:
            if download_cover_from_url(cover_url, str(book.id)):
                book.cover_path = f'/uploads/covers/{book.id}.jpg'
                book.save(update_fields=['cover_path'])

        for name in [a.strip() for a in (request.data.get('author') or '').split(',') if a.strip()]:
            author, _ = Author.objects.get_or_create(name=name, defaults={'sort_name': name})
            book.authors.add(author)

        series_name = (request.data.get('series') or '').strip()
        if series_name:
            s, created = Series.objects.get_or_create(name=series_name)
            book.series.add(s)
            if not created:
                _notify_series_subscribers(book, s, request)

        tags_str = request.data.get('tags', '')
        if tags_str:
            for tag_name in [t.strip().lower() for t in tags_str.split(',') if t.strip()]:
                tag, _ = Tag.objects.get_or_create(name=tag_name)
                book.tags.add(tag)

        book_cache.invalidate_lists()
        return Response(
            BookOutSerializer(Book.objects.prefetch_related(*BOOK_PREFETCH).get(id=book.id)).data,
            status=201,
        )


class BookAnalyzeView(APIView):
    """POST /api/books/<id>/analyze — trigger async AI review via Kafka (used by upload flow)."""

    def post(self, request, book_id):
        try:
            book = Book.objects.prefetch_related('authors', 'files').get(id=book_id)
        except Book.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)

        if not llm_is_enabled():
            return Response({'detail': 'LLM is disabled'}, status=400)

        book_file = book.files.first()
        if not book_file:
            return Response({'detail': 'No book file available'}, status=400)

        author_names = [a.name for a in book.authors.all()]
        book.ai_review_status = 'pending'
        book.save(update_fields=['ai_review_status'])

        kafka_client.produce(kafka_client.TOPIC_LLM_ANALYZE, {
            'book_id': str(book.id),
            'file_path': book_file.file_path,
            'title': book.title,
            'authors': author_names,
        }, key=str(book.id))
        return Response({'status': 'pending'})


class BookAnalyzeStreamView(APIView):
    """POST /api/books/<id>/analyze/stream — SSE streaming AI review with thinking output.

    Returns a Server-Sent Events stream. Message types:
      {"type": "status",   "message": "..."}
      {"type": "thinking", "content": "token"}
      {"type": "done",     "review": "...", "metadata": {...}}
      {"type": "error",    "message": "..."}
    """
    STREAM_TIMEOUT = 300           

    def post(self, request, book_id):
        import json as _json
        import requests as req
        from django.http import StreamingHttpResponse
        from .services import extract_book_text
        from .llm_client import _get, llm_is_enabled

        if not llm_is_enabled():
            return Response({'detail': 'LLM is disabled'}, status=400)

        try:
            book = Book.objects.prefetch_related('authors', 'files').get(id=book_id)
        except Book.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)

        book_file = book.files.first()
        if not book_file:
            return Response({'detail': 'No book file available'}, status=400)

                                    
        file_path = book_file.file_path
        if not os.path.isabs(file_path):
            file_path = os.path.join('/app/uploads', file_path)
        if not os.path.exists(file_path):
            return Response({'detail': 'Book file not found on disk'}, status=404)

        author_names = [a.name for a in book.authors.all()]
        fmt = book_file.format.lower()

                                                 
        Book.objects.filter(id=book_id).update(ai_review_status='pending')

        LLM_URL = os.environ.get('LLM_SERVICE_URL', 'http://llm:8100')
        provider = _get('llm_provider', 'local')
        api_key  = _get('llm_api_key', '')
        model    = _get('llm_model', '')
        ollama_url = _get('llm_ollama_url', 'http://ollama:11434')

        def _sse(msg: dict) -> str:
            return f"data: {_json.dumps(msg, ensure_ascii=False)}\n\n"

        def generate():
            try:
                yield _sse({"type": "status", "message": "Извлечение текста из книги…"})

                with open(file_path, 'rb') as fh:
                    file_data = fh.read(10 * 1024 * 1024)

                text = extract_book_text(file_data, fmt)
                if not text:
                    yield _sse({"type": "error", "message": "Не удалось извлечь текст из файла"})
                    Book.objects.filter(id=book_id).update(ai_review_status='error')
                    return

                yield _sse({"type": "status", "message": f"Отправка в ИИ ({provider})…"})

                resp = req.post(
                    f"{LLM_URL}/analyze-stream",
                    json={
                        "text": text,
                        "title": book.title,
                        "authors": author_names,
                        "provider": provider,
                        "api_key": api_key,
                        "model": model,
                        "ollama_url": ollama_url,
                    },
                    stream=True,
                    timeout=self.STREAM_TIMEOUT + 30,
                )
                resp.raise_for_status()

                review_text = None
                buf = ""
                for chunk in resp.iter_content(chunk_size=None, decode_unicode=True):
                    buf += chunk
                                                
                    while "\n\n" in buf:
                        event, buf = buf.split("\n\n", 1)
                        for line in event.split("\n"):
                            if not line.startswith("data: "):
                                continue
                            raw = line[6:].strip()
                            if not raw:
                                continue
                            try:
                                msg = _json.loads(raw)
                            except _json.JSONDecodeError:
                                continue

                            if msg.get("type") == "done":
                                review_text = msg.get("review")
                                Book.objects.filter(id=book_id).update(
                                    ai_review=review_text or "",
                                    ai_review_status="done",
                                )
                            elif msg.get("type") == "error":
                                Book.objects.filter(id=book_id).update(ai_review_status="error")

                            yield _sse(msg)

            except req.exceptions.Timeout:
                Book.objects.filter(id=book_id).update(ai_review_status='error')
                yield _sse({"type": "error", "message": f"Таймаут {self.STREAM_TIMEOUT}s — ИИ не ответил"})
            except Exception as exc:
                Book.objects.filter(id=book_id).update(ai_review_status='error')
                yield _sse({"type": "error", "message": str(exc)})

        response = StreamingHttpResponse(generate(), content_type='text/event-stream')
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response


class BookDownloadView(APIView):
    authentication_classes = [OptionalJWTAuthentication]
    permission_classes = [AllowAny]

    def get(self, request, book_id, fmt):
        try:
            book_file = BookFile.objects.select_related('book').get(book_id=book_id, format=fmt.lower())
        except BookFile.DoesNotExist:
            return Response({'detail': 'File not found'}, status=404)

        book = book_file.book
        if not book.is_public:
            user = request.user
            if not (user and user.is_authenticated):
                return Response({'detail': 'Authentication required'}, status=401)
            if str(book.uploaded_by_id) != str(user.id) and getattr(user, 'role', '') not in ('admin', 'moderator'):
                return Response({'detail': 'Forbidden'}, status=403)

        if not os.path.exists(book_file.file_path):
            return Response({'detail': 'File missing from storage'}, status=404)

        Book.objects.filter(id=book_id).update(download_count=Book.objects.get(id=book_id).download_count + 1)
                                                               
        book_cache.invalidate_book(book_id)
                                                 
        kafka_client.emit_book_downloaded(
            book_id=str(book_id),
            fmt=fmt,
            user_id=str(request.user.id) if request.user and request.user.is_authenticated else None,
        )

        from urllib.parse import quote as _url_quote
        safe_title = ''.join(c for c in book_file.book.title if c.isalnum() or c in ' _-').strip()[:100]
        safe_ascii = ''.join(c for c in safe_title if ord(c) < 128).strip() or 'book'
        mime_map = {
            'epub': 'application/epub+zip',
            'pdf': 'application/pdf',
            'mobi': 'application/x-mobipocket-ebook',
            'fb2': 'application/x-fictionbook+xml',
            'txt': 'text/plain',
            'djvu': 'image/vnd.djvu',
        }
        response = FileResponse(
            open(book_file.file_path, 'rb'),
            content_type=mime_map.get(fmt, 'application/octet-stream'),
        )
        response['Content-Disposition'] = (
            f"attachment; filename=\"{safe_ascii}.{fmt}\"; "
            f"filename*=UTF-8''{_url_quote(safe_title, safe='')}.{fmt}"
        )
        return response


class BookConvertView(APIView):
    """POST {target_format} — convert an existing file to another format."""

    def post(self, request, book_id):
        target = (request.data.get('target_format') or '').strip().lower()
        if target not in CONVERT_OUTPUT_FORMATS:
            return Response(
                {'detail': f'Unsupported target format. Allowed: {", ".join(sorted(CONVERT_OUTPUT_FORMATS))}'},
                status=400,
            )

        try:
            book = Book.objects.prefetch_related('files').get(id=book_id)
        except Book.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)

        existing = {f.format for f in book.files.all()}
        if target in existing:
            return Response({'detail': 'This format already exists'}, status=400)
        if target not in get_conversion_targets(existing):
            return Response({'detail': 'Conversion to this format is not possible for this book'}, status=400)

        src_fmt = pick_conversion_source(existing)
        src_file = book.files.get(format=src_fmt)
        if not os.path.exists(src_file.file_path):
            return Response({'detail': 'Source file missing from storage'}, status=404)

        try:
            dst_path, dst_size = convert_book_file(src_file.file_path, str(book.id), target)
        except Exception as exc:
            return Response({'detail': f'Conversion failed: {exc}'}, status=500)

        BookFile.objects.create(book=book, format=target, file_path=dst_path, file_size=dst_size)
        return Response(
            BookOutSerializer(Book.objects.prefetch_related(*BOOK_PREFETCH).get(id=book_id)).data,
            status=201,
        )


class BookReadView(APIView):
    authentication_classes = [OptionalJWTAuthentication]
    permission_classes = [AllowAny]

                                                                               
    _CONVERT_TO = {'fb2': 'epub', 'djvu': 'pdf'}

    def get(self, request, book_id):
        fmt = request.query_params.get('fmt', 'epub').lower()
        target_fmt = self._CONVERT_TO.get(fmt, fmt)

                                                       
        try:
            book = Book.objects.get(id=book_id)
        except Book.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)

        if not book.is_public:
            user = request.user
            if not (user and user.is_authenticated):
                return Response({'detail': 'Authentication required'}, status=401)
            if str(book.uploaded_by_id) != str(user.id) and getattr(user, 'role', '') not in ('admin', 'moderator'):
                return Response({'detail': 'Forbidden'}, status=403)

                                                                         
        if fmt in self._CONVERT_TO:
            book_file = self._get_or_convert(book, fmt, target_fmt)
        else:
            try:
                book_file = BookFile.objects.get(book=book, format=fmt)
            except BookFile.DoesNotExist:
                return Response({'detail': 'File not found'}, status=404)

        if book_file is None:
            return Response({'detail': 'File not found and conversion unavailable'}, status=404)

        if not os.path.exists(book_file.file_path):
            return Response({'detail': 'File missing from storage'}, status=404)

        mime_map = {'epub': 'application/epub+zip', 'pdf': 'application/pdf'}
        response = FileResponse(
            open(book_file.file_path, 'rb'),
            content_type=mime_map.get(book_file.format, 'application/octet-stream'),
        )
        response['Access-Control-Allow-Origin'] = '*'
        return response

    def _get_or_convert(self, book, src_fmt: str, target_fmt: str):
        """Return a BookFile in target_fmt, auto-converting from src_fmt if needed."""
                                         
        try:
            return BookFile.objects.get(book=book, format=target_fmt)
        except BookFile.DoesNotExist:
            pass

                                              
        try:
            src_file = BookFile.objects.get(book=book, format=src_fmt)
        except BookFile.DoesNotExist:
            return None

        if not os.path.exists(src_file.file_path):
            return None

                                                                       
        if src_fmt == 'djvu':
            if not djvu_conversion_available():
                return None
        else:
            if not conversion_available():
                return None

        try:
            dst_path, dst_size = convert_book_file(src_file.file_path, str(book.id), target_fmt)
        except Exception:
            return None

        return BookFile.objects.create(
            book=book, format=target_fmt, file_path=dst_path, file_size=dst_size
        )


class BookCoverView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, book_id):
        try:
            book = Book.objects.get(id=book_id)
        except Book.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)

        if str(book.uploaded_by_id) != str(request.user.id) and request.user.role not in ('admin', 'moderator'):
            return Response({'detail': 'Forbidden'}, status=403)

        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'detail': 'No file provided'}, status=400)

        if not save_cover(file_obj.read(), str(book_id)):
            return Response({'detail': 'Invalid image'}, status=400)

        book.cover_path = f'/uploads/covers/{book_id}.jpg'
        book.save(update_fields=['cover_path'])
        return Response({'cover_path': book.cover_path})


class BookProgressView(APIView):
    def get(self, request, book_id):
        try:
            prog = ReadingProgress.objects.get(user=request.user, book_id=book_id)
        except ReadingProgress.DoesNotExist:
            return Response({'detail': 'No progress found'}, status=404)
        return Response(ProgressSerializer(prog).data)

    def post(self, request, book_id):
        serializer = ProgressUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        prog, _ = ReadingProgress.objects.update_or_create(
            user=request.user,
            book_id=book_id,
            defaults={'cfi_position': d.get('cfi_position'), 'percentage': d['percentage']},
        )
        return Response({'success': True})


def _recalc_book_rating(book_id):
    agg = UserRating.objects.filter(book_id=book_id).aggregate(
        avg=Avg('rating'), cnt=Count('id')
    )
    Book.objects.filter(id=book_id).update(
        avg_rating=float(agg['avg'] or 0),
        rating_count=agg['cnt'],
    )
    book_cache.invalidate_book(book_id)
    book_cache.invalidate_lists()


class BookRateView(APIView):
    def get(self, request, book_id):
        """Return current user's rating for this book, or 404."""
        try:
            r = UserRating.objects.get(user=request.user, book_id=book_id)
            return Response(RatingSerializer(r).data)
        except UserRating.DoesNotExist:
            return Response({'detail': 'No rating yet'}, status=404)

    def post(self, request, book_id):
        has_progress = ReadingProgress.objects.filter(
            user=request.user, book_id=book_id
        ).exists()
        if not has_progress:
            return Response(
                {'detail': 'You must read the book before leaving a review'},
                status=403,
            )

        serializer = RatingCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        rating_obj, _ = UserRating.objects.update_or_create(
            user=request.user,
            book_id=book_id,
            defaults={'rating': d['rating'], 'review': d.get('review')},
        )
        _recalc_book_rating(book_id)
        return Response(RatingSerializer(rating_obj).data, status=201)

    def delete(self, request, book_id):
        """Delete current user's own rating."""
        try:
            r = UserRating.objects.get(user=request.user, book_id=book_id)
        except UserRating.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        r.delete()
        _recalc_book_rating(book_id)
        return Response({'success': True})


class BookRatingsView(APIView):
    authentication_classes = [OptionalJWTAuthentication]
    permission_classes = [AllowAny]

    def get(self, request, book_id):
        ratings = UserRating.objects.filter(book_id=book_id).order_by('-created_at')
        return Response(RatingSerializer(ratings, many=True).data)


class BookRatingDetailView(APIView):
    """Admin/moderator can delete any rating by ID."""

    def delete(self, request, book_id, rating_id):
        if getattr(request.user, 'role', '') not in ('admin', 'moderator'):
            return Response({'detail': 'Forbidden'}, status=403)
        try:
            r = UserRating.objects.get(id=rating_id, book_id=book_id)
        except UserRating.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        r.delete()
        _recalc_book_rating(book_id)
        return Response({'success': True})



class AuthorListView(APIView):
    authentication_classes = [OptionalJWTAuthentication]
    permission_classes = [AllowAny]

    def get(self, request):
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 50))
        search = request.query_params.get('search')
        cached = book_cache.get_authors(page, search)
        if cached is not None:
            return Response(cached)
        qs = Author.objects.all()
        if search:
            qs = qs.filter(name__icontains=search)
        total = qs.count()
        offset = (page - 1) * page_size
        data = {
            'items': AuthorSerializer(qs[offset:offset + page_size], many=True).data,
            'total': total,
        }
        book_cache.set_authors(page, search, data)
        return Response(data)


class AuthorDetailView(APIView):
    authentication_classes = [OptionalJWTAuthentication]
    permission_classes = [AllowAny]

    def get(self, request, author_id):
        try:
            author = Author.objects.get(id=author_id)
        except Author.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        return Response(AuthorSerializer(author).data)

    def put(self, request, author_id):
        if not (request.user.is_authenticated and request.user.role in ('admin', 'moderator')):
            return Response({'detail': 'Forbidden'}, status=403)
        try:
            author = Author.objects.get(id=author_id)
        except Author.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        for field in ('name', 'sort_name', 'bio', 'photo'):
            if field in request.data:
                setattr(author, field, request.data[field])
        author.save()
        return Response(AuthorSerializer(author).data)


class AuthorBooksView(APIView):
    authentication_classes = [OptionalJWTAuthentication]
    permission_classes = [AllowAny]

    def get(self, request, author_id):
        books = Book.objects.filter(authors__id=author_id, is_public=True).prefetch_related(*BOOK_PREFETCH)
        return Response(BookShortSerializer(books, many=True).data)



class SeriesListView(APIView):
    authentication_classes = [OptionalJWTAuthentication]
    permission_classes = [AllowAny]

    def get(self, request):
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 50))
        search = request.query_params.get('search')
        cached = book_cache.get_series(page, search)
        if cached is not None:
            return Response(cached)
        qs = Series.objects.all()
        if search:
            qs = qs.filter(name__icontains=search)
        total = qs.count()
        offset = (page - 1) * page_size
        data = {
            'items': SeriesSerializer(qs[offset:offset + page_size], many=True).data,
            'total': total,
        }
        book_cache.set_series(page, search, data)
        return Response(data)


class SeriesDetailView(APIView):
    authentication_classes = [OptionalJWTAuthentication]
    permission_classes = [AllowAny]

    def get(self, request, series_id):
        try:
            s = Series.objects.get(id=series_id)
        except Series.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        return Response(SeriesSerializer(s).data)


class SeriesBooksView(APIView):
    authentication_classes = [OptionalJWTAuthentication]
    permission_classes = [AllowAny]

    def get(self, request, series_id):
        books = Book.objects.filter(series__id=series_id, is_public=True).prefetch_related(*BOOK_PREFETCH)
        return Response(BookShortSerializer(books, many=True).data)


class SeriesSubscriptionView(APIView):
    """Subscribe / unsubscribe to email alerts about new books in a series."""

    def get(self, request, series_id):
        subscribed = SeriesSubscription.objects.filter(
            user=request.user, series_id=series_id
        ).exists()
        return Response({'subscribed': subscribed})

    def post(self, request, series_id):
        if not Series.objects.filter(id=series_id).exists():
            return Response({'detail': 'Not found'}, status=404)
        SeriesSubscription.objects.get_or_create(user=request.user, series_id=series_id)
        return Response({'subscribed': True}, status=201)

    def delete(self, request, series_id):
        SeriesSubscription.objects.filter(user=request.user, series_id=series_id).delete()
        return Response({'subscribed': False})



class TagListView(APIView):
    authentication_classes = [OptionalJWTAuthentication]
    permission_classes = [AllowAny]

    def get(self, request):
        cached = book_cache.get_tags()
        if cached is not None:
            return Response(cached)
        data = TagSerializer(Tag.objects.all(), many=True).data
        book_cache.set_tags(data)
        return Response(data)



class ShelfListView(APIView):
    def get(self, request):
        shelves = Shelf.objects.filter(user=request.user)
        return Response(ShelfSerializer(shelves, many=True).data)

    def post(self, request):
        serializer = ShelfCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        shelf = Shelf.objects.create(
            user=request.user,
            name=d['name'],
            description=d.get('description', ''),
            is_public=d.get('is_public', False),
        )
        return Response(ShelfSerializer(shelf).data, status=201)


class ShelfDetailView(APIView):
    def get(self, request, shelf_id):
        try:
            shelf = Shelf.objects.prefetch_related('shelf_books__book').get(id=shelf_id)
        except Shelf.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        if str(shelf.user_id) != str(request.user.id) and not shelf.is_public:
            return Response({'detail': 'Forbidden'}, status=403)
        return Response(ShelfWithBooksSerializer(shelf).data)

    def delete(self, request, shelf_id):
        try:
            shelf = Shelf.objects.get(id=shelf_id, user=request.user)
        except Shelf.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        shelf.delete()
        return Response({'success': True})


class ShelfBookView(APIView):
    def post(self, request, shelf_id, book_id):
        try:
            shelf = Shelf.objects.get(id=shelf_id, user=request.user)
        except Shelf.DoesNotExist:
            return Response({'detail': 'Shelf not found'}, status=404)
        if not Book.objects.filter(id=book_id).exists():
            return Response({'detail': 'Book not found'}, status=404)
        ShelfBook.objects.get_or_create(shelf=shelf, book_id=book_id)
        return Response({'success': True}, status=201)

    def delete(self, request, shelf_id, book_id):
        try:
            shelf = Shelf.objects.get(id=shelf_id, user=request.user)
        except Shelf.DoesNotExist:
            return Response({'detail': 'Shelf not found'}, status=404)
        ShelfBook.objects.filter(shelf=shelf, book_id=book_id).delete()
        return Response({'success': True})



class AnnotationListView(APIView):
    """GET all annotations for a book (own + public others), POST to create."""
    authentication_classes = [OptionalJWTAuthentication]
    permission_classes = [AllowAny]

    def get(self, request, book_id):
        from django.db.models import Q
        user = request.user
        if user and user.is_authenticated:
            qs = Annotation.objects.filter(
                Q(book_id=book_id, user=user) | Q(book_id=book_id, is_public=True)
            ).select_related('user').distinct()
        else:
            qs = Annotation.objects.filter(book_id=book_id, is_public=True).select_related('user')
        return Response(AnnotationSerializer(qs, many=True).data)

    def post(self, request, book_id):
        if not (request.user and request.user.is_authenticated):
            return Response({'detail': 'Authentication required'}, status=401)
        if not Book.objects.filter(id=book_id).exists():
            return Response({'detail': 'Book not found'}, status=404)
        s = AnnotationCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        ann = Annotation.objects.create(
            user=request.user, book_id=book_id, **d
        )
        return Response(AnnotationSerializer(ann).data, status=201)


class AnnotationDetailView(APIView):
    """PATCH / DELETE a specific annotation (owner only)."""

    def _get_own(self, request, annotation_id):
        try:
            return Annotation.objects.get(id=annotation_id, user=request.user)
        except Annotation.DoesNotExist:
            return None

    def patch(self, request, book_id, annotation_id):
        ann = self._get_own(request, annotation_id)
        if not ann:
            return Response({'detail': 'Not found'}, status=404)
        for field in ('note', 'color', 'is_public'):
            if field in request.data:
                setattr(ann, field, request.data[field])
        ann.save()
        return Response(AnnotationSerializer(ann).data)

    def delete(self, request, book_id, annotation_id):
        ann = self._get_own(request, annotation_id)
        if not ann:
            return Response({'detail': 'Not found'}, status=404)
        ann.delete()
        return Response({'success': True})



class BookCommentListView(APIView):
    """GET threaded comments for a book, POST to create a new root comment or reply."""
    authentication_classes = [OptionalJWTAuthentication]
    permission_classes = [AllowAny]

    def get(self, request, book_id):
        qs = (
            BookComment.objects
            .filter(book_id=book_id, parent__isnull=True)
            .select_related('user')
            .prefetch_related('replies__user')
            .order_by('created_at')
        )
        return Response(BookCommentSerializer(qs, many=True).data)

    def post(self, request, book_id):
        if not (request.user and request.user.is_authenticated):
            return Response({'detail': 'Authentication required'}, status=401)
        if not Book.objects.filter(id=book_id).exists():
            return Response({'detail': 'Book not found'}, status=404)
        s = BookCommentCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        text = d.get('text', '').strip()
        media_urls = d.get('media_urls') or []
        if not text and not media_urls:
            return Response({'detail': 'text or media_urls required'}, status=400)
        parent_id = d.get('parent_id')
        if parent_id:
            try:
                parent = BookComment.objects.get(id=parent_id, book_id=book_id)
                                                                            
                if parent.parent_id:
                    parent_id = parent.parent_id
            except BookComment.DoesNotExist:
                return Response({'detail': 'Parent comment not found'}, status=404)
        comment = BookComment.objects.create(
            book_id=book_id, user=request.user,
            parent_id=parent_id, text=text, media_urls=media_urls,
        )
        serialized = BookCommentSerializer(comment).data
        _broadcast_discussion(book_id, 'discussion.new', serialized)
        return Response(serialized, status=201)


class BookCommentDetailView(APIView):
    """PATCH (edit text) / DELETE (owner or admin/mod) a comment."""

    def _get_comment(self, request, comment_id):
        try:
            return BookComment.objects.get(id=comment_id)
        except BookComment.DoesNotExist:
            return None

    def _can_modify(self, request, comment):
        if comment.user_id == request.user.id:
            return True
        return getattr(request.user, 'role', '') in ('admin', 'moderator')

    def patch(self, request, book_id, comment_id):
        c = self._get_comment(request, comment_id)
        if not c or not self._can_modify(request, c):
            return Response({'detail': 'Not found or forbidden'}, status=404)
        text = request.data.get('text', '').strip()
        if not text:
            return Response({'detail': 'Text required'}, status=400)
        c.text = text
        c.save()
        return Response(BookCommentSerializer(c).data)

    def delete(self, request, book_id, comment_id):
        c = self._get_comment(request, comment_id)
        if not c or not self._can_modify(request, c):
            return Response({'detail': 'Not found or forbidden'}, status=404)
        delete_payload = {'type': 'deleted', 'id': str(c.id), 'parent_id': str(c.parent_id) if c.parent_id else None}
        c.delete()
        _broadcast_discussion(book_id, 'discussion.delete', delete_payload)
        return Response({'success': True})



class MediaUploadView(APIView):
    """Upload images, GIFs and videos for use in discussions, reviews and chat."""
    parser_classes = [MultiPartParser, FormParser]

    ALLOWED_IMAGE = {'image/jpeg', 'image/png', 'image/gif', 'image/webp'}
    ALLOWED_VIDEO = {'video/mp4', 'video/webm', 'video/ogg'}
    MAX_SIZE = 20 * 1024 * 1024         

    def post(self, request):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'detail': 'No file provided'}, status=400)

        content_type = file_obj.content_type or ''
        if content_type not in self.ALLOWED_IMAGE | self.ALLOWED_VIDEO:
            return Response({'detail': 'Unsupported file type'}, status=400)

        data = file_obj.read()
        if len(data) > self.MAX_SIZE:
            return Response({'detail': 'File too large (max 20 MB)'}, status=400)

        ext_map = {
            'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
            'image/webp': 'webp', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/ogg': 'ogg',
        }
        ext = ext_map.get(content_type, 'bin')

        import uuid as _uuid
        import os as _os
        media_dir = _os.path.join(settings.MEDIA_ROOT, 'media_uploads')
        _os.makedirs(media_dir, exist_ok=True)
        filename = f'{_uuid.uuid4()}.{ext}'
        path = _os.path.join(media_dir, filename)
        with open(path, 'wb') as f:
            f.write(data)

        url = f'/uploads/media_uploads/{filename}'
        return Response({'url': url, 'content_type': content_type})


class BookFilesView(APIView):
    """POST: add a new file version to an existing book."""
    parser_classes = [MultiPartParser, FormParser]

    def _check_permission(self, request, book):
        return request.user.role in ('admin', 'moderator') or book.uploaded_by == request.user

    def get(self, request, book_id):
        try:
            book = Book.objects.get(id=book_id)
        except Book.DoesNotExist:
            return Response({'detail': 'Book not found'}, status=404)
        return Response(BookFileSerializer(book.files.all().order_by('created_at'), many=True).data)

    def post(self, request, book_id):
        try:
            book = Book.objects.get(id=book_id)
        except Book.DoesNotExist:
            return Response({'detail': 'Book not found'}, status=404)

        if not self._check_permission(request, book):
            return Response({'detail': 'Forbidden'}, status=403)

        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'detail': 'No file provided'}, status=400)

        file_data = file_obj.read()
        if len(file_data) > settings.MAX_UPLOAD_SIZE:
            return Response({'detail': 'File too large'}, status=413)

        fmt = get_file_format(file_obj.name or '')
        if not fmt:
            return Response({'detail': 'Unsupported format'}, status=400)

        version_label = (request.data.get('version_label') or '').strip()

        import uuid as _uuid
        suffix = f'_{_uuid.uuid4().hex[:8]}' if version_label else ''
        file_name = f'book{suffix}.{fmt}'
        book_dir = os.path.join(settings.MEDIA_ROOT, 'books', str(book.id))
        os.makedirs(book_dir, exist_ok=True)
        file_path = os.path.join(book_dir, file_name)
        with open(file_path, 'wb') as f:
            f.write(file_data)

        bf = BookFile.objects.create(
            book=book,
            format=fmt,
            file_path=file_path,
            file_size=len(file_data),
            version_label=version_label,
        )

        book_cache.invalidate_book(str(book.id))
        book_cache.invalidate_lists()
        return Response(BookFileSerializer(bf).data, status=201)


class BookFileDetailView(APIView):
    """PATCH: update version_label. DELETE: remove file."""

    def _get_objects(self, request, book_id, file_id):
        try:
            book = Book.objects.get(id=book_id)
        except Book.DoesNotExist:
            return None, None, Response({'detail': 'Book not found'}, status=404)
        if not (request.user.role in ('admin', 'moderator') or book.uploaded_by == request.user):
            return None, None, Response({'detail': 'Forbidden'}, status=403)
        try:
            bf = BookFile.objects.get(id=file_id, book=book)
        except BookFile.DoesNotExist:
            return None, None, Response({'detail': 'File not found'}, status=404)
        return book, bf, None

    def patch(self, request, book_id, file_id):
        book, bf, err = self._get_objects(request, book_id, file_id)
        if err:
            return err
        if 'version_label' in request.data:
            bf.version_label = (request.data['version_label'] or '').strip()
            bf.save(update_fields=['version_label'])
        book_cache.invalidate_book(str(book.id))
        return Response(BookFileSerializer(bf).data)

    def delete(self, request, book_id, file_id):
        book, bf, err = self._get_objects(request, book_id, file_id)
        if err:
            return err
        if BookFile.objects.filter(book=bf.book).count() <= 1:
            return Response({'detail': 'Cannot delete the only file'}, status=400)
        if os.path.exists(bf.file_path):
            os.remove(bf.file_path)
        bf.delete()
        book_cache.invalidate_book(str(book.id))
        book_cache.invalidate_lists()
        return Response(status=204)


AUDIO_FORMATS = {'mp3', 'm4a', 'm4b', 'ogg', 'flac', 'aac', 'opus'}
AUDIO_MIME = {
    'mp3': 'audio/mpeg',
    'm4a': 'audio/mp4',
    'm4b': 'audio/mp4',
    'ogg': 'audio/ogg',
    'flac': 'audio/flac',
    'aac': 'audio/aac',
    'opus': 'audio/ogg; codecs=opus',
}


class AudioChapterListView(APIView):
    """GET list audio chapters / POST upload a new chapter."""

    parser_classes = [MultiPartParser, FormParser]

    def get(self, request, book_id):
        try:
            book = Book.objects.get(id=book_id)
        except Book.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        chapters = book.audio_chapters.all()
        return Response(AudioChapterSerializer(chapters, many=True).data)

    def post(self, request, book_id):
        user = request.user
        if not (user and user.is_authenticated):
            return Response({'detail': 'Authentication required'}, status=401)
        try:
            book = Book.objects.get(id=book_id)
        except Book.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        is_privileged = getattr(user, 'role', '') in ('admin', 'moderator')
        is_uploader = book.uploaded_by_id and book.uploaded_by_id == user.id
        if not (is_privileged or is_uploader):
            return Response({'detail': 'Forbidden'}, status=403)

        ser = AudioChapterCreateSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=400)

        audio_file = ser.validated_data['audio_file']
        ext = os.path.splitext(audio_file.name)[1].lstrip('.').lower()
        if ext not in AUDIO_FORMATS:
            return Response({'detail': f'Unsupported audio format: {ext}'}, status=400)

        upload_dir = os.path.join(settings.MEDIA_ROOT, 'audio', str(book_id))
        os.makedirs(upload_dir, exist_ok=True)
        chapter_num = ser.validated_data['chapter_number']
        filename = f'chapter_{chapter_num:04d}.{ext}'
        file_path = os.path.join(upload_dir, filename)

        with open(file_path, 'wb') as f:
            for chunk in audio_file.chunks():
                f.write(chunk)

        chapter, _ = AudioChapter.objects.update_or_create(
            book=book,
            chapter_number=chapter_num,
            defaults={
                'title': ser.validated_data['title'],
                'audio_file': file_path,
                'duration_seconds': ser.validated_data.get('duration_seconds'),
                'file_size': os.path.getsize(file_path),
            },
        )
        return Response(AudioChapterSerializer(chapter).data, status=201)


class AudioChapterDetailView(APIView):
    """DELETE a single audio chapter."""

    def delete(self, request, book_id, chapter_id):
        user = request.user
        if not (user and user.is_authenticated):
            return Response({'detail': 'Authentication required'}, status=401)
        try:
            chapter = AudioChapter.objects.select_related('book').get(id=chapter_id, book_id=book_id)
        except AudioChapter.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        is_privileged = getattr(user, 'role', '') in ('admin', 'moderator')
        is_uploader = chapter.book.uploaded_by_id and chapter.book.uploaded_by_id == user.id
        if not (is_privileged or is_uploader):
            return Response({'detail': 'Forbidden'}, status=403)
        if os.path.exists(chapter.audio_file):
            os.remove(chapter.audio_file)
        chapter.delete()
        return Response(status=204)


class AudioChapterStreamView(APIView):
    """GET stream an audio chapter with Range request support."""

    # <audio> elements can't send Authorization headers; auth is handled
    # manually inside get() using the ?token= query param fallback.
    permission_classes = []

    def get(self, request, book_id, chapter_id):
        try:
            chapter = AudioChapter.objects.select_related('book').get(
                id=chapter_id, book_id=book_id
            )
        except AudioChapter.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)

        book = chapter.book
        if not book.is_public:
            user = request.user
            # <audio> elements can't send Authorization headers, so we accept
            # the JWT as a ?token= query param as a fallback.
            if not (user and user.is_authenticated):
                raw_token = request.GET.get('token')
                if raw_token:
                    try:
                        from rest_framework_simplejwt.tokens import AccessToken as JWTToken
                        from django.contrib.auth import get_user_model
                        payload = JWTToken(raw_token)
                        user = get_user_model().objects.get(id=payload['user_id'])
                    except Exception:
                        return Response({'detail': 'Authentication required'}, status=401)
                else:
                    return Response({'detail': 'Authentication required'}, status=401)
            if str(book.uploaded_by_id) != str(user.id) and getattr(user, 'role', '') not in ('admin', 'moderator'):
                return Response({'detail': 'Forbidden'}, status=403)

        file_path = chapter.audio_file
        if not os.path.exists(file_path):
            return Response({'detail': 'Audio file missing'}, status=404)

        ext = os.path.splitext(file_path)[1].lstrip('.').lower()
        content_type = AUDIO_MIME.get(ext, 'audio/mpeg')
        file_size = os.path.getsize(file_path)

        range_header = request.META.get('HTTP_RANGE', '').strip()
        if range_header.startswith('bytes='):
            ranges = range_header[6:].split('-')
            start = int(ranges[0]) if ranges[0] else 0
            end = int(ranges[1]) if ranges[1] else file_size - 1
            end = min(end, file_size - 1)
            length = end - start + 1

            from django.http import StreamingHttpResponse

            def _iter_file(path, offset, size, chunk=64 * 1024):
                with open(path, 'rb') as f:
                    f.seek(offset)
                    remaining = size
                    while remaining > 0:
                        data = f.read(min(chunk, remaining))
                        if not data:
                            break
                        remaining -= len(data)
                        yield data

            resp = StreamingHttpResponse(
                _iter_file(file_path, start, length),
                status=206,
                content_type=content_type,
            )
            resp['Content-Range'] = f'bytes {start}-{end}/{file_size}'
            resp['Accept-Ranges'] = 'bytes'
            resp['Content-Length'] = str(length)
            return resp

        resp = FileResponse(open(file_path, 'rb'), content_type=content_type)
        resp['Accept-Ranges'] = 'bytes'
        resp['Content-Length'] = str(file_size)
        return resp


class BookTOCView(APIView):
    """GET table of contents extracted from the epub file."""

    def get(self, request, book_id):
        try:
            book = Book.objects.get(id=book_id)
        except Book.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)

        epub_file = book.files.filter(format='epub').first()
        if not epub_file or not os.path.exists(epub_file.file_path):
            return Response({'chapters': []})

        try:
            import ebooklib
            from ebooklib import epub as epub_lib

            eb = epub_lib.read_epub(epub_file.file_path, options={'ignore_ncx': False})

            def flatten_toc(items, depth=0):
                result = []
                for item in items:
                    if isinstance(item, tuple):
                        section, children = item
                        result.append({'title': section.title, 'href': getattr(section, 'href', ''), 'depth': depth})
                        result.extend(flatten_toc(children, depth + 1))
                    elif hasattr(item, 'title'):
                        result.append({'title': item.title, 'href': getattr(item, 'href', ''), 'depth': depth})
                return result

            chapters = flatten_toc(eb.toc)
            return Response({'chapters': chapters})
        except Exception:
            return Response({'chapters': []})


class AudioProgressView(APIView):
    """GET/POST per-chapter audio listening progress."""

    def get(self, request, book_id):
        user = request.user
        if not (user and user.is_authenticated):
            return Response({'detail': 'Authentication required'}, status=401)
        rows = AudioListenProgress.objects.filter(user=user, book_id=book_id).select_related('chapter')
        # Return dict keyed by chapter_id for O(1) frontend lookup.
        # Also include the most-recently-updated chapter so the player can resume.
        data = {str(r.chapter_id): r.position_seconds for r in rows}
        last = max(rows, key=lambda r: r.updated_at, default=None)
        return Response({
            'chapters': data,
            'resume_chapter_id': str(last.chapter_id) if last else None,
            'resume_position_seconds': last.position_seconds if last else 0,
        })

    def post(self, request, book_id):
        user = request.user
        if not (user and user.is_authenticated):
            return Response({'detail': 'Authentication required'}, status=401)
        chapter_id = request.data.get('chapter_id')
        try:
            position = float(request.data.get('position_seconds', 0))
        except (TypeError, ValueError):
            return Response({'detail': 'Invalid position_seconds'}, status=400)
        if not chapter_id:
            return Response({'detail': 'chapter_id required'}, status=400)
        try:
            chapter = AudioChapter.objects.get(id=chapter_id, book_id=book_id)
        except AudioChapter.DoesNotExist:
            return Response({'detail': 'Chapter not found'}, status=404)
        AudioListenProgress.objects.update_or_create(
            user=user, chapter=chapter,
            defaults={'book_id': book_id, 'position_seconds': position},
        )
        return Response({'status': 'ok'})
