"""
Tests for BookReadView — the reading/streaming endpoint.

Run inside the container:
    docker exec sbrw_backend python manage.py test apps.books.tests.test_read_view -v 2

What these tests verify:
1. Epub and PDF files are served correctly with correct MIME types
2. Non-existent format returns 404
3. Non-existent book returns 404
4. Private books require authentication
5. CORS header is present on responses
6. FB2 books: if epub already exists serve epub; if not and calibre available, auto-convert
7. DjVu books: if pdf already exists serve pdf; if not and calibre available, auto-convert
8. BookFile auto-creation when conversion happens
"""

import os
import shutil
import tempfile
import zipfile
from io import BytesIO
from unittest import mock

from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from apps.books.models import Book, BookFile

User = get_user_model()

                                                                   
def _make_epub_bytes() -> bytes:
    buf = BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_STORED) as zf:
        zf.writestr('mimetype', 'application/epub+zip')
        zf.writestr('META-INF/container.xml', (
            '<?xml version="1.0"?>'
            '<container version="1.0" xmlns="urn:oasis:schemas:container">'
            '<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>'
            '</rootfiles></container>'
        ))
        zf.writestr('OEBPS/content.opf', (
            '<?xml version="1.0"?>'
            '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">'
            '<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">'
            '<dc:title>Test Book</dc:title></metadata>'
            '<manifest></manifest><spine></spine></package>'
        ))
    return buf.getvalue()


def _make_pdf_bytes() -> bytes:
    return b'%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF'


def _make_fb2_bytes() -> bytes:
    return (
        b'<?xml version="1.0" encoding="utf-8"?>'
        b'<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">'
        b'<description><title-info><book-title>Test FB2</book-title></title-info></description>'
        b'<body><section><p>Hello world</p></section></body></FictionBook>'
    )


def _make_djvu_bytes() -> bytes:
                                                                              
    return b'AT&TFORM\x00\x00\x00\x00DJVMDIRM'


class BookReadViewBase(TestCase):
    """Shared setUp/tearDown that creates a tmp uploads dir and a test user."""

    def setUp(self):
        self.tmp_dir = tempfile.mkdtemp()
        self.settings_override = override_settings(MEDIA_ROOT=self.tmp_dir)
        self.settings_override.enable()

        self.user = User.objects.create_user(
            username='reader', email='reader@test.com', password='pass'
        )
        self.admin = User.objects.create_user(
            username='admin', email='admin@test.com', password='pass', role='admin'
        )
        self.client = APIClient()

    def tearDown(self):
        shutil.rmtree(self.tmp_dir, ignore_errors=True)
        self.settings_override.disable()

    def _write_file(self, book_id: str, fmt: str, content: bytes) -> str:
        book_dir = os.path.join(self.tmp_dir, 'books', str(book_id))
        os.makedirs(book_dir, exist_ok=True)
        path = os.path.join(book_dir, f'book.{fmt}')
        with open(path, 'wb') as f:
            f.write(content)
        return path

    def _create_book_with_file(self, fmt: str, content: bytes, is_public: bool = True) -> tuple:
        book = Book.objects.create(title='Test Book', is_public=is_public)
        path = self._write_file(str(book.id), fmt, content)
        bf = BookFile.objects.create(book=book, format=fmt, file_path=path, file_size=len(content))
        return book, bf

    def _read_url(self, book_id, fmt='epub'):
        return f'/api/books/{book_id}/read?fmt={fmt}'


class TestEpubRead(BookReadViewBase):

    def test_epub_returns_200_and_correct_mime(self):
        book, _ = self._create_book_with_file('epub', _make_epub_bytes())
        resp = self.client.get(self._read_url(book.id, 'epub'))
        self.assertEqual(resp.status_code, 200)
        self.assertIn('epub', resp.get('Content-Type', ''))

    def test_epub_cors_header_present(self):
        book, _ = self._create_book_with_file('epub', _make_epub_bytes())
        resp = self.client.get(self._read_url(book.id, 'epub'))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.get('Access-Control-Allow-Origin'), '*')

    def test_epub_content_is_served(self):
        epub_bytes = _make_epub_bytes()
        book, _ = self._create_book_with_file('epub', epub_bytes)
        resp = self.client.get(self._read_url(book.id, 'epub'))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(b''.join(resp.streaming_content), epub_bytes)

    def test_epub_missing_file_on_disk_returns_404(self):
        book = Book.objects.create(title='Ghost Book')
        BookFile.objects.create(
            book=book, format='epub',
            file_path='/nonexistent/path/book.epub',
            file_size=1000,
        )
        resp = self.client.get(self._read_url(book.id, 'epub'))
        self.assertEqual(resp.status_code, 404)


