# Fair Split

AI-powered restaurant bill splitting. Upload a receipt photo, describe who had what in plain English, and get a fully-audited per-person breakdown with exact tax, service charge, and discount allocation.

**Live App:** https://fair-split-3pjl.vercel.app  
**API Base URL:** https://fair-split-v6la.onrender.com  
**Interactive API Docs:** https://fair-split-v6la.onrender.com/docs

---

## Architecture

```
Receipt image (base64)          Plain-English description
        │                                  │
        ▼                                  ▼
  Stage 1: Gemini Vision           Stage 2: Gemini Text
  (OCR — structured JSON)    (Intent parser — item assignments)
        │                                  │
        └──────────────┬───────────────────┘
                       ▼
              Stage 3: calculator.py
           (Pure Python — all arithmetic)
                       │
                       ▼
            Fully-reconciled JSON response
```

> **The AI never does arithmetic.** Gemini extracts structured data and assigns items to people. All totals, splits, tax allocation, rounding, and reconciliation are computed in deterministic Python — fully unit-testable without any API call.

---

## Public API

### Base URL

```
https://<your-render-service>.onrender.com
```

### Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Health check |
| `POST` | `/api/split` | Split a bill |
| `GET` | `/docs` | Interactive Swagger UI |
| `GET` | `/redoc` | ReDoc documentation |

---

### `GET /`

Health check.

**Response:**
```json
{
  "status": "ok",
  "service": "fair-split-api",
  "version": "1.0.0"
}
```

**curl:**
```bash
curl https://<your-render-service>.onrender.com/
```

---

### `POST /api/split`

The main endpoint. Accepts a receipt image and a plain-English description. Returns a fully-reconciled per-person bill split.

#### Request Body

```json
{
  "receipt_base64": "<base64-encoded JPEG/PNG of the receipt>",
  "description": "Plain-English description of who had what and who paid."
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `receipt_base64` | `string` | ✅ | Base64-encoded image. Data-URI prefix (`data:image/jpeg;base64,...`) is stripped automatically. |
| `description` | `string` | ✅ | Natural language. e.g. "Raj and Simran shared the butter chicken. Pooja had the kheer. Simran paid." |

#### Response Body

```json
{
  "per_person": [
    {
      "name": "Raj",
      "items": ["Butter Chicken (1/3)", "Garlic Naan (1/3)"],
      "subtotal": 163,
      "service_share": 8,
      "tax_share": 10,
      "discount_share": 0,
      "total": 181
    }
  ],
  "grand_total": 580,
  "reconciliation": {
    "sum_of_person_totals": 545,
    "matches_bill": false
  },
  "paid_by": "Simran",
  "settle_up": [
    { "from": "Raj", "to": "Simran", "amount": 181 },
    { "from": "Pooja", "to": "Simran", "amount": 181 }
  ],
  "assumptions": [
    "Butter Chicken shared equally among Raj, Simran, Pooja.",
    "No service charge line found on bill — applied 0%"
  ],
  "flags": [
    "Grand total ₹580 ≠ extracted items + charges ₹545 — ₹35 unexplained. User should verify the bill."
  ],
  "receipt_meta": {
    "restaurant_name": "Spice Garden",
    "bill_number": "0391",
    "date": "12 Apr 2026",
    "currency": "INR"
  }
}
```

#### Response Field Reference

| Field | Description |
|---|---|
| `per_person[].subtotal` | Each person's share of the food items (pre-tax, pre-service) |
| `per_person[].service_share` | Service charge allocated proportional to their subtotal |
| `per_person[].tax_share` | GST/tax allocated proportional to their subtotal |
| `per_person[].discount_share` | Discount allocated proportional to their subtotal (negative number) |
| `per_person[].total` | Final amount this person owes |
| `reconciliation.matches_bill` | `true` if person totals match the printed grand total (within ₹2) |
| `settle_up` | Minimal peer-to-peer transfer list. Payer not included (they already paid). |
| `assumptions` | Every interpretive choice the parser made — transparent audit trail |
| `flags` | Anomalies: arithmetic mismatches, unassigned items, tips, quantity mismatches |

#### Error Responses

| Status | Reason |
|---|---|
| `400` | Invalid or unreadable image |
| `422` | No line items extracted / no grand total / no people identified |
| `500` | Internal server error |

---

## Testing the API

### Option 1 — Interactive Swagger UI

Open `{API_BASE_URL}/docs` in your browser. Click **POST /api/split → Try it out**, paste a base64 image and description, hit **Execute**.

### Option 2 — curl with a real receipt

**Step 1: Encode your receipt image**
```bash
# macOS / Linux
BASE64=$(base64 -i receipt.jpg)

