import os
import re
from pathlib import Path
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent

try:
    from dotenv import load_dotenv
    load_dotenv(BASE_DIR.parent / '.env')
except ImportError:
    pass

SECRET_KEY = os.environ.get('SECRET_KEY', 'django-insecure-change-me-in-production-at-least-50-chars')

FIELD_ENCRYPTION_KEY = os.environ.get('FIELD_ENCRYPTION_KEY', '')

DEBUG = os.environ.get('DEBUG', 'false').lower() == 'true'

ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'daphne',
    'django.contrib.contenttypes',
    'django.contrib.auth',
    'corsheaders',
    'rest_framework',
    'rest_framework_simplejwt',
    'channels',
    'apps.core',
    'apps.users',
    'apps.books',
    'apps.opds',
    'apps.discussions',
    'apps.chat',
    'apps.telegram_upload',
]

ASGI_APPLICATION = 'config.asgi.application'

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'apps.core.middleware.VisitTrackingMiddleware',
]

ROOT_URLCONF = 'config.urls'
WSGI_APPLICATION = 'config.wsgi.application'

                  
_db_url = os.environ.get('DATABASE_URL', '')
_match = re.match(r'postgresql://([^:]+):([^@]+)@([^:/]+):?(\d+)?/(.+)', _db_url) if _db_url else None
if _match:
    _user, _pass, _host, _port, _name = _match.groups()
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': _name,
            'USER': _user,
            'PASSWORD': _pass,
            'HOST': _host,
            'PORT': _port or '5432',
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('POSTGRES_DB', 'bookdb'),
            'USER': os.environ.get('POSTGRES_USER', 'bookuser'),
            'PASSWORD': os.environ.get('POSTGRES_PASSWORD', 'bookpass'),
            'HOST': os.environ.get('POSTGRES_HOST', 'db'),
            'PORT': os.environ.get('POSTGRES_PORT', '5432'),
        }
    }

AUTH_USER_MODEL = 'users.User'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

                        
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'apps.core.authentication.LastSeenJWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'EXCEPTION_HANDLER': 'rest_framework.views.exception_handler',
}

             
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=2),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
    'ROTATE_REFRESH_TOKENS': False,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'AUTH_HEADER_TYPES': ('Bearer',),
    'TOKEN_TYPE_CLAIM': 'token_type',
}

              
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

                         
MEDIA_ROOT = os.environ.get('UPLOAD_DIR', '/app/uploads')
MEDIA_URL = '/uploads/'
MAX_UPLOAD_SIZE = int(os.environ.get('MAX_UPLOAD_SIZE', str(500 * 1024 * 1024)))

USE_TZ = True
TIME_ZONE = 'UTC'
LANGUAGE_CODE = 'en-us'

TEMPLATES = []

                     
_redis_url = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': _redis_url,
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            'SOCKET_CONNECT_TIMEOUT': 2,
            'SOCKET_TIMEOUT': 2,
            'IGNORE_EXCEPTIONS': True,                                        
        },
        'KEY_PREFIX': 'sbrw',
        'TIMEOUT': 300,
    }
}

                                     
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [_redis_url],
            'capacity': 1500,
            'expiry': 10,
        },
    },
}

               
KAFKA_BOOTSTRAP_SERVERS = os.environ.get('KAFKA_BOOTSTRAP_SERVERS', 'localhost:9092')

                 
MONGODB_URL = os.environ.get('MONGODB_URL', 'mongodb://mongodb:27017/sbrwdb')
MONGODB_DB = os.environ.get('MONGODB_DB', 'sbrwdb')
