import httpx
from decimal import Decimal

from app.core.config import (
    PAYPAL_CLIENT_ID,
    PAYPAL_CLIENT_SECRET,
    PAYPAL_BASE_URL,
)


def get_access_token():
    """Generate an OAuth 2.0 access token from PayPal Sandbox."""
    if not PAYPAL_CLIENT_ID or not PAYPAL_CLIENT_SECRET:
        raise ValueError("PayPal credentials are missing from .env")

    url = f"{PAYPAL_BASE_URL}/v1/oauth2/token"
    try:
        response = httpx.post(
            url,
            auth=(PAYPAL_CLIENT_ID.strip(), PAYPAL_CLIENT_SECRET.strip()),
            data={"grant_type": "client_credentials"},
            headers={"Accept": "application/json", "Accept-Language": "en_US"},
            timeout=30.0,
        )
        response.raise_for_status()
        access_token = response.json().get("access_token")
        if not access_token:
            raise ValueError("PayPal did not return an access token.")
        return access_token

    except httpx.HTTPStatusError as error:
        try:
            details = error.response.json()
        except ValueError:
            details = {}
        raise RuntimeError(
            f"PayPal authentication failed: HTTP {error.response.status_code}; "
            f"Error: {details.get('error', 'Unknown')}; "
            f"Details: {details.get('error_description', 'No additional details')}"
        ) from error
    except httpx.RequestError as error:
        raise RuntimeError("Could not connect to PayPal Sandbox.") from error


def _get_approval_url(order_data):
    """Extract the buyer approval URL from a PayPal order response."""
    return next(
        (
            link["href"]
            for link in order_data.get("links", [])
            if link.get("rel") in ("payer-action", "approve") and link.get("href")
        ),
        None,
    )


def _verify_order_matches_invoice(order_data, invoice):
    """Verify that a saved PayPal order belongs to this invoice."""
    if order_data.get("id") != invoice.paypal_order_id:
        raise ValueError("Saved PayPal order ID verification failed.")

    purchase_units = order_data.get("purchase_units", [])
    if len(purchase_units) != 1:
        raise ValueError("Saved PayPal order has an unexpected purchase unit.")

    purchase_unit = purchase_units[0]
    if purchase_unit.get("custom_id") != str(invoice.id):
        raise ValueError("Saved PayPal order does not match this invoice.")

    amount = purchase_unit.get("amount", {})
    if amount.get("currency_code") != invoice.currency:
        raise ValueError("Saved PayPal order currency does not match invoice.")

    if Decimal(amount.get("value", "0")) != Decimal(str(invoice.amount)):
        raise ValueError("Saved PayPal order amount does not match invoice.")


def create_paypal_order(invoice):
    """
    Reuse a still-approvable order for this invoice.
    Create a fresh order only if the saved order is voided or no longer exists.
    """
    if invoice.currency != "USD":
        raise ValueError(
            "PayPal Sandbox test checkout currently uses USD in this project. "
            "Create a separate USD test invoice."
        )
    if invoice.status not in ("pending", "overdue"):
        raise ValueError("Only pending or overdue invoices can be paid.")

    access_token = get_access_token()
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    # Check and reuse the existing order before creating another one.
    if invoice.paypal_order_id:
        existing_url = (
            f"{PAYPAL_BASE_URL}/v2/checkout/orders/{invoice.paypal_order_id}"
        )
        try:
            existing_response = httpx.get(
                existing_url, headers=headers, timeout=30.0
            )

            if existing_response.status_code == 200:
                existing_order = existing_response.json()
                _verify_order_matches_invoice(existing_order, invoice)
                order_status = existing_order.get("status")

                if order_status in ("CREATED", "PAYER_ACTION_REQUIRED"):
                    approval_url = _get_approval_url(existing_order)
                    if not approval_url:
                        raise RuntimeError(
                            "The existing PayPal order is awaiting approval, "
                            "but PayPal did not return an approval link."
                        )
                    return {
                        "order_id": existing_order["id"],
                        "approval_url": approval_url,
                        "status": order_status,
                        "reused": True,
                    }

                if order_status == "VOIDED":
                    # A voided order cannot be approved; create a replacement.
                    pass
                elif order_status == "APPROVED":
                    raise ValueError(
                        "This PayPal order has already been approved. "
                        "Return to the payment success page to complete "
                        "payment verification; do not start checkout again."
                    )
                elif order_status == "COMPLETED":
                    raise ValueError(
                        "PayPal reports that this order is already completed. "
                        "Refresh the dashboard and verify the invoice payment."
                    )
                else:
                    raise ValueError(
                        f"The existing PayPal order has status '{order_status}' "
                        "and cannot be reused."
                    )

            elif existing_response.status_code == 404:
                # PayPal no longer has this order; create a replacement.
                pass
            else:
                existing_response.raise_for_status()

        except httpx.HTTPStatusError as error:
            raise RuntimeError(
                "Could not verify the existing PayPal order. "
                f"PayPal returned HTTP {error.response.status_code}."
            ) from error
        except httpx.RequestError as error:
            raise RuntimeError(
                "Could not connect to PayPal to verify the existing order."
            ) from error

    # No saved order, or the previous order was voided/not found.
    url = f"{PAYPAL_BASE_URL}/v2/checkout/orders"
    payload = {
        "intent": "CAPTURE",
        "payment_source": {
            "paypal": {
                "experience_context": {
                    "brand_name": "PayPilot AI",
                    "shipping_preference": "NO_SHIPPING",
                    "user_action": "PAY_NOW",
                    "return_url": (
                        f"http://localhost:5173/payment/success?invoice_id={invoice.id}"
                    ),
                    "cancel_url": (
                        f"http://localhost:5173/payment/cancel?invoice_id={invoice.id}"
                    ),
                }
            }
        },
        "purchase_units": [
            {
                "reference_id": str(invoice.id),
                "invoice_id": invoice.invoice_number,
                "custom_id": str(invoice.id),
                "description": invoice.description[:127],
                "amount": {
                    "currency_code": "USD",
                    "value": f"{invoice.amount:.2f}",
                },
            }
        ],
    }

    try:
        response = httpx.post(
            url,
            json=payload,
            headers={**headers, "Prefer": "return=representation"},
            timeout=30.0,
        )
        response.raise_for_status()
        order_data = response.json()
        approval_url = _get_approval_url(order_data)

        if not order_data.get("id") or not approval_url:
            raise RuntimeError(
                "PayPal did not return an order ID or approval link."
            )

        return {
            "order_id": order_data["id"],
            "approval_url": approval_url,
            "status": order_data.get("status"),
            "reused": False,
        }

    except httpx.HTTPStatusError as error:
        try:
            details = error.response.json()
        except ValueError:
            details = {}
        raise RuntimeError(
            f"PayPal returned HTTP {error.response.status_code}: "
            f"{details.get('message', 'PayPal order creation failed.')}"
        ) from error
    except httpx.RequestError as error:
        raise RuntimeError(
            "Could not connect to PayPal while creating the order."
        ) from error


