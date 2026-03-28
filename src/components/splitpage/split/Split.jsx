import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  UtensilsCrossed, Plane, Hotel, Receipt, ShoppingBag,
  ShoppingCart, Fuel, Package, ArrowLeft, Check, X,
  UserPlus, Users, ChevronRight, Pencil, CircleDollarSign,
  SplitSquareHorizontal, Eye, Wallet, UserCheck, UserX, Loader2,
  CalendarDays
} from "lucide-react";
import { supabase } from "../../../supabaseClient";
import "./Split.css";

// ── Constants ──
const CATEGORIES = [
  { id: "food",      label: "Food & Drinks", Icon: UtensilsCrossed },
  { id: "travel",    label: "Travel",        Icon: Plane },
  { id: "stay",      label: "Stay",          Icon: Hotel },
  { id: "bill",      label: "Bill",          Icon: Receipt },
  { id: "shopping",  label: "Shopping",      Icon: ShoppingBag },
  { id: "groceries", label: "Groceries",     Icon: ShoppingCart },
  { id: "fuel",      label: "Fuel",          Icon: Fuel },
  { id: "other",     label: "Other",         Icon: Package },
];

const STEPS = ["details", "involved", "people", "split", "preview", "pay"];

function fmt(n) { return "₹" + (+n || 0).toFixed(2); }
function getInitials(name) {
  return name.trim().split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}
