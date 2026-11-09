# PayPilot AI 🚀
### AI-Powered Financial Operations Assistant for Small Businesses

PayPilot AI is an intelligent financial management platform designed to simplify invoice management, streamline payment collection, and provide actionable financial insights using Generative AI.

By combining **PayPal integration** with **Google Gemini AI**, PayPilot AI helps small businesses monitor their invoices, track payments, identify overdue accounts, and make smarter cash-flow decisions.

---

## 💡 Problem Statement

Small businesses often face challenges such as:
- Managing multiple invoices and payment statuses.
- Tracking pending and overdue payments.
- Monitoring outstanding balances and cash flow.
- Identifying which invoices require immediate attention.
- Making informed financial decisions using scattered financial records.

PayPilot AI addresses these challenges through a unified platform that combines financial tracking, online payments, and AI-powered recommendations.

## ✨ Key Features

### 1. Invoice Management
- Create and manage customer invoices.
- Store invoice details, amounts, issue dates, and due dates.
- Track invoice statuses: Pending, Paid, Overdue, and Cancelled.
- Search and filter invoices.

### 2. PayPal Payment Integration
- Create PayPal payment orders through the PayPal Orders API.
- Redirect customers to PayPal Sandbox checkout.
- Capture approved payments through the backend.
- Verify payment details before updating invoice status.
- Store PayPal order IDs and capture IDs for transaction tracking.

### 3. Gemini AI Financial Insights
- Generate AI-powered financial summaries.
- Analyse pending and overdue invoices.
- Prioritize invoices requiring attention.
- Provide practical cash-flow improvement recommendations.
- Suggest actionable collection strategies.
- Analyse different currencies separately to avoid incorrect combined totals.

### 4. Financial Analytics
- Monitor total invoices.
- Track paid, pending, overdue, and cancelled invoices.
- View paid revenue and outstanding balances.
- Understand overall invoice performance.

### 5. Payment Verification and Security
- Keep API credentials in environment variables.
- Perform payment capture and verification on the backend.
- Validate invoice references, payment amounts, and currencies.
- Require customer approval through PayPal checkout.

---

## 🛠️ Technology Stack

| Category | Technologies |
|---|---|
| Frontend | React.js, Vite, JavaScript, CSS |
| Backend | Python, FastAPI |
| Database | SQLite, SQLAlchemy |
| Generative AI | Google Gemini API |
| Payment Gateway | PayPal Orders API |
| API Communication | REST API, HTTPX |
| Data Validation | Pydantic |
| Version Control | Git, GitHub |

---

## 🏗️ System Architecture

```text
                 ┌──────────────────────┐
                 │      User            │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │   React + Vite UI    │
                 │   Financial Dashboard│
                 └──────────┬───────────┘
                            │ REST API
                            ▼
                 ┌──────────────────────┐
                 │    FastAPI Backend   │
                 └──────────┬───────────┘
                            │
             ┌──────────────┼──────────────┐
             │              │              │
             ▼              ▼              ▼
      ┌────────────┐ ┌────────────┐ ┌────────────┐
      │  SQLite    │ │ PayPal API │ │ Gemini API │
      │  Database  │ │ Payments   │ │ AI Insights│
      └────────────┘ └────────────┘ └────────────┘
```

## 📂 Project Structure

```text
PayPilotAI/
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── ai.py
│   │   │   ├── analytics.py
│   │   │   ├── health.py
│   │   │   ├── invoices.py
│   │   │   └── payments.py
│   │   │
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   └── database.py
│   │   │
│   │   ├── models/
│   │   │   └── invoice.py
│   │   │
│   │   ├── schemas/
│   │   │   └── invoice.py
│   │   │
│   │   ├── services/
│   │   │   ├── gemini_service.py
│   │   │   └── paypal_service.py
│   │   │
│   │   └── main.py
│   │
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── AI-Insights.css
│   │   ├── index.css
│   │   └── main.jsx
│   │
│   ├── package.json
│   └── vite.config.js
│
├── .gitignore
└── README.md
```

## ⚙️ Getting Started

### Prerequisites

Install the following:

- Python 3.11 or later
- Node.js and npm
- Git
- Google Gemini API key
- PayPal Developer Sandbox credentials

### 1. Clone the Repository

```bash
git clone https://github.com/mrunaldeore24-png/PayPilotAI.git
cd PayPilotAI
```

### 2. Backend Setup

Open a terminal:

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment on Windows:

```powershell
.venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r requirements.txt
```

### 3. Configure Environment Variables

Create a `.env` file inside the `backend` directory.

Add your own credentials:

```env
GEMINI_API_KEY=your_gemini_api_key
PAYPAL_CLIENT_ID=your_paypal_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_paypal_sandbox_client_secret
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
```

**Important:** Never commit your `.env` file or expose API credentials publicly.

### 4. Start the Backend

From the backend directory:

```bash
uvicorn app.main:app --reload
```

Backend:

`http://localhost:8000`

API documentation:

`http://localhost:8000/docs`

### 5. Frontend Setup

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend:

`http://localhost:5173`

---

## 💳 PayPal Sandbox Integration

PayPilot AI integrates with the PayPal Orders API using Sandbox credentials.

Payment workflow:

1. A business creates an invoice.
2. The customer selects the PayPal checkout option.
3. The backend creates a PayPal order.
4. The customer approves the payment through PayPal Sandbox.
5. The frontend returns to the application.
6. The backend captures and verifies the payment.
7. The invoice status is updated to Paid only after successful verification.

**Note:** The current implementation uses PayPal Sandbox for testing. No real money is transferred.

## 🤖 AI-Powered Financial Intelligence

Google Gemini AI analyses the invoice data supplied by the backend and generates:

- Financial summaries.
- Pending and overdue invoice risk assessments.
- Payment prioritization recommendations.
- Cash-flow improvement suggestions.
- Recommended next actions.

AI-generated recommendations are advisory. Payment operations remain under user control.

## 🔐 Security Considerations

- API credentials are stored in environment variables.
- Payment operations are performed through the backend.
- PayPal payment details are verified before invoice updates.
- Financial analysis keeps different currencies separate.
- AI recommendations do not independently execute payments.

## 🚀 Future Enhancements

- Automated invoice payment reminders.
- PayPal webhook integration for payment event notifications.
- Advanced cash-flow forecasting.
- Predictive overdue-payment risk analysis.
- Customer payment behaviour analytics.
- Exportable financial reports.
- Role-based access and multi-business support.

## 🎯 Hackathon Project

**Project Name:** PayPilot AI  
**Category:** FinTech | Artificial Intelligence | Generative AI  
**Payment Platform:** PayPal  
**AI Platform:** Google Gemini

Built as an AI-powered financial operations solution to help small businesses manage invoices, improve payment collection, and make smarter financial decisions.

---

## 👩‍💻 Author

**Mrunal Deore**

GitHub: [@mrunaldeore24-png](https://github.com/mrunaldeore24-png)

**Repository:** [PayPilot AI](https://github.com/mrunaldeore24-png/PayPilotAI)

---

⭐ If you find this project interesting, consider giving the repository a star!
