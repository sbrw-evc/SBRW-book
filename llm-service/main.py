"""
LLM Service — FastAPI proxy for book analysis.

Supports both batch (/analyze) and streaming (/analyze-stream) modes.
Streaming endpoint returns Server-Sent Events with thinking tokens in real time.
"""
import json
import logging
import re
from typing import AsyncIterator, Optional

import httpx
from fastapi import FastAPI
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

logger = logging.getLogger("llm_service")

app = FastAPI(title="SBRW LLM Service", version="1.2.0")

THINKING_TIMEOUT = 300                                         
TIMEOUT = httpx.Timeout(THINKING_TIMEOUT + 10)


DEFAULT_MODELS = {
    "local":    "qwen2.5:7b",                                                                               
    "claude":   "claude-haiku-4-5-20251001",
    "openai":   "gpt-4o-mini",
    "gemini":   "gemini-2.0-flash",
    "deepseek": "deepseek-chat",
}

                                                                                 
                                                     
TEXT_LIMIT_LOCAL   = 4_000
TEXT_LIMIT_CLOUD   = 18_000


SYSTEM_PROMPT = """You are a literary critic. When given a book excerpt, respond with ONLY a valid JSON object — no markdown, no explanation, no text outside the JSON.

Required JSON format:
{"review":"<4-6 sentences of your critical opinion>","metadata":{"title":"<book title or empty>","authors":["<name>"],"genres":["<genre>"],"language":"<ru or en>","description":"<2-3 sentence synopsis>"}}

Rules:
- "review" must be YOUR OWN critical opinion. Never copy sentences from the book.
- LANGUAGE RULE (most important): write "review" entirely in the SAME language as the book text.
  If the book text is Russian → every word of the review must be Russian.
  If the book text is English → every word of the review must be English.
  Do NOT mix languages. Do NOT use English words inside a Russian review.
- Output ONLY the JSON object. No preamble, no code blocks, no trailing text."""

                                                             
                                                                  
_LANG_DIRECTIVE = {
    'ru': {
        False: 'Write the review in Russian only.',
        True:  'ВАЖНО: ПИШИ РЕЦЕНЗИЮ ИСКЛЮЧИТЕЛЬНО НА РУССКОМ ЯЗЫКЕ. НЕ ИСПОЛЬЗУЙ АНГЛИЙСКИЙ НИ В ОДНОМ СЛОВЕ.',
    },
    'en': {
        False: 'Write the review in English only.',
        True:  'IMPORTANT: WRITE THE REVIEW IN ENGLISH ONLY. DO NOT USE ANY RUSSIAN WORDS.',
    },
}

MAX_RETRIES = 2                                                              


def detect_language(text: str) -> str:
    """Detect dominant script: 'ru' if Cyrillic ≥ Latin, else 'en'."""
    cyrillic = sum(1 for c in text if 'Ѐ' <= c <= 'ӿ')
    latin    = sum(1 for c in text if 'a' <= c.lower() <= 'z')
    return 'ru' if cyrillic >= latin else 'en'


def is_review_language_correct(review: str, expected: str) -> bool:
    """Return True when review is in the expected language.

    Uses two signals:
    1. Character ratio: Cyrillic share must be ≥ 80% for Russian (stricter than before).
    2. Word check: for Russian reviews, any standalone Latin word of 4+ chars
       (e.g. 'Strengths', 'Target', 'atmosphere') immediately fails the check.
    """
    if not review:
        return True
    cyrillic = sum(1 for c in review if 'Ѐ' <= c <= 'ӿ')
    latin    = sum(1 for c in review if 'a' <= c.lower() <= 'z')
    total = cyrillic + latin
    if total == 0:
        return True
    ratio = cyrillic / total

    if expected == 'ru':
                                 
        if ratio < 0.80:
            return False
                                                                               
        latin_words = re.findall(r'\b[A-Za-z]{4,}\b', review)
        if latin_words:
            return False
        return True
    else:
        return ratio <= 0.4


def make_prompt(title: str, authors: str, text: str, lang: str, strong: bool = False) -> str:
    directive = _LANG_DIRECTIVE.get(lang, _LANG_DIRECTIVE['en'])[strong]
    return f"""Book title: «{title}»
Author(s): {authors}
{directive}

Read this excerpt and write a review:

{text}"""



class AnalyzeRequest(BaseModel):
    text: str
    title: str = ""
    authors: list[str] = []
    provider: str = "local"                                                      
    api_key: str = ""
    model: str = ""
    ollama_url: str = "http://ollama:11434"
    task: str = "both"                                        


class AnalyzeResponse(BaseModel):
    review: Optional[str] = None
    metadata: Optional[dict] = None
    source: str = "AI"
    provider_used: str = ""
    error: Optional[str] = None



