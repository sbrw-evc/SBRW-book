"""
OPDS 1.2 catalog (Atom).  Root navigation feed plus acquisition feeds:
all/new/popular books, by author, by series, by tag, and full-text search
with an OpenSearch description document.  Public books only.
"""
from datetime import datetime, timezone

from django.db.models import Q, Count
from django.http import HttpResponse
from django.views import View

OPDS_NAV = 'application/atom+xml;profile=opds-catalog;kind=navigation'
OPDS_ACQ = 'application/atom+xml;profile=opds-catalog;kind=acquisition'
OPENSEARCH = 'application/opensearchdescription+xml'

PAGE_SIZE = 30

MIME_MAP = {
    'epub': 'application/epub+zip',
    'pdf': 'application/pdf',
    'mobi': 'application/x-mobipocket-ebook',
    'azw3': 'application/x-mobi8-ebook',
    'fb2': 'application/x-fictionbook+xml',
    'txt': 'text/plain',
    'djvu': 'image/vnd.djvu',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'rtf': 'application/rtf',
    'doc': 'application/msword',
}


def xe(s) -> str:
    if not s:
        return ''
    return (str(s).replace('&', '&amp;').replace('<', '&lt;')
            .replace('>', '&gt;').replace('"', '&quot;'))


def _now() -> str:
    return datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def _feed(feed_id: str, title: str, base: str, self_href: str,
          entries: str, kind: str = OPDS_ACQ, extra_links: str = '') -> HttpResponse:
    content = f"""<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:dc="http://purl.org/dc/terms/"
      xmlns:opds="http://opds-spec.org/2010/catalog">
  <id>urn:sbrw:{feed_id}</id>
  <title>{xe(title)}</title>
  <updated>{_now()}</updated>
  <author><name>SBRW Books</name></author>
  <link rel="self" href="{self_href}" type="{kind}"/>
  <link rel="start" href="{base}/opds" type="{OPDS_NAV}"/>
  <link rel="search" href="{base}/opds/opensearch.xml" type="{OPENSEARCH}"/>
  {extra_links}
  {entries}
</feed>"""
    return HttpResponse(content, content_type=kind)


def _nav_entry(base: str, path: str, title: str, summary: str, kind: str = OPDS_ACQ) -> str:
    return f"""
  <entry>
    <id>urn:sbrw:nav:{xe(path)}</id>
    <title>{xe(title)}</title>
    <updated>{_now()}</updated>
    <link href="{base}/opds{path}" type="{kind}"/>
    <content type="text">{xe(summary)}</content>
  </entry>"""


def _book_entry(base: str, book) -> str:
    authors_xml = ''.join(
        f'<author><name>{xe(a.name)}</name></author>' for a in book.authors.all()
    )
    cats = ''.join(
        f'<category term="{xe(t.name)}" label="{xe(t.name)}"/>' for t in book.tags.all()
    )
    links = ''
    for f in book.files.all():
        mime = MIME_MAP.get(f.format, 'application/octet-stream')
        links += (
            f'<link rel="http://opds-spec.org/acquisition" '
            f'href="{base}/api/books/{book.id}/download/{f.format}" type="{mime}"/>'
        )
    if book.cover_path:
        links += (
            f'<link rel="http://opds-spec.org/image" '
            f'href="{base}{book.cover_path}" type="image/jpeg"/>'
            f'<link rel="http://opds-spec.org/image/thumbnail" '
            f'href="{base}{book.cover_path}" type="image/jpeg"/>'
        )
    extra = ''
    if book.language:
        extra += f'<dc:language>{xe(book.language)}</dc:language>'
    if book.published_year:
        extra += f'<dc:issued>{book.published_year}</dc:issued>'
    if book.publisher:
        extra += f'<dc:publisher>{xe(book.publisher)}</dc:publisher>'
    if book.isbn:
        extra += f'<dc:identifier>urn:isbn:{xe(book.isbn)}</dc:identifier>'

    updated = book.created_at.strftime('%Y-%m-%dT%H:%M:%SZ')
    return f"""
  <entry>
    <id>urn:sbrw:book:{book.id}</id>
    <title>{xe(book.title)}</title>
    {authors_xml}
    <updated>{updated}</updated>
    {extra}
    {cats}
    <content type="text">{xe(book.description or '')}</content>
    {links}
  </entry>"""


def _paginated_books(request, qs, feed_id, title, path):
    base = request.build_absolute_uri('/').rstrip('/')
    try:
        page = max(int(request.GET.get('page', 0)), 0)
    except ValueError:
        page = 0

    total = qs.count()
    books = list(qs[page * PAGE_SIZE:(page + 1) * PAGE_SIZE])
    sep = '&' if '?' in path else '?'

    extra_links = ''
    if (page + 1) * PAGE_SIZE < total:
        extra_links += f'<link rel="next" href="{base}/opds{path}{sep}page={page + 1}" type="{OPDS_ACQ}"/>'
    if page > 0:
        extra_links += f'<link rel="previous" href="{base}/opds{path}{sep}page={page - 1}" type="{OPDS_ACQ}"/>'

    entries = ''.join(_book_entry(base, b) for b in books)
    return _feed(
        f'{feed_id}:{page}', title, base,
        f'{base}/opds{path}{sep}page={page}',
        entries, OPDS_ACQ, extra_links,
    )


def _public_books():
    from apps.books.models import Book
    return Book.objects.filter(is_public=True).prefetch_related('authors', 'files', 'tags')


