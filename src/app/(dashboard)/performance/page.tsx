'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GoalDTO, ReviewDTO, GoalCategoryDTO, ReviewCycleDTO, PerformancePolicyDTO, EmployeeProfileDTO, GoalStatus } from '@ems/types';
import { performanceApi, employeesApi } from '@/lib/auth';
import { useAuth } from '@/context/AuthContext';
import styles from './performance.module.css';

type Tab = 'goals' | 'reviews' | 'team' | 'settings';

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}
function goalBadge(s: GoalStatus): string {
  return s === 'Completed' ? styles.bCompleted : s === 'Active' ? styles.bActive : s === 'PendingApproval' ? styles.bPending : s === 'Rejected' ? styles.bRejected : styles.bDraft;
}
function goalLabel(s: GoalStatus): string {
  return s === 'PendingApproval' ? 'Awaiting approval' : s;
}

const emptyGoal = { title: '', description: '', categoryId: '', cycleId: '', dueDate: '', weight: '' };
const emptyReview = { userId: '', cycleId: '', rating: '', comments: '', strengths: '', improvements: '' };

export default function PerformancePage() {
  const { user, isOrgAdmin } = useAuth();
  const canTeam = !!user && (user.accountType === 'Owner' || ['Admin', 'Manager', 'Lead'].includes(user.orgRole));

  const [tab, setTab] = useState<Tab>('goals');
  const [goals, setGoals] = useState<GoalDTO[]>([]);
  const [myReviews, setMyReviews] = useState<ReviewDTO[]>([]);
  const [categories, setCategories] = useState<GoalCategoryDTO[]>([]);
  const [cycles, setCycles] = useState<ReviewCycleDTO[]>([]);
  const [policy, setPolicy] = useState<PerformancePolicyDTO | null>(null);
  const [teamGoals, setTeamGoals] = useState<GoalDTO[]>([]);
  const [teamReviews, setTeamReviews] = useState<ReviewDTO[]>([]);
  const [teamEmployees, setTeamEmployees] = useState<EmployeeProfileDTO[]>([]);

  const [goalForm, setGoalForm] = useState({ ...emptyGoal });
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [reviewForm, setReviewForm] = useState({ ...emptyReview });
  const [newCat, setNewCat] = useState({ name: '', code: '' });
  const [newCycle, setNewCycle] = useState({ name: '', startDate: '', endDate: '' });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const loadGoals = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [g, cats, cys] = await Promise.all([performanceApi.goals('mine'), performanceApi.categories(), performanceApi.cycles()]);
      setGoals(g); setCategories(cats); setCycles(cys);
    } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }, []);
  const loadReviews = useCallback(async () => {
    setLoading(true); setError(null);
    try { setMyReviews(await performanceApi.reviews('mine')); } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }, []);
  const loadTeam = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [tg, tr, cys, pol, emps] = await Promise.all([
        performanceApi.goals('team'), performanceApi.reviews('team'), performanceApi.cycles(), performanceApi.policy(), employeesApi.list({ pageSize: 100 }),
      ]);
      setTeamGoals(tg); setTeamReviews(tr); setCycles(cys); setPolicy(pol);
      setTeamEmployees(emps.items.filter((e) => e.userId !== user?.id));
    } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }, [user?.id]);
  const loadSettings = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [cats, cys, pol] = await Promise.all([performanceApi.categories(), performanceApi.cycles(), performanceApi.policy()]);
      setCategories(cats); setCycles(cys); setPolicy(pol);
    } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === 'goals') void loadGoals();
    if (tab === 'reviews') void loadReviews();
    if (tab === 'team') void loadTeam();
    if (tab === 'settings') void loadSettings();
  }, [tab, loadGoals, loadReviews, loadTeam, loadSettings]);

  const activeCategories = useMemo(() => categories.filter((c) => c.active), [categories]);
  const openCycles = useMemo(() => cycles.filter((c) => c.status === 'Open'), [cycles]);
  const ratingLevels = policy?.ratingLevels ?? [];
  const ratingLabel = (v?: number) => (v == null ? '—' : ratingLevels.find((l) => l.value === v)?.label ?? String(v));

  const resetGoalForm = () => { setGoalForm({ ...emptyGoal }); setEditingGoalId(null); setShowGoalForm(false); };

  const saveGoal = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setInfo(null);
    const body = {
      title: goalForm.title.trim(),
      ...(goalForm.description.trim() ? { description: goalForm.description.trim() } : {}),
      ...(goalForm.categoryId ? { categoryId: goalForm.categoryId } : {}),
      ...(goalForm.cycleId ? { cycleId: goalForm.cycleId } : {}),
      ...(goalForm.dueDate ? { dueDate: goalForm.dueDate } : {}),
      ...(goalForm.weight ? { weight: Number(goalForm.weight) } : {}),
    };
    try {
      if (editingGoalId) await performanceApi.updateGoal(editingGoalId, body);
      else await performanceApi.createGoal(body);
      setInfo(editingGoalId ? 'Goal updated.' : 'Goal created — submit it when ready.');
      resetGoalForm();
      await loadGoals();
    } catch (err) { setError(errMsg(err)); }
  };

  const editGoal = (g: GoalDTO) => {
    setEditingGoalId(g.id);
    setGoalForm({ title: g.title, description: g.description ?? '', categoryId: g.categoryId ?? '', cycleId: g.cycleId ?? '', dueDate: g.dueDate ?? '', weight: g.weight != null ? String(g.weight) : '' });
    setShowGoalForm(true);
  };

  const goalAction = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id); setError(null);
    try {
      await fn();
      await (tab === 'team' ? loadTeam() : tab === 'settings' ? loadSettings() : loadGoals());
    } catch (e) { setError(errMsg(e)); } finally { setBusy(null); }
  };

  const saveReview = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setInfo(null);
    try {
      await performanceApi.upsertReview({
        userId: reviewForm.userId,
        cycleId: reviewForm.cycleId,
        ...(reviewForm.rating ? { rating: Number(reviewForm.rating) } : {}),
        ...(reviewForm.comments.trim() ? { comments: reviewForm.comments.trim() } : {}),
        ...(reviewForm.strengths.trim() ? { strengths: reviewForm.strengths.trim() } : {}),
        ...(reviewForm.improvements.trim() ? { improvements: reviewForm.improvements.trim() } : {}),
      });
      setInfo('Review saved as a draft — share it when ready.');
      setReviewForm({ ...emptyReview });
      await loadTeam();
    } catch (err) { setError(errMsg(err)); }
  };

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    try { await performanceApi.createCategory({ name: newCat.name.trim(), code: newCat.code.trim() }); setNewCat({ name: '', code: '' }); await loadSettings(); } catch (err) { setError(errMsg(err)); }
  };
  const addCycle = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    try { await performanceApi.createCycle({ name: newCycle.name.trim(), startDate: newCycle.startDate, endDate: newCycle.endDate }); setNewCycle({ name: '', startDate: '', endDate: '' }); await loadSettings(); } catch (err) { setError(errMsg(err)); }
  };

  const pendingTeamGoals = useMemo(() => teamGoals.filter((g) => g.status === 'PendingApproval'), [teamGoals]);

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Performance</h1>
        <p className={styles.subtitle}>Set goals, track progress, and see your review each cycle.</p>
      </div>

      {error && <div className={`${styles.banner} ${styles.bannerError}`}>{error}</div>}
      {info && <div className={`${styles.banner} ${styles.bannerInfo}`}>{info}</div>}

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'goals' ? styles.tabActive : ''}`} aria-pressed={tab === 'goals'} onClick={() => setTab('goals')}>My goals</button>
        <button className={`${styles.tab} ${tab === 'reviews' ? styles.tabActive : ''}`} aria-pressed={tab === 'reviews'} onClick={() => setTab('reviews')}>My reviews</button>
        {canTeam && <button className={`${styles.tab} ${tab === 'team' ? styles.tabActive : ''}`} aria-pressed={tab === 'team'} onClick={() => setTab('team')}>Team</button>}
        {isOrgAdmin && <button className={`${styles.tab} ${tab === 'settings' ? styles.tabActive : ''}`} aria-pressed={tab === 'settings'} onClick={() => setTab('settings')}>Settings</button>}
      </div>

      {/* ---------------- My goals ---------------- */}
      {tab === 'goals' && (
        <>
          <div className={styles.toolbar}>
            <div className={styles.spacer} />
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => (showGoalForm ? resetGoalForm() : setShowGoalForm(true))}>{showGoalForm ? 'Cancel' : '+ New goal'}</button>
          </div>

          {showGoalForm && (
            <form className={styles.card} onSubmit={saveGoal}>
              <div className={styles.cardTitle}>{editingGoalId ? 'Edit goal' : 'New goal'}</div>
              <div className={styles.formGrid}>
                <label className={`${styles.formField} ${styles.full}`}>Title<input className={styles.input} required maxLength={140} value={goalForm.title} onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })} /></label>
                <label className={`${styles.formField} ${styles.full}`}>Description<textarea className={styles.textarea} maxLength={2000} value={goalForm.description} onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })} /></label>
                <label className={styles.formField}>Category<select className={styles.select} value={goalForm.categoryId} onChange={(e) => setGoalForm({ ...goalForm, categoryId: e.target.value })}><option value="">—</option>{activeCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                <label className={styles.formField}>Cycle<select className={styles.select} value={goalForm.cycleId} onChange={(e) => setGoalForm({ ...goalForm, cycleId: e.target.value })}><option value="">—</option>{openCycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                <label className={styles.formField}>Due date<input className={styles.input} type="date" value={goalForm.dueDate} onChange={(e) => setGoalForm({ ...goalForm, dueDate: e.target.value })} /></label>
                <label className={styles.formField}>Weight %<input className={styles.input} type="number" min="0" max="100" value={goalForm.weight} onChange={(e) => setGoalForm({ ...goalForm, weight: e.target.value })} /></label>
              </div>
              <div className={styles.formActions}><button className={`${styles.btn} ${styles.btnPrimary}`} type="submit">{editingGoalId ? 'Save goal' : 'Create goal'}</button></div>
            </form>
          )}

          {loading ? <div className={styles.empty}>Loading…</div> : goals.length ? (
            <div className={styles.cardList}>
              {goals.map((g) => (
                <div key={g.id} className={styles.goalCard}>
                  <div className={styles.goalHead}>
                    <div>
                      <div className={styles.goalTitle}>{g.title}</div>
                      <div className={styles.goalMeta}>{[g.categoryName, g.cycleName, g.dueDate ? `due ${g.dueDate}` : null].filter(Boolean).join(' · ') || '—'}</div>
                    </div>
                    <span className={`${styles.badge} ${goalBadge(g.status)}`}>{goalLabel(g.status)}</span>
                  </div>
                  {g.description ? <p className={styles.goalDesc}>{g.description}</p> : null}
                  {g.status === 'Active' || g.status === 'Completed' ? (
                    <div className={styles.progressRow}>
                      <div className={styles.progressTrack}><div className={styles.progressFill} style={{ width: `${g.progress}%` }} /></div>
                      <span className={styles.progressPct}>{g.progress}%</span>
                    </div>
                  ) : null}
                  {g.decisionNote && g.status === 'Rejected' ? <p className={styles.goalNote}>Manager: “{g.decisionNote}”</p> : null}
                  <div className={styles.formActions}>
                    {(g.status === 'Draft' || g.status === 'Rejected') && <>
                      <button className={`${styles.btn} ${styles.btnPrimary}`} disabled={busy === g.id} onClick={() => goalAction(g.id, () => performanceApi.submitGoal(g.id))}>Submit for approval</button>
                      <button className={styles.btn} disabled={busy === g.id} onClick={() => editGoal(g)}>Edit</button>
                    </>}
                    {g.status === 'Active' && <GoalProgress goal={g} busy={busy === g.id} onSave={(p) => goalAction(g.id, () => performanceApi.updateGoal(g.id, { progress: p }))} onComplete={() => goalAction(g.id, () => performanceApi.completeGoal(g.id))} />}
                  </div>
                </div>
              ))}
            </div>
          ) : <div className={styles.empty}>No goals yet — create one to get started.</div>}
        </>
      )}

      {/* ---------------- My reviews ---------------- */}
      {tab === 'reviews' && (
        loading ? <div className={styles.empty}>Loading…</div> : myReviews.length ? (
          <div className={styles.cardList}>
            {myReviews.map((r) => (
              <div key={r.id} className={styles.goalCard}>
                <div className={styles.goalHead}>
                  <div><div className={styles.goalTitle}>{r.cycleName ?? 'Review'}</div><div className={styles.goalMeta}>by {r.reviewerName ?? '—'}{r.sharedAt ? ` · ${r.sharedAt.slice(0, 10)}` : ''}</div></div>
                  {r.rating != null && <span className={styles.ratingPill}>{ratingLabelFromReview(r)}</span>}
                </div>
                <div className={styles.reviewBody}>
                  {r.comments && <div><div className={styles.reviewLabel}>Summary</div>{r.comments}</div>}
                  {r.strengths && <div><div className={styles.reviewLabel}>Strengths</div>{r.strengths}</div>}
                  {r.improvements && <div><div className={styles.reviewLabel}>Areas to improve</div>{r.improvements}</div>}
                </div>
              </div>
            ))}
          </div>
        ) : <div className={styles.empty}>No reviews have been shared with you yet.</div>
      )}

      {/* ---------------- Team ---------------- */}
      {tab === 'team' && canTeam && (
        <>
          <h2 className={styles.cardTitle}>Goals awaiting your approval</h2>
          {loading ? <div className={styles.empty}>Loading…</div> : pendingTeamGoals.length ? (
            <div className={styles.cardList}>
              {pendingTeamGoals.map((g) => (
                <div key={g.id} className={styles.goalCard}>
                  <div className={styles.goalHead}>
                    <div><div className={styles.goalTitle}>{g.title}</div><div className={styles.goalMeta}>{g.employeeName ?? '—'}{g.categoryName ? ` · ${g.categoryName}` : ''}{g.cycleName ? ` · ${g.cycleName}` : ''}</div></div>
                    <span className={`${styles.badge} ${styles.bPending}`}>Awaiting approval</span>
                  </div>
                  {g.description ? <p className={styles.goalDesc}>{g.description}</p> : null}
                  <div className={styles.formActions}>
                    <button className={`${styles.btn} ${styles.btnGhostOk}`} disabled={busy === g.id} onClick={() => goalAction(g.id, () => performanceApi.approveGoal(g.id))}>Approve</button>
                    <button className={`${styles.btn} ${styles.btnGhostDanger}`} disabled={busy === g.id} onClick={() => goalAction(g.id, () => performanceApi.rejectGoal(g.id))}>Send back</button>
                  </div>
                </div>
              ))}
            </div>
          ) : <div className={styles.empty}>No goals awaiting approval.</div>}

          <form className={styles.card} onSubmit={saveReview} style={{ marginTop: 'var(--space-6)' }}>
            <div className={styles.cardTitle}>Write a review</div>
            <div className={styles.formGrid}>
              <label className={styles.formField}>Employee<select className={styles.select} required value={reviewForm.userId} onChange={(e) => setReviewForm({ ...reviewForm, userId: e.target.value })}><option value="">Select…</option>{teamEmployees.map((emp) => <option key={emp.userId} value={emp.userId}>{emp.fullName}</option>)}</select></label>
              <label className={styles.formField}>Cycle<select className={styles.select} required value={reviewForm.cycleId} onChange={(e) => setReviewForm({ ...reviewForm, cycleId: e.target.value })}><option value="">Select…</option>{cycles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <label className={styles.formField}>Rating<select className={styles.select} value={reviewForm.rating} onChange={(e) => setReviewForm({ ...reviewForm, rating: e.target.value })}><option value="">—</option>{ratingLevels.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</select></label>
              <label className={`${styles.formField} ${styles.full}`}>Summary<textarea className={styles.textarea} value={reviewForm.comments} onChange={(e) => setReviewForm({ ...reviewForm, comments: e.target.value })} /></label>
              <label className={`${styles.formField} ${styles.full}`}>Strengths<textarea className={styles.textarea} value={reviewForm.strengths} onChange={(e) => setReviewForm({ ...reviewForm, strengths: e.target.value })} /></label>
              <label className={`${styles.formField} ${styles.full}`}>Areas to improve<textarea className={styles.textarea} value={reviewForm.improvements} onChange={(e) => setReviewForm({ ...reviewForm, improvements: e.target.value })} /></label>
            </div>
            <div className={styles.formActions}><button className={`${styles.btn} ${styles.btnPrimary}`} type="submit">Save draft</button></div>
          </form>

          <h2 className={styles.cardTitle}>Reviews you&rsquo;ve written</h2>
          {teamReviews.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>Employee</th><th>Cycle</th><th>Rating</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {teamReviews.map((r) => (
                    <tr key={r.id}>
                      <td>{r.employeeName ?? '—'}</td>
                      <td>{r.cycleName ?? '—'}</td>
                      <td>{r.rating != null ? ratingLabelFromReview(r) : '—'}</td>
                      <td><span className={`${styles.badge} ${r.status === 'Shared' ? styles.bShared : styles.bDraft}`}>{r.status}</span></td>
                      <td>{r.status === 'Draft' && <button className={`${styles.btn} ${styles.btnPrimary}`} disabled={busy === r.id} onClick={() => goalAction(r.id, () => performanceApi.shareReview(r.id))}>Share</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className={styles.empty}>You haven&rsquo;t written any reviews yet.</div>}
        </>
      )}

      {/* ---------------- Settings ---------------- */}
      {tab === 'settings' && isOrgAdmin && (
        <>
          <form className={styles.card} onSubmit={addCycle}>
            <div className={styles.cardTitle}>Review cycles</div>
            <div className={styles.formActions}>
              <input className={styles.input} placeholder="Name (e.g. H1 2027)" required value={newCycle.name} onChange={(e) => setNewCycle({ ...newCycle, name: e.target.value })} />
              <input className={styles.input} type="date" aria-label="Start date" required value={newCycle.startDate} onChange={(e) => setNewCycle({ ...newCycle, startDate: e.target.value })} />
              <input className={styles.input} type="date" aria-label="End date" required value={newCycle.endDate} onChange={(e) => setNewCycle({ ...newCycle, endDate: e.target.value })} />
              <button className={`${styles.btn} ${styles.btnPrimary}`} type="submit">Add cycle</button>
            </div>
            {cycles.length > 0 && (
              <div className={styles.tableWrap} style={{ marginTop: 'var(--space-3)' }}>
                <table className={styles.table}>
                  <thead><tr><th>Cycle</th><th>Window</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {cycles.map((c) => (
                      <tr key={c.id}>
                        <td>{c.name}</td><td>{c.startDate} → {c.endDate}</td>
                        <td><span className={`${styles.badge} ${c.status === 'Open' ? styles.bActive : styles.bDraft}`}>{c.status}</span></td>
                        <td>{c.status === 'Open' && <button className={styles.btn} disabled={busy === c.id} onClick={() => goalAction(c.id, () => performanceApi.updateCycle(c.id, { status: 'Closed' }))}>Close</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </form>

          <form className={styles.card} onSubmit={addCategory}>
            <div className={styles.cardTitle}>Goal categories</div>
            <div className={styles.formActions}>
              <input className={styles.input} placeholder="Name" required value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} />
              <input className={styles.input} placeholder="CODE" required value={newCat.code} onChange={(e) => setNewCat({ ...newCat, code: e.target.value })} />
              <button className={`${styles.btn} ${styles.btnPrimary}`} type="submit">Add</button>
            </div>
            <div className={styles.toolbar} style={{ marginTop: 'var(--space-2)' }}>
              {categories.map((c) => <span key={c.id} className={`${styles.badge} ${c.active ? styles.bActive : styles.bDraft}`}>{c.name}</span>)}
            </div>
          </form>

          {policy && (
            <div className={styles.card}>
              <div className={styles.cardTitle}>Rating scale</div>
              <div className={styles.toolbar}>
                {policy.ratingLevels.map((l) => <span key={l.value} className={styles.ratingPill}>{l.value} · {l.label}</span>)}
              </div>
              <p className={styles.subtitle}>Managers rate against this scale. (Editing the scale values is available via the API.)</p>
            </div>
          )}
        </>
      )}
    </>
  );

  function ratingLabelFromReview(r: ReviewDTO): string {
    return r.ratingLabel ?? ratingLabel(r.rating);
  }
}

/** Inline progress editor for an Active goal. */
function GoalProgress({ goal, busy, onSave, onComplete }: { goal: GoalDTO; busy: boolean; onSave: (p: number) => void; onComplete: () => void }) {
  const [p, setP] = useState(goal.progress);
  return (
    <>
      <input className={styles.progressInput} type="number" min="0" max="100" value={p} onChange={(e) => setP(Math.max(0, Math.min(100, Number(e.target.value))))} aria-label="Progress %" />
      <button className={styles.btn} disabled={busy} onClick={() => onSave(p)}>Save progress</button>
      <button className={`${styles.btn} ${styles.btnGhostOk}`} disabled={busy} onClick={onComplete}>Mark complete</button>
    </>
  );
}
