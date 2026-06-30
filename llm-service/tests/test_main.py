"""
Tests for the LLM service (FastAPI app in main.py).

Run from the llm-service/ directory:
    pytest tests/test_main.py -v

Or from the repo root:
    cd llm-service && pytest -v
"""

import json
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from main import (
    app, extract_json, SYSTEM_PROMPT,
    detect_language, is_review_language_correct, make_prompt,
)

                                                                             
          
                                                                             

@pytest.fixture
async def client():
    """Async test client bound to the FastAPI app."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as c:
        yield c


                                                                             
             
                                                                             

class TestHealthEndpoint:
    async def test_health_returns_200(self, client):
        response = await client.get('/health')
        assert response.status_code == 200

    async def test_health_returns_ok_status(self, client):
        data = response = await client.get('/health')
        assert response.json() == {'status': 'ok'}


                                                                             
                     
                                                                             

class TestExtractJson:
    def test_plain_json_object(self):
        result = extract_json('{"review": "good", "metadata": {}}')
        assert isinstance(result, dict)
        assert 'review' in result
        assert result['review'] == 'good'

    def test_extracts_from_markdown_code_block(self):
        raw = '```json\n{"review": "x"}\n```'
        result = extract_json(raw)
        assert isinstance(result, dict)
        assert result.get('review') == 'x'

    def test_garbage_text_returns_empty_dict(self):
        result = extract_json('garbage text that is not JSON at all')
        assert result == {}

    def test_empty_string_returns_empty_dict(self):
        result = extract_json('')
        assert result == {}

    def test_nested_json_in_prose(self):
        raw = 'Here is the result: {"review": "nice", "metadata": {"title": "X"}}'
        result = extract_json(raw)
        assert result.get('review') == 'nice'

    def test_json_with_markdown_no_lang_specifier(self):
        raw = '```\n{"review": "stripped"}\n```'
        result = extract_json(raw)
        assert result.get('review') == 'stripped'


                                                                             
                                                     
                                                                             

VALID_LLM_RESPONSE = json.dumps({
    'review': 'Great book',
    'metadata': {
        'title': 'Test',
        'authors': ['A'],
        'genres': ['fiction'],
        'language': 'ru',
        'description': 'A test.',
    },
})


class TestAnalyzeEndpoint:
    async def test_analyze_with_mocked_ollama_returns_review(self, client):
        with patch('main.call_ollama', new=AsyncMock(return_value=VALID_LLM_RESPONSE)):
            response = await client.post('/analyze', json={
                'text': 'Once upon a time in a land far away…',
                'title': 'Test Book',
                'authors': ['Author One'],
                'provider': 'local',
            })
        assert response.status_code == 200
        data = response.json()
        assert 'review' in data
        assert data['review'] is not None
        assert data.get('error') is None

    async def test_analyze_with_mocked_ollama_returns_metadata(self, client):
        with patch('main.call_ollama', new=AsyncMock(return_value=VALID_LLM_RESPONSE)):
            response = await client.post('/analyze', json={
                'text': 'Some book text here.',
                'provider': 'local',
            })
        data = response.json()
        assert data.get('metadata') is not None
        assert data['metadata']['title'] == 'Test'

    async def test_analyze_provider_used_field(self, client):
        with patch('main.call_ollama', new=AsyncMock(return_value=VALID_LLM_RESPONSE)):
            response = await client.post('/analyze', json={
                'text': 'Any text.',
                'provider': 'local',
            })
        assert response.json()['provider_used'] == 'local'

    async def test_analyze_no_text_returns_error_field(self, client):
        response = await client.post('/analyze', json={
            'text': '',
            'provider': 'local',
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get('error') is not None
        assert data['error'] != ''

    async def test_analyze_unknown_provider_returns_error_field(self, client):
        response = await client.post('/analyze', json={
            'text': 'Some text.',
            'provider': 'unknown_provider',
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get('error') is not None

    async def test_analyze_missing_text_field_returns_422(self, client):
        """Pydantic validation rejects a payload with no 'text' key."""
        response = await client.post('/analyze', json={'provider': 'local'})
        assert response.status_code == 422


                                                                             
                      
                                                                             

class TestPromptConstants:
    def test_system_prompt_contains_json(self):
        assert 'JSON' in SYSTEM_PROMPT

    def test_system_prompt_contains_review(self):
        assert 'review' in SYSTEM_PROMPT

    def test_make_prompt_contains_title(self):
        rendered = make_prompt('My Book', 'Alice', 'Chapter one.', 'en')
        assert 'My Book' in rendered

    def test_make_prompt_contains_authors(self):
        rendered = make_prompt('My Book', 'Alice', 'Chapter one.', 'en')
        assert 'Alice' in rendered

    def test_make_prompt_contains_text(self):
        rendered = make_prompt('My Book', 'Alice', 'Chapter one.', 'en')
        assert 'Chapter one.' in rendered

    def test_make_prompt_ru_directive(self):
        rendered = make_prompt('Книга', 'Автор', 'Текст.', 'ru', strong=False)
        assert 'Russian' in rendered

    def test_make_prompt_ru_strong_directive(self):
        rendered = make_prompt('Книга', 'Автор', 'Текст.', 'ru', strong=True)
        assert 'РУССКОМ' in rendered

    def test_detect_language_ru(self):
        assert detect_language('Привет мир это русский текст для теста') == 'ru'

    def test_detect_language_en(self):
        assert detect_language('Hello world this is English text for testing') == 'en'

    def test_is_review_language_correct_ru(self):
        ru_text = 'Это отличная книга в жанре фэнтези с интересными персонажами.'
        assert is_review_language_correct(ru_text, 'ru') is True

    def test_is_review_language_correct_ru_mismatch(self):
        en_text = 'This is a great fantasy novel with interesting characters.'
        assert is_review_language_correct(en_text, 'ru') is False

    def test_is_review_language_correct_ru_mixed_words(self):
                                                                           
        mixed = 'Это роман в жанре фэнтези. Strengths книги — детальный мир. Target Audience широкая.'
        assert is_review_language_correct(mixed, 'ru') is False

    def test_is_review_language_correct_ru_short_latin_ok(self):
                                                                                  
        ru_with_abbr = 'Это книга в жанре фэнтези от издательства МИФ, серии LIT.'
                                                                              
        assert is_review_language_correct(ru_with_abbr, 'ru') is True
