"""
Fair Split API — FastAPI application entry point.
Single endpoint: POST /api/split
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, field_validator

from calculator import calculate_split
from extractor import extract_receipt, parse_description

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Fair Split API",
    description=(
        "Receipt OCR + AI bill splitting. "
        "Accepts a base64-encoded receipt image and a plain-English description "
        "of who had what; returns a fully-reconciled per-person breakdown."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS ── allow all origins by default; restrict via ALLOWED_ORIGINS env var
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "*")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response Models ─────────────────────────────────────────────────

class SplitRequest(BaseModel):
    receipt_base64: str
    description: str

    @field_validator("receipt_base64")
    @classmethod
    def strip_data_uri(cls, v: str) -> str:
        """Remove data-URI prefix if user accidentally included it."""
        v = v.strip()
        if v.startswith("data:") and "," in v:
            v = v.split(",", 1)[1]
        return v

    @field_validator("description")
    @classmethod
    def must_not_be_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("description must not be empty")
        return v.strip()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/", tags=["health"])
def health() -> Dict[str, str]:
    return {"status": "ok", "service": "fair-split-api", "version": "1.0.0"}


@app.post("/api/split", tags=["split"])
async def split_bill(req: SplitRequest) -> Dict[str, Any]:
    """
    Accept a receipt image (base64-encoded) and a plain-English description.
    Return a fully-reconciled per-person bill split.

    Request body:
        receipt_base64: Base64-encoded image bytes (no data-URI prefix).
        description: Free-text description of who had what and who paid.

    Response matches the contract defined in the assignment spec.
    """

    # ── Stage 1: Receipt extraction (Gemini Vision) ──────────────────────
    logger.info("Starting receipt extraction")
    try:
        receipt = extract_receipt(req.receipt_base64)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {e}")
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=f"Receipt extraction failed: {e}")

    if not receipt.get("line_items"):
        raise HTTPException(
            status_code=422,
            detail="Could not extract any line items from the receipt. "
                   "Please ensure the image is clear and shows a restaurant bill.",
        )

    if receipt.get("grand_total", 0) == 0:
        raise HTTPException(
            status_code=422,
            detail="Could not extract a grand total from the receipt.",
        )

    # ── Stage 2: Description parsing (Gemini text) ───────────────────────
    logger.info("Starting description parsing")
    try:
        parsed = parse_description(receipt["line_items"], req.description)
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=f"Description parsing failed: {e}")

    if not parsed.get("people"):
        raise HTTPException(
            status_code=422,
            detail="Could not identify any people from the description.",
        )

    # ── Stage 3: Pure Python arithmetic ─────────────────────────────────
    logger.info(
        "Computing split: %d people, payer=%s",
        len(parsed["people"]),
        parsed.get("payer"),
    )
    result = calculate_split(
        line_items=receipt["line_items"],
        subtotal=float(receipt.get("subtotal", 0)),
        service_charge=float(receipt.get("service_charge", 0)),
        discount=float(receipt.get("discount", 0)),
        tax=float(receipt.get("tax", 0)),
        round_off=float(receipt.get("round_off", 0)),
        grand_total=float(receipt.get("grand_total", 0)),
        assignments=parsed.get("assignments", []),
        people=parsed["people"],
        payer=parsed.get("payer"),
        assumptions=parsed.get("assumptions", []),
        flags=parsed.get("flags", []),
        extra_charges=receipt.get("extra_charges", []),
    )

    # Attach receipt metadata for frontend display
    result["receipt_meta"] = {
        "restaurant_name": receipt.get("restaurant_name"),
        "bill_number": receipt.get("bill_number"),
        "date": receipt.get("date"),
        "currency": receipt.get("currency", "INR"),
    }

    logger.info(
        "Split complete: grand_total=%d, reconciled=%s, %d flags",
        result["grand_total"],
        result["reconciliation"]["matches_bill"],
        len(result["flags"]),
    )
    return result


# ── Global error handler ──────────────────────────────────────────────────────

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception on %s", request.url)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {type(exc).__name__}: {exc}"},
    )
