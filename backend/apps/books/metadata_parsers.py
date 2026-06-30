"""
Book metadata parsers — each parser searches one online source and returns
a normalized list of result dicts.  All parsers fail silently; callers use
search_all() to run them in parallel and merge results.

Result dict shape:
  source, source_url, title, subtitle, authors (list), description,
  genres (list), publisher, published_year (int|None), cover_url,
  language, isbn, page_count (int|None), series, series_index (float|None)

Source notes (verified June 2026):
  - Google Books   — official JSON API; optional GOOGLE_BOOKS_API_KEY env
                     raises the per-IP rate limit (anonymous calls get 429
                     easily from datacenter/NAT IPs).
  - Open Library   — official JSON API.
  - LitRes         — api.litres.ru/foundation/api/search (the old
                     www.litres.ru/api/arts/search is gone, returns 404).
                     Search results lack annotation/genres, so we fetch
                     /foundation/api/arts/{id} for the top hits.
  - Author.Today   — api.author.today/v1/catalog/search ignores the query
                     and just returns the popular feed, so we scrape the
                     site search page for work ids and then pull
                     /v1/work/{id}/details (Bearer guest) for metadata.
  - Fantlab        — official JSON API (api.fantlab.ru); good coverage of
                     Russian fiction.  Replaces Yandex Books, whose search
                     is rendered client-side and unusable without a real
                     browser.
"""
import html as html_lib
import json
import logging
import os
import re
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

logger = logging.getLogger(__name__)

_TIMEOUT = 8

                                                                      
                                                                  
_BROWSER_HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    ),
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
}

try:
    import requests as _requests

    _session = _requests.Session()
    _session.headers.update(_BROWSER_HEADERS)
except ImportError:                                                      
    _requests = None
    _session = None



