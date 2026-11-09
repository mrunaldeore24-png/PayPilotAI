
import time

from google import genai
from google.genai import types

from app.core.config import GEMINI_API_KEY


MODEL_NAME = "gemini-3.8-flash"


def get_gemini_client():
    if not GEMINI_API_KEY:
        raise RuntimeError("Gemini API key is missing.")

    return genai.Client(api_key=GEMINI_API_KEY)


def generate_financial_insights(financial_data: dict) -> str:
    client = get_gemini_client()

    prompt = f"""
You are PayPilot AI, a financial operations assistant
for small businesses.

Analyse the following real invoice and financial data:

{financial_data}

Prepare a professional report with these sections:

1. Financial Summary
   - Summarize invoice counts and payment status.
   - Report revenue and outstanding amounts separately
     for each currency.
   - Never add amounts from different currencies.

2. Pending and Overdue Invoice Risks
   - Identify invoices requiring attention.
   - Explain risks based on their amounts, due dates,
     and payment status.

3. Payment Prioritization
   - Prioritize overdue invoices first.
   - Then prioritize pending invoices by earliest due date.
   - Mention invoice numbers and amounts where available.

4. Cash-Flow Improvement Suggestions
   - Suggest practical ways to improve collections.
   - Recommend appropriate payment reminders.

5. Recommended Next Actions
   - Provide a short, actionable checklist.

IMPORTANT RULES:
- Use only the supplied data.
- Never invent amounts, customers, dates, or invoice details.
- Keep INR and USD completely separate.
- Do not calculate a combined total across currencies.
- Clearly distinguish facts from recommendations.
- Do not claim that reminders have been sent.
- Never initiate, capture, or modify payments.
- Do not expose customer email addresses.
- Use simple, professional language.
"""

    last_error = None

    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.3,
                    max_output_tokens=2000,
                ),
            )

            if not response.text:
                raise RuntimeError(
                    "Gemini returned an empty response."
                )

            return response.text

        except Exception as error:
            last_error = error
            error_text = str(error)

            if not any(
                code in error_text
                for code in ("503", "429", "500", "502", "504")
            ):
                break

            if attempt < 2:
                time.sleep(2 ** attempt)

    raise RuntimeError(
        f"Gemini AI request failed after retries: {last_error}"
    ) from last_error
