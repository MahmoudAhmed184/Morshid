# Proposed `CONTEXT.md` glossary update

Apply only the domain-language changes below. Keep implementation details in the feature design, not in `CONTEXT.md`.

## Replace `Tutoring Allowance`

**Tutoring Allowance**:
The number of distinct Student turns a Student may admit for AI tutoring in one Course during one Policy Day. Replays and retries of the same Student turn do not consume another unit.
_Avoid_: Request quota, provider quota

## Replace `Review Allowance`

**Review Allowance**:
The number of manual Review Requests a Student may make for one Course during one Policy Day. Automatic review triggers do not consume it.
_Avoid_: Flag quota

## Add `Review Request`

**Review Request**:
A Student-initiated request for Instructor review of one Assistant message.
_Avoid_: Student flag

## Add `AI Readiness`

**AI Readiness**:
Morshid's locally derived ability to admit the AI work required for supported product flows. It does not assert external provider reachability.
_Avoid_: Provider health

## Add `AI Capacity Pressure`

**AI Capacity Pressure**:
A locally observed reduction in usable AI capacity caused by Morshid budget guards or passively observed provider rate limits. It is not provider-reported quota remaining.
_Avoid_: Provider quota remaining

## Keep unchanged

The existing definitions of these terms remain suitable:

- Policy Day
- Course Policy Override
- Allowance Reset
- Review Case
- Audit Event