def extract_json(raw: str) -> dict:
    """Extract first JSON object from LLM output (which may contain extra text)."""
    raw = raw.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            pass
    m = re.search(r"\{.*\}", raw, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(0))
        except json.JSONDecodeError:
            pass
    return {}


def _sse(msg: dict) -> str:
    return f"data: {json.dumps(msg, ensure_ascii=False)}\n\n"



async def call_ollama(model: str, prompt: str, ollama_url: str) -> str:
    url = ollama_url.rstrip("/") + "/api/chat"
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": prompt},
        ],
        "stream": False,
        "options": {"temperature": 0.3, "num_predict": 1024},
    }
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        return resp.json()["message"]["content"]


async def call_openai_compatible(api_url: str, api_key: str, model: str, prompt: str) -> str:
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": prompt},
        ],
        "temperature": 0.3,
        "max_tokens": 1024,
    }
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.post(api_url, headers=headers, json=payload)
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


async def call_claude(api_key: str, model: str, prompt: str) -> str:
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    payload = {
        "model": model,
        "max_tokens": 1024,
        "system": SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": prompt}],
    }
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload)
        resp.raise_for_status()
        return resp.json()["content"][0]["text"]


async def call_gemini(api_key: str, model: str, prompt: str) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    payload = {
        "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 1024},
    }
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        return resp.json()["candidates"][0]["content"]["parts"][0]["text"]



async def stream_ollama(model: str, prompt: str, ollama_url: str) -> AsyncIterator[str]:
    url = ollama_url.rstrip("/") + "/api/chat"
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": prompt},
        ],
        "stream": True,
        "options": {"temperature": 0.3, "num_predict": 1024},
    }
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        async with client.stream("POST", url, json=payload) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.strip():
                    continue
                try:
                    data = json.loads(line)
                    token = data.get("message", {}).get("content", "")
                    if token:
                        yield token
                except json.JSONDecodeError:
                    continue


async def stream_openai_compatible(api_url: str, api_key: str, model: str, prompt: str) -> AsyncIterator[str]:
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": prompt},
        ],
        "temperature": 0.3,
        "max_tokens": 1024,
        "stream": True,
    }
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        async with client.stream("POST", api_url, headers=headers, json=payload) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                raw = line[6:].strip()
                if raw == "[DONE]":
                    break
                try:
                    data = json.loads(raw)
                    token = data["choices"][0].get("delta", {}).get("content", "")
                    if token:
                        yield token
                except (json.JSONDecodeError, KeyError, IndexError):
                    continue


async def stream_claude(api_key: str, model: str, prompt: str) -> AsyncIterator[str]:
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    payload = {
        "model": model,
        "max_tokens": 1024,
        "system": SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": prompt}],
        "stream": True,
    }
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        async with client.stream("POST", "https://api.anthropic.com/v1/messages", headers=headers, json=payload) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                try:
                    data = json.loads(line[6:])
                    if data.get("type") == "content_block_delta":
                        token = data.get("delta", {}).get("text", "")
                        if token:
                            yield token
                except (json.JSONDecodeError, KeyError):
                    continue


async def stream_gemini(api_key: str, model: str, prompt: str) -> AsyncIterator[str]:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?key={api_key}&alt=sse"
    payload = {
        "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 1024},
    }
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        async with client.stream("POST", url, json=payload) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                try:
                    data = json.loads(line[6:])
                    for part in data.get("candidates", [{}])[0].get("content", {}).get("parts", []):
                        token = part.get("text", "")
                        if token:
                            yield token
                except (json.JSONDecodeError, KeyError, IndexError):
                    continue



@app.get("/health")
async def health():
    return {"status": "ok"}


