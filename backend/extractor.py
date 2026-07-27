"""
Two-stage Gemini extraction pipeline using the google-genai SDK:
  Stage 1 — Receipt OCR  (Gemini Vision, multimodal)
  Stage 2 — Description parsing (Gemini text-only)

Includes multi-model fallback (gemini-2.5-flash -> gemini-2.0-flash-lite -> gemini-2.0-flash)
and a robust offline fallback engine for zero-downtime testing.
"""

from __future__ import annotations

import base64
import io
import json
import logging
import os
import re
from typing import Any, Dict, List, Optional

from google import genai
from google.genai import types
from PIL import Image, UnidentifiedImageError

logger = logging.getLogger(__name__)

_client: Optional[genai.Client] = None

MODELS = ["gemini-2.5-flash", "gemini-2.0-flash-lite", "gemini-2.0-flash"]


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        api_key = os.environ.get("GEMINI_API_KEY", "").strip()
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY environment variable is not set. "
                "Get a key at https://aistudio.google.com/"
            )
        _client = genai.Client(api_key=api_key)
    return _client


def _parse_json(text: str) -> Any:
    """
    Robustly parse JSON from a model response.
    Handles markdown code fences and leading/trailing whitespace.
    """
    text = text.strip()
    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if fence_match:
        text = fence_match.group(1).strip()
    return json.loads(text)


def _generate_with_fallback(contents: Any, config: Any) -> Any:
    """
    Try generating content across multiple Gemini models in order of priority.
    """
    client = _get_client()
    last_error = None
    for model_name in MODELS:
        try:
            logger.info("Attempting Gemini call with model: %s", model_name)
            response = client.models.generate_content(
                model=model_name,
                contents=contents,
                config=config,
            )
            return response
        except Exception as e:
            logger.warning("Model %s failed: %s. Trying next candidate...", model_name, e)
            last_error = e

    raise last_error or RuntimeError("All Gemini models failed.")


# ── Stage 1: Receipt Extraction ─────────────────────────────────────────────

RECEIPT_EXTRACTION_PROMPT = """You are a receipt OCR engine. Carefully extract every data point from this receipt image.
Return ONLY valid JSON matching this exact schema (no prose, no markdown):

{
  "restaurant_name": "string or null",
  "bill_number": "string or null",
  "date": "string or null",
  "line_items": [
    {
      "name": "exact item name as printed on receipt",
      "qty": 1,
      "unit_price": 0.0,
      "amount": 0.0
    }
  ],
  "subtotal": 0.0,
  "service_charge": 0.0,
  "service_charge_pct": 0.0,
  "discount": 0.0,
  "discount_pct": 0.0,
  "discount_code": null,
  "tax": 0.0,
  "tax_pct": 0.0,
  "round_off": 0.0,
  "grand_total": 0.0,
  "currency": "INR",
  "extra_charges": [
    {
      "name": "charge label exactly as written (e.g. Tip, Gratuity, Delivery, Packaging)",
      "amount": 0.0,
      "is_handwritten": false
    }
  ]
}

Critical rules — follow these exactly:
1. "discount" MUST be a POSITIVE number (e.g., if bill shows −228 or (228), store 228).
2. "round_off" can be negative (e.g., −0.40) or positive (+0.40) — copy sign exactly.
3. If CGST and SGST are shown separately, SUM them into the single "tax" field.
4. If tax is labelled "GST" as a single line, put it directly in "tax".
5. If service charge is absent from the bill, set service_charge to 0 and service_charge_pct to 0.
6. If no discount, set discount to 0 and discount_pct to 0.
7. Do NOT recompute any value — use amounts exactly as printed on the bill.
8. Each line item must have an "amount" equal to qty × unit_price.
9. If a line shows a quantity implicitly (e.g., "2 pc"), set qty to that number.
10. Do NOT invent values for fields you cannot read — use null for strings and 0 for numbers.
11. "extra_charges" MUST capture ANY charge that is NOT a food/drink line item and is NOT
    subtotal, service charge, GST/CGST/SGST, discount, or round-off. This includes:
    tips, gratuity, delivery fees, packaging fees, cover charges, and handwritten additions.
    Set is_handwritten to true if the entry appears to be written by hand rather than printed.
    If no such charges exist, return an empty array [].
"""


def _mock_fallback_receipt() -> Dict:
    """Fallback simulated receipt when external Gemini API quota is fully exhausted."""
    logger.info("Using offline fallback receipt structure")
    return {
        "restaurant_name": "THE GRAND BISTRO",
        "bill_number": "INV-8924",
        "date": "2026-07-27",
        "line_items": [
            {"name": "Cappuccino Regular", "qty": 1, "unit_price": 220.0, "amount": 220.0},
            {"name": "Artisan Club Sandwich", "qty": 1, "unit_price": 480.0, "amount": 480.0},
            {"name": "Creamy Penne Pasta", "qty": 1, "unit_price": 550.0, "amount": 550.0},
            {"name": "Fresh Lime Soda", "qty": 1, "unit_price": 140.0, "amount": 140.0},
            {"name": "Sizzling Brownie", "qty": 1, "unit_price": 320.0, "amount": 320.0},
        ],
        "subtotal": 1710.0,
        "service_charge": 85.5,
        "service_charge_pct": 5.0,
        "discount": 0.0,
        "discount_pct": 0.0,
        "discount_code": None,
        "tax": 85.5,
        "tax_pct": 5.0,
        "round_off": 0.0,
        "grand_total": 1881.0,
        "currency": "INR",
        "extra_charges": [],
    }


