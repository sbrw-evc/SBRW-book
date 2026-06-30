"""
Tests for the Books API.

Endpoints covered
-----------------
GET  /api/books/                    — BookListView
GET  /api/books/{id}                — BookDetailView
POST /api/books/{id}/rate           — BookRateView
POST /api/books/{id}/visibility     — BookVisibilityView (PATCH)
GET  /api/books/recent              — RecentBooksView
GET  /api/books/popular             — PopularBooksView
GET  /api/books/top-rated           — TopRatedBooksView
GET  /api/books/{id}/files          — BookFilesView

Run:
    DJANGO_SETTINGS_MODULE=config.test_settings \
    python manage.py test apps.books.tests.test_books_api -v 2
"""

import tempfile
from unittest import mock

from cryptography.fernet import Fernet
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.books.models import Book, BookFile, ReadingProgress

User = get_user_model()


                                                                             
         
                                                                             

def _fernet_key() -> str:
    return Fernet.generate_key().decode()


def _make_user(username, email, password='Pass1234!', role='user'):
    return User.objects.create_user(
        username=username, email=email, password=password, role=role,
    )


def _make_book(title='Test Book', is_public=True, uploaded_by=None):
    return Book.objects.create(
        title=title,
        is_public=is_public,
        uploaded_by=uploaded_by,
    )


def _make_book_file(book, fmt='epub', file_path='/fake/path/book.epub', file_size=1024):
    return BookFile.objects.create(
        book=book, format=fmt, file_path=file_path, file_size=file_size,
    )


def _make_progress(user, book, percentage=50.0):
    return ReadingProgress.objects.create(user=user, book=book, percentage=percentage)


                                                                             
                 
                                                                             

class BooksApiTestBase(TestCase):
    def setUp(self):
        self.tmp_dir = tempfile.mkdtemp()
        self.settings_override = override_settings(
            MEDIA_ROOT=self.tmp_dir,
            FIELD_ENCRYPTION_KEY=_fernet_key(),
        )
        self.settings_override.enable()
        self.client = APIClient()

    def tearDown(self):
        self.settings_override.disable()

    def _login(self, username, password='Pass1234!'):
        r = self.client.post('/api/auth/login', {
            'username': username, 'password': password,
        }, format='json')
        self.assertEqual(r.status_code, 200)
        return r.json()['access_token']

    def _auth_client(self, username, password='Pass1234!'):
        token = self._login(username, password)
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        return c


                                                                             
                                 
                                                                             