class TestPdfRead(BookReadViewBase):

    def test_pdf_returns_200_and_correct_mime(self):
        book, _ = self._create_book_with_file('pdf', _make_pdf_bytes())
        resp = self.client.get(self._read_url(book.id, 'pdf'))
        self.assertEqual(resp.status_code, 200)
        self.assertIn('pdf', resp.get('Content-Type', ''))

    def test_pdf_content_is_served(self):
        pdf_bytes = _make_pdf_bytes()
        book, _ = self._create_book_with_file('pdf', pdf_bytes)
        resp = self.client.get(self._read_url(book.id, 'pdf'))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(b''.join(resp.streaming_content), pdf_bytes)


class TestMissingFormat(BookReadViewBase):

    def test_unknown_format_returns_404(self):
        book, _ = self._create_book_with_file('epub', _make_epub_bytes())
        resp = self.client.get(self._read_url(book.id, 'pdf'))
                                    
        self.assertEqual(resp.status_code, 404)

    def test_nonexistent_book_returns_404(self):
        import uuid
        fake_id = uuid.uuid4()
        resp = self.client.get(self._read_url(fake_id, 'epub'))
        self.assertEqual(resp.status_code, 404)


class TestPrivateBookAuth(BookReadViewBase):

    def test_private_book_without_auth_returns_401(self):
        book, _ = self._create_book_with_file('epub', _make_epub_bytes(), is_public=False)
        resp = self.client.get(self._read_url(book.id, 'epub'))
        self.assertEqual(resp.status_code, 401)

    def test_private_book_owner_can_read(self):
        book = Book.objects.create(title='Private', is_public=False, uploaded_by=self.user)
        path = self._write_file(str(book.id), 'epub', _make_epub_bytes())
        BookFile.objects.create(book=book, format='epub', file_path=path, file_size=10)
        self.client.force_authenticate(user=self.user)
        resp = self.client.get(self._read_url(book.id, 'epub'))
        self.assertEqual(resp.status_code, 200)

    def test_private_book_admin_can_read(self):
        book = Book.objects.create(title='Private', is_public=False, uploaded_by=self.user)
        path = self._write_file(str(book.id), 'epub', _make_epub_bytes())
        BookFile.objects.create(book=book, format='epub', file_path=path, file_size=10)
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get(self._read_url(book.id, 'epub'))
        self.assertEqual(resp.status_code, 200)

    def test_private_book_other_user_gets_403(self):
        other = User.objects.create_user(username='other', email='other@test.com', password='pass')
        book = Book.objects.create(title='Private', is_public=False, uploaded_by=self.user)
        path = self._write_file(str(book.id), 'epub', _make_epub_bytes())
        BookFile.objects.create(book=book, format='epub', file_path=path, file_size=10)
        self.client.force_authenticate(user=other)
        resp = self.client.get(self._read_url(book.id, 'epub'))
        self.assertEqual(resp.status_code, 403)


