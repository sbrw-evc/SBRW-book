import os
import re
import shutil
import io
from pathlib import Path
from typing import Optional, Tuple

from django.conf import settings
from PIL import Image

ALLOWED_FORMATS = {'epub', 'pdf', 'mobi', 'fb2', 'djvu', 'doc', 'docx', 'txt', 'rtf'}


def get_file_format(filename: str) -> Optional[str]:
    ext = Path(filename).suffix.lower().lstrip('.')
    return ext if ext in ALLOWED_FORMATS else None


def save_book_file(file_data: bytes, book_id: str, fmt: str) -> Tuple[str, int]:
    book_dir = os.path.join(settings.MEDIA_ROOT, 'books', book_id)
    os.makedirs(book_dir, exist_ok=True)
    file_path = os.path.join(book_dir, f'book.{fmt}')
    with open(file_path, 'wb') as f:
        f.write(file_data)
    return file_path, len(file_data)


def delete_book_files(book_id: str):
    book_dir = os.path.join(settings.MEDIA_ROOT, 'books', book_id)
    if os.path.exists(book_dir):
        shutil.rmtree(book_dir)


def save_cover(image_data: bytes, book_id: str) -> Optional[str]:
    try:
        covers_dir = os.path.join(settings.MEDIA_ROOT, 'covers')
        os.makedirs(covers_dir, exist_ok=True)
        img = Image.open(io.BytesIO(image_data))
        img = img.convert('RGB')
        img.thumbnail((400, 600), Image.LANCZOS)
        cover_path = os.path.join(covers_dir, f'{book_id}.jpg')
        img.save(cover_path, 'JPEG', quality=85)
        return cover_path
    except Exception:
        return None


def download_cover_from_url(url: str, book_id: str) -> Optional[str]:
    """Download a cover image from an external metadata source and save it."""
    if not url or not url.startswith(('http://', 'https://')):
        return None
    try:
        import requests
        r = requests.get(
            url,
            timeout=15,
            stream=True,
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'},
        )
        r.raise_for_status()
        data = r.raw.read(10 * 1024 * 1024, decode_content=True)
        return save_cover(data, book_id)
    except Exception:
        return None



                                           
CONVERT_INPUT_FORMATS = {'epub', 'mobi', 'fb2', 'txt', 'docx', 'rtf', 'pdf'}
CONVERT_OUTPUT_FORMATS = {'epub', 'mobi', 'fb2', 'pdf', 'txt', 'azw3', 'docx'}


def conversion_available() -> bool:
    return shutil.which('ebook-convert') is not None


def get_conversion_targets(existing_formats: set) -> list:
    """Formats this book can be converted to, given the files it already has."""
    if not conversion_available():
        return []
    if not (existing_formats & CONVERT_INPUT_FORMATS):
        return []
    return sorted(CONVERT_OUTPUT_FORMATS - existing_formats)


def pick_conversion_source(existing_formats: set) -> Optional[str]:
    """Best source format for conversion, in order of fidelity."""
    for fmt in ('epub', 'fb2', 'mobi', 'docx', 'rtf', 'txt', 'pdf'):
        if fmt in existing_formats:
            return fmt
    return None


def djvu_conversion_available() -> bool:
    return shutil.which('ddjvu') is not None


def convert_book_file(src_path: str, book_id: str, target_fmt: str) -> Tuple[str, int]:
    """Convert a book file to target_fmt.  Raises on failure."""
    import subprocess
    book_dir = os.path.join(settings.MEDIA_ROOT, 'books', book_id)
    os.makedirs(book_dir, exist_ok=True)
    dst_path = os.path.join(book_dir, f'book.{target_fmt}')
    src_ext = Path(src_path).suffix.lower().lstrip('.')

                                                                                      
    if src_ext == 'djvu' and target_fmt == 'pdf' and djvu_conversion_available():
        cmd = ['ddjvu', '-format=pdf', '-quality=85', src_path, dst_path]
    else:
        cmd = ['ebook-convert', src_path, dst_path]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    if result.returncode != 0 or not os.path.exists(dst_path):
        tail = (result.stderr or result.stdout or '')[-500:]
        raise RuntimeError(f'conversion failed ({cmd[0]}): {tail}')
    return dst_path, os.path.getsize(dst_path)


