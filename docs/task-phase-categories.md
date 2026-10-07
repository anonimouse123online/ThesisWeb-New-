# Task construction phase categories

The standalone Create Task page, Tasks creation modal and Project Details task
creation modal use a shared checkbox checklist labeled **Construction Phase
Category \***. Available options are Site Development, Structural, Electrical &
Utilities, Plumbing & MEP, Architectural, Construction Phase and Turnover Phase.
Form state uses `phases: string[]`. General task creation starts with no selection;
creating from a category group preselects that category and allows changes.
At least one category is required. Other task fields and their validation retain
their existing behavior.

Task lists/grouping, assignment details and resource-to-task labels accept
`phases` arrays or the legacy `phase` string. Foundation displays as Site
Development and Finishing as Architectural, including numbered legacy labels.
Multiple categories display separated by bullets, with a task appearing in each
applicable category group. Overall task/progress totals still use the original
task list, not the sum of group memberships. Unrecognized legacy categories and
uncategorized tasks remain visible. Existing database records are not rewritten.
Project lifecycle phases and project progress logs are independent and unchanged.

No general Edit Task form or phase-edit endpoint exists in the inspected project.
Assign Task edits assignment/deadline/priority, and now displays all task categories.
`getTaskPhases(task)` supplies normalized existing selections for a future editor.

## Current backend contract

The sibling backend at `C:\Users\Kurt Paul\backend_projectManagement` was inspected:

- `routes/task.js`: creation is `POST /tasks`; no general task edit route.
- `controllers/taskController.js`, `createTask`: reads `req.body.phase` and calls
  `.trim()` on it. It maps five single-string labels to the exact numbered values
  stored in `tasks.phase`, then inserts one scalar value. It does not read `phases`.
- `setup_db.sql` and `setup_new_db.sql`: `tasks.phase` is `VARCHAR(100)`. The
  controller also references a database `tasks_phase_check` constraint limiting
  legacy values; no migration supporting multiple task phases was found.
- List/report/dashboard queries select/filter/group the scalar `t.phase`.

The backend **does not support multiple task categories**, or the new Construction
Phase/Turnover Phase values. No array is sent into the existing `phase` property.
`legacyTaskPhasePayload()` permits only a single compatible selection:

| Checklist label | Current request field |
| --- | --- |
| Site Development | `"phase": "Phase 1 - Foundation"` |
| Structural | `"phase": "Phase 2 - Structural"` |
| Electrical & Utilities | `"phase": "Phase 3 - Electrical & Utilities"` |
| Plumbing & MEP | `"phase": "Phase 4 - Plumbing & MEP"` |
| Architectural | `"phase": "Phase 5 - Finishing"` |

These legacy strings are transport/storage values only; they are not checklist
options. The existing request fields for name, project, engineer, dates, priority,
resources, instructions and subtasks stay as before. Draft `phases` is removed
from the outgoing request.

Multiple selections are retained but submission is blocked before any request,
with an error explaining that multiple categories cannot yet be saved. Singleton
Construction Phase and Turnover Phase selections are also blocked. Nothing is
silently truncated, joined into a string, or saved as multiple duplicate tasks.

## Proposed backend request (not currently sent)

Keep `POST /tasks`, but accept a nonempty array of allowed canonical categories:

```json
{
  "taskName": "Concrete inspection",
  "projectId": "existing-project-id",
  "phases": ["Site Development", "Structural", "Architectural"],
  "assigneeId": "existing-engineer-id",
  "startDate": "2026-10-07",
  "dueDate": "2026-10-09",
  "priority": "Medium",
  "siteInstructions": "Existing site instructions"
}
```

The other current request fields remain unchanged. The backend must validate the
array, reject unknown/empty values, deduplicate categories, and persist the full
selection atomically. Retain support for legacy `phase` clients. List/single-task
responses must include `phases`; update category filtering, reports and dashboard
grouping to use array membership and avoid counting a task twice in overall totals.
If a phase editor is introduced, add an authenticated update route accepting the
same array and returning the saved categories.

## Required database migration for full persistence

No database migration is needed for the safe frontend portion, and none was run.
Full multiple-category storage requires a migration, for example an additive
`tasks.phases TEXT[]` column (or a normalized task/category join table). Keep the
old `tasks.phase` column/records during transition. Use read-time fallback for
legacy rows rather than automatically rewriting them. Validate nonempty arrays
and the seven allowed values at the API/database boundary for new writes.
For new categories, the old five-value `tasks_phase_check` must be revised or
the legacy column made optional for array-based requests, with a check requiring
either valid legacy storage or valid new storage. Update create/list/read queries
accordingly. Verify the actual live constraint definition before writing migration
SQL; the controller references it but the setup files do not declare it.

After that contract is implemented and verified, replace the three calls to
`legacyTaskPhasePayload()` with a payload containing the validated `phases` array.
Do not enable a speculative payload using a frontend flag before backend support
is deployed. The checklist/display code already supports the new response shape.

## Verification

```sh
node --test --test-isolation=none tests/task-phases.test.mjs
npm run build
npm run lint
```

Verify check/uncheck combinations, no selected categories, compatible singleton
creation, rejected multiple/new-category submission without a network request,
legacy display mapping, array display/grouping, and the single-column phone layout.
