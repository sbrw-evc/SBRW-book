"""
Helpers for calling the internal LLM service (sbrw_llm container).
All settings are read from AppSettings at call time.
"""
import os
import requests
from apps.core.models import AppSettings


def _get(key: str, default: str = '') -> str:
    try:
        obj = AppSettings.objects.get(key=key)
        return obj.value or default
    except AppSettings.DoesNotExist:
        return default


def llm_is_enabled() -> bool:
    return _get('llm_enabled', 'false').lower() in ('true', '1', 'yes')


def call_llm_service(text: str, title: str = '', authors: list = None) -> dict:
    """
    Call the LLM microservice. Returns dict with keys:
      review: str | None
      metadata: dict | None   — title, authors, genres, language, description
      error: str | None
    """
    if not llm_is_enabled():
        return {}

    llm_url = os.environ.get('LLM_SERVICE_URL', 'http://llm:8100')
    provider  = _get('llm_provider', 'local')
    api_key   = _get('llm_api_key',  '')
    model     = _get('llm_model',    '')
    ollama_url = _get('llm_ollama_url', 'http://ollama:11434')

    payload = {
        'text':       text,
        'title':      title,
        'authors':    authors or [],
        'provider':   provider,
        'api_key':    api_key,
        'model':      model,
        'ollama_url': ollama_url,
        'task':       'both',
    }
    try:
        resp = requests.post(f'{llm_url}/analyze', json=payload, timeout=180)
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        return {'error': str(exc)}