class OpdsRootView(View):
    def get(self, request):
        base = request.build_absolute_uri('/').rstrip('/')
        entries = (
            _nav_entry(base, '/books', 'Все книги / All Books', 'Каталог всех книг')
            + _nav_entry(base, '/books?sort=new', 'Новинки / New', 'Недавно добавленные книги')
            + _nav_entry(base, '/books?sort=popular', 'Популярное / Popular', 'Самые скачиваемые книги')
            + _nav_entry(base, '/authors', 'Авторы / Authors', 'Книги по авторам', OPDS_NAV)
            + _nav_entry(base, '/series', 'Серии / Series', 'Книги по сериям', OPDS_NAV)
            + _nav_entry(base, '/genres', 'Жанры / Genres', 'Книги по жанрам', OPDS_NAV)
        )
        return _feed('root', 'SBRW Books', base, f'{base}/opds', entries, OPDS_NAV)


class OpenSearchView(View):
    def get(self, request):
        base = request.build_absolute_uri('/').rstrip('/')
        content = f"""<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>SBRW Books</ShortName>
  <Description>Search books in the SBRW library</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <OutputEncoding>UTF-8</OutputEncoding>
  <Url type="{OPDS_ACQ}" template="{base}/opds/search?q={{searchTerms}}"/>
</OpenSearchDescription>"""
        return HttpResponse(content, content_type=OPENSEARCH)


class OpdsBooksView(View):
    def get(self, request):
        sort = request.GET.get('sort', 'new')
        qs = _public_books()
        if sort == 'popular':
            qs = qs.order_by('-download_count')
            title, fid = 'Популярное', 'books:popular'
        else:
            qs = qs.order_by('-created_at')
            title, fid = 'Все книги', 'books:new'
        return _paginated_books(request, qs, fid, title, f'/books?sort={sort}')


class OpdsSearchView(View):
    def get(self, request):
        q = (request.GET.get('q') or '').strip()
        qs = _public_books()
        if q:
            qs = qs.filter(
                Q(title__icontains=q)
                | Q(authors__name__icontains=q)
                | Q(series__name__icontains=q)
            ).distinct().order_by('-created_at')
        else:
            qs = qs.none()
        from urllib.parse import quote
        return _paginated_books(request, qs, f'search:{q}', f'Поиск: {q}', f'/search?q={quote(q)}')


class OpdsAuthorsView(View):
    def get(self, request):
        from apps.books.models import Author
        base = request.build_absolute_uri('/').rstrip('/')
        authors = (
            Author.objects.annotate(n=Count('books', filter=Q(books__is_public=True)))
            .filter(n__gt=0).order_by('name')[:500]
        )
        entries = ''.join(
            _nav_entry(base, f'/authors/{a.id}/books', a.name, f'Книг: {a.n}')
            for a in authors
        )
        return _feed('authors', 'Авторы', base, f'{base}/opds/authors', entries, OPDS_NAV)


class OpdsAuthorBooksView(View):
    def get(self, request, author_id):
        from apps.books.models import Author
        try:
            author = Author.objects.get(id=author_id)
        except (Author.DoesNotExist, Exception):
            return HttpResponse(status=404)
        qs = _public_books().filter(authors__id=author_id).order_by('-created_at')
        return _paginated_books(request, qs, f'author:{author_id}', author.name, f'/authors/{author_id}/books')


class OpdsSeriesListView(View):
    def get(self, request):
        from apps.books.models import Series
        base = request.build_absolute_uri('/').rstrip('/')
        series = (
            Series.objects.annotate(n=Count('books', filter=Q(books__is_public=True)))
            .filter(n__gt=0).order_by('name')[:500]
        )
        entries = ''.join(
            _nav_entry(base, f'/series/{s.id}/books', s.name, f'Книг: {s.n}')
            for s in series
        )
        return _feed('series', 'Серии', base, f'{base}/opds/series', entries, OPDS_NAV)


class OpdsSeriesBooksView(View):
    def get(self, request, series_id):
        from apps.books.models import Series
        try:
            s = Series.objects.get(id=series_id)
        except (Series.DoesNotExist, Exception):
            return HttpResponse(status=404)
        qs = _public_books().filter(series__id=series_id).order_by('created_at')
        return _paginated_books(request, qs, f'series:{series_id}', s.name, f'/series/{series_id}/books')


class OpdsGenresView(View):
    def get(self, request):
        from apps.books.models import Tag
        base = request.build_absolute_uri('/').rstrip('/')
        tags = (
            Tag.objects.annotate(n=Count('books', filter=Q(books__is_public=True)))
            .filter(n__gt=0).order_by('name')[:500]
        )
        entries = ''.join(
            _nav_entry(base, f'/genres/{t.id}/books', t.name, f'Книг: {t.n}')
            for t in tags
        )
        return _feed('genres', 'Жанры', base, f'{base}/opds/genres', entries, OPDS_NAV)


class OpdsGenreBooksView(View):
    def get(self, request, tag_id):
        from apps.books.models import Tag
        try:
            tag = Tag.objects.get(id=tag_id)
        except (Tag.DoesNotExist, Exception):
            return HttpResponse(status=404)
        qs = _public_books().filter(tags__id=tag_id).order_by('-created_at')
        return _paginated_books(request, qs, f'genre:{tag_id}', tag.name, f'/genres/{tag_id}/books')
