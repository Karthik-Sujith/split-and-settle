import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../supabaseClient";
import "./History.css";

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

const CAT_LABELS = {
  food:      "Food & Drinks",
  travel:    "Travel",
  stay:      "Stay",
  bill:      "Bill",
  shopping:  "Shopping",
  groceries: "Groceries",
  fuel:      "Fuel",
  other:     "Other",
};

function fmt(n) { return "₹" + (+n || 0).toFixed(2); }

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function formatEventDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return formatDate(dateStr);
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const [user, setUser]     = useState(null);
  const [splits, setSplits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expanded, setExpanded] = useState(null);
  const [participants, setParticipants] = useState({});
  const [loadingParts, setLoadingParts] = useState({});

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
  }, []);

  // Fetch all splits
  useEffect(() => {
    if (!user) { setLoading(false); return; }

    const fetchAll = async () => {
      setLoading(true);
      setError("");
      try {
        const { data: splitRows, error: splitErr } = await supabase
          .from("splits")
          .select("id, description, category, base_amount, tax, tip, total_amount, paid_by, split_mode, creator_involved, creator_name, created_at, event_date")
          .eq("created_by", user.id)
          .order("created_at", { ascending: false });

        if (splitErr) throw splitErr;

        const enriched = await Promise.all(
          splitRows.map(async (s) => {
            const { data: parts, error: partErr } = await supabase
              .from("participants")
              .select("id, name, amount, is_paid, is_creator")
              .eq("split_id", s.id);
            if (partErr) return { ...s, memberCount: 0, paidCount: 0, participants: [] };
            return {
              ...s,
              memberCount: parts.length,
              paidCount:   parts.filter(p => p.is_paid).length,
              participants: parts,
            };
          })
        );
        setSplits(enriched);
      } catch (err) {
        console.error(err);
        setError("Couldn't load history.");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [user]);

  // Filter logic
  const filtered = splits.filter(s => {
    const matchSearch = !search.trim() ||
      s.description.toLowerCase().includes(search.toLowerCase()) ||
      s.paid_by.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === "all" || s.category === filterCat;
    const allPaid = s.paidCount === s.memberCount;
    const matchStatus =
      filterStatus === "all" ||
      (filterStatus === "settled" && allPaid) ||
      (filterStatus === "pending" && !allPaid);
    return matchSearch && matchCat && matchStatus;
  });

  // Stats
  const totalSpent    = splits.reduce((a, s) => a + (+s.total_amount || 0), 0);
  const totalSettled  = splits.filter(s => s.paidCount === s.memberCount).length;
  const totalPending  = splits.filter(s => s.paidCount < s.memberCount).length;

  const toggleExpand = (id) => {
    setExpanded(prev => prev === id ? null : id);
  };

  const categories = [...new Set(splits.map(s => s.category))];

  return (
    <div className="hist-page">
      <div className="hist-bg-grid" />

      {/* Top bar */}
      <header className="hist-topbar">
        <button className="hist-back" onClick={() => navigate("/")}>
          ← home
        </button>
        <div className="hist-logo">⇄ split<em>&</em>settle</div>
        <button className="hist-new-btn" onClick={() => navigate("/split")}>
          new split →
        </button>
      </header>

      <div className="hist-body">

        {/* Page heading */}
        <div className="hist-heading-row">
          <div>
            <div className="hist-page-tag">📋 split history</div>
            <h1 className="hist-page-title">all your <em>splits</em></h1>
          </div>
        </div>

        {/* Stats row */}
        {!loading && splits.length > 0 && (
          <div className="hist-stats-row">
            <div className="hist-stat">
              <span className="hist-stat-num">{splits.length}</span>
              <span className="hist-stat-lbl">total splits</span>
            </div>
            <div className="hist-stat-div" />
            <div className="hist-stat">
              <span className="hist-stat-num accent">{fmt(totalSpent)}</span>
              <span className="hist-stat-lbl">total tracked</span>
            </div>
            <div className="hist-stat-div" />
            <div className="hist-stat">
              <span className="hist-stat-num pos">{totalSettled}</span>
              <span className="hist-stat-lbl">fully settled</span>
            </div>
            <div className="hist-stat-div" />
            <div className="hist-stat">
              <span className="hist-stat-num neg">{totalPending}</span>
              <span className="hist-stat-lbl">pending</span>
            </div>
          </div>
        )}

        {/* Filters */}
        {!loading && splits.length > 0 && (
          <div className="hist-filters">
            <input
              className="hist-search"
              placeholder="search by description or payer…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div className="hist-filter-row">
              <div className="hist-filter-group">
                <span className="hist-filter-label">category</span>
                <div className="hist-filter-chips">
                  <button
                    className={`hist-chip-btn ${filterCat === "all" ? "active" : ""}`}
                    onClick={() => setFilterCat("all")}>all</button>
                  {categories.map(c => (
                    <button
                      key={c}
                      className={`hist-chip-btn ${filterCat === c ? "active" : ""}`}
                      onClick={() => setFilterCat(c)}>
                      {CAT_EMOJI[c]} {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className="hist-filter-group">
                <span className="hist-filter-label">status</span>
                <div className="hist-filter-chips">
                  {["all", "settled", "pending"].map(s => (
                    <button
                      key={s}
                      className={`hist-chip-btn ${filterStatus === s ? "active" : ""}`}
                      onClick={() => setFilterStatus(s)}>{s}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="hist-empty">
            <span className="hist-pulse" />
            <p>loading your history…</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="hist-empty">
            <span className="hist-empty-icon">⚠️</span>
            <p>{error}</p>
          </div>
        )}

        {/* No splits at all */}
        {!loading && !error && splits.length === 0 && (
          <div className="hist-empty">
            <span className="hist-empty-icon">💸</span>
            <p>no splits yet — create your first one!</p>
            <button className="hist-cta" onClick={() => navigate("/split")}>new split →</button>
          </div>
        )}

        {/* No results after filter */}
        {!loading && !error && splits.length > 0 && filtered.length === 0 && (
          <div className="hist-empty">
            <span className="hist-empty-icon">🔍</span>
            <p>no splits match your filters.</p>
            <button className="hist-chip-btn active" onClick={() => {
              setSearch(""); setFilterCat("all"); setFilterStatus("all");
            }}>clear filters</button>
          </div>
        )}

        {/* Split list */}
        {!loading && filtered.length > 0 && (
          <div className="hist-list">
            {filtered.map((split, idx) => {
              const allPaid   = split.paidCount === split.memberCount;
              const emoji     = CAT_EMOJI[split.category] || "📦";
              const isOpen    = expanded === split.id;
              const eventDate = formatEventDate(split.event_date);

              return (
                <div
                  key={split.id}
                  className={`hist-item ${isOpen ? "open" : ""} ${allPaid ? "settled" : "pending"}`}
                  style={{ animationDelay: `${idx * 0.04}s` }}
                >
                  {/* Row — always visible */}
                  <div className="hist-item-row" onClick={() => toggleExpand(split.id)}>
                    <div className="hist-item-left">
                      <div className="hist-item-emoji">{emoji}</div>
                      <div className="hist-item-info">
                        <span className="hist-item-desc">{split.description}</span>
                        <span className="hist-item-meta">
                          {CAT_LABELS[split.category] || split.category}
                          {" · "}paid by <strong>{split.paid_by}</strong>
                          {" · "}{split.memberCount} {split.memberCount === 1 ? "person" : "people"}
                          {eventDate && <> · <span className="hist-event-date">📅 {eventDate}</span></>}
                        </span>
                        <span className="hist-item-created">created {timeAgo(split.created_at)}</span>
                      </div>
                    </div>
                    <div className="hist-item-right">
                      <span className={`hist-status-badge ${allPaid ? "pos" : "neg"}`}>
                        {allPaid ? "settled ✓" : `${split.paidCount}/${split.memberCount} paid`}
                      </span>
                      <span className="hist-item-total">{fmt(split.total_amount)}</span>
                      <span className={`hist-chevron ${isOpen ? "rot" : ""}`}>›</span>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="hist-detail anim-in">
                      {/* Summary strip */}
                      <div className="hist-detail-strip">
                        {[
                          { label: "base",      val: fmt(split.base_amount) },
                          split.tax  && { label: `tax (${split.tax}%)`,  val: fmt(split.base_amount * split.tax / 100) },
                          split.tip  && { label: `tip (${split.tip}%)`,  val: fmt(split.base_amount * split.tip / 100) },
                          { label: "total",     val: fmt(split.total_amount), accent: true },
                          { label: "split mode",val: split.split_mode },
                          eventDate && { label: "event date", val: eventDate },
                        ].filter(Boolean).map(item => (
                          <div className="hist-ds-item" key={item.label}>
                            <span className="hist-ds-label">{item.label}</span>
                            <span className={`hist-ds-val ${item.accent ? "accent" : ""}`}>{item.val}</span>
                          </div>
                        ))}
                      </div>

                      {/* Participants */}
                      <div className="hist-parts-title">participants</div>
                      <div className="hist-parts-list">
                        {split.participants.map(p => {
                          const isPayer = split.paid_by.trim().toLowerCase() === p.name.trim().toLowerCase();
                          return (
                            <div key={p.id} className={`hist-part-row ${p.is_paid || isPayer ? "paid" : ""}`}>
                              <div className="hist-part-avatar" style={{ "--av-hue": nameHue(p.name) }}>
                                {getInitials(p.name)}
                              </div>
                              <div className="hist-part-info">
                                <span className="hist-part-name">
                                  {p.name}
                                  {isPayer && <span className="hist-payer-tag">payer</span>}
                                  {p.is_creator && !isPayer && <span className="hist-creator-tag">you</span>}
                                </span>
                                <span className="hist-part-status">
                                  {isPayer ? "paid the bill" : p.is_paid ? "settled ✓" : `owes ${split.paid_by}`}
                                </span>
                              </div>
                              <span className={`hist-part-amt ${isPayer ? "accent" : p.is_paid ? "pos" : "neg"}`}>
                                {fmt(p.amount)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function getInitials(name) {
  return name.trim().split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}
function nameHue(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}