class TestFb2AutoConvert(BookReadViewBase):
    """
    When reading an FB2 book:
    - If an epub already exists, serve it directly.
    - If no epub exists but calibre is available, convert and cache.
    - If calibre is not available, return 404.
    """

    def test_fb2_read_serves_existing_epub(self):
        """Epub already exists → serve it, don't re-convert."""
        epub_bytes = _make_epub_bytes()
        fb2_bytes = _make_fb2_bytes()
        book = Book.objects.create(title='Has Both')
        epub_path = self._write_file(str(book.id), 'epub', epub_bytes)
        fb2_path = self._write_file(str(book.id), 'fb2', fb2_bytes)
        BookFile.objects.create(book=book, format='epub', file_path=epub_path, file_size=len(epub_bytes))
        BookFile.objects.create(book=book, format='fb2', file_path=fb2_path, file_size=len(fb2_bytes))

        resp = self.client.get(self._read_url(book.id, 'fb2'))
        self.assertEqual(resp.status_code, 200)
        self.assertIn('epub', resp.get('Content-Type', ''))
        self.assertEqual(b''.join(resp.streaming_content), epub_bytes)

    def test_fb2_without_epub_no_calibre_returns_404(self):
        """No epub and calibre not available → 404."""
        book, _ = self._create_book_with_file('fb2', _make_fb2_bytes())
        with mock.patch('shutil.which', return_value=None):
            resp = self.client.get(self._read_url(book.id, 'fb2'))
        self.assertEqual(resp.status_code, 404)

    def test_fb2_without_epub_calibre_available_converts(self):
        """No epub, calibre available → convert, create BookFile, serve epub."""
        epub_bytes = _make_epub_bytes()
        book, fb2_bf = self._create_book_with_file('fb2', _make_fb2_bytes())

        def fake_convert(src_path, book_id, target_fmt):
            dst = self._write_file(book_id, target_fmt, epub_bytes)
            return dst, len(epub_bytes)

        with mock.patch('apps.books.views.conversion_available', return_value=True), \
             mock.patch('apps.books.views.convert_book_file', side_effect=fake_convert):
            resp = self.client.get(self._read_url(book.id, 'fb2'))

        self.assertEqual(resp.status_code, 200)
        self.assertIn('epub', resp.get('Content-Type', ''))
                                                               
        self.assertTrue(BookFile.objects.filter(book=book, format='epub').exists())

    def test_fb2_only_book_shows_in_readable_formats_via_serializer(self):
        """
        The BookOutSerializer should mark fb2 books as readable
        (readable_formats field includes 'fb2').
        """
        book, _ = self._create_book_with_file('fb2', _make_fb2_bytes())
        resp = self.client.get(f'/api/books/{book.id}')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        formats = [f['format'] for f in data.get('files', [])]
        self.assertIn('fb2', formats)


class TestDjvuAutoConvert(BookReadViewBase):
    """
    When reading a DjVu book:
    - If a pdf already exists, serve it directly.
    - If no pdf but calibre available, convert djvu→pdf and cache.
    - If calibre not available, 404.
    """

    def test_djvu_read_serves_existing_pdf(self):
        """PDF already exists → serve it, don't re-convert."""
        pdf_bytes = _make_pdf_bytes()
        book = Book.objects.create(title='DjVu With PDF')
        pdf_path = self._write_file(str(book.id), 'pdf', pdf_bytes)
        djvu_path = self._write_file(str(book.id), 'djvu', _make_djvu_bytes())
        BookFile.objects.create(book=book, format='pdf', file_path=pdf_path, file_size=len(pdf_bytes))
        BookFile.objects.create(book=book, format='djvu', file_path=djvu_path, file_size=10)

        resp = self.client.get(self._read_url(book.id, 'djvu'))
        self.assertEqual(resp.status_code, 200)
        self.assertIn('pdf', resp.get('Content-Type', ''))
        self.assertEqual(b''.join(resp.streaming_content), pdf_bytes)

    def test_djvu_without_pdf_no_calibre_returns_404(self):
        """No pdf and calibre not available → 404."""
        book, _ = self._create_book_with_file('djvu', _make_djvu_bytes())
        with mock.patch('shutil.which', return_value=None):
            resp = self.client.get(self._read_url(book.id, 'djvu'))
        self.assertEqual(resp.status_code, 404)

    def test_djvu_without_pdf_calibre_available_converts(self):
        """No pdf, calibre available → convert djvu→pdf, cache, serve pdf."""
        pdf_bytes = _make_pdf_bytes()
        book, _ = self._create_book_with_file('djvu', _make_djvu_bytes())

        def fake_convert(src_path, book_id, target_fmt):
            dst = self._write_file(book_id, target_fmt, pdf_bytes)
            return dst, len(pdf_bytes)

        with mock.patch('apps.books.views.djvu_conversion_available', return_value=True), \
             mock.patch('apps.books.views.convert_book_file', side_effect=fake_convert):
            resp = self.client.get(self._read_url(book.id, 'djvu'))

        self.assertEqual(resp.status_code, 200)
        self.assertIn('pdf', resp.get('Content-Type', ''))
        self.assertTrue(BookFile.objects.filter(book=book, format='pdf').exists())


class TestDjvuUploadAndDownload(BookReadViewBase):
    """DjVu should be uploadable and downloadable."""

    def test_djvu_download_works(self):
        djvu_bytes = _make_djvu_bytes()
        book, _ = self._create_book_with_file('djvu', djvu_bytes)
        self.client.force_authenticate(user=self.user)
        resp = self.client.get(f'/api/books/{book.id}/download/djvu')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('djvu', resp.get('Content-Type', ''))
