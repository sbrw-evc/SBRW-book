"""
Redis cache helpers for book queries.

Cache keys follow the pattern: sbrw:<entity>:<variant>
TTLs are intentionally short since book data changes infrequently but catalog
freshness matters.
"""
import logging
from django.core.cache import cache

logger = logging.getLogger(__name__)

TTL_SHORT  = 120                                                     
TTL_MEDIUM = 600                                                  
TTL_LONG   = 1800                                                  
TTL_BOOK   = 300                                    


def _key(*parts):
    return ':'.join(str(p) for p in parts)



def get_recent(limit):
    return cache.get(_key('recent', limit))

def set_recent(limit, data):
    if data:
        cache.set(_key('recent', limit), data, TTL_SHORT)

def get_popular(limit):
    return cache.get(_key('popular', limit))

def set_popular(limit, data):
    if data:
        cache.set(_key('popular', limit), data, TTL_MEDIUM)

def get_top_rated(limit):
    return cache.get(_key('top_rated', limit))

def set_top_rated(limit, data):
    if data:
        cache.set(_key('top_rated', limit), data, TTL_MEDIUM)

def get_book(book_id):
    return cache.get(_key('book', book_id))

def set_book(book_id, data):
    cache.set(_key('book', book_id), data, TTL_BOOK)

def invalidate_book(book_id):
    cache.delete(_key('book', book_id))

def invalidate_lists():
    """Bust all list caches when catalog content changes."""
                                                                        
                                                                         
    keys = [
        _key(kind, limit)
        for kind in ('recent', 'popular', 'top_rated')
        for limit in (6, 12, 24, 50)
    ]
    cache.delete_many(keys)



def get_tags():
    return cache.get('tags')

def set_tags(data):
    cache.set('tags', data, TTL_LONG)

def invalidate_tags():
    cache.delete('tags')



def get_authors(page, search):
    return cache.get(_key('authors', page, search or ''))

def set_authors(page, search, data):
    cache.set(_key('authors', page, search or ''), data, TTL_LONG)



def get_series(page, search):
    return cache.get(_key('series', page, search or ''))

def set_series(page, search, data):
    cache.set(_key('series', page, search or ''), data, TTL_LONG)