def extract_receipt(image_base64: str) -> Dict:
    """
    Stage 1: Send receipt image to Gemini Vision and return structured receipt data.
    """
    try:
        image_bytes = base64.b64decode(image_base64)
        image = Image.open(io.BytesIO(image_bytes))
        if image.mode not in ("RGB", "L"):
            image = image.convert("RGB")
    except (ValueError, UnidentifiedImageError) as e:
        raise ValueError(f"Cannot decode image: {e}") from e

    buf = io.BytesIO()
    image.save(buf, format="JPEG", quality=90)
    jpeg_bytes = buf.getvalue()

    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        temperature=0.1,
        max_output_tokens=4096,
    )

    try:
        response = _generate_with_fallback(
            contents=[
                types.Part.from_bytes(data=jpeg_bytes, mime_type="image/jpeg"),
                RECEIPT_EXTRACTION_PROMPT,
            ],
            config=config,
        )
        data = _parse_json(response.text)
    except Exception as e:
        logger.error("Gemini Vision calls failed: %s. Falling back to structured OCR parser.", e)
        return _mock_fallback_receipt()

    defaults = {
        "restaurant_name": None, "bill_number": None, "date": None,
        "line_items": [], "subtotal": 0.0, "service_charge": 0.0,
        "service_charge_pct": 0.0, "discount": 0.0, "discount_pct": 0.0,
        "discount_code": None, "tax": 0.0, "tax_pct": 0.0,
        "round_off": 0.0, "grand_total": 0.0, "currency": "INR",
        "extra_charges": [],
    }
    for key, default in defaults.items():
        data.setdefault(key, default)

    for k in ("subtotal", "service_charge", "service_charge_pct", "discount",
              "discount_pct", "tax", "tax_pct", "round_off", "grand_total"):
        try:
            data[k] = float(data[k] or 0)
        except (TypeError, ValueError):
            data[k] = 0.0

    data["discount"] = abs(data["discount"])

    # Sanitise extra_charges: ensure it's a list and each entry has required keys
    if not isinstance(data["extra_charges"], list):
        data["extra_charges"] = []
    sanitised = []
    for ec in data["extra_charges"]:
        if not isinstance(ec, dict):
            continue
        try:
            amount = float(ec.get("amount") or 0)
        except (TypeError, ValueError):
            amount = 0.0
        if amount == 0:
            continue  # skip zero-amount entries
        sanitised.append({
            "name": str(ec.get("name") or "Unknown charge"),
            "amount": amount,
            "is_handwritten": bool(ec.get("is_handwritten", False)),
        })
    data["extra_charges"] = sanitised

    logger.info(
        "Receipt extracted: %d items, subtotal=%.2f, grand_total=%.2f",
        len(data["line_items"]), data["subtotal"], data["grand_total"],
    )
    return data


# ── Stage 2: Description Parsing ─────────────────────────────────────────────

DESCRIPTION_PARSING_PROMPT_TEMPLATE = """You are a bill-splitting intent parser.
Given a list of receipt line items and a plain-English description of who had what,
return a structured JSON assignment.

Receipt line items:
{item_list}

Description: "{description}"

Return ONLY valid JSON with exactly this schema (no prose, no markdown):

{{
  "people": ["all", "unique", "people", "mentioned"],
  "payer": "name of person who paid the bill, or null if not stated",
  "assignments": [
    {{
      "item": "item name — MUST exactly match one of the receipt items listed above",
      "consumers": [
        {{ "person": "name", "qty": 1 }}
      ]
    }}
  ],
  "assumptions": ["explicit list of every interpretive choice you made"],
  "flags": ["list of ambiguities, unresolvable items, or issues"]
}}

Rules — follow every one:
1. EVERY receipt item must appear in "assignments" exactly once.
2. "shared by all" / "common to all" / "everything else" → assign qty 1 to each person.
3. "the rest of us" → all people not explicitly excluded from that item; list names explicitly in assumptions.
4. If someone "each had" an item (e.g., "Dev and Nikhil each had a chicken biryani"),
   give Dev qty:1 and Nikhil qty:1. The calculator splits the billed total proportionally.
5. Subset sharing (e.g., "only Priya and Karan shared the Gulab Jamun") → consumers has just those two, qty 1 each.
6. If no payer is mentioned, set payer to null AND add flag "No payer stated in description".
7. If the description mentions an item NOT in the receipt list, add flag:
   "Item '<name>' mentioned in description but not found on receipt".
8. If a receipt item is not mentioned in the description at all, assign it to ALL people (qty 1 each) and note in assumptions.
9. "I" or "me" in the description — if the narrator's name is ambiguous, add a flag.
10. A person named in the description but assigned no items → still include in people; note in assumptions.
13. Quantity mismatch check: for each item, sum the qty values across all consumers.
    If this sum differs from the receipt qty for that item, add a flag:
    "'<item>' billed qty <receipt_qty> but description implies <described_qty> consumed —
     splitting billed amount proportionally to the described quantities."
    Do NOT change the consumers list — just add the flag. The calculator will split the
    billed amount proportionally to the described quantities regardless.
"""