function nameHue(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

export default function SplitPage() {
  const navigate = useNavigate();
  const [step, setStep]   = useState(0);
  const [error, setError] = useState("");

  // Step 0 — Details
  const [desc,      setDesc]      = useState("");
  const [category,  setCategory]  = useState("");
  const [baseAmt,   setBaseAmt]   = useState("");
  const [tax,       setTax]       = useState("");
  const [tip,       setTip]       = useState("");
  const [paidBy,    setPaidBy]    = useState("");
  const [eventDate, setEventDate] = useState(""); // ← NEW: date the event occurred

  // Step 1 — Involvement
  const [userName,     setUserName]     = useState("");
  const [userInvolved, setUserInvolved] = useState(null);

  // Step 2 — People
  const [people,      setPeople]      = useState([]);
  const [personInput, setPersonInput] = useState("");

  // Step 3 — Split
  const [splitMode,   setSplitMode]   = useState("equal");
  const [customAmts,  setCustomAmts]  = useState({});
  const [groupAmts,   setGroupAmts]   = useState([]);
  const [newGroupSel, setNewGroupSel] = useState([]);
  const [newGroupAmt, setNewGroupAmt] = useState("");

  // Step 4 — Preview
  const [confirmedSplit, setConfirmedSplit] = useState(null);

  // Step 5 — Pay
  const [paidStatus,      setPaidStatus]      = useState({});
  const [splitDbId,       setSplitDbId]       = useState(null);
  const [participantIds,  setParticipantIds]  = useState({});
  const [saving,          setSaving]          = useState(false);
  const [saveError,       setSaveError]       = useState("");

  // ── Derived ──
  const totalAmount = useMemo(() => {
    const base = +baseAmt || 0;
    const taxAmt = tax ? base * (+tax / 100) : 0;
    const tipAmt = tip ? base * (+tip / 100) : 0;
    return +(base + taxAmt + tipAmt).toFixed(2);
  }, [baseAmt, tax, tip]);

  const allPeople = useMemo(() => {
    if (userInvolved && userName.trim()) {
      if (!people.find(p => p.toLowerCase() === userName.trim().toLowerCase())) {
        return [userName.trim(), ...people];
      }
    }
    return people;
  }, [people, userInvolved, userName]);

  const equalShare = useMemo(() => {
    if (!allPeople.length) return 0;
    return +(totalAmount / allPeople.length).toFixed(2);
  }, [totalAmount, allPeople]);

  const customTotal = useMemo(() =>
    Object.values(customAmts).reduce((a, b) => a + (+b || 0), 0),
  [customAmts]);

  const groupTotal = useMemo(() =>
    groupAmts.reduce((a, g) => a + (+g.amount || 0) * g.names.length, 0),
  [groupAmts]);

  const unassignedInGroup = useMemo(() => {
    const assigned = new Set(groupAmts.flatMap(g => g.names));
    return allPeople.filter(p => !assigned.has(p));
  }, [allPeople, groupAmts]);

  // ── Navigation ──
  const goNext = () => { setError(""); setStep(s => s + 1); };
  const goBack = () => { setError(""); setStep(s => s - 1); };

  // ── Step 0 ──
  const submitDetails = () => {
    if (!desc.trim())              return setError("Add a description.");
    if (!category)                 return setError("Select a category.");
    if (!baseAmt || +baseAmt <= 0) return setError("Enter a valid amount.");
    if (!paidBy.trim())            return setError("Enter who paid.");
    goNext();
  };

  // ── Step 1 ──
  const submitInvolvement = () => {
    if (userInvolved === null)              return setError("Please choose an option.");
    if (userInvolved && !userName.trim())  return setError("Enter your name.");
    goNext();
  };

  // ── Step 2 ──
  const addPerson = () => {
    const name = personInput.trim();
    if (!name) return;
    if (allPeople.find(p => p.toLowerCase() === name.toLowerCase()))
      return setError("Already added.");
    setPeople(prev => [...prev, name]);
    setPersonInput("");
    setError("");
  };

  const removePerson = (name) => {
    setPeople(prev => prev.filter(p => p !== name));
    setCustomAmts(prev => { const n = { ...prev }; delete n[name]; return n; });
    setGroupAmts(prev =>
      prev.map(g => ({ ...g, names: g.names.filter(n => n !== name) }))
          .filter(g => g.names.length > 0)
    );
  };

  const submitPeople = () => {
    if (allPeople.length < 1) return setError("Add at least one person.");
    setCustomAmts({});
    setGroupAmts([]);
    setNewGroupSel([]);
    setNewGroupAmt("");
    goNext();
  };

  // ── Step 3 ──
  const toggleGroupSel = (name) => {
    setNewGroupSel(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const addGroupEntry = () => {
    if (!newGroupSel.length)               return setError("Select at least one person.");
    if (!newGroupAmt || +newGroupAmt <= 0) return setError("Enter a valid amount.");
    setGroupAmts(prev => {
      const cleaned = prev
        .map(g => ({ ...g, names: g.names.filter(n => !newGroupSel.includes(n)) }))
        .filter(g => g.names.length > 0);
      return [...cleaned, { names: [...newGroupSel], amount: newGroupAmt }];
    });
    setNewGroupSel([]);
    setNewGroupAmt("");
    setError("");
  };

  const submitSplit = () => {
    if (splitMode === "custom") {
      const missing = allPeople.filter(p => !customAmts[p] || +customAmts[p] <= 0);
      if (missing.length) return setError(`Enter amounts for: ${missing.join(", ")}`);
      if (Math.abs(customTotal - totalAmount) > 0.05)
        return setError(`Amounts total ${fmt(customTotal)}, bill is ${fmt(totalAmount)}.`);
    }
    if (splitMode === "group") {
      if (unassignedInGroup.length)
        return setError(`Unassigned: ${unassignedInGroup.join(", ")}`);
      if (Math.abs(groupTotal - totalAmount) > 0.05)
        return setError(`Group total ${fmt(groupTotal)} ≠ bill ${fmt(totalAmount)}.`);
    }
    let splitMap = {};
    if (splitMode === "equal") {
      allPeople.forEach(p => { splitMap[p] = equalShare; });
    } else if (splitMode === "custom") {
      allPeople.forEach(p => { splitMap[p] = +(+customAmts[p]).toFixed(2); });
    } else {
      groupAmts.forEach(g => {
        g.names.forEach(n => { splitMap[n] = +(+g.amount).toFixed(2); });
      });
    }
    setConfirmedSplit(splitMap);
    setPaidStatus({});
    goNext();
  };

  // ── Supabase save ──
  const confirmSplit = async () => {
    setSaving(true);
    setSaveError("");

    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) throw new Error("Not authenticated. Please log in.");

      const myName = userInvolved && userName.trim() ? userName.trim().toLowerCase() : null;
      const initialPaid = Object.fromEntries(
        allPeople.map(p => [p, myName && p.toLowerCase() === myName])
      );

      const { data: splitRow, error: splitErr } = await supabase
        .from("splits")
        .insert({
          created_by:       user.id,
          description:      desc.trim(),
          category,
          base_amount:      +baseAmt,
          tax:              tax ? +tax : 0,
          tip:              tip ? +tip : 0,
          total_amount:     totalAmount,
          paid_by:          paidBy.trim(),
          split_mode:       splitMode,
          creator_involved: !!userInvolved,
          creator_name:     userInvolved ? userName.trim() : null,
          event_date:       eventDate || null, // ← NEW: store event date
        })
        .select("id")
        .single();

      if (splitErr) throw splitErr;
      const newSplitId = splitRow.id;

      const participantRows = allPeople.map(p => ({
        split_id:   newSplitId,
        name:       p,
        amount:     confirmedSplit[p],
        is_paid:    initialPaid[p],
        is_creator: myName ? p.toLowerCase() === myName : false,
      }));

      const { data: participantData, error: partErr } = await supabase
        .from("participants")
        .insert(participantRows)
        .select("id, name");

      if (partErr) throw partErr;

      const idMap = {};
      participantData.forEach(row => { idMap[row.name] = row.id; });

      setSplitDbId(newSplitId);
      setParticipantIds(idMap);
      setPaidStatus(initialPaid);
      setStep(s => s + 1);

    } catch (err) {
      console.error("Save failed:", err);
      setSaveError(err.message || "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle paid ──
  const togglePaid = async (name) => {
    const newVal = !paidStatus[name];
    setPaidStatus(prev => ({ ...prev, [name]: newVal }));

    const participantId = participantIds[name];
    if (!participantId) return;

    const { error } = await supabase
      .from("participants")
      .update({ is_paid: newVal })
      .eq("id", participantId);

    if (error) {
      console.error("Failed to update paid status:", error);
      setPaidStatus(prev => ({ ...prev, [name]: !newVal }));
    }
  };

  const allPaid   = allPeople.length > 0 && allPeople.every(p => paidStatus[p]);
  const paidCount = allPeople.filter(p => paidStatus[p]).length;

  const CatIcon = CATEGORIES.find(c => c.id === category)?.Icon || Package;

  return (
    <div className="sp-page">
      <div className="sp-bg-grid" />

      {/* Top bar */}
      <header className="sp-topbar">
        <button className="sp-back"
          onClick={() => step === 0 ? navigate("/") : goBack()}>
          <ArrowLeft size={13} />
          {step === 0 ? "home" : "back"}
        </button>
        <div className="sp-logo">⇄ split<em>&</em>settle</div>
        <div className="sp-dots">
          {STEPS.map((s, i) => (
            <div key={s} className={`sp-dot ${i === step ? "active" : i < step ? "done" : ""}`} />
          ))}
        </div>
      </header>

      <div className="sp-body">

        {/* ══ STEP 0 — DETAILS ══ */}
        {step === 0 && (
          <div className="sp-card anim-up">
            <div className="sp-step-tag"><CircleDollarSign size={11} /> 01 — details</div>
            <h2 className="sp-card-title">what's the <em>bill?</em></h2>

            <div className="sp-field-group">
              <label className="sp-label">description</label>
              <input className="sp-input" autoFocus
                placeholder="dinner at thalassery, cab to airport…"
                value={desc} onChange={e => setDesc(e.target.value)} />
            </div>

            <div className="sp-field-group">
              <label className="sp-label">category</label>
              <div className="sp-cat-grid">
                {CATEGORIES.map(c => (
                  <button key={c.id}
                    className={`sp-cat-btn ${category === c.id ? "active" : ""}`}
                    onClick={() => setCategory(c.id)}>
                    <c.Icon size={18} strokeWidth={1.8} />
                    <span className="sp-cat-label">{c.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="sp-row-2">
              <div className="sp-field-group">
                <label className="sp-label">base amount (₹)</label>
                <input className="sp-input" type="number" placeholder="0.00"
                  value={baseAmt} onChange={e => setBaseAmt(e.target.value)} />
              </div>
              <div className="sp-field-group">
                <label className="sp-label">paid by</label>
                <input className="sp-input" placeholder="who paid?"
                  value={paidBy} onChange={e => setPaidBy(e.target.value)} />
              </div>
            </div>

            {/* ── NEW: Event date field ── */}
            <div className="sp-field-group">
              <label className="sp-label">
                <CalendarDays size={10} style={{ display: "inline", marginRight: 4 }} />
                event date <span className="sp-label-optional">(optional)</span>
              </label>
              <input
                className="sp-input sp-date-input"
                type="date"
                value={eventDate}
                onChange={e => setEventDate(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
              />
              {eventDate && (
                <div className="sp-date-preview">
                  📅 {new Date(eventDate).toLocaleDateString("en-IN", {
                    weekday: "long", day: "numeric", month: "long", year: "numeric"
                  })}
                </div>
              )}
            </div>

            {(category === "bill" || category === "food") && (
              <div className="sp-extras">
                <div className="sp-extras-title">
                  <span>optional extras</span>
                  <span className="sp-extras-badge">tax &amp; tip</span>
                </div>
                <div className="sp-row-2">
                  <div className="sp-field-group">
                    <label className="sp-label">tax (%)</label>
                    <input className="sp-input" type="number" placeholder="e.g. 5"
                      value={tax} onChange={e => setTax(e.target.value)} />
                  </div>
                  <div className="sp-field-group">
                    <label className="sp-label">tip (%)</label>
                    <input className="sp-input" type="number" placeholder="e.g. 10"
                      value={tip} onChange={e => setTip(e.target.value)} />
                  </div>
                </div>
                {(tax || tip) && baseAmt && (
                  <div className="sp-breakdown">
                    <div className="sp-breakdown-row"><span>base</span><span>{fmt(+baseAmt)}</span></div>
                    {tax && <div className="sp-breakdown-row"><span>tax ({tax}%)</span><span>+ {fmt((+baseAmt) * (+tax / 100))}</span></div>}
                    {tip && <div className="sp-breakdown-row"><span>tip ({tip}%)</span><span>+ {fmt((+baseAmt) * (+tip / 100))}</span></div>}
                    <div className="sp-breakdown-row total"><span>total</span><span>{fmt(totalAmount)}</span></div>
                  </div>
                )}
              </div>
            )}

            {!tax && !tip && baseAmt && +baseAmt > 0 && (
              <div className="sp-total-pill">total: {fmt(totalAmount)}</div>
            )}

            {error && <div className="sp-error"><X size={12} /> {error}</div>}
            <button className="sp-btn-primary" onClick={submitDetails}>
              next <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* ══ STEP 1 — INVOLVEMENT ══ */}
        {step === 1 && (
          <div className="sp-card anim-up">
            <div className="sp-step-tag"><Users size={11} /> 02 — your role</div>
            <h2 className="sp-card-title">are you <em>splitting</em> too?</h2>

            <div className="sp-involve-context">
              <div className="sp-involve-pill">
                <CatIcon size={14} />
                <span>{desc}</span>
                <span className="sp-involve-amt">{fmt(totalAmount)}</span>
              </div>
              <p className="sp-involve-hint">
                did you also share this expense, or are you just tracking it for the group?
              </p>
            </div>

            <div className="sp-involve-options">
              <button
                className={`sp-involve-btn ${userInvolved === true ? "active yes" : ""}`}
                onClick={() => { setUserInvolved(true); setError(""); }}>
                <div className="sp-involve-icon yes"><UserCheck size={22} strokeWidth={1.6} /></div>
                <div className="sp-involve-text">
                  <span className="sp-involve-label">yes, include me</span>
                  <span className="sp-involve-sub">I'm part of the split</span>
                </div>
                {userInvolved === true && <Check size={15} className="sp-involve-check" />}
              </button>

              <button
                className={`sp-involve-btn ${userInvolved === false ? "active no" : ""}`}
                onClick={() => { setUserInvolved(false); setUserName(""); setError(""); }}>
                <div className="sp-involve-icon no"><UserX size={22} strokeWidth={1.6} /></div>
                <div className="sp-involve-text">
                  <span className="sp-involve-label">no, just tracking</span>
                  <span className="sp-involve-sub">only the people I add will split</span>
                </div>
                {userInvolved === false && <Check size={15} className="sp-involve-check" />}
              </button>
            </div>

            {userInvolved === true && (
              <div className="sp-field-group anim-up">
                <label className="sp-label">your name</label>
                <input className="sp-input" autoFocus
                  placeholder="what should we call you?"
                  value={userName}
                  onChange={e => setUserName(e.target.value)} />
              </div>
            )}

            {error && <div className="sp-error"><X size={12} /> {error}</div>}
            <button className="sp-btn-primary" onClick={submitInvolvement}>
              add people <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* ══ STEP 2 — PEOPLE ══ */}
        {step === 2 && (
          <div className="sp-card anim-up">
            <div className="sp-step-tag"><UserPlus size={11} /> 03 — people</div>
            <h2 className="sp-card-title">who's <em>splitting?</em></h2>

            {userInvolved && userName && (
              <div className="sp-you-badge">
                <div className="sp-avatar" style={{ "--av-hue": nameHue(userName) }}>{getInitials(userName)}</div>
                <span>you ({userName}) are included</span>
              </div>
            )}

            <div className="sp-add-row">
              <input className="sp-input" autoFocus
                placeholder="person's name…"
                value={personInput}
                onChange={e => setPersonInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addPerson()} />
              <button className="sp-add-btn" onClick={addPerson}>
                <UserPlus size={13} /> add
              </button>
            </div>

            {people.length === 0 && !userInvolved
              ? <div className="sp-empty">no one added yet</div>
              : (
                <div className="sp-people-list">
                  {people.map((p, i) => (
                    <div className="sp-person-row" key={p} style={{ animationDelay: `${i * 0.05}s` }}>
                      <div className="sp-avatar" style={{ "--av-hue": nameHue(p) }}>{getInitials(p)}</div>
                      <span className="sp-person-name">{p}</span>
                      <button className="sp-remove" onClick={() => removePerson(p)}><X size={13} /></button>
                    </div>
                  ))}
                </div>
              )
            }

            {allPeople.length > 0 && (
              <div className="sp-people-meta">
                <Users size={11} /> {allPeople.length} {allPeople.length === 1 ? "person" : "people"} · {fmt(totalAmount)} total · ~{fmt(totalAmount / allPeople.length)} each
              </div>
            )}

            {error && <div className="sp-error"><X size={12} /> {error}</div>}
            <button className="sp-btn-primary" onClick={submitPeople}>
              choose split <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* ══ STEP 3 — SPLIT ══ */}
        {step === 3 && (
          <div className="sp-card anim-up">
            <div className="sp-step-tag"><SplitSquareHorizontal size={11} /> 04 — split</div>
            <h2 className="sp-card-title">how to <em>split?</em></h2>

            <div className="sp-mode-tabs">
              {[
                { id: "equal",  label: "equal",    sub: "everyone pays same" },
                { id: "custom", label: "custom",   sub: "set each person's share" },
                { id: "group",  label: "by group", sub: "multiple people, one rate" },
              ].map(m => (
                <button key={m.id}
                  className={`sp-mode-tab ${splitMode === m.id ? "active" : ""}`}
                  onClick={() => { setSplitMode(m.id); setError(""); }}>
                  <span className="sp-mode-label">{m.label}</span>
                  <span className="sp-mode-sub">{m.sub}</span>
                </button>
              ))}
            </div>

            {splitMode === "equal" && (
              <div className="sp-equal-preview">
                <div className="sp-eq-amount">{fmt(equalShare)}</div>
                <div className="sp-eq-meta">per person · {allPeople.length} people · {fmt(totalAmount)} total</div>
                <div className="sp-chips-wrap">
                  {allPeople.map(p => (
                    <div className="sp-chip" key={p}>
                      <div className="sp-chip-av" style={{ "--av-hue": nameHue(p) }}>{getInitials(p)}</div>
                      <span>{p}</span>
                      <span className="sp-chip-amt">{fmt(equalShare)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {splitMode === "custom" && (
              <div className="sp-custom-section">
                {allPeople.map(p => (
                  <div className="sp-custom-row" key={p}>
                    <div className="sp-avatar sm" style={{ "--av-hue": nameHue(p) }}>{getInitials(p)}</div>
                    <span className="sp-custom-name">{p}</span>
                    <div className="sp-amt-input-wrap">
                      <span className="sp-rupee">₹</span>
                      <input className="sp-input tight" type="number" placeholder="0.00"
                        value={customAmts[p] || ""}
                        onChange={e => setCustomAmts(prev => ({ ...prev, [p]: e.target.value }))} />
                    </div>
                  </div>
                ))}
                <div className={`sp-running-total ${Math.abs(customTotal - totalAmount) < 0.05 ? "ok" : "off"}`}>
                  {fmt(customTotal)} / {fmt(totalAmount)}
                  {Math.abs(customTotal - totalAmount) < 0.05 ? "  ✓ balanced" : `  · ${fmt(Math.abs(customTotal - totalAmount))} off`}
                </div>
              </div>
            )}

            {splitMode === "group" && (
              <div className="sp-group-section">
                <p className="sp-group-hint">select people who share the same amount, set the amount, and assign.</p>
                {groupAmts.map((g, idx) => (
                  <div className="sp-group-entry" key={idx}>
                    <div className="sp-group-chips">
                      {g.names.map(n => (
                        <div className="sp-chip sm" key={n}>
                          <div className="sp-chip-av sm" style={{ "--av-hue": nameHue(n) }}>{getInitials(n)}</div>
                          <span>{n}</span>
                        </div>
                      ))}
                    </div>
                    <div className="sp-group-entry-right">
                      <span className="sp-group-amt">{fmt(+g.amount)} each</span>
                      <button className="sp-remove" onClick={() => setGroupAmts(prev => prev.filter((_, i) => i !== idx))}><X size={12} /></button>
                    </div>
                  </div>
                ))}
                {unassignedInGroup.length > 0 && (
                  <div className="sp-group-builder">
                    <div className="sp-gb-title">pick people <span className="sp-unassigned-badge">{unassignedInGroup.length} left</span></div>
                    <div className="sp-group-sel-grid">
                      {unassignedInGroup.map(p => (
                        <button key={p}
                          className={`sp-group-sel-btn ${newGroupSel.includes(p) ? "active" : ""}`}
                          onClick={() => toggleGroupSel(p)}>
                          <div className="sp-avatar sm" style={{ "--av-hue": nameHue(p) }}>{getInitials(p)}</div>
                          <span>{p}</span>
                        </button>
                      ))}
                    </div>
                    <div className="sp-group-amt-row">
                      <div className="sp-amt-input-wrap">
                        <span className="sp-rupee">₹</span>
                        <input className="sp-input tight" type="number" placeholder="amount each"
                          value={newGroupAmt} onChange={e => setNewGroupAmt(e.target.value)} />
                      </div>
                      <button className="sp-add-btn" onClick={addGroupEntry}>assign</button>
                    </div>
                  </div>
                )}
                <div className={`sp-running-total ${Math.abs(groupTotal - totalAmount) < 0.05 && !unassignedInGroup.length ? "ok" : "off"}`}>
                  {fmt(groupTotal)} / {fmt(totalAmount)}
                  {unassignedInGroup.length > 0 && `  · ${unassignedInGroup.length} unassigned`}
                </div>
              </div>
            )}

            {error && <div className="sp-error"><X size={12} /> {error}</div>}
            <button className="sp-btn-primary" onClick={submitSplit}>
              preview <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* ══ STEP 4 — PREVIEW ══ */}
        {step === 4 && confirmedSplit && (
          <div className="sp-card anim-up">
            <div className="sp-step-tag"><Eye size={11} /> 05 — preview</div>
            <h2 className="sp-card-title">looks <em>right?</em></h2>

            <div className="sp-preview-strip">
              {[
                { label: "bill",       val: desc },
                { label: "category",   val: CATEGORIES.find(c => c.id === category)?.label },
                { label: "total",      val: fmt(totalAmount), accent: true },
                { label: "paid by",   val: paidBy },
                { label: "split",      val: splitMode },
                eventDate && { label: "event date", val: new Date(eventDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) },
              ].filter(Boolean).map(item => (
                <div className="sp-ps-item" key={item.label}>
                  <span className="sp-ps-label">{item.label}</span>
                  <span className={`sp-ps-val ${item.accent ? "accent" : ""}`}>{item.val}</span>
                </div>
              ))}
            </div>

            <div className="sp-preview-list">
              {Object.entries(confirmedSplit).map(([name, amt], i) => {
                const isPayer = paidBy.trim().toLowerCase() === name.trim().toLowerCase();
                return (
                  <div className="sp-preview-row" key={name} style={{ animationDelay: `${i * 0.06}s` }}>
                    <div className="sp-preview-left">
                      <div className="sp-avatar" style={{ "--av-hue": nameHue(name) }}>{getInitials(name)}</div>
                      <div>
                        <div className="sp-preview-name">{name}</div>
                        <div className="sp-preview-sub">
                          {isPayer ? `paid · gets back ${fmt(totalAmount - amt)}` : `owes ${paidBy}`}
                        </div>
                      </div>
                    </div>
                    <span className={`sp-preview-amt ${isPayer ? "pos" : ""}`}>{fmt(amt)}</span>
                  </div>
                );
              })}
            </div>

            {(tax || tip) && (
              <div className="sp-preview-note">
                includes {[tax && `${tax}% tax`, tip && `${tip}% tip`].filter(Boolean).join(" + ")}
              </div>
            )}

            {saveError && (
              <div className="sp-error"><X size={12} /> {saveError}</div>
            )}

            <div className="sp-preview-actions">
              <button className="sp-btn-ghost"
                onClick={() => { setConfirmedSplit(null); setSaveError(""); setStep(0); }}
                disabled={saving}>
                <Pencil size={12} /> edit
              </button>
              <button className="sp-btn-primary" onClick={confirmSplit} disabled={saving}>
                {saving
                  ? <><Loader2 size={14} className="sp-spin" /> saving…</>
                  : <>confirm &amp; create <ChevronRight size={14} /></>
                }
              </button>
            </div>
          </div>
        )}

        {/* ══ STEP 5 — PAY ══ */}
        {step === 5 && (
          <div className="sp-card sp-card-pay anim-up">
            <div className="sp-pay-header">
              <div className="sp-pay-title-row">
                <div className="sp-pay-cat-badge">
                  <CatIcon size={16} strokeWidth={1.6} />
                </div>
                <div>
                  <div className="sp-pay-desc">{desc}</div>
                  <div className="sp-pay-meta">paid by <strong>{paidBy}</strong> · {fmt(totalAmount)}</div>
                </div>
              </div>
              {splitDbId && (
                <div className="sp-split-id-badge">
                  <span className="sp-split-id-label">split id</span>
                  <span className="sp-split-id-val">{splitDbId.slice(0, 8)}…</span>
                </div>
              )}
              <div className="sp-progress-wrap">
                <div className="sp-progress-bar">
                  <div className="sp-progress-fill"
                    style={{ width: `${allPeople.length ? (paidCount / allPeople.length) * 100 : 0}%` }} />
                </div>
                <span className="sp-progress-label">{paidCount}/{allPeople.length} paid</span>
              </div>
            </div>

            <div className="sp-pay-grid">
              {allPeople.map((p, i) => {
                const isPayer = paidBy.trim().toLowerCase() === p.trim().toLowerCase();
                const paid    = paidStatus[p];
                const isMe    = userInvolved && userName && p.toLowerCase() === userName.trim().toLowerCase();
                return (
                  <div key={p}
                    className={`sp-pay-card ${(paid || isPayer) && !isMe ? "settled" : ""} ${paid && isMe ? "settled-me" : ""} ${isMe ? "is-me" : ""}`}
                    style={{ animationDelay: `${i * 0.06}s` }}>
                    <div className="sp-pay-card-top">
                      <div className={`sp-avatar ${paid || isPayer ? "av-paid" : ""}`}
                        style={{ "--av-hue": nameHue(p) }}>
                        {getInitials(p)}
                      </div>
                      {isMe && <span className="sp-me-tag">you</span>}
                      {isPayer && <span className="sp-payer-tag"><Wallet size={10} /> payer</span>}
                    </div>
                    <div className="sp-pay-card-name">{p}</div>
                    <div className="sp-pay-card-amt">{fmt(confirmedSplit?.[p] || 0)}</div>
                    <div className="sp-pay-card-status">
                      {isPayer ? "paid bill" : paid ? "settled ✓" : `owes ${paidBy}`}
                    </div>
                    {(!isPayer || isMe) && (
                      <button
                        className={`sp-pay-card-btn ${paid ? "done" : ""}`}
                        onClick={() => togglePaid(p)}>
                        {paid ? <><Check size={11} /> paid</> : "mark paid"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {allPaid && (
              <div className="sp-all-done">
                <span className="sp-done-emoji">🎉</span>
                <div>
                  <div className="sp-done-title">all settled up!</div>
                  <div className="sp-done-sub">everyone has paid their share</div>
                </div>
                <button className="sp-btn-ghost sm" onClick={() => navigate("/")}>
                  <ArrowLeft size={12} /> home
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}