"""
Tests for the Users / Auth API.

Endpoints covered
-----------------
POST /api/auth/register      — RegisterView
POST /api/auth/login         — LoginView
POST /api/auth/refresh       — RefreshView
GET  /api/users/me           — MeView      (auth_urls has /me too, but user_urls/me is UpdateMeView)
PUT  /api/users/me           — UpdateMeView
GET  /api/users/{id}/public  — PublicProfileView

Run:
    DJANGO_SETTINGS_MODULE=config.test_settings \
    python manage.py test apps.users.tests.test_auth -v 2
"""

import tempfile

from cryptography.fernet import Fernet
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

User = get_user_model()

                                                                             
         
                                                                             

def _fernet_key() -> str:
    return Fernet.generate_key().decode()


def _make_user(username='testuser', email='test@example.com',
               password='StrongPass1!', role='user', is_active=True):
    user = User.objects.create_user(
        username=username,
        email=email,
        password=password,
        role=role,
    )
    if not is_active:
        user.is_active = False
        user.save(update_fields=['is_active'])
    return user


                                                                             
                                                                     
                                                                             

class AuthTestBase(TestCase):
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


                                                                             
                         
                                                                             

class RegisterViewTests(AuthTestBase):

    def test_register_success_returns_201(self):
        response = self.client.post('/api/auth/register', {
            'username': 'newuser',
            'email': 'new@example.com',
            'password': 'ValidPass123!',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data['username'], 'newuser')
        self.assertNotIn('password', data)

    def test_register_duplicate_username_returns_400(self):
        _make_user(username='taken', email='taken@example.com')
        response = self.client.post('/api/auth/register', {
            'username': 'taken',
            'email': 'other@example.com',
            'password': 'ValidPass123!',
        }, format='json')
        self.assertEqual(response.status_code, 400)

    def test_register_duplicate_email_returns_400(self):
        _make_user(username='first', email='dup@example.com')
        response = self.client.post('/api/auth/register', {
            'username': 'second',
            'email': 'dup@example.com',
            'password': 'ValidPass123!',
        }, format='json')
        self.assertEqual(response.status_code, 400)

    def test_register_weak_password_returns_400(self):
                                                    
        response = self.client.post('/api/auth/register', {
            'username': 'shortpwuser',
            'email': 'short@example.com',
            'password': 'abc',
        }, format='json')
        self.assertEqual(response.status_code, 400)


                                                                             
                      
                                                                             

class LoginViewTests(AuthTestBase):

    def test_login_success_returns_tokens(self):
        _make_user(username='loginuser', email='login@example.com', password='MyPass1234!')
        response = self.client.post('/api/auth/login', {
            'username': 'loginuser',
            'password': 'MyPass1234!',
        }, format='json')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('access_token', data)
        self.assertIn('refresh_token', data)

    def test_login_wrong_password_returns_401(self):
        _make_user(username='badpwuser', email='badpw@example.com', password='CorrectPass!')
        response = self.client.post('/api/auth/login', {
            'username': 'badpwuser',
            'password': 'WrongPass!',
        }, format='json')
        self.assertEqual(response.status_code, 401)

    def test_login_inactive_user_returns_401(self):
        _make_user(username='inactive', email='inactive@example.com',
                   password='Pass1234!', is_active=False)
        response = self.client.post('/api/auth/login', {
            'username': 'inactive',
            'password': 'Pass1234!',
        }, format='json')
        self.assertEqual(response.status_code, 401)


                                                                             
                        
                                                                             

class RefreshViewTests(AuthTestBase):

    def _login(self, username, password):
        r = self.client.post('/api/auth/login', {
            'username': username, 'password': password,
        }, format='json')
        self.assertEqual(r.status_code, 200)
        return r.json()

    def test_refresh_with_valid_token_returns_access(self):
        _make_user(username='refreshuser', email='refresh@example.com', password='Pass1234!')
        tokens = self._login('refreshuser', 'Pass1234!')
        response = self.client.post('/api/auth/refresh', {
            'refresh_token': tokens['refresh_token'],
        }, format='json')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('access_token', data)

    def test_refresh_with_invalid_token_returns_401(self):
        response = self.client.post('/api/auth/refresh', {
            'refresh_token': 'completelyfaketoken.notvalid.atall',
        }, format='json')
        self.assertEqual(response.status_code, 401)


                                                                             
                                             
                                                          
                                                                             

class MeViewTests(AuthTestBase):

    def _auth_client(self, username, password):
        r = self.client.post('/api/auth/login', {
            'username': username, 'password': password,
        }, format='json')
        self.assertEqual(r.status_code, 200)
        access = r.json()['access_token']
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        return client

    def test_get_me_without_auth_returns_401(self):
        response = self.client.get('/api/auth/me')
        self.assertEqual(response.status_code, 401)

    def test_get_me_authenticated_returns_user_data(self):
        _make_user(username='meuser', email='me@example.com', password='Pass1234!')
        client = self._auth_client('meuser', 'Pass1234!')
        response = client.get('/api/auth/me')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['username'], 'meuser')
        self.assertIn('email', data)
        self.assertNotIn('password', data)


                                                                             
                                   
                                                                             

class UpdateMeViewTests(AuthTestBase):

    def _auth_client(self, username, password):
        r = self.client.post('/api/auth/login', {
            'username': username, 'password': password,
        }, format='json')
        self.assertEqual(r.status_code, 200)
        access = r.json()['access_token']
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        return client

    def test_update_me_locale_and_theme(self):
        _make_user(username='upuser', email='up@example.com', password='Pass1234!')
        client = self._auth_client('upuser', 'Pass1234!')
        response = client.put('/api/users/me', {
            'locale': 'en',
            'theme': 'dark',
        }, format='json')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['locale'], 'en')
        self.assertEqual(data['theme'], 'dark')

    def test_update_me_cannot_change_role(self):
        """UserUpdateSerializer has no 'role' field — role stays 'user'."""
        _make_user(username='norole', email='norole@example.com', password='Pass1234!')
        client = self._auth_client('norole', 'Pass1234!')
                                                                           
        response = client.put('/api/users/me', {
            'locale': 'ru',
            'role': 'admin',                      
        }, format='json')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['role'], 'user')


                                                                             
                                                 
                                                                             

class PublicProfileViewTests(AuthTestBase):

    def test_public_profile_returns_200_with_username(self):
        user = _make_user(username='pubuser', email='pub@example.com', password='Pass1234!')
        response = self.client.get(f'/api/users/{user.id}/public')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['username'], 'pubuser')

    def test_public_profile_does_not_expose_email(self):
        user = _make_user(username='noemailuser', email='secret@example.com', password='Pass1234!')
        response = self.client.get(f'/api/users/{user.id}/public')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertNotIn('email', data)

    def test_public_profile_not_found_returns_404(self):
        import uuid
        response = self.client.get(f'/api/users/{uuid.uuid4()}/public')
        self.assertEqual(response.status_code, 404)