def _get(url: str, headers: dict | None = None, timeout: int = _TIMEOUT) -> bytes:
    if _session is not None:
        r = _session.get(url, headers=headers or {}, timeout=timeout)
        r.raise_for_status()
        return r.content
    req_headers = dict(_BROWSER_HEADERS)
    req_headers.pop('Accept-Encoding', None)                                 
    if headers:
        req_headers.update(headers)
    req = urllib.request.Request(url, headers=req_headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _get_json(url: str, headers: dict | None = None) -> dict | list:
    h = {'Accept': 'application/json'}
    if headers:
        h.update(headers)
    return json.loads(_get(url, headers=h))


def _get_text(url: str, headers: dict | None = None) -> str:
    h = {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1',
    }
    if headers:
        h.update(headers)
    return _get(url, headers=h).decode('utf-8', errors='replace')


def _parse_year(value) -> int | None:
    if not value:
        return None
    m = re.match(r'(\d{4})', str(value))
    return int(m.group(1)) if m else None


def _strip_html(text: str) -> str:
    if not text:
        return ''
    text = re.sub(r'<br\s*/?>', '\n', text)
    text = re.sub(r'</p>\s*<p[^>]*>', '\n\n', text)
    text = re.sub(r'<[^>]+>', '', text)
    return html_lib.unescape(text).strip()



def search_google_books(title: str, authors: list) -> list:
    parts = []
    if title:
        parts.append(f'intitle:{title}')
    if authors:
        parts.append(f'inauthor:{authors[0]}')
    q = urllib.parse.quote(' '.join(parts) or title)
    url = (
        f'https://www.googleapis.com/books/v1/volumes'
        f'?q={q}&maxResults=5&printType=books'
    )
    api_key = os.environ.get('GOOGLE_BOOKS_API_KEY', '')
    if api_key:
        url += f'&key={urllib.parse.quote(api_key)}'
    try:
        data = _get_json(url)
    except Exception as exc:
        logger.warning('Google Books: %s', exc)
        return []

    results = []
    for item in data.get('items', []):
        vi = item.get('volumeInfo', {})
        imgs = vi.get('imageLinks', {})
        cover = (
            imgs.get('thumbnail') or imgs.get('smallThumbnail') or ''
        ).replace('http://', 'https://')

        isbn = ''
        for iid in vi.get('industryIdentifiers', []):
            if iid.get('type') in ('ISBN_13', 'ISBN_10'):
                isbn = iid['identifier']
                break

        results.append({
            'source': 'Google Books',
            'source_url': vi.get('infoLink', f'https://books.google.com/books?id={item.get("id","")}'),
            'title': vi.get('title', ''),
            'subtitle': vi.get('subtitle', ''),
            'authors': vi.get('authors', []),
            'description': vi.get('description', ''),
            'genres': vi.get('categories', []),
            'publisher': vi.get('publisher', ''),
            'published_year': _parse_year(vi.get('publishedDate')),
            'cover_url': cover,
            'language': vi.get('language', ''),
            'isbn': isbn,
            'page_count': vi.get('pageCount'),
            'series': '',
            'series_index': None,
        })
    return results



def search_open_library(title: str, authors: list) -> list:
    params: dict = {
        'limit': '5',
        'fields': (
            'key,title,author_name,first_publish_year,publisher,'
            'isbn,subject,cover_i,language,number_of_pages_median,series'
        ),
    }
    if title:
        params['title'] = title
    if authors:
        params['author'] = authors[0]
    url = 'https://openlibrary.org/search.json?' + urllib.parse.urlencode(params)
    try:
        data = _get_json(url)
    except Exception as exc:
        logger.warning('Open Library: %s', exc)
        return []

    results = []
    for doc in data.get('docs', []):
        cid = doc.get('cover_i')
        cover = f'https://covers.openlibrary.org/b/id/{cid}-L.jpg' if cid else ''
        isbns = doc.get('isbn') or []
        publishers = doc.get('publisher') or ['']
        langs = doc.get('language') or ['']
        series_list = doc.get('series') or ['']
        results.append({
            'source': 'Open Library',
            'source_url': f'https://openlibrary.org{doc.get("key", "")}',
            'title': doc.get('title', ''),
            'subtitle': '',
            'authors': doc.get('author_name', []),
            'description': '',
            'genres': (doc.get('subject') or [])[:8],
            'publisher': publishers[0] if publishers else '',
            'published_year': doc.get('first_publish_year'),
            'cover_url': cover,
            'language': langs[0] if langs else '',
            'isbn': isbns[0] if isbns else '',
            'page_count': doc.get('number_of_pages_median'),
            'series': series_list[0] if series_list else '',
            'series_index': None,
        })
    return results



_LITRES_API = 'https://api.litres.ru/foundation/api'


def _litres_art_details(art_id) -> dict:
    try:
        data = _get_json(f'{_LITRES_API}/arts/{art_id}')
        payload = data.get('payload', {})
        details = payload.get('data', {}) if isinstance(payload, dict) else {}
        return details if isinstance(details, dict) else {}
    except Exception as exc:
        logger.debug('LitRes details %s: %s', art_id, exc)
        return {}


def search_litres(title: str, authors: list) -> list:
    query = f'{authors[0]} {title}' if authors else title
    url = (
        f'{_LITRES_API}/search'
        f'?q={urllib.parse.quote(query)}&limit=5&types=text_book'
    )
    try:
        data = _get_json(url)
    except Exception as exc:
        logger.warning('LitRes: %s', exc)
        return []

    payload = data.get('payload', {})
    items = payload.get('data', []) if isinstance(payload, dict) else []

    results = []
    for entry in items[:3]:
        art = entry.get('instance') if isinstance(entry, dict) else None
        if not isinstance(art, dict) or not art.get('id'):
            continue

        details = _litres_art_details(art['id'])

        cover = art.get('cover_url') or ''
        if cover.startswith('/'):
            cover = 'https://cdn.litres.ru' + cover

        author_names = [
            p['full_name']
            for p in (art.get('persons') or [])
            if isinstance(p, dict) and p.get('full_name')
        ]
        genres = [
            g['name']
            for g in (details.get('genres') or [])
            if isinstance(g, dict) and g.get('name')
        ]
        pub = details.get('publisher')
        publisher_name = pub.get('name', '') if isinstance(pub, dict) else (pub or '')
        series_list = art.get('series') or details.get('series') or []
        series_name = ''
        series_index = None
        if series_list and isinstance(series_list[0], dict):
            series_name = series_list[0].get('name') or series_list[0].get('title') or ''
            series_index = series_list[0].get('art_order')

        page_url = art.get('url') or ''
        if page_url.startswith('/'):
            page_url = 'https://www.litres.ru' + page_url

        results.append({
            'source': 'ЛитРес',
            'source_url': page_url,
            'title': art.get('title', ''),
            'subtitle': art.get('subtitle') or '',
            'authors': author_names,
            'description': _strip_html(
                details.get('html_annotation') or details.get('annotation') or ''
            ),
            'genres': genres[:8],
            'publisher': publisher_name,
            'published_year': _parse_year(
                details.get('date_written_at')
                or details.get('first_time_sale_at')
                or art.get('date_written_at')
            ),
            'cover_url': cover,
            'language': art.get('language_code', 'ru'),
            'isbn': details.get('isbn') or '',
            'page_count': details.get('pages_count'),
            'series': series_name,
            'series_index': series_index,
        })
    return results



_AT_API = 'https://api.author.today/v1'
_AT_HEADERS = {'Authorization': 'Bearer guest'}


def _at_work_details(work_id: str) -> dict:
    try:
        data = _get_json(f'{_AT_API}/work/{work_id}/details', headers=_AT_HEADERS)
        return data if isinstance(data, dict) else {}
    except Exception as exc:
        logger.debug('Author.Today details %s: %s', work_id, exc)
        return {}


def search_author_today(title: str, authors: list) -> list:
                                                                          
                                                                        
    query = title or (authors[0] if authors else '')
    search_url = (
        'https://author.today/search'
        f'?category=works&q={urllib.parse.quote(query)}'
    )
    try:
        page = _get_text(search_url)
    except Exception as exc:
        logger.warning('Author.Today: %s', exc)
        return []

    work_ids: list[str] = []
    for m in re.finditer(r'href="/work/(\d+)"', page):
        wid = m.group(1)
        if wid not in work_ids:
            work_ids.append(wid)
        if len(work_ids) >= 3:
            break

    results = []
    for wid in work_ids:
        work = _at_work_details(wid)
        if not work.get('title'):
            continue

        author_names = [
            fio for fio in (
                work.get('authorFIO'),
                work.get('coAuthorFIO'),
                work.get('secondCoAuthorFIO'),
            ) if fio
        ]
        results.append({
            'source': 'Author.Today',
            'source_url': f'https://author.today/work/{wid}',
            'title': work.get('title', ''),
            'subtitle': '',
            'authors': author_names,
            'description': _strip_html(work.get('annotation') or ''),
            'genres': (work.get('tags') or [])[:8],
            'publisher': '',
            'published_year': _parse_year(
                work.get('finishTime')
                or work.get('lastModificationTime')
            ),
            'cover_url': work.get('coverUrl') or '',
            'language': 'ru',
            'isbn': '',
            'page_count': None,
            'series': work.get('seriesTitle') or '',
            'series_index': work.get('seriesWorkNumber'),
        })
    return results



_FANTLAB_API = 'https://api.fantlab.ru'


def search_fantlab(title: str, authors: list) -> list:
    query = f'{title} {authors[0]}' if authors else title
    url = f'{_FANTLAB_API}/search-works?q={urllib.parse.quote(query)}'
    try:
        data = _get_json(url)
    except Exception as exc:
        logger.warning('Fantlab: %s', exc)
        return []

    matches = data.get('matches') if isinstance(data, dict) else None
    results = []
    for match in (matches or [])[:3]:
        work_id = match.get('work_id')
        if not work_id:
            continue

        description = ''
        cover = ''
        year = _parse_year(match.get('year'))
        try:
            work = _get_json(f'{_FANTLAB_API}/work/{work_id}')
            description = _strip_html(work.get('work_description') or '')
            image = work.get('image') or ''
            if image.startswith('/'):
                cover = 'https://fantlab.ru' + image
            year = year or _parse_year(work.get('work_year'))
        except Exception as exc:
            logger.debug('Fantlab work %s: %s', work_id, exc)

        author_names = [
            a.strip()
            for a in (match.get('all_autor_rusname') or match.get('autor_rusname') or '').split(',')
            if a.strip()
        ]
        results.append({
            'source': 'Fantlab',
            'source_url': f'https://fantlab.ru/work{work_id}',
            'title': (match.get('rusname') or match.get('name') or '').strip(),
            'subtitle': '',
            'authors': author_names,
            'description': description,
            'genres': [],
            'publisher': '',
            'published_year': year,
            'cover_url': cover,
            'language': 'ru',
            'isbn': '',
            'page_count': None,
            'series': '',
            'series_index': None,
        })
    return results



_PARSERS = [
    ('Google Books', search_google_books),
    ('Open Library', search_open_library),
    ('ЛитРес', search_litres),
    ('Author.Today', search_author_today),
    ('Fantlab', search_fantlab),
]


def _completeness(result: dict) -> int:
    return sum(
        1 for k in ('description', 'cover_url', 'published_year', 'genres', 'publisher', 'isbn', 'page_count')
        if result.get(k)
    )


def _normalize(text: str) -> str:
    return re.sub(r'[^\w\s]', '', (text or '').lower()).strip()


def _relevance(result: dict, title: str, authors: list) -> float:
    """Score a result against the original query: title similarity dominates,
    matching author adds a bonus, completeness breaks ties."""
    from difflib import SequenceMatcher

    score = 0.0
    if title:
        score += SequenceMatcher(
            None, _normalize(title), _normalize(result.get('title', ''))
        ).ratio() * 10
    if authors:
        wanted = {_normalize(a) for a in authors}
        found = {_normalize(a) for a in (result.get('authors') or [])}
                                                                                   
        wanted_words = {w for a in wanted for w in a.split()}
        found_words = {w for a in found for w in a.split()}
        if wanted_words & found_words:
            score += 3
    return score + _completeness(result) * 0.1


def search_all(title: str, authors: list) -> dict:
    """
    Run all parsers concurrently (max 8s wall clock).
    Returns:
      {
        sources: [{ name, results }],
        all_results: [...],
        best: dict | None,
        total: int,
      }
    """
    source_map: dict[str, list] = {}
    all_results: list = []

                                                                                
                                                                       
    pool = ThreadPoolExecutor(max_workers=5)
    try:
        futures = {pool.submit(fn, title, authors): name for name, fn in _PARSERS}
        try:
            for future in as_completed(futures, timeout=8):
                name = futures[future]
                try:
                    results = future.result()
                    if results:
                        source_map[name] = results
                        all_results.extend(results)
                except Exception as exc:
                    logger.warning('Parser "%s" failed: %s', name, exc)
        except TimeoutError:
            logger.warning('Metadata search timed out; returning partial results')
    finally:
        pool.shutdown(wait=False, cancel_futures=True)

    best = (
        max(all_results, key=lambda r: _relevance(r, title, authors))
        if all_results else None
    )
                                          
    all_results.sort(key=lambda r: _relevance(r, title, authors), reverse=True)

    return {
        'sources': [
            {'name': name, 'results': results}
            for name, results in source_map.items()
        ],
        'all_results': all_results,
        'best': best,
        'total': len(all_results),
    }
