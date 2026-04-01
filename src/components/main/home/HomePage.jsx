import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { UserCircle } from "lucide-react";
import { supabase } from "../../../supabaseClient";
import "./HomePage.css";

const CAT_EMOJI = {
  food:      "🍽️",
  travel:    "✈️",
  stay:      "🏨",
  bill:      "🧾",
  shopping:  "🛍️",
  groceries: "🛒",
  fuel:      "⛽",
  other:     "📦",
};

function fmt(n) { return "₹" + (+n || 0).toFixed(2); }

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function HomePage() {
  const [hoveredGroup, setHoveredGroup] = useState(null);
  const [user,         setUser]         = useState(null);
  const navigate = useNavigate();

  const [splits,        setSplits]        = useState([]);
  const [loadingSplits, setLoadingSplits] = useState(true);
  const [splitsError,   setSplitsError]   = useState("");

  // ── Auth ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
  }, []);

  // ── Fetch splits + participant counts ──
  useEffect(() => {
    if (!user) { setLoadingSplits(false); return; }

    const fetchSplits = async () => {
      setLoadingSplits(true);
      setSplitsError("");

      try {
        const { data: splitRows, error: splitErr } = await supabase
          .from("splits")
          .select("id, description, category, total_amount, paid_by, split_mode, created_at, event_date")
          .eq("created_by", user.id)
          .order("created_at", { ascending: false })
          .limit(10);

        if (splitErr) throw splitErr;

        const enriched = await Promise.all(
          splitRows.map(async (s) => {
            const { data: parts, error: partErr } = await supabase
              .from("participants")
              .select("id, is_paid")
              .eq("split_id", s.id);

            if (partErr) return { ...s, memberCount: 0, paidCount: 0 };
            return {
              ...s,
              memberCount: parts.length,
              paidCount:   parts.filter(p => p.is_paid).length,
            };
          })
        );

        setSplits(enriched);
      } catch (err) {
        console.error("Failed to fetch splits:", err);
        setSplitsError("Couldn't load your splits.");
      } finally {
        setLoadingSplits(false);
      }
    };

    fetchSplits();
  }, [user]);

  // ── Derived stats ──
  const totalSplits = splits.length;
  const totalSpent  = splits.reduce((a, s) => a + (+s.total_amount || 0), 0);
  const fullSettled = splits.filter(s => s.paidCount === s.memberCount).length;

  const stats = [
    { label: "total splits",  amount: totalSplits,     negative: false, mono: true  },
    { label: "total tracked", amount: fmt(totalSpent), negative: false, mono: false },
    { label: "fully settled", amount: fullSettled,     negative: false, mono: true  },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="home">
      <div className="bg-grid" />

      {/* Header */}
      <header className="header">
        <div className="logo">
          <span className="logo-symbol">⇄</span>
          <span className="logo-text">split<em>&</em>settle</span>
        </div>
        <nav className="nav">
          {user ? (
            <>
              <UserCircle size={22} className="nav-user-icon" strokeWidth={1.6} />
              <button className="nav-btn" onClick={() => navigate("/history")}>history</button>
              <button className="nav-btn" onClick={handleLogout}>logout</button>
            </>
          ) : (
            <button className="nav-btn" onClick={() => navigate("/auth")}>sign in</button>
          )}
          <button className="nav-btn primary" onClick={() => navigate("/split")}>new split</button>
        </nav>
      </header>

      {/* Hero */}
      <section className="hero">
        <div className="hero-label">expense splitting, simplified</div>
        <h1 className="hero-heading">
          no more <br />
          <span className="strike">awkward</span> <span className="accent">money</span> <br />
          conversations.
        </h1>
        <p className="hero-sub">
          Add expenses. Split fairly. Settle in the fewest transactions possible.
        </p>
        <div className="hero-actions">
          <button className="btn-main" onClick={() => navigate("/split")}>start splitting →</button>
          <span className="hero-hint"></span>
        </div>
      </section>

      {/* Stats bar */}
      <div className="stats-bar">
        {stats.map((s) => (
          <div className="stat-item" key={s.label}>
            <span className={`stat-amount ${s.negative ? "neg" : "pos"}`}>
              {s.amount}
            </span>
            <span className="stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Recent splits section */}
      <section className="groups-section">
        <div className="section-header">
          <h2 className="section-title">recent splits</h2>
          <div className="section-header-actions">
            {user && splits.length > 0 && (
              <button className="see-all" onClick={() => navigate("/history")}>view all →</button>
            )}
            <button className="see-all" onClick={() => navigate("/split")}>new split →</button>
          </div>
        </div>

        {!user && (
          <div className="hp-empty">
            <span className="hp-empty-icon">🔒</span>
            <p>sign in to see your splits</p>
            <button className="nav-btn primary" onClick={() => navigate("/auth")}>sign in</button>
          </div>
        )}

        {user && loadingSplits && (
          <div className="hp-empty">
            <span className="hp-loading-dot" />
            <p>loading your splits…</p>
          </div>
        )}

        {user && !loadingSplits && splitsError && (
          <div className="hp-empty">
            <span className="hp-empty-icon">⚠️</span>
            <p>{splitsError}</p>
          </div>
        )}

        {user && !loadingSplits && !splitsError && splits.length === 0 && (
          <div className="hp-empty">
            <span className="hp-empty-icon">💸</span>
            <p>no splits yet — create your first one!</p>
            <button className="nav-btn primary" onClick={() => navigate("/split")}>new split</button>
          </div>
        )}

        {user && !loadingSplits && splits.length > 0 && (
          <div className="groups-list">
            {splits.map((split) => {
              const allPaid      = split.paidCount === split.memberCount;
              const emoji        = CAT_EMOJI[split.category] || "📦";
              const settledRatio = `${split.paidCount}/${split.memberCount} paid`;
              const eventDate    = split.event_date
                ? new Date(split.event_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                : null;

              return (
                <div
                  key={split.id}
                  className={`group-card ${hoveredGroup === split.id ? "hovered" : ""}`}
                  onMouseEnter={() => setHoveredGroup(split.id)}
                  onMouseLeave={() => setHoveredGroup(null)}
                  onClick={() => navigate(`/split/${split.id}`)}
                >
                  <div className="group-left">
                    <div className="group-avatar">{emoji}</div>
                    <div className="group-info">
                      <span className="group-name">{split.description}</span>
                      <span className="group-members">
                        {split.memberCount} people · {split.split_mode} · {timeAgo(split.created_at)}
                        {eventDate && <span className="group-event-date"> · 📅 {eventDate}</span>}
                      </span>
                    </div>
                  </div>
                  <div className="group-right">
                    <span className={`group-balance ${allPaid ? "pos" : "neg"}`}>
                      {allPaid ? "settled ✓" : settledRatio}
                    </span>
                    <span className="group-amount">{fmt(split.total_amount)}</span>
                    <span className="group-arrow">→</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="how-section">
        <h2 className="section-title">how it works</h2>
        <div className="steps">
          {[
            { num: "01", title: "create a split", desc: "Describe the expense, pick a category, enter the amount and date." },
            { num: "02", title: "add people",     desc: "Add who's splitting — equally, custom, or by group." },
            { num: "03", title: "settle up",      desc: "Mark payments as done and track who still owes." },
          ].map((step) => (
            <div className="step" key={step.num}>
              <span className="step-num">{step.num}</span>
              <h3 className="step-title">{step.title}</h3>
              <p className="step-desc">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-left">
          <span className="footer-logo">⇄ split<em>&</em>settle</span>
          <span className="footer-divider">·</span>
          
        </div>
        <div className="footer-right">
          <span className="footer-by">created by <strong>Karthik Sujith</strong></span>
          <div className="footer-socials">
            <a
              href="https://github.com/Karthik-Sujith"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-social-btn"
            >
              github
            </a>
            <a
              href="https://www.linkedin.com/in/karthiksujith"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-social-btn"
            >
              linkedin
            </a>
          </div>
        </div>
      </footer>

    </div>
  );
}