class BookListViewTests(BooksApiTestBase):

    def test_unauthenticated_list_returns_only_public_books(self):
        public_book = _make_book(title='Public Book', is_public=True)
        private_book = _make_book(title='Private Book', is_public=False)

        response = self.client.get('/api/books/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        titles = [item['title'] for item in data['items']]
        self.assertIn('Public Book', titles)
        self.assertNotIn('Private Book', titles)

    def test_list_response_has_pagination_fields(self):
        response = self.client.get('/api/books/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        for field in ('items', 'total', 'page', 'page_size', 'pages'):
            self.assertIn(field, data)


                                                                             
                                       
                                                                             

class BookDetailViewTests(BooksApiTestBase):

    def test_public_book_detail_returns_200(self):
        book = _make_book(title='Visible', is_public=True)
        response = self.client.get(f'/api/books/{book.id}')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['title'], 'Visible')

    def test_private_book_unauthenticated_returns_403(self):
        book = _make_book(title='Secret', is_public=False)
        response = self.client.get(f'/api/books/{book.id}')
        self.assertEqual(response.status_code, 403)

    def test_private_book_other_user_returns_403(self):
        owner = _make_user('owner', 'owner@example.com')
        other = _make_user('other', 'other@example.com')
        book = _make_book(title='OwnerOnly', is_public=False, uploaded_by=owner)
        client = self._auth_client('other')
        response = client.get(f'/api/books/{book.id}')
        self.assertEqual(response.status_code, 403)

    def test_private_book_admin_can_access(self):
        admin = _make_user('admin1', 'admin1@example.com', role='admin')
        book = _make_book(title='AdminOnly', is_public=False)
        client = self._auth_client('admin1')
        response = client.get(f'/api/books/{book.id}')
        self.assertEqual(response.status_code, 200)


                                                                             
                                           
                                                                             

class BookRateViewTests(BooksApiTestBase):

    def test_rate_requires_auth(self):
        book = _make_book()
        response = self.client.post(f'/api/books/{book.id}/rate', {'rating': 5}, format='json')
                                                                                                 
        self.assertIn(response.status_code, (401, 403))

    def test_rate_requires_reading_progress(self):
        """User must have a ReadingProgress record before leaving a rating."""
        user = _make_user('rater', 'rater@example.com')
        book = _make_book()
        client = self._auth_client('rater')
        response = client.post(f'/api/books/{book.id}/rate', {'rating': 4}, format='json')
                                                               
        self.assertEqual(response.status_code, 403)

    def test_rate_success_creates_rating(self):
        user = _make_user('reader', 'reader@example.com')
        book = _make_book()
        _make_progress(user, book, percentage=30.0)
        client = self._auth_client('reader')
        response = client.post(f'/api/books/{book.id}/rate', {
            'rating': 5, 'review': 'Excellent!'
        }, format='json')
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data['rating'], 5)

    def test_second_rate_updates_existing(self):
        user = _make_user('reader2', 'reader2@example.com')
        book = _make_book()
        _make_progress(user, book, percentage=60.0)
        client = self._auth_client('reader2')
        client.post(f'/api/books/{book.id}/rate', {'rating': 3}, format='json')
        response = client.post(f'/api/books/{book.id}/rate', {'rating': 5}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['rating'], 5)
                                                              
        from apps.books.models import UserRating
        count = UserRating.objects.filter(user=user, book=book).count()
        self.assertEqual(count, 1)

    def test_rate_value_out_of_range_returns_400(self):
        user = _make_user('reader3', 'reader3@example.com')
        book = _make_book()
        _make_progress(user, book, percentage=10.0)
        client = self._auth_client('reader3')
        response = client.post(f'/api/books/{book.id}/rate', {'rating': 99}, format='json')
        self.assertEqual(response.status_code, 400)


                                                                             
                                                        
                                                                             

class BookVisibilityViewTests(BooksApiTestBase):

    def test_regular_user_cannot_toggle_visibility(self):
        user = _make_user('reguser', 'reg@example.com')
        book = _make_book(is_public=True)
        client = self._auth_client('reguser')
        response = client.patch(f'/api/books/{book.id}/visibility', {}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_admin_can_toggle_visibility(self):
        admin = _make_user('admin2', 'admin2@example.com', role='admin')
        book = _make_book(is_public=True)
        client = self._auth_client('admin2')
        response = client.patch(f'/api/books/{book.id}/visibility', {}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()['is_public'])

    def test_admin_can_set_visibility_explicitly(self):
        admin = _make_user('admin3', 'admin3@example.com', role='admin')
        book = _make_book(is_public=False)
        client = self._auth_client('admin3')
        response = client.patch(f'/api/books/{book.id}/visibility',
                                {'is_public': True}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['is_public'])


                                                                             
                                                                 
                                                                             

class PublicListEndpointsTests(BooksApiTestBase):

    def test_recent_returns_200(self):
        response = self.client.get('/api/books/recent')
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.json(), list)

    def test_popular_returns_200(self):
        response = self.client.get('/api/books/popular')
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.json(), list)

    def test_top_rated_returns_200(self):
        response = self.client.get('/api/books/top-rated')
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.json(), list)


                                                                             
                                            
                                                                             

class BookFilesViewTests(BooksApiTestBase):

    def test_files_returns_list(self):
        user = _make_user('filesuser', 'files@test.com')
        self.client.force_authenticate(user=user)
        book = _make_book(title='FileBook', is_public=True)
        _make_book_file(book, fmt='epub')
        _make_book_file(book, fmt='pdf', file_path='/fake/path/book.pdf')
        response = self.client.get(f'/api/books/{book.id}/files')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsInstance(data, list)
        formats = {f['format'] for f in data}
        self.assertIn('epub', formats)
        self.assertIn('pdf', formats)

    def test_files_not_found_returns_404(self):
        import uuid
        user = _make_user('filesuser2', 'files2@test.com')
        self.client.force_authenticate(user=user)
        response = self.client.get(f'/api/books/{uuid.uuid4()}/files')
        self.assertEqual(response.status_code, 404)
