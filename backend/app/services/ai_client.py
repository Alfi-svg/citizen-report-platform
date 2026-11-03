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


async def call_ai_completion(
    prompt: str,
    system_prompt: Optional[str] = None,
    json_mode: bool = False,
    temperature: float = 0.2,
    max_tokens: int = 1000,
    timeout_seconds: float = 12.0,
) -> Optional[str]:
    """
    Asynchronously invokes the configured OpenRouter / AI provider.
    Returns the string response, or None if the provider is unconfigured,
    times out, or errors, allowing safe deterministic fallback.
    """
    api_key = settings.OPENROUTER_API_KEY
    if not api_key or not api_key.strip():
        logger.debug("AI client: No OPENROUTER_API_KEY configured; utilizing deterministic fallback.")
        return None

    messages: List[Dict[str, str]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    payload: Dict[str, Any] = {
        "model": settings.OPENROUTER_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://nirapotta-citizen-platform.vercel.app",
        "X-Title": "Nirapotta Citizen Safety Platform",
    }

    url = f"{settings.OPENROUTER_BASE_URL.rstrip('/')}/chat/completions"

    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.post(url, json=payload, headers=headers)
            if response.status_code == 200:
                result = response.json()
                choices = result.get("choices", [])
                if choices and len(choices) > 0:
                    content = choices[0].get("message", {}).get("content", "")
                    return content
                logger.warning(f"AI client: Received 200 OK but empty choices list: {result}")
                return None
            else:
                logger.warning(
                    f"AI client returned HTTP {response.status_code}: {response.text[:200]}"
                )
                return None
    except httpx.TimeoutException:
        logger.warning(f"AI client timed out after {timeout_seconds}s; falling back to deterministic engine.")
        return None
    except Exception as exc:
        logger.warning(f"AI client request failed: {exc}; falling back to deterministic engine.")
        return None


async def call_ai_json(
    prompt: str,
    system_prompt: Optional[str] = None,
    temperature: float = 0.1,
    max_tokens: int = 1000,
    timeout_seconds: float = 12.0,
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
    )
    if not raw:
        return None
    return extract_json_from_text(raw)
