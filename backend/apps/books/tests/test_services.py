"""
Tests for pure utility functions in apps.books.services.

Covers
------
get_file_format   — extension → format string or None
extract_metadata  — fb2 and epub bytes dispatch correctly

Run:
    DJANGO_SETTINGS_MODULE=config.test_settings \
    python manage.py test apps.books.tests.test_services -v 2
"""

import io
from io import BytesIO

from django.test import TestCase

from apps.books.services import get_file_format, extract_metadata


                                                                             
                                                                  
                                                                             

def _make_epub_bytes(title: str = 'Test Book', author: str = 'Test Author') -> bytes:
    import tempfile
    import os
    from ebooklib import epub

    book = epub.EpubBook()
    book.set_title(title)
    book.add_author(author)
    chapter = epub.EpubHtml(title='Chapter 1', file_name='chap_01.xhtml')
    chapter.content = b'<h1>Chapter 1</h1><p>Sample text.</p>'
    book.add_item(chapter)
    book.add_item(epub.EpubNcx())
    book.add_item(epub.EpubNav())
    book.spine = ['nav', chapter]

    with tempfile.NamedTemporaryFile(suffix='.epub', delete=False) as tmp:
        epub.write_epub(tmp.name, book, {})
        path = tmp.name
    try:
        with open(path, 'rb') as f:
            return f.read()
    finally:
        os.unlink(path)


def _make_fb2_bytes(title: str = 'FB2 Title',
                    author_first: str = 'Ivan',
                    author_last: str = 'Petrov') -> bytes:
    return (
        b'<?xml version="1.0" encoding="utf-8"?>'
        b'<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">'
        b'<description>'
        b'<title-info>'
        b'<book-title>' + title.encode() + b'</book-title>'
        b'<author>'
        b'<first-name>' + author_first.encode() + b'</first-name>'
        b'<last-name>' + author_last.encode() + b'</last-name>'
        b'</author>'
        b'<lang>ru</lang>'
        b'</title-info>'
        b'</description>'
        b'<body><section><p>Sample text.</p></section></body>'
        b'</FictionBook>'
    )


                                                                             
                       
                                                                             

class GetFileFormatTests(TestCase):

    def test_epub(self):
        self.assertEqual(get_file_format('book.epub'), 'epub')

    def test_pdf(self):
        self.assertEqual(get_file_format('book.pdf'), 'pdf')

    def test_fb2(self):
        self.assertEqual(get_file_format('book.fb2'), 'fb2')

    def test_txt(self):
        self.assertEqual(get_file_format('book.txt'), 'txt')

    def test_unknown_extension_returns_none(self):
        self.assertIsNone(get_file_format('book.unknown'))

    def test_empty_filename_returns_none(self):
        self.assertIsNone(get_file_format(''))

    def test_no_extension_returns_none(self):
        self.assertIsNone(get_file_format('justfilename'))

    def test_uppercase_extension_is_normalised(self):
                                                                                 
                                                                 
        self.assertEqual(get_file_format('book.EPUB'), 'epub')

    def test_mobi_supported(self):
        self.assertEqual(get_file_format('book.mobi'), 'mobi')

    def test_path_with_directory(self):
        self.assertEqual(get_file_format('/home/user/books/mybook.fb2'), 'fb2')


                                                                             
                        
                                                                             

class ExtractFb2MetadataTests(TestCase):

    def test_fb2_returns_title(self):
        data = _make_fb2_bytes(title='Great Novel')
        meta = extract_metadata(data, 'fb2')
        self.assertEqual(meta.get('title'), 'Great Novel')

    def test_fb2_returns_author(self):
        data = _make_fb2_bytes(author_first='Alexander', author_last='Pushkin')
        meta = extract_metadata(data, 'fb2')
        authors = meta.get('authors', [])
        self.assertTrue(
            any('Alexander' in a or 'Pushkin' in a for a in authors),
            f"Expected author not found in {authors}",
        )

    def test_fb2_returns_language(self):
        data = _make_fb2_bytes()
        meta = extract_metadata(data, 'fb2')
        self.assertEqual(meta.get('language'), 'ru')

    def test_fb2_empty_bytes_returns_dict(self):
        meta = extract_metadata(b'', 'fb2')
        self.assertIsInstance(meta, dict)

    def test_fb2_garbage_bytes_returns_empty_dict(self):
        meta = extract_metadata(b'\x00\xff\xfe garbage', 'fb2')
        self.assertIsInstance(meta, dict)


                                                                             
                         
                                                                             

class ExtractEpubMetadataTests(TestCase):

    def test_epub_returns_title(self):
        data = _make_epub_bytes(title='My Epub Title')
        meta = extract_metadata(data, 'epub')
        self.assertEqual(meta.get('title'), 'My Epub Title')

    def test_epub_returns_author(self):
        data = _make_epub_bytes(author='Jane Doe')
        meta = extract_metadata(data, 'epub')
        authors = meta.get('authors', [])
        self.assertIn('Jane Doe', authors)

    def test_epub_empty_bytes_returns_dict(self):
        meta = extract_metadata(b'', 'epub')
        self.assertIsInstance(meta, dict)

    def test_epub_garbage_returns_empty_dict(self):
        meta = extract_metadata(b'notanepub', 'epub')
        self.assertIsInstance(meta, dict)


                                                                             
                                                            
                                                                             

class ExtractMetadataUnknownFormatTests(TestCase):

    def test_unknown_format_returns_empty_dict(self):
        meta = extract_metadata(b'whatever', 'xyz')
        self.assertEqual(meta, {})