def _strip_tags(text: str) -> str:
    text = re.sub(r'<br\s*/?>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'</p\s*>', '\n\n', text, flags=re.IGNORECASE)
    text = re.sub(r'<[^>]+>', '', text)
    import html as _html
    return _html.unescape(text).strip()


def extract_epub_metadata(file_data: bytes) -> dict:
    try:
        import tempfile
        import ebooklib
        from ebooklib import epub
        with tempfile.NamedTemporaryFile(suffix='.epub', delete=False) as tmp:
            tmp.write(file_data)
            tmp_path = tmp.name
        try:
            book = epub.read_epub(tmp_path)
        finally:
            os.unlink(tmp_path)
        meta = {}

        title = book.get_metadata('DC', 'title')
        if title:
            meta['title'] = title[0][0]

        creators = book.get_metadata('DC', 'creator')
        if creators:
            meta['authors'] = [c[0] for c in creators if c[0]]

        description = book.get_metadata('DC', 'description')
        if description:
            meta['description'] = _strip_tags(description[0][0])

        language = book.get_metadata('DC', 'language')
        if language and language[0][0]:
            meta['language'] = language[0][0][:2].lower()

        publisher = book.get_metadata('DC', 'publisher')
        if publisher:
            meta['publisher'] = publisher[0][0]

                        
        date_items = book.get_metadata('DC', 'date')
        for d in date_items:
            m = re.match(r'(\d{4})', str(d[0]))
            if m:
                meta['published_year'] = int(m.group(1))
                break

                              
        isbn_items = book.get_metadata('DC', 'identifier')
        for id_item in isbn_items:
            val = id_item[0] or ''
            if re.match(r'\d{9}[\dX]', val.replace('-', '').replace(' ', '')):
                meta['isbn'] = val
                break
            if 'isbn' in str(id_item).lower():
                meta['isbn'] = val
                break

                                                     
        spine_count = len(list(book.spine))
        if spine_count > 1:
            meta['page_count'] = spine_count * 8                  

                                                                                     
        try:
            calibre_series = book.get_metadata('calibre', 'series')
            if calibre_series:
                meta['series'] = calibre_series[0][0]
            calibre_si = book.get_metadata('calibre', 'series_index')
            if calibre_si:
                try:
                    meta['series_index'] = float(calibre_si[0][0])
                except (ValueError, TypeError):
                    pass
        except KeyError:
            pass
                                             
        if 'series' not in meta:
            try:
                opf_series = book.get_metadata('OPF', 'series')
                if opf_series:
                    meta['series'] = opf_series[0][0]
            except KeyError:
                pass

                     
        cover_data = None
        for item in book.get_items():
            if item is None:
                continue
            if item.get_type() == ebooklib.ITEM_COVER:
                cover_data = item.get_content()
                break
        if not cover_data:
            for item in book.get_items_of_type(ebooklib.ITEM_IMAGE):
                if item is None:
                    continue
                name = item.get_name().lower()
                if any(x in name for x in ('cover', 'обложка', 'front')):
                    cover_data = item.get_content()
                    break
        if not cover_data:
            for item in book.get_items_of_type(ebooklib.ITEM_IMAGE):
                if item is not None:
                    cover_data = item.get_content()
                    break
        meta['cover_data'] = cover_data
        return meta
    except Exception:
        return {}


def extract_pdf_metadata(file_data: bytes) -> dict:
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(file_data))
        info = reader.metadata or {}
        meta: dict = {}
        title = info.get('/Title') or info.get('title')
        if title:
            meta['title'] = str(title).strip()
        author = info.get('/Author') or info.get('author')
        if author:
            raw = str(author)
            meta['authors'] = [a.strip() for a in re.split(r'[;,]', raw) if a.strip()]
        subject = info.get('/Subject') or info.get('subject')
        if subject:
            meta['description'] = str(subject).strip()
        publisher = info.get('/Producer') or info.get('/Creator')
        if publisher and 'pdf' not in str(publisher).lower():
            meta['publisher'] = str(publisher).strip()
        creation = info.get('/CreationDate') or info.get('/ModDate')
        if creation:
            m = re.search(r'(\d{4})', str(creation))
            if m:
                meta['published_year'] = int(m.group(1))
        meta['page_count'] = len(reader.pages)
        return meta
    except Exception:
        return {}


