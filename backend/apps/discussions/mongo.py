from pymongo import MongoClient, ASCENDING, DESCENDING, TEXT
from django.conf import settings
import threading

_client = None
_lock = threading.Lock()

def get_client():
    global _client
    if _client is None:
        with _lock:
            if _client is None:
                _client = MongoClient(settings.MONGODB_URL, serverSelectionTimeoutMS=3000)
    return _client

def get_db():
    return get_client()[settings.MONGODB_DB]

def discussions_col():
    col = get_db()['discussions']
                                 
    col.create_index([('book_id', ASCENDING), ('created_at', DESCENDING)])
    col.create_index([('user_id', ASCENDING)])
    col.create_index([('parent_id', ASCENDING)])
    return col

def reviews_col():
    col = get_db()['reviews']
    col.create_index([('book_id', ASCENDING), ('created_at', DESCENDING)])
    col.create_index([('user_id', ASCENDING)])
    col.create_index([('book_id', ASCENDING), ('user_id', ASCENDING)], unique=True)
    col.create_index([('rating', ASCENDING)])
    return col
