"""
Django settings override for the test suite.

Usage:
    DJANGO_SETTINGS_MODULE=config.test_settings python manage.py test
"""
from cryptography.fernet import Fernet

from config.settings import *                    

                                                                       
FIELD_ENCRYPTION_KEY = Fernet.generate_key().decode()

                                                                             
                                                                 
import os as _os

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME':     _os.environ.get('POSTGRES_DB', 'bookdb'),
        'USER':     _os.environ.get('POSTGRES_USER', 'bookuser'),
        'PASSWORD': _os.environ.get('POSTGRES_PASSWORD', 'bookpass'),
        'HOST':     _os.environ.get('POSTGRES_HOST', 'db'),
        'PORT':     _os.environ.get('POSTGRES_PORT', '5432'),
                                                                                      
        'CONN_MAX_AGE': 0,
        'TEST': {
            'NAME': 'bookdb_test',
        },
    }
}

                                                                           
                                                        
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels.layers.InMemoryChannelLayer',
    }
}

                                                                             
KAFKA_BOOTSTRAP_SERVERS = 'localhost:9092'

LLM_SERVICE_URL = 'http://localhost:8100'

                                                                                
                                                                                      
TEST_OUTPUT_DIR = _os.environ.get('TEST_OUTPUT_DIR', '/tmp/test-reports')

DEBUG = False

TEST_RUNNER = 'config.test_runner.TerminateConnectionsRunner'