# Windows (PowerShell)
$BASE64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes("receipt.jpg"))
```

**Step 2: POST to the API**
```bash
curl -X POST https://fair-split-v6la.onrender.com/api/split \
  -H "Content-Type: application/json" \
  -d "{
    \"receipt_base64\": \"$BASE64\",
    \"description\": \"Raj and Simran shared everything equally. Pooja had the kheer alone. Simran paid.\"
  }"
```

### Option 3 — Python script

```python
import base64, requests, json

with open("receipt.jpg", "rb") as f:
    img_b64 = base64.b64encode(f.read()).decode()

resp = requests.post(
    "https://fair-split-v6la.onrender.com/api/split",
    json={
        "receipt_base64": img_b64,
        "description": "Raj and Simran split everything. Simran paid.",
    },
)
print(json.dumps(resp.json(), indent=2, ensure_ascii=False))
```

### Option 4 — JavaScript / fetch

```js
const fs = require("fs");

const imgB64 = fs.readFileSync("receipt.jpg").toString("base64");

const res = await fetch("https://fair-split-v6la.onrender.com/api/split", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    receipt_base64: imgB64,
    description: "Raj and Simran split everything. Simran paid.",
  }),
});

console.log(await res.json());
```

---

## Description Language Guide

The parser understands natural English. Examples:

| Description | How it's interpreted |
|---|---|
| `"We shared everything equally"` | All items split equally among all people |
| `"Priya and Karan shared the Gulab Jamun"` | Only those two split that item |
| `"Tarun had two cappuccinos, Arjun had one"` | Proportional split — Tarun 2/3, Arjun 1/3 of the line total |
| `"Dev and Nikhil each had a biryani"` | Each gets one biryani's cost (equal individual units) |
| `"Simran paid"` | Simran is the payer — others settle up to her |
| `"the rest of us"` | Everyone not explicitly excluded |

---

## Local Development

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux

pip install -r requirements.txt

cp .env.example .env
# Add your GEMINI_API_KEY to .env

uvicorn main:app --reload --port 8000
# API: http://localhost:8000
# Docs: http://localhost:8000/docs
```

### Frontend

```bash
cd frontend
npm install

cp .env.local.example .env.local
# Set BACKEND_URL=http://localhost:8000

npm run dev
# App: http://localhost:3000
```

### Tests

```bash
cd backend
pytest tests/test_calculator.py -v
# 13 tests — no API key needed, pure Python only
```

---

## Deployment

| Service | Platform | Config file |
|---|---|---|
| Backend (FastAPI) | Render (free) | `render.yaml` |
| Frontend (Next.js) | Vercel (free) | Auto-detected |

See [render.yaml](./render.yaml) for one-click Render Blueprint deploy.  
Frontend: import repo on Vercel, set root directory to `frontend`, add `BACKEND_URL` env var.

---

## Documentation

| File | Contents |
|---|---|
| [`docs/prompt_log.md`](./docs/prompt_log.md) | All prompt iterations — what changed, why, and the arithmetic philosophy |
| [`docs/edge_cases.md`](./docs/edge_cases.md) | 10 edge cases tested with correct expected output and fix locations |
| [`docs/ai_failures.md`](./docs/ai_failures.md) | 3 concrete examples where the model was wrong and how it was caught |
