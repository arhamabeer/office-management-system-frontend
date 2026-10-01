'use client';

import { useCallback, useEffect, useState } from 'react';
import type { TeamDTO, EmployeeProfileDTO } from '@ems/types';
import { teamsApi, employeesApi } from '@/lib/auth';
import { useAuth } from '@/context/AuthContext';
import styles from './teams.module.css';

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

export default function TeamsPage() {
  const { user } = useAuth();
  const isOrgAdmin = !!user && (user.accountType === 'Owner' || user.orgRole === 'Admin');
  const canCreate = isOrgAdmin || user?.orgRole === 'Manager';

  const [teams, setTeams] = useState<TeamDTO[]>([]);
  const [people, setPeople] = useState<EmployeeProfileDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [pick, setPick] = useState<Record<string, string>>({}); // teamId -> userId to add
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [t, emp] = await Promise.all([teamsApi.list(), employeesApi.list({ pageSize: 100 })]);
      setTeams(t);
      setPeople(emp.items);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const replace = (t: TeamDTO) => setTeams((ts) => ts.map((x) => (x.id === t.id ? t : x)));

  const createTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    setInfo(null);
    try {
      const t = await teamsApi.create({ name: newName.trim(), description: newDesc.trim() || undefined });
      setTeams((ts) => [t, ...ts]);
      setNewName('');
      setNewDesc('');
      setInfo(`Team “${t.name}” created.`);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setCreating(false);
    }
  };

  const removeTeam = async (t: TeamDTO) => {
    if (!window.confirm(`Delete team “${t.name}”? This cannot be undone.`)) return;
    setBusy(t.id);
    setError(null);
    try {
      await teamsApi.remove(t.id);
      setTeams((ts) => ts.filter((x) => x.id !== t.id));
      setInfo(`Team “${t.name}” deleted.`);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const addMember = async (teamId: string) => {
    const userId = pick[teamId];
    if (!userId) return;
    setBusy(teamId);
    setError(null);
    try {
      replace(await teamsApi.addMember(teamId, userId));
      setPick((p) => ({ ...p, [teamId]: '' }));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const removeMember = async (teamId: string, userId: string) => {
    setBusy(teamId);
    setError(null);
    try {
      replace(await teamsApi.removeMember(teamId, userId));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  const setLeads = async (team: TeamDTO, leadIds: string[]) => {
    setBusy(team.id);
    setError(null);
    try {
      replace(await teamsApi.update(team.id, { leadIds }));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Teams</h1>
          <p className={styles.subtitle}>
            Group people into teams. A team&apos;s leads (with owners/admins) can add or remove members; a
            person can be in multiple teams. Leading a team lets you see their attendance and approvals.
          </p>
        </div>
      </div>

      {error && <div className={`${styles.banner} ${styles.bannerError}`}>{error}</div>}
      {info && <div className={`${styles.banner} ${styles.bannerInfo}`}>{info}</div>}

      {canCreate && (
        <form className={styles.card} onSubmit={createTeam}>
          <div className={styles.cardTitle}>Create a team</div>
          <div className={styles.createRow}>
            <input
              className={styles.input}
              placeholder="Team name"
              aria-label="Team name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={80}
              required
            />
            <input
              className={styles.input}
              placeholder="Description (optional)"
              aria-label="Team description"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              maxLength={500}
            />
            <button className={`${styles.btn} ${styles.btnPrimary}`} type="submit" disabled={creating}>
              {creating ? 'Creating…' : 'Create team'}
            </button>
          </div>
        </form>
      )}

      {loaded && teams.length === 0 && (
        <div className={styles.card}>
          <div className={styles.empty}>
            {canCreate ? 'No teams yet. Create your first team above.' : 'You are not part of any team yet.'}
          </div>
        </div>
      )}

      <div className={styles.grid}>
        {teams.map((team) => {
          const leadIds = new Set(team.leads.map((l) => l.userId));
          const memberIds = new Set(team.members.map((m) => m.userId));
          const available = people.filter((p) => !memberIds.has(p.userId));
          return (
            <div className={styles.teamCard} key={team.id}>
              <div className={styles.teamHead}>
                <div>
                  <div className={styles.teamName}>{team.name}</div>
                  {team.description && <div className={styles.teamDesc}>{team.description}</div>}
                </div>
                {isOrgAdmin && (
                  <button
                    className={`${styles.btn} ${styles.btnGhostDanger}`}
                    disabled={busy === team.id}
                    onClick={() => removeTeam(team)}
                  >
                    Delete
                  </button>
                )}
              </div>

              <div className={styles.sectionLabel}>Leads</div>
              <div className={styles.chips}>
                {team.leads.length ? (
                  team.leads.map((l) => (
                    <span className={`${styles.chip} ${styles.chipLead}`} key={l.userId}>
                      {l.name}
                      {team.canManage && team.leads.length > 1 && (
                        <button
                          className={styles.chipX}
                          aria-label={`Remove ${l.name} as lead`}
                          disabled={busy === team.id}
                          onClick={() => setLeads(team, team.leads.filter((x) => x.userId !== l.userId).map((x) => x.userId))}
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))
                ) : (
                  <span className={styles.muted}>No leads</span>
                )}
              </div>

              <div className={styles.sectionLabel}>Members ({team.memberCount})</div>
              <div className={styles.memberList}>
                {team.members.length ? (
                  team.members.map((m) => (
                    <div className={styles.memberRow} key={m.userId}>
                      <div className={styles.memberInfo}>
                        <span className={styles.memberName}>{m.name}</span>
                        <span className={styles.memberEmail}>{m.designation ? `${m.designation} · ` : ''}{m.email}</span>
                      </div>
                      {team.canManage && (
                        <span className={styles.memberActions}>
                          {!leadIds.has(m.userId) && (
                            <button
                              className={styles.linkBtn}
                              disabled={busy === team.id}
                              onClick={() => setLeads(team, [...team.leads.map((x) => x.userId), m.userId])}
                            >
                              Make lead
                            </button>
                          )}
                          <button
                            className={`${styles.linkBtn} ${styles.linkDanger}`}
                            disabled={busy === team.id}
                            onClick={() => removeMember(team.id, m.userId)}
                          >
                            Remove
                          </button>
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <div className={styles.muted}>No members yet.</div>
                )}
              </div>

              {team.canManage && (
                <div className={styles.addRow}>
                  <select
                    className={styles.input}
                    aria-label={`Add member to ${team.name}`}
                    value={pick[team.id] ?? ''}
                    onChange={(e) => setPick((p) => ({ ...p, [team.id]: e.target.value }))}
                  >
                    <option value="">Add a member…</option>
                    {available.map((p) => (
                      <option key={p.userId} value={p.userId}>
                        {p.fullName} — {p.email}
                      </option>
                    ))}
                  </select>
                  <button
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    disabled={busy === team.id || !pick[team.id]}
                    onClick={() => addMember(team.id)}
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
