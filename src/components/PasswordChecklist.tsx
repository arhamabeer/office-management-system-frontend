'use client';

import { PASSWORD_RULES } from '@ems/validation';

/** True when a password satisfies every strength rule (mirrors the server). */
export function passwordValid(value: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(value));
}

/** A live checklist of the password strength rules, each ticked as it's met. */
export default function PasswordChecklist({ value }: { value: string }) {
  return (
    <ul
      aria-label="Password requirements"
      style={{ listStyle: 'none', margin: '6px 0 0', padding: 0, display: 'grid', gap: 2, fontSize: 12 }}
    >
      {PASSWORD_RULES.map((r) => {
        const ok = r.test(value);
        return (
          <li
            key={r.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: ok ? 'var(--color-success)' : 'var(--color-text-muted)',
            }}
          >
            <span aria-hidden style={{ width: 12, display: 'inline-block' }}>{ok ? '✓' : '○'}</span>
            {r.label}
          </li>
        );
      })}
    </ul>
  );
}
