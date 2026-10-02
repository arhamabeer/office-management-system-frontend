import type { RequestStatus, RequestRouteTarget, RequestTimelineAction } from '@ems/types';

/** User-facing label for a request status. */
export const STATUS_LABEL: Record<RequestStatus, string> = {
  Submitted: 'Awaiting manager',
  Forwarded: 'Forwarded',
  Resolved: 'Resolved',
  Rejected: 'Rejected',
};

/** User-facing label for a timeline action (incl. the initial 'submitted'). */
export const TIMELINE_ACTION_LABEL: Record<RequestTimelineAction, string> = {
  submitted: 'Filed',
  resolve: 'Resolved',
  reject: 'Rejected',
  forward_operations: 'Forwarded to Operations',
  forward_admin: 'Forwarded to Admin',
  forward_both: 'Forwarded to Operations & Admin',
};

export function routedToLabel(t: RequestRouteTarget[]): string {
  return t.length ? t.join(' & ') : '';
}