def extract_fb2_metadata(file_data: bytes) -> dict:
    """FB2 is XML.  Extract title/author/description from <description>/<title-info>."""
    import xml.etree.ElementTree as ET
    import base64

    try:
        raw = file_data
        if raw[:2] == b'\x1f\x8b':
            import gzip
            raw = gzip.decompress(raw)
        text = raw.decode('utf-8', errors='replace')
        text = re.sub(r'\s+xmlns(?::\w+)?="[^"]*"', '', text)
        root = ET.fromstring(text)

        def _el_text(el) -> str:
            """Return all text inside an element including nested children."""
            if el is None:
                return ''
            return ''.join(el.itertext()).strip()

        def _find_el(*paths):
            for path in paths:
                el = root.find(path)
                if el is not None:
                    return el
            return None

        def _find_text(*paths) -> str:
            el = _find_el(*paths)
            return _el_text(el) if el is not None else ''

        meta: dict = {}

        title = _find_text('.//description/title-info/book-title', './/title-info/book-title')
        if title:
            meta['title'] = title

        author_names = []
        for author_el in root.findall('.//description/title-info/author'):
            first = (author_el.findtext('first-name') or '').strip()
            middle = (author_el.findtext('middle-name') or '').strip()
            last = (author_el.findtext('last-name') or '').strip()
            nickname = (author_el.findtext('nickname') or '').strip()
            full = ' '.join(filter(None, [first, middle, last])) or nickname
            if full:
                author_names.append(full)
        if author_names:
            meta['authors'] = author_names

                                                                           
        ann_el = _find_el('.//description/title-info/annotation', './/title-info/annotation')
        if ann_el is not None:
            raw_ann = ET.tostring(ann_el, encoding='unicode')
            meta['description'] = _strip_tags(raw_ann)

        lang = _find_text('.//description/title-info/lang', './/title-info/lang')
        if lang:
            meta['language'] = lang[:2].lower()

                
        genres = [_el_text(g) for g in root.findall('.//description/title-info/genre') if _el_text(g)]
        if genres:
            meta['genres'] = genres

                                                     
        seq_el = _find_el('.//description/title-info/sequence')
        if seq_el is not None:
            series_name = seq_el.get('name', '').strip()
            if series_name:
                meta['series'] = series_name
            series_num = seq_el.get('number', '')
            if series_num:
                try:
                    meta['series_index'] = float(series_num)
                except ValueError:
                    pass

        publisher = _find_text('.//description/publish-info/publisher')
        if publisher:
            meta['publisher'] = publisher

        isbn = _find_text('.//description/publish-info/isbn')
        if isbn:
            meta['isbn'] = isbn.replace('-', '').strip()

        year_str = _find_text('.//description/publish-info/year', './/description/title-info/date')
        if year_str:
            m = re.match(r'(\d{4})', year_str)
            if m:
                meta['published_year'] = int(m.group(1))

                     
        cover_data = None
        for binary in root.findall('.//binary'):
            bid = (binary.get('id') or '').lower()
            if 'cover' in bid and binary.text:
                try:
                    cover_data = base64.b64decode(binary.text.strip())
                    break
                except Exception:
                    pass
        if not cover_data:
            for binary in root.findall('.//binary'):
                ct = (binary.get('content-type') or '').lower()
                if ct.startswith('image/') and binary.text:
                    try:
                        cover_data = base64.b64decode(binary.text.strip())
                        break
                    except Exception:
                        pass
        meta['cover_data'] = cover_data
        return meta
    except Exception:
        return {}


