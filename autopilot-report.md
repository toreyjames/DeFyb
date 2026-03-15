# DeFyb Wiggum Autopilot Report

Generated: 2026-03-15T14:06:02.375Z
Live status: **degraded** (HTTP 200; content markers: missing)

## Verification
- [PASS] Practice login component exists — Found PracticeLogin
- [PASS] Team login component exists — Found TeamLogin
- [PASS] Revenue capture tool exists — Found RevenueCaptureTool
- [PASS] Auth error normalization exists — Found normalizeAuthError
- [PASS] Landing CTA points to tool — Found tool CTA text
- [FAIL] Live site reachable with expected core copy — HTTP 200; content markers: missing

Summary: 5 passed, 1 failed.

## Priority Backlog (Doctor Ease-of-Use)
- P2: Add explicit /team login route in addition to hidden multi-click
  Why: Hidden access is brittle for support and QA.
  Expected outcome: Faster team access troubleshooting without affecting public UX.
