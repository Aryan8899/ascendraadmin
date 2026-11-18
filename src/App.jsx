import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "https://ascendorabackend.vercel.app";
const TOKEN_KEY = "ascendora_admin_token";

const FILTERS = [
  { key: "PENDING", label: "Pending", hint: "Waiting for review" },
  { key: "APPROVED", label: "Approved", hint: "Payment verified" },
  { key: "REJECTED", label: "Rejected", hint: "Payment not verified" },
  { key: "ALL", label: "All", hint: "Every registration" },
];

const initials = (name = "") =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "?";

function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} days ago`;
  return new Date(iso).toLocaleDateString();
}

/* ================= Login ================= */

function Login({ onLoggedIn }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password: password.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error || "Login failed. Try again.");
        return;
      }
      sessionStorage.setItem(TOKEN_KEY, data.token);
      onLoggedIn(data.token);
    } catch {
      setError("Cannot reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <aside className="login-brand">
        <img src="https://ascendoratalentsolutions.co.in/header.png" alt="Ascendora Talent Solutions" />
        <h2>Review every registration before it is confirmed.</h2>
        <p>Match the UTR with your bank statement, then approve or reject. The candidate is emailed and sees the result on their status page.</p>
      </aside>

      <main className="login-main">
        <form className="login-card" onSubmit={submit}>
          <h1>Sign in</h1>
          <p className="muted">Admin access for Ascendora Talent Solutions.</p>

          <label htmlFor="u">Username</label>
          <input id="u" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />

          <label htmlFor="p">Password</label>
          <input id="p" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />

          {error && <p className="error" role="alert">{error}</p>}

          <button className="btn primary wide" disabled={loading || !username || !password}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </main>
    </div>
  );
}

/* ================= Pieces ================= */

function Field({ label, children }) {
  return (
    <div className="field">
      <dt>{label}</dt>
      <dd>{children || "-"}</dd>
    </div>
  );
}

function CopyButton({ text }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch { /* clipboard blocked */ }
  };
  return (
    <button type="button" className="link small-link" onClick={copy}>
      {done ? "Copied" : "Copy"}
    </button>
  );
}

function CandidateCard({ c, busy, onApprove, onReject }) {
  const st = c.status.toLowerCase();
  return (
    <article className={`card ${st}`}>
      <header className="card-head">
        <span className="avatar" aria-hidden="true">{initials(c.name)}</span>
        <div className="who">
          <h3>{c.name}</h3>
          <p className="muted small">
            {c.ref} <span className="sep" /> {timeAgo(c.createdAt)}
          </p>
        </div>
        <span className={`pill ${st}`}>{st}</span>
      </header>

      <div className="utr-box">
        <div>
          <div className="utr-label">UTR to match in your bank statement</div>
          <div className="utr-value">{c.utr}</div>
        </div>
        <CopyButton text={c.utr} />
      </div>

      <dl className="fields">
        <Field label="Email"><a href={`mailto:${c.email}`}>{c.email}</a></Field>
        <Field label="Phone"><a href={`tel:${c.phone}`}>{c.phone}</a></Field>
        <Field label="Education">{c.education}</Field>
        <Field label="Experience">{c.exp}</Field>
        <Field label="Location">{c.location}</Field>
        <Field label="Notice period">{c.notice}</Field>
        <Field label="Domain">{c.domain}</Field>
        <Field label="Found via">{c.source}</Field>
      </dl>

      <div className="docs">
        {c.resumeUrl && <a className="doc" href={c.resumeUrl} target="_blank" rel="noreferrer">Resume</a>}
        {c.screenshotUrl && <a className="doc" href={c.screenshotUrl} target="_blank" rel="noreferrer">Payment screenshot</a>}
        {c.linkedin && <a className="doc" href={c.linkedin} target="_blank" rel="noreferrer">LinkedIn profile</a>}
      </div>

      {c.status === "REJECTED" && c.rejectReason && (
        <p className="reason"><b>Reason shared with candidate:</b> {c.rejectReason}</p>
      )}

      {c.status === "PENDING" && (
        <footer className="actions">
          <button className="btn approve" disabled={busy} onClick={() => onApprove(c)}>
            {busy ? "Working..." : "Approve payment"}
          </button>
          <button className="btn reject-outline" disabled={busy} onClick={() => onReject(c)}>
            Reject
          </button>
        </footer>
      )}
    </article>
  );
}

function ActionDialog({ type, candidate, onCancel, onConfirm }) {
  const [reason, setReason] = useState("");
  const isReject = type === "reject";

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {isReject ? (
          <>
            <h2>Reject {candidate.name}?</h2>
            <p className="muted">The candidate sees this reason on their status page and in the email.</p>
            <textarea
              rows={3}
              maxLength={300}
              autoFocus
              placeholder="e.g. UTR not found in the bank statement"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </>
        ) : (
          <>
            <h2>Approve {candidate.name}?</h2>
            <p className="muted">Only approve after you see this UTR in your bank or GPay statement.</p>
            <div className="utr-box solo">
              <div>
                <div className="utr-label">UTR</div>
                <div className="utr-value">{candidate.utr}</div>
              </div>
            </div>
            <p className="muted small">A confirmation email goes to {candidate.email}.</p>
          </>
        )}
        <div className="dialog-actions">
          <button className="btn ghost" onClick={onCancel}>Cancel</button>
          {isReject ? (
            <button className="btn reject" disabled={!reason.trim()} onClick={() => onConfirm(reason.trim())}>
              Reject and send email
            </button>
          ) : (
            <button className="btn approve" onClick={() => onConfirm("")}>
              Approve and send email
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================= Dashboard ================= */

function Dashboard({ token, onLogout }) {
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState("PENDING");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [dialog, setDialog] = useState(null); // { type, c }
  const [toast, setToast] = useState("");

  const authHeaders = useMemo(
    () => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}` }),
    [token]
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/candidates`, { headers: authHeaders, cache: "no-store" });
      if (res.status === 401) return onLogout();
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setList(data.candidates);
      setError("");
    } catch {
      setError("Could not load candidates. Check your connection and press Refresh.");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, onLogout]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const review = async (c, action, reason = "") => {
    setBusyId(c.id);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/admin/review`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ id: c.id, action, reason }),
      });
      if (res.status === 401) return onLogout();
      const data = await res.json().catch(() => ({}));
      if (!data.ok) {
        setError(data.error || "Could not update this candidate.");
      } else {
        setToast(action === "approve" ? `Approved ${c.name}` : `Rejected ${c.name}`);
      }
      await load();
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusyId(null);
    }
  };

  const counts = useMemo(() => ({
    ALL: list.length,
    PENDING: list.filter((c) => c.status === "PENDING").length,
    APPROVED: list.filter((c) => c.status === "APPROVED").length,
    REJECTED: list.filter((c) => c.status === "REJECTED").length,
  }), [list]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list
      .filter((c) => filter === "ALL" || c.status === filter)
      .filter((c) =>
        !q || [c.name, c.email, c.phone, c.utr, c.ref].some((v) => String(v || "").toLowerCase().includes(q))
      );
  }, [list, filter, query]);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-in">
          <div className="brand">
            <span className="brand-mark">A</span>
            <div>
              <div className="brand-name">Ascendora</div>
              <div className="brand-sub">Admin</div>
            </div>
          </div>
          <div className="topbar-actions">
            <button className="top-btn" onClick={load}>Refresh</button>
            <button className="top-btn" onClick={onLogout}>Sign out</button>
          </div>
        </div>
      </header>

      <main className="page">
        <section className="stats" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`stat ${f.key.toLowerCase()} ${filter === f.key ? "on" : ""}`}
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
            >
              <span className="stat-num">{counts[f.key]}</span>
              <span className="stat-label">{f.label}</span>
              <span className="stat-hint">{f.hint}</span>
            </button>
          ))}
        </section>

        <div className="searchbar">
          <input
            type="search"
            placeholder="Search by name, email, phone, UTR or reference"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search candidates"
          />
        </div>

        {error && <p className="banner" role="alert">{error}</p>}

        {loading && (
          <div className="list">
            {[1, 2].map((i) => <div key={i} className="skeleton" />)}
          </div>
        )}

        {!loading && shown.length === 0 && (
          <div className="empty">
            <b>{query ? "No matches" : filter === "PENDING" ? "Nothing to review" : "Nothing here yet"}</b>
            <span>
              {query
                ? "Try a different name, email or UTR."
                : filter === "PENDING"
                ? "New registrations with payment proof will show up here."
                : "Candidates will appear here once they are reviewed."}
            </span>
          </div>
        )}

        <div className="list">
          {shown.map((c) => (
            <CandidateCard
              key={c.id}
              c={c}
              busy={busyId === c.id}
              onApprove={(x) => setDialog({ type: "approve", c: x })}
              onReject={(x) => setDialog({ type: "reject", c: x })}
            />
          ))}
        </div>
      </main>

      {dialog && (
        <ActionDialog
          type={dialog.type}
          candidate={dialog.c}
          onCancel={() => setDialog(null)}
          onConfirm={(reason) => {
            const { type, c } = dialog;
            setDialog(null);
            review(c, type, reason);
          }}
        />
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

/* ================= Root ================= */

export default function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY));

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }, []);

  return token ? <Dashboard token={token} onLogout={logout} /> : <Login onLoggedIn={setToken} />;
}