def extract_mobi_metadata(file_data: bytes) -> dict:
    """Extract metadata from MOBI/AZW3 using calibre's ebook-meta CLI."""
    if not shutil.which('ebook-meta'):
        return {}
    import subprocess
    import tempfile
    try:
        with tempfile.NamedTemporaryFile(suffix='.mobi', delete=False) as f:
            f.write(file_data)
            tmp_path = f.name
        result = subprocess.run(
            ['ebook-meta', tmp_path],
            capture_output=True, text=True, timeout=30,
        )
        os.unlink(tmp_path)
        if result.returncode != 0:
            return {}
        meta: dict = {}
        for line in result.stdout.splitlines():
            if ':' not in line:
                continue
            key, _, val = line.partition(':')
            key = key.strip().lower()
            val = val.strip()
            if not val or val == 'Unknown':
                continue
            if key == 'title':
                meta['title'] = val
            elif key in ('author(s)', 'authors'):
                meta['authors'] = [a.strip() for a in val.split('&') if a.strip()]
            elif key == 'publisher':
                meta['publisher'] = val
            elif key == 'published':
                m = re.search(r'(\d{4})', val)
                if m:
                    meta['published_year'] = int(m.group(1))
            elif key == 'isbn':
                meta['isbn'] = val
            elif key == 'languages':
                meta['language'] = val[:2].lower()
            elif key in ('series', 'series name'):
                meta['series'] = val
            elif key == 'series index':
                try:
                    meta['series_index'] = float(val)
                except ValueError:
                    pass
            elif key == 'comments':
                meta['description'] = _strip_tags(val)
        return meta
    except Exception:
        return {}


def extract_txt_metadata(file_data: bytes) -> dict:
    """Try to infer title from the first non-empty line of a text file."""
    try:
        text = file_data[:4096].decode('utf-8', errors='replace')
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        if lines:
            candidate = lines[0][:200]
            if not candidate.startswith(('http', '<', '{', '[')):
                return {'title': candidate}
    except Exception:
        pass
    return {}


def extract_metadata(file_data: bytes, fmt: str) -> dict:
    if fmt == 'epub':
        return extract_epub_metadata(file_data)
    if fmt == 'pdf':
        return extract_pdf_metadata(file_data)
    if fmt == 'fb2':
        return extract_fb2_metadata(file_data)
    if fmt in ('mobi', 'azw3'):
        return extract_mobi_metadata(file_data)
    if fmt == 'txt':
        return extract_txt_metadata(file_data)
    return {}


def extract_book_text(file_data: bytes, fmt: str, max_chars: int = 18_000) -> str:
    """Extract plain text from a book file for LLM analysis."""
    try:
        if fmt == 'epub':
            import tempfile
            import ebooklib
            from ebooklib import epub
            with tempfile.NamedTemporaryFile(suffix='.epub', delete=False) as tmp:
                tmp.write(file_data)
                tmp_path = tmp.name
            try:
                book = epub.read_epub(tmp_path)
            finally:
                os.unlink(tmp_path)
            parts = []
            for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT):
                html = item.get_content().decode('utf-8', errors='ignore')
                parts.append(_strip_tags(html))
                if sum(len(p) for p in parts) >= max_chars:
                    break
            return ' '.join(parts)[:max_chars]

        if fmt == 'pdf':
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(file_data))
            parts = []
            for page in reader.pages:
                parts.append(page.extract_text() or '')
                if sum(len(p) for p in parts) >= max_chars:
                    break
            return ' '.join(parts)[:max_chars]

        if fmt == 'fb2':
            import xml.etree.ElementTree as ET
            root = ET.fromstring(file_data)
            ns = {'fb': 'http://www.gribuser.ru/xml/fictionbook/2.0'}
            texts = root.findall('.//fb:p', ns) or root.findall('.//p')
            parts = [t.text or '' for t in texts if t.text]
            return ' '.join(parts)[:max_chars]

        if fmt == 'txt':
            return file_data.decode('utf-8', errors='ignore')[:max_chars]

    except Exception:
        pass
    return ''