def capture_paypal_order(
    order_id,
    expected_invoice_id,
    expected_amount,
    expected_currency="USD",
):
    """Capture an approved order and verify its payment details."""
    access_token = get_access_token()
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    order_url = f"{PAYPAL_BASE_URL}/v2/checkout/orders/{order_id}"

    try:
        order_response = httpx.get(
            order_url, headers=headers, timeout=30.0
        )
        order_response.raise_for_status()
        order_data = order_response.json()

        if order_data.get("id") != order_id:
            raise ValueError("PayPal order ID verification failed.")

        purchase_units = order_data.get("purchase_units", [])
        if len(purchase_units) != 1:
            raise ValueError("Unexpected PayPal purchase unit count.")

        purchase_unit = purchase_units[0]
        if purchase_unit.get("custom_id") != str(expected_invoice_id):
            raise ValueError("PayPal order does not match this invoice.")

        expected_value = Decimal(str(expected_amount))
        order_amount = purchase_unit.get("amount", {})
        if order_amount.get("currency_code") != expected_currency:
            raise ValueError("Payment currency does not match invoice.")
        if Decimal(order_amount.get("value", "0")) != expected_value:
            raise ValueError("Payment amount does not match invoice.")

        if order_data.get("status") == "COMPLETED":
            capture_data = order_data
        elif order_data.get("status") == "APPROVED":
            capture_response = httpx.post(
                f"{order_url}/capture",
                json={},
                headers=headers,
                timeout=30.0,
            )
            capture_response.raise_for_status()
            capture_data = capture_response.json()
        else:
            raise ValueError(
                "The customer has not approved this PayPal order yet."
            )

        if capture_data.get("id") != order_id:
            raise ValueError("Captured order ID does not match.")
        if capture_data.get("status") != "COMPLETED":
            raise ValueError("PayPal order capture is not completed.")

        captured_units = capture_data.get("purchase_units", [])
        if len(captured_units) != 1:
            raise ValueError("Unexpected captured purchase unit count.")

        captures = (
            captured_units[0]
            .get("payments", {})
            .get("captures", [])
        )
        completed_capture = next(
            (item for item in captures if item.get("status") == "COMPLETED"),
            None,
        )
        if not completed_capture:
            raise ValueError("No completed payment capture was found.")

        captured_amount = completed_capture.get("amount", {})
        if captured_amount.get("currency_code") != expected_currency:
            raise ValueError("Captured currency does not match invoice.")
        if Decimal(captured_amount.get("value", "0")) != expected_value:
            raise ValueError("Captured amount does not match invoice.")

        capture_id = completed_capture.get("id")
        if not capture_id:
            raise ValueError("PayPal did not return a capture ID.")

        return {
            "order_id": order_id,
            "capture_id": capture_id,
            "status": "COMPLETED",
            "amount": str(expected_value),
            "currency": expected_currency,
        }

    except httpx.HTTPStatusError as error:
        raise RuntimeError(
            f"PayPal API returned HTTP {error.response.status_code}."
        ) from error
    except httpx.RequestError as error:
        raise RuntimeError(
            "Could not connect to PayPal during payment capture."
        ) from error
