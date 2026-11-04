import json
import logging
import re
from typing import Any, Dict, List, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger("citizen_report.ai_client")


def extract_json_from_text(text: str) -> Optional[Dict[str, Any]]:
    """
    Robustly extracts and parses a JSON object from raw LLM output,
    stripping markdown backticks, explanations, or surrounding text.
    """
    if not text:
        return None
    cleaned = text.strip()

    # Try direct parse
    try:
        data = json.loads(cleaned)
        if isinstance(data, dict):
            return data
    except Exception:
        pass

    # Try extracting inside ```json ... ``` code fence
    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned)
    if fence_match:
        try:
            data = json.loads(fence_match.group(1))
            if isinstance(data, dict):
                return data
        except Exception:
            pass

    # Try extracting first {...} block
    block_match = re.search(r"\{[\s\S]*\}", cleaned)
    if block_match:
        try:
            data = json.loads(block_match.group(0))
            if isinstance(data, dict):
                return data
        except Exception:
            pass

    return None


async def _execute_chat_completion(
    client: httpx.AsyncClient,
    url: str,
    headers: Dict[str, str],
    model: str,
    messages: List[Dict[str, str]],
    json_mode: bool,
    temperature: float,
    max_tokens: int,
) -> Optional[str]:
    payload: Dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    response = await client.post(url, json=payload, headers=headers)
    if response.status_code == 200:
        result = response.json()
        choices = result.get("choices", [])
        if choices and len(choices) > 0:
            return choices[0].get("message", {}).get("content", "")
        logger.warning(f"AI client: Received 200 OK from model '{model}' but empty choices: {result}")
        return None
    else:
        logger.warning(
            f"AI client model '{model}' returned HTTP {response.status_code}: {response.text[:200]}"
        )
        return None


async def call_ai_completion(
    prompt: str,
    system_prompt: Optional[str] = None,
    json_mode: bool = False,
    temperature: float = 0.2,
    max_tokens: int = 1000,
    timeout_seconds: Optional[float] = None,
    primary_model: Optional[str] = None,
    fallback_model: Optional[str] = None,
) -> Optional[str]:
    """
    Asynchronously invokes the configured OpenRouter / AI provider.
    Tries the primary model first; if it times out, encounters a rate limit, or fails,
    tries the fallback model before reverting to None (allowing deterministic fallback).
    """
    api_key = settings.OPENROUTER_API_KEY
    if not api_key or not api_key.strip():
        logger.debug("AI client: No OPENROUTER_API_KEY configured; utilizing deterministic fallback.")
        return None

    actual_timeout = timeout_seconds if timeout_seconds is not None else settings.AI_REQUEST_TIMEOUT_SECONDS
    main_model = primary_model or settings.OPENROUTER_MODEL
    alt_model = fallback_model if fallback_model is not None else settings.OPENROUTER_FALLBACK_MODEL

    messages: List[Dict[str, str]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://nirapotta-citizen-platform.vercel.app",
        "X-Title": "Nirapotta Citizen Safety Platform",
    }
    url = f"{settings.OPENROUTER_BASE_URL.rstrip('/')}/chat/completions"

    # Attempt primary model
    try:
        async with httpx.AsyncClient(timeout=actual_timeout) as client:
            content = await _execute_chat_completion(
                client=client,
                url=url,
                headers=headers,
                model=main_model,
                messages=messages,
                json_mode=json_mode,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            if content:
                return content
    except httpx.TimeoutException:
        logger.warning(f"AI client: Primary model '{main_model}' timed out after {actual_timeout}s.")
    except Exception as exc:
        logger.warning(f"AI client: Primary model '{main_model}' error: {exc}")

    # Attempt fallback model if different and configured
    if alt_model and alt_model != main_model:
        try:
            logger.info(f"AI client: Retrying with fallback model '{alt_model}'...")
            async with httpx.AsyncClient(timeout=actual_timeout) as client:
                content = await _execute_chat_completion(
                    client=client,
                    url=url,
                    headers=headers,
                    model=alt_model,
                    messages=messages,
                    json_mode=json_mode,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                if content:
                    return content
        except httpx.TimeoutException:
            logger.warning(f"AI client: Fallback model '{alt_model}' timed out after {actual_timeout}s.")
        except Exception as exc:
            logger.warning(f"AI client: Fallback model '{alt_model}' error: {exc}")

    return None


async def call_ai_json(
    prompt: str,
    system_prompt: Optional[str] = None,
    temperature: float = 0.1,
    max_tokens: int = 1000,
    timeout_seconds: Optional[float] = None,
    primary_model: Optional[str] = None,
    fallback_model: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Convenience method to request and parse JSON from the AI provider.
    """
    raw = await call_ai_completion(
        prompt=prompt,
        system_prompt=system_prompt,
        json_mode=True,
        temperature=temperature,
        max_tokens=max_tokens,
        timeout_seconds=timeout_seconds,
        primary_model=primary_model,
        fallback_model=fallback_model,
    )
    if not raw:
        return None
    return extract_json_from_text(raw)
