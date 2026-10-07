# Issue resolution feedback

The existing SitePulse issue log keeps its layout, cards, search, filters, sidebar,
typography and colors. Choosing Resolved opens `ResolveIssueModal`; no request or
status change happens until confirmation. Cancel leaves the issue untouched.
The modal requires a trimmed summary and at least one nonempty action, supports
adding/removing extra actions, and accepts optional final remarks. Inputs and
close controls are disabled during submission, with duplicate submissions blocked.
The native dialog provides focus containment, Escape handling and focus restoration.
Errors retain the draft and appear through the existing toast system and inline.

Resolved cards replace the status selector with a checked Resolved label and
View Resolution. The separate Resolution Details section shows the server's
resolver name, timestamp, summary, numbered action timeline, optional remarks and
available resolution evidence. Original issue fields are preserved. Legacy
`resolution_notes` can be displayed as a summary; absent metadata is explicitly
shown as not recorded, rather than attributed to the current admin.

## Backend discovery and remaining integration

This repository contains the frontend. The sibling backend inspected at
`C:\Users\Kurt Paul\backend_projectManagement` has
`PATCH /projects/:code/issues/:issueId` (and `PATCH /issues/:id`), supporting
`resolution_notes` and status. It has **no dedicated resolution route**, fields
for structured summary/steps/remarks, resolver identity, or issue evidence upload.
Sending the new fields to that legacy update endpoint would discard feedback.
The frontend therefore does not assume `/api/issues/:issueId/resolve`, downgrade
to status-only resolution, or encode feedback/identity into `resolution_notes`.

Once the backend resolution route is confirmed, set `VITE_ISSUE_RESOLUTION_PATH`
in the frontend environment to its exact root-relative PATCH path and restart
Vite/rebuild. A template must contain `:issueId` and may contain `:projectCode`.
`fetchWithAuth` adds the existing API base URL and JWT. An unset route fails
before any network mutation; frontend resolution is not operational until this
backend integration is supplied. Do not configure the generic update route.

`resolveProjectIssue(projectCode, issueId, feedback)` sends only:

```json
{
  "resolution_summary": "Trimmed summary",
  "resolution_steps": ["First action", "Next action"],
  "final_remarks": "Optional remarks"
}
```

Blank extra actions and blank optional remarks are omitted. `resolved_by`,
`resolved_at`, status and original issue fields are never submitted. The backend
must validate feedback and permissions, save it atomically with Resolved status,
and record the authenticated resolver and timestamp. It must reject repeated
resolution with 409. A successful response can be 200 JSON or 204.

The existing `GET /projects/:code/issues` list should return these additional
fields on resolved issues:

| Field | Expected value |
| --- | --- |
| `resolution_summary` | String |
| `resolution_steps` | Ordered string array |
| `final_remarks` | Optional string/null |
| `resolved_by` | Server-assigned user ID, or object with `id` and `name` |
| `resolved_by_name` | Resolver display name when `resolved_by` is an ID |
| `resolved_at` | Server-assigned ISO timestamp |
| `resolution_evidence` | Optional array of `{ id?, name, url, mime_type? }` |

No evidence upload control is provided because neither the existing issue flow
nor its backend supports uploading resolution evidence. The unrelated project
document endpoint is not used. Returned resolution evidence is shown as links;
it must have accessible HTTP(S) or backend-relative URLs. Original issue evidence
must remain separate from `resolution_evidence`.

Errors map 400, 403, 404, 409 and 5xx to the requested messages. Authentication
expiry keeps `fetchWithAuth`'s existing session-clearing/login redirect behavior.
Network/non-JSON failures produce a usable error instead of JSON parsing errors.

## Refresh and counts

After confirmed resolution, the modal closes, the success toast appears and
both the filtered issue list and complete issue list are refetched. Counts are
computed from the complete backend list using the existing endpoint; no new
statistics endpoint is assumed. Open, In Progress, Resolved, Active and total
counts remain project-wide regardless of active search/category/status filters.
The backend must continue returning the complete list (as currently documented)
or expose authoritative aggregates if pagination is introduced. Pending/failed
counts show a dash rather than a misleading zero. Canonical lowercase statuses
and severity values are normalized for the existing UI. Aborted stale requests
cannot replace newer list/count data. Other status updates and creation refresh
both lists too.

## Verification

```sh
node --test --test-isolation=none tests/issue-resolution.test.mjs tests/project-issues.test.mjs
npm run build
npm run lint
```

With the verified backend, confirm cancellation sends no PATCH; whitespace-only
feedback disables confirmation; add/remove actions preserves order; a double
click sends one PATCH; failures retain feedback; success changes counts under
Open/Active/search filters; and a reload displays the saved resolution details.
Verify a legacy resolved record shows available notes without inventing a resolver,
and that resolved cards do not expose a reopening/editing selector.
