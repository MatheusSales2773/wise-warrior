# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Plan/Checks)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 - Assert the exact reason string a domain rule returns, not just that it is not null
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `users` · harmful: 0
- features: assinatura-premium-s1
- evidence: C8 for-sale.spec.ts (users)
- last seen: 2026-11-08T14:37:25Z

### L-002 - Prove a sprite layer through the component that renders it, not only through the lookup table
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `frontend` · harmful: 0
- features: assinatura-premium-s1
- evidence: C11 character-catalog.test.tsx (frontend)
- last seen: 2026-11-08T14:37:25Z

### L-003 - When a lookup filters on two keys, prove each key with a case where only the other one matches
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `billing` · harmful: 0
- features: assinatura-premium-s3
- evidence: C12 billing-webhook.integration.test.ts (billing)
- last seen: 2026-11-08T16:24:09Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
