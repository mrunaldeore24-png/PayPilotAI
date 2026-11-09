
import { useEffect, useRef, useState } from "react";
import "./App.css";
import "./AI-Insights.css";

const API_URL = "http://127.0.0.1:8000";

const initialForm = {
  invoice_number: "",
  customer_name: "",
  customer_email: "",
  description: "",
  amount: "",
  currency: "INR",
  issue_date: "",
  due_date: "",
};

function formatCurrency(value, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "INR" ? 0 : 2,
  }).format(Number(value) || 0);
}

function App() {
  // Dashboard state
  const [summary, setSummary] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Invoice form state
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [formData, setFormData] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // AI Financial Insights state
  const [aiInsights, setAiInsights] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  // PayPal checkout state
  const [paymentStartingId, setPaymentStartingId] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState("processing");
  const [paymentMessage, setPaymentMessage] = useState("");
  const paymentCaptureRequestRef = useRef(null);

  // Load dashboard data
  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      const [summaryResponse, invoicesResponse] = await Promise.all([
        fetch(`${API_URL}/api/analytics/summary`),
        fetch(`${API_URL}/api/invoices/`),
      ]);

      if (!summaryResponse.ok || !invoicesResponse.ok) {
        throw new Error("Unable to load dashboard data.");
      }

      const summaryData = await summaryResponse.json();
      const invoiceData = await invoicesResponse.json();

      setSummary(summaryData);
      setInvoices(invoiceData);
    } catch (err) {
      setError(
        "Could not connect to PayPilot AI backend. Make sure your backend server is running."
      );
    } finally {
      setLoading(false);
    }
  }

  // Generate AI financial insights using the Gemini-powered backend
  async function loadAiInsights() {
    try {
      setAiLoading(true);
      setAiError("");

      const response = await fetch(`${API_URL}/api/ai/insights`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof result.detail === "string"
            ? result.detail
            : "Unable to generate AI insights."
        );
      }

      setAiInsights(result);
    } catch (err) {
      setAiError(
        err.message || "Could not connect to the Gemini AI service."
      );
    } finally {
      setAiLoading(false);
    }
  }

  // Start PayPal Sandbox checkout for a USD invoice.
  async function handlePayPalCheckout(invoice) {
    try {
      setError("");
      setPaymentStartingId(invoice.id);

      const response = await fetch(
        `${API_URL}/api/payments/create-order/${invoice.id}`,
        { method: "POST" }
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof result.detail === "string"
            ? result.detail
            : "Unable to start PayPal checkout."
        );
      }

      if (!result.approval_url) {
        throw new Error("PayPal did not return a checkout approval link.");
      }

      // PayPal redirects the customer back to /payment/success or /payment/cancel.
      window.location.assign(result.approval_url);
    } catch (err) {
      setError(err.message || "Could not connect to PayPal Sandbox.");
      setPaymentStartingId(null);
    }
  }

  // Create a new invoice
  async function handleCreateInvoice(event) {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");

      const response = await fetch(`${API_URL}/api/invoices/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          amount: Number(formData.amount),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof result.detail === "string"
            ? result.detail
            : "Please check the invoice details."
        );
      }

      setFormData(initialForm);
      setShowInvoiceForm(false);
      setSuccessMessage("Invoice created successfully!");

      await loadDashboard();
    } catch (err) {
      setError(err.message || "Unable to create invoice.");
    } finally {
      setSaving(false);
    }
  }

  // Handle PayPal return/cancel routes, otherwise load the dashboard.
  useEffect(() => {
    const currentPath = window.location.pathname;

    if (currentPath === "/payment/cancel") {
      setPaymentStatus("cancelled");
      return;
    }

    if (currentPath === "/payment/success") {
      const params = new URLSearchParams(window.location.search);
      const invoiceId = params.get("invoice_id");

      if (!invoiceId || !/^[0-9]+$/.test(invoiceId)) {
        setPaymentStatus("error");
        setPaymentMessage(
          "The invoice reference is missing or invalid. No payment status was changed."
        );
        return;
      }

      let isActive = true;

      async function verifyAndCapturePayment() {
        try {
          setPaymentStatus("processing");
          setPaymentMessage("Verifying your payment with PayPal...");

          // Reuse the same in-flight request if React StrictMode re-runs this effect.
          if (!paymentCaptureRequestRef.current) {
            paymentCaptureRequestRef.current = (async () => {
              const response = await fetch(
                `${API_URL}/api/payments/capture/${invoiceId}`,
                { method: "POST" }
              );
              const result = await response.json();
              return { response, result };
            })();
          }

          const { response, result } = await paymentCaptureRequestRef.current;

          if (!response.ok) {
            throw new Error(
              typeof result.detail === "string"
                ? result.detail
                : "PayPal could not verify this payment."
            );
          }

          if (!isActive) return;

          setPaymentStatus("success");
          setPaymentMessage(
            result.message || "Your payment was captured and verified successfully."
          );

          // Refresh invoice and analytics data after verified capture.
          await loadDashboard();
        } catch (err) {
          if (!isActive) return;
          setPaymentStatus("error");
          setPaymentMessage(
            err.message || "Payment verification failed. Please contact the business administrator."
          );
        }
      }

      verifyAndCapturePayment();

      return () => {
        isActive = false;
      };
    }

    loadDashboard();
  }, []);

  // Search and status filtering
  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      invoice.invoice_number.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || invoice.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Dashboard statistics
  const stats = summary
    ? [
        {
          label: "Total Invoices",
          value: summary.total_invoices,
          icon: "▤",
          color: "blue",
        },
        {
          label: "Paid Invoices",
          value: summary.paid_invoices,
          icon: "↗",
          color: "green",
        },
        {
          label: "Pending Invoices",
          value: summary.pending_invoices,
          icon: "◷",
          color: "orange",
        },
        {
          label: "Overdue Invoices",
          value: summary.overdue_invoices,
          icon: "!",
          color: "red",
        },
      ]
    : [];

  const statusItems = summary
    ? [
        { label: "Paid", count: summary.paid_invoices, color: "#20b486" },
        { label: "Pending", count: summary.pending_invoices, color: "#e9a23b" },
        { label: "Overdue", count: summary.overdue_invoices, color: "#e45b66" },
        {
          label: "Cancelled",
          count: summary.cancelled_invoices,
          color: "#8993a5",
        },
      ]
    : [];

  const maxStatusCount = Math.max(
    ...statusItems.map((item) => item.count),
    1
  );

  // Dedicated PayPal success screen.
  if (window.location.pathname === "/payment/success") {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background: "#f5f7fb",
          fontFamily: "inherit",
        }}
      >
        <section
          style={{
            width: "100%",
            maxWidth: "560px",
            padding: "36px",
            borderRadius: "20px",
            background: "#ffffff",
            boxShadow: "0 12px 40px rgba(20, 35, 70, 0.10)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>
            {paymentStatus === "success" ? "✓" : paymentStatus === "error" ? "!" : "◌"}
          </div>
          <h1 style={{ margin: "0 0 12px", color: "#17233c" }}>
            {paymentStatus === "success"
              ? "Payment successful"
              : paymentStatus === "error"
              ? "Payment verification needs attention"
              : "Verifying your payment"}
          </h1>
          <p style={{ color: "#65718a", lineHeight: 1.7 }}>
            {paymentMessage || "Please wait while we verify your PayPal transaction."}
          </p>
          {paymentStatus === "processing" && (
            <p style={{ color: "#65718a", fontSize: "14px" }}>
              Please do not close this page.
            </p>
          )}
          <button
            type="button"
            onClick={() => window.location.assign("/")}
            disabled={paymentStatus === "processing"}
            style={{
              marginTop: "18px",
              padding: "12px 22px",
              border: 0,
              borderRadius: "10px",
              background: paymentStatus === "processing" ? "#aab3c2" : "#2457d6",
              color: "#ffffff",
              fontWeight: 600,
              cursor: paymentStatus === "processing" ? "not-allowed" : "pointer",
            }}
          >
            Return to PayPilot AI
          </button>
        </section>
      </main>
    );
  }

  // Dedicated PayPal cancellation screen. No capture request is made here.
  if (window.location.pathname === "/payment/cancel") {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background: "#f5f7fb",
          fontFamily: "inherit",
        }}
      >
        <section
          style={{
            width: "100%",
            maxWidth: "560px",
            padding: "36px",
            borderRadius: "20px",
            background: "#ffffff",
            boxShadow: "0 12px 40px rgba(20, 35, 70, 0.10)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>↩</div>
          <h1 style={{ margin: "0 0 12px", color: "#17233c" }}>
            Payment cancelled
          </h1>
          <p style={{ color: "#65718a", lineHeight: 1.7 }}>
            You returned from PayPal without completing checkout. The invoice has not been marked as paid.
          </p>
          <button
            type="button"
            onClick={() => window.location.assign("/")}
            style={{
              marginTop: "18px",
              padding: "12px 22px",
              border: 0,
              borderRadius: "10px",
              background: "#2457d6",
              color: "#ffffff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Return to PayPilot AI
          </button>
        </section>
      </main>
    );
  }

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">P</div>
          <div>
            <h2>
              PayPilot<span>AI</span>
            </h2>
            <p>Financial intelligence</p>
          </div>
        </div>

        <div className="nav-label">WORKSPACE</div>

        <nav className="navigation">
          <a className="nav-item active" href="#dashboard">
            <span>▦</span> Dashboard
          </a>
          <a className="nav-item" href="#invoices">
            <span>▤</span> Invoices
          </a>
          <a className="nav-item" href="#analytics">
            <span>◔</span> Analytics
          </a>
        </nav>

        <div className="sidebar-bottom">
          <div className="ai-card">
            <div className="ai-card-icon">✦</div>
            <h3>AI Financial Assistant</h3>
            <p>Your financial insights, simplified.</p>
            <a className="ai-card-link" href="#ai-insights">
              Explore AI insights ↓
            </a>
          </div>

          <div className="profile">
            <div className="profile-avatar">P</div>
            <div>
              <strong>Business Admin</strong>
              <p>Administrator</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main dashboard */}
      <main className="main-content" id="dashboard">
        <header className="topbar">
          <div>
            <p className="breadcrumb">Workspace / Overview</p>
            <h1>Financial Overview</h1>
            <p className="page-subtitle">
              Monitor your business finances and payment activity.
            </p>
          </div>

          <div className="header-actions">
            <button
              className="add-invoice-button"
              onClick={() => {
                setError("");
                setSuccessMessage("");
                setShowInvoiceForm(true);
              }}
            >
              + Add Invoice
            </button>

            <button className="refresh-button" onClick={loadDashboard}>
              ↻ <span>Refresh data</span>
            </button>
          </div>
        </header>

        {/* Success message */}
        {successMessage && (
          <div className="success-message">
            {successMessage}
            <button onClick={() => setSuccessMessage("")}>×</button>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="error-message">
            <span>{error}</span>
            <button onClick={loadDashboard}>Retry</button>
          </div>
        )}

        {/* Add invoice modal */}
        {showInvoiceForm && (
          <div className="modal-overlay">
            <div className="invoice-modal">
              <div className="modal-heading">
                <div>
                  <h2>Create New Invoice</h2>
                  <p>Enter the customer and payment details.</p>
                </div>

                <button
                  className="close-modal"
                  onClick={() => setShowInvoiceForm(false)}
                  type="button"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleCreateInvoice}>
                <div className="form-grid">
                  <label>
                    Invoice Number
                    <input
                      required
                      minLength="2"
                      maxLength="50"
                      value={formData.invoice_number}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          invoice_number: e.target.value,
                        })
                      }
                      placeholder="PP-2026-002"
                    />
                  </label>

                  <label>
                    Customer Name
                    <input
                      required
                      minLength="2"
                      maxLength="150"
                      value={formData.customer_name}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          customer_name: e.target.value,
                        })
                      }
                      placeholder="Customer name"
                    />
                  </label>

                  <label>
                    Customer Email
                    <input
                      required
                      type="email"
                      value={formData.customer_email}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          customer_email: e.target.value,
                        })
                      }
                      placeholder="customer@example.com"
                    />
                  </label>

                  <label>
                    Amount (INR)
                    <input
                      required
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          amount: e.target.value,
                        })
                      }
                      placeholder="25000"
                    />
                  </label>

                  <label className="full-width">
                    Invoice Description
                    <input
                      required
                      minLength="2"
                      maxLength="500"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      placeholder="Website development services"
                    />
                  </label>

                  <label>
                    Issue Date
                    <input
                      required
                      type="date"
                      value={formData.issue_date}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          issue_date: e.target.value,
                        })
                      }
                    />
                  </label>

                  <label>
                    Due Date
                    <input
                      required
                      type="date"
                      min={formData.issue_date || undefined}
                      value={formData.due_date}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          due_date: e.target.value,
                        })
                      }
                    />
                  </label>
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="cancel-button"
                    onClick={() => setShowInvoiceForm(false)}
                    disabled={saving}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="submit-invoice-button"
                    disabled={saving}
                  >
                    {saving ? "Creating..." : "Create Invoice"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Dashboard content */}
        {loading ? (
          <div className="loading-state">
            <div className="loader"></div>
            <p>Loading your financial overview...</p>
          </div>
        ) : summary ? (
          <>
            {/* Statistics cards */}
            <section className="stats-grid">
              {stats.map((stat) => (
                <div className="stat-card" key={stat.label}>
                  <div className="stat-top">
                    <span className="stat-label">{stat.label}</span>
                    <div className={`stat-icon ${stat.color}`}>
                      {stat.icon}
                    </div>
                  </div>
                  <h2>{stat.value}</h2>
                  <p className="stat-caption">
                    Based on your invoice records
                  </p>
                </div>
              ))}
            </section>

            {/* Analytics and financial snapshot */}
            <section className="content-grid" id="analytics">
              <div className="panel status-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Invoice Overview</h2>
                    <p>Payment status distribution</p>
                  </div>
                  <span className="panel-icon">◉</span>
                </div>

                <div className="status-total">
                  <h2>{summary.total_invoices}</h2>
                  <p>Total invoices</p>
                </div>

                <div className="status-bars">
                  {statusItems.map((item) => (
                    <div className="status-row" key={item.label}>
                      <div className="status-info">
                        <span>
                          <i style={{ background: item.color }}></i>
                          {item.label}
                        </span>
                        <strong>{item.count}</strong>
                      </div>

                      <div className="progress-track">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${(item.count / maxStatusCount) * 100}%`,
                            background: item.color,
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel insight-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Financial Snapshot</h2>
                    <p>Your current payment position</p>
                  </div>
                  <span className="panel-icon">✧</span>
                </div>

                <div className="snapshot-item">
                  <div className="snapshot-symbol green-symbol">↗</div>
                  <div>
                    <p>Successfully collected</p>
                    <h3>{summary.paid_invoices} invoices</h3>
                  </div>
                </div>

                <div className="snapshot-item">
                  <div className="snapshot-symbol orange-symbol">◷</div>
                  <div>
                    <p>Awaiting collection</p>
                    <h3>{summary.pending_invoices} invoices</h3>
                  </div>
                </div>

                <div className="snapshot-item">
                  <div className="snapshot-symbol red-symbol">!</div>
                  <div>
                    <p>Past-due payments</p>
                    <h3>{summary.overdue_invoices} invoices</h3>
                  </div>
                </div>

                <div className="snapshot-note">
                  <span>✦</span>
                  Generate an AI report below to view financial amounts separately by currency.
                </div>
              </div>
            </section>

            {/* AI Financial Insights */}
            <section className="panel ai-insights-panel" id="ai-insights">
              <div className="ai-insights-heading">
                <div>
                  <div className="ai-eyebrow">GEMINI POWERED</div>
                  <h2>AI Financial Insights</h2>
                  <p>Understand payment risks and get practical collection recommendations.</p>
                </div>

                <button
                  className="ai-generate-button"
                  onClick={loadAiInsights}
                  disabled={aiLoading}
                  type="button"
                >
                  {aiLoading
                    ? "Generating insights..."
                    : aiInsights
                    ? "↻ Refresh insights"
                    : "✦ Generate insights"}
                </button>
              </div>

              {aiError && (
                <div className="ai-error" role="alert">
                  <span>{aiError}</span>
                  <button type="button" onClick={loadAiInsights} disabled={aiLoading}>
                    Try again
                  </button>
                </div>
              )}

              {aiLoading && (
                <div className="ai-empty ai-loading">
                  <div className="loader"></div>
                  <p>Gemini is analysing your invoice data. This may take a few seconds.</p>
                </div>
              )}

              {!aiLoading && !aiInsights && !aiError && (
                <div className="ai-empty">
                  <div className="ai-empty-icon">✦</div>
                  <h3>Your financial assistant is ready</h3>
                  <p>Generate a report to see currency-wise revenue, outstanding invoices, payment priorities and cash-flow suggestions.</p>
                </div>
              )}

              {aiInsights && !aiLoading && (
                <div className="ai-results">
                  <div className="ai-results-meta">
                    <span>
                      {aiInsights.financial_data?.total_invoices ?? 0} invoices analysed
                    </span>
                    {aiInsights.generated_at && (
                      <span>
                        Generated {new Date(aiInsights.generated_at).toLocaleString()}
                      </span>
                    )}
                  </div>

                  <h3 className="ai-subheading">Currency-wise financial position</h3>
                  <div className="ai-currency-grid">
                    {Object.entries(
                      aiInsights.financial_data?.currency_breakdown || {}
                    ).map(([currency, data]) => (
                      <div className="ai-currency-card" key={currency}>
                        <div className="ai-currency-title">
                          <strong>{currency}</strong>
                          <span>{data.total_invoices} invoices</span>
                        </div>
                        <div className="ai-currency-values">
                          <div>
                            <span>Collected revenue</span>
                            <strong>{formatCurrency(data.paid_revenue, currency)}</strong>
                          </div>
                          <div>
                            <span>Outstanding</span>
                            <strong>{formatCurrency(data.outstanding_amount, currency)}</strong>
                          </div>
                        </div>
                        <div className="ai-currency-footer">
                          <span>Paid: {data.paid_invoices}</span>
                          <span>Pending: {data.pending_invoices}</span>
                          <span>Overdue: {data.overdue_invoices}</span>
                        </div>
                      </div>
                    ))}
                    {Object.keys(
                      aiInsights.financial_data?.currency_breakdown || {}
                    ).length === 0 && (
                      <p className="ai-muted">No invoice currency data is available yet.</p>
                    )}
                  </div>

                  <h3 className="ai-subheading">Invoices requiring attention</h3>
                  <div className="ai-attention-list">
                    {(aiInsights.financial_data?.invoices_requiring_attention || []).length > 0 ? (
                      aiInsights.financial_data.invoices_requiring_attention.map((invoice) => (
                        <div className="ai-attention-item" key={invoice.invoice_number}>
                          <div className="ai-attention-main">
                            <strong>{invoice.invoice_number}</strong>
                            <span>{invoice.due_date}</span>
                          </div>
                          <div className="ai-attention-side">
                            <strong>{formatCurrency(invoice.amount, invoice.currency)}</strong>
                            <span className={`status-badge ${invoice.status}`}>
                              {invoice.status}
                            </span>
                            {invoice.days_overdue > 0 && (
                              <small>{invoice.days_overdue} days overdue</small>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="ai-muted">There are no pending or overdue invoices requiring attention.</p>
                    )}
                  </div>

                  <h3 className="ai-subheading">Gemini recommendations</h3>
                  <div className="ai-report">
                    {aiInsights.insights || "The AI service did not return a report."}
                  </div>
                </div>
              )}
            </section>

            {/* Invoice table */}
            <section className="panel invoices-panel" id="invoices">
              <div className="panel-heading invoice-heading">
                <div>
                  <h2>Recent Invoices</h2>
                  <p>Review and monitor your customer payments</p>
                </div>

                <span className="invoice-count">
                  {invoices.length} invoices
                </span>
              </div>

              <div className="table-controls">
                <div className="search-box">
                  <span>⌕</span>
                  <input
                    type="text"
                    placeholder="Search customer or invoice..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="all">All statuses</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="overdue">Overdue</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>INVOICE</th>
                      <th>CUSTOMER</th>
                      <th>ISSUE DATE</th>
                      <th>DUE DATE</th>
                      <th>AMOUNT</th>
                      <th>STATUS</th>
                      <th>PAYMENT</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredInvoices.length > 0 ? (
                      filteredInvoices.map((invoice) => (
                        <tr key={invoice.id}>
                          <td className="invoice-number">
                            {invoice.invoice_number}
                          </td>

                          <td>
                            <strong>{invoice.customer_name}</strong>
                            <small>{invoice.customer_email}</small>
                          </td>

                          <td>{invoice.issue_date}</td>
                          <td>{invoice.due_date}</td>

                          <td className="amount-cell">
                            {formatCurrency(invoice.amount, invoice.currency)}
                          </td>

                          <td>
                            <span className={`status-badge ${invoice.status}`}>
                              {invoice.status}
                            </span>
                          </td>

                          <td>
                            {invoice.currency === "USD" &&
                            ["pending", "overdue"].includes(invoice.status) ? (
                              <button
                                type="button"
                                onClick={() => handlePayPalCheckout(invoice)}
                                disabled={paymentStartingId === invoice.id}
                                style={{
                                  padding: "8px 12px",
                                  border: 0,
                                  borderRadius: "8px",
                                  background: paymentStartingId === invoice.id ? "#aab3c2" : "#2457d6",
                                  color: "#ffffff",
                                  fontWeight: 600,
                                  cursor: paymentStartingId === invoice.id ? "not-allowed" : "pointer",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {paymentStartingId === invoice.id ? "Connecting..." : "Pay with PayPal"}
                              </button>
                            ) : invoice.status === "paid" ? (
                              <span style={{ color: "#16845b", fontWeight: 600 }}>Paid</span>
                            ) : (
                              <span style={{ color: "#8993a5" }}>—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" className="empty-state">
                          No matching invoices found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}

        <footer className="footer">
          <span>PayPilot AI</span>
          <span>Intelligent financial operations · 2026</span>
        </footer>
      </main>
    </div>
  );
}

export default App;