async def _call_provider(provider: str, model: str, prompt: str, req: "AnalyzeRequest") -> str:
    """Dispatch to the correct provider and return raw LLM output."""
    if provider == "local":
        return await call_ollama(model, prompt, req.ollama_url)
    if provider == "claude":
        return await call_claude(req.api_key, model, prompt)
    if provider == "openai":
        return await call_openai_compatible(
            "https://api.openai.com/v1/chat/completions", req.api_key, model, prompt)
    if provider == "gemini":
        return await call_gemini(req.api_key, model, prompt)
    if provider == "deepseek":
        return await call_openai_compatible(
            "https://api.deepseek.com/v1/chat/completions", req.api_key, model, prompt)
    raise ValueError(f"Unknown provider: {provider}")


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest):
    """Batch (non-streaming) analysis — used by kafka-worker.

    Retries up to MAX_RETRIES times if the review language does not match
    the detected book language (e.g. English words in a Russian review).
    """
    provider = req.provider.lower()
    model = req.model or DEFAULT_MODELS.get(provider, "")
    authors_str = ", ".join(req.authors) if req.authors else "Неизвестен"
    limit = TEXT_LIMIT_LOCAL if provider == "local" else TEXT_LIMIT_CLOUD
    text = req.text[:limit] if req.text else ""
    if not text:
        return AnalyzeResponse(error="No text provided", provider_used=provider)

    lang = detect_language(text)
    parsed: dict = {}

    for attempt in range(MAX_RETRIES):
        strong = attempt > 0
        prompt = make_prompt(req.title or "Неизвестно", authors_str, text, lang, strong)
        try:
            raw = await _call_provider(provider, model, prompt, req)
        except ValueError as exc:
            return AnalyzeResponse(error=str(exc), provider_used=provider)
        except httpx.HTTPStatusError as exc:
            logger.error("HTTP error from %s: %s", provider, exc.response.status_code)
            return AnalyzeResponse(error=f"Provider error: {exc.response.status_code}", provider_used=provider)
        except Exception as exc:
            logger.error("Error calling %s: %s", provider, exc)
            return AnalyzeResponse(error=str(exc), provider_used=provider)

        parsed = extract_json(raw)
        review = parsed.get("review") or ""

        if review and not is_review_language_correct(review, lang):
            logger.warning(
                "Language mismatch (attempt %d/%d, expected=%s) — retrying with stronger directive",
                attempt + 1, MAX_RETRIES, lang,
            )
            continue
        break

    return AnalyzeResponse(
        review=parsed.get("review") or None,
        metadata=parsed.get("metadata") or None,
        source="AI",
        provider_used=provider,
    )


@app.post("/analyze-stream")
async def analyze_stream(req: AnalyzeRequest):
    """Streaming analysis — returns SSE with thinking tokens + final result.

    SSE message types:
      {"type": "status",   "message": "..."}      — progress status
      {"type": "thinking", "content": "token"}    — LLM output token
      {"type": "done",     "review": "...", "metadata": {...}} — final result
      {"type": "error",    "message": "..."}      — error
    """
    provider = req.provider.lower()
    model = req.model or DEFAULT_MODELS.get(provider, "")
    authors_str = ", ".join(req.authors) if req.authors else "Неизвестен"
    limit = TEXT_LIMIT_LOCAL if provider == "local" else TEXT_LIMIT_CLOUD
    text = req.text[:limit] if req.text else ""
    lang = detect_language(text)

    if not text:
        async def empty():
            yield _sse({"type": "error", "message": "No text provided"})
        return StreamingResponse(empty(), media_type="text/event-stream",
                                 headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

    prompt = make_prompt(req.title or "Неизвестно", authors_str, text, lang, strong=False)

    def _get_stream(p: str):
        if provider == "local":
            return stream_ollama(model, p, req.ollama_url)
        if provider == "claude":
            return stream_claude(req.api_key, model, p)
        if provider in ("openai",):
            return stream_openai_compatible(
                "https://api.openai.com/v1/chat/completions", req.api_key, model, p)
        if provider == "deepseek":
            return stream_openai_compatible(
                "https://api.deepseek.com/v1/chat/completions", req.api_key, model, p)
        if provider == "gemini":
            return stream_gemini(req.api_key, model, p)
        return None

    async def generate():
        accumulated = []
        try:
            yield _sse({"type": "status", "message": f"Подключение к {provider}…"})

            token_stream = _get_stream(prompt)
            if token_stream is None:
                yield _sse({"type": "error", "message": f"Unknown provider: {provider}"})
                return

            async for token in token_stream:
                accumulated.append(token)
                yield _sse({"type": "thinking", "content": token})

            raw = "".join(accumulated)
            parsed = extract_json(raw)
            review = parsed.get("review") or raw.strip() or None
            meta = parsed.get("metadata") or None

                                                                                  
            if review and not is_review_language_correct(review, lang):
                logger.warning("Stream: language mismatch (expected=%s), retrying…", lang)
                yield _sse({"type": "status", "message": "Проверка языка — повторный запрос…"})
                retry_prompt = make_prompt(req.title or "Неизвестно", authors_str, text, lang, strong=True)
                try:
                    retry_raw = await _call_provider(provider, model, retry_prompt, req)
                    retry_parsed = extract_json(retry_raw)
                    if retry_parsed.get("review"):
                        review = retry_parsed["review"]
                        meta = retry_parsed.get("metadata") or meta
                except Exception as exc:
                    logger.warning("Stream retry failed: %s — keeping original", exc)

            yield _sse({"type": "done", "review": review, "metadata": meta, "provider_used": provider})

        except httpx.HTTPStatusError as exc:
            logger.error("HTTP error from %s: %s", provider, exc.response.status_code)
            yield _sse({"type": "error", "message": f"Ошибка провайдера: {exc.response.status_code}"})
        except httpx.TimeoutException:
            yield _sse({"type": "error", "message": f"Таймаут ({THINKING_TIMEOUT}s) — провайдер не ответил"})
        except Exception as exc:
            logger.error("Stream error from %s: %s", provider, exc)
            yield _sse({"type": "error", "message": str(exc)})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
