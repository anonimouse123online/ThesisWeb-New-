# Task construction phase categories

The standalone Create Task page, Tasks creation modal and Project Details task
creation modal keep their existing checkbox design, layout and seven categories.
State remains `phases: string[]`; checking another category retains earlier
selections, and unchecking removes only that category. At least one is required.
All unrelated fields, validation and styling remain unchanged.

## Request contract

All three creation forms use `taskPhasePayload()` and send the complete selection:

```json
{
  "taskName": "Fence Installation",
  "construction_phase_categories": ["Site Development", "Structural"]
}
```

This excerpt omits the existing project, assignee, date and other task fields;
their names and values remain unchanged. The old `legacyTaskPhasePayload()`
restriction has been removed. Construction Phase and Turnover Phase can also be
submitted. No selected category is truncated or joined into a scalar string.

The sibling backend already persists arrays through its `phases` contract and
normalized `task_phases` relation. It now also accepts
`construction_phase_categories` for POST /tasks and PATCH/PUT /tasks/:id,
with the same nonempty-array validation. The new field takes precedence over
compatibility fields. Existing backend responses continue returning `phases`.
Deploy the alias support before using this updated frontend; the alias itself
requires no database migration.

## Responses and Edit Task

`getTaskPhases(task)` reads every value from `construction_phase_categories`
or `phases`, with scalar `phase` fallback for legacy tasks. Arrays take
precedence. Initializing the existing checklist with this helper selects all
returned categories. Task grouping and assignment details use the same helper.

No general Edit Task category checkbox form exists in this frontend. The current
Assign Task modal displays categories and edits assignment fields; it does not
submit category changes. No new editor or UI change was introduced.

## Verification

```sh
node --test --test-isolation=none tests/task-phases.test.mjs
npm run build
npm run lint
```

The category tests cover full-array payloads, all seven categories, required
selection, checkbox check/uncheck handlers, response initialization, legacy
display mapping and grouping.