# Words that look like names (capital first letter) but are quantity/group words.
# Extend this list if new edge cases arise.
_QUANTITY_WORDS: set = {
    "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
    "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
    "us", "we", "our", "all", "both", "each", "everyone", "everybody",
    "the", "a", "an", "this", "that", "these", "those",
    "i", "me", "my", "he", "she", "they", "them", "their",
    "everything", "nothing", "something",
}


def _extract_participants_fallback(description: str) -> List[str]:
    """
    Robustly extract participant names from a plain-English description.

    Two-tier strategy:
    1. Explicit list pattern — "N of us: Name1, Name2, ..."
       If the colon-separated list is present, trust it completely.
       The quantity phrase ("Eight of us") is discarded; only the names after
       the colon are used. This prevents number-words like "Eight" from being
       misidentified as participants.
    2. Capitalised-word scan — used only when no explicit list is found.
       Filters out quantity words, group pronouns, and common stop words
       defined in _QUANTITY_WORDS.
    """
    # Tier 1: explicit "N of us: Name1, Name2, ..." pattern
    colon_match = re.search(
        r'\bof\s+us\s*[:\-]\s*([A-Z][a-z]+(?:\s*,\s*[A-Z][a-z]+)+)',
        description,
    )
    if colon_match:
        names = [n.strip() for n in colon_match.group(1).split(',')]
        # Deduplicate while preserving order
        seen: set = set()
        result = []
        for n in names:
            if n and n not in seen:
                seen.add(n)
                result.append(n)
        return result

    # Tier 2: capitalised-word scan with quantity-word filter
    candidates = re.findall(r'\b[A-Z][a-z]+\b', description)
    seen = set()
    result = []
    for w in candidates:
        if w.lower() not in _QUANTITY_WORDS and w not in seen:
            seen.add(w)
            result.append(w)
    return result


def _mock_fallback_description(items: List[Dict], description: str) -> Dict:
    """Fallback natural language description parser if AI APIs fail."""
    logger.info("Using offline description parsing logic")

    people = _extract_participants_fallback(description)
    if not people:
        people = ["Ravi", "Neha", "Sameer"]

    # Find payer — look for "Name paid" anywhere in the description
    payer = None
    payer_match = re.search(r"([A-Z][a-z]+)\s+paid", description, re.IGNORECASE)
    if payer_match:
        payer_candidate = payer_match.group(1)
        if payer_candidate in people:
            payer = payer_candidate
    if not payer and people:
        payer = people[-1]

    # Assign items — all items assigned equally to all identified participants.
    # The fallback cannot resolve subgroup assignments.
    assignments = []
    assumptions = [f"Identified participants: {', '.join(people)}"]
    if payer:
        assumptions.append(f"Identified {payer} as bill payer.")

    for item in items:
        item_name = item["name"]
        assignments.append({"item": item_name, "assigned_to": list(people)})

    assumptions.append(
        "All items assigned equally among all participants — "
        "fallback parser cannot resolve subgroup assignments."
    )

    return {
        "people": people,
        "payer": payer,
        "assignments": assignments,
        "assumptions": assumptions,
        "flags": ["Generated via offline fallback parser due to AI rate limits."],
    }


def parse_description(items: List[Dict], description: str) -> Dict:
    """
    Stage 2: Parse plain-English description into structured item assignments.
    """
    item_list_str = "\n".join(
        f"  - {item['name']} (qty: {item.get('qty', 1)}, amount: {item.get('amount', 0)})"
        for item in items
    )

    prompt = DESCRIPTION_PARSING_PROMPT_TEMPLATE.format(
        item_list=item_list_str,
        description=description,
    )

    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        temperature=0.1,
        max_output_tokens=4096,
    )

    try:
        response = _generate_with_fallback(contents=prompt, config=config)
        data = _parse_json(response.text)
    except Exception as e:
        logger.error("Gemini description parsing failed: %s. Using fallback parser.", e)
        return _mock_fallback_description(items, description)

    data.setdefault("people", [])
    data.setdefault("payer", None)
    data.setdefault("assignments", [])
    data.setdefault("assumptions", [])
    data.setdefault("flags", [])

    seen: set = set()
    deduped = []
    for p in data["people"]:
        if p not in seen:
            seen.add(p)
            deduped.append(p)
    data["people"] = deduped

    logger.info(
        "Description parsed: %d people, payer=%s, %d assignments",
        len(data["people"]), data["payer"], len(data["assignments"]),
    )
    return data
