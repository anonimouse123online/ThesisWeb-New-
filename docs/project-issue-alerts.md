# Project issue alerts

The Projects overview has a clickable Issues column. Compact orange badges show
a warning icon and the number of Open and In Progress issues; green badges show
a check icon. Tooltips and accessible labels describe the count or No Issues. The project
status is independent: a Completed project can still have unresolved issues.
Loading and failed requests use neutral labels and never imply a zero count.

The Projects table uses proportional column widths, compact cell padding,
stacked timeline dates, and wrapped project/client text. All ten columns and
Workspace fit together at laptop widths of 1280–1440 pixels, including the
existing 260-pixel sidebar. Tablet widths use smaller text and spacing; below
1024 pixels a scrollable table preserves readable content in the narrower space.
Phone layouts use the full page width and allow horizontal table scrolling.

Counts use `active_issue_count` from `GET /projects` when the backend provides a
nonnegative integer (including an integer string). Otherwise the frontend uses
the existing authenticated `GET /projects/:projectCode/issues` endpoint and
counts only Open and In Progress records. It accepts the existing `{ data: [] }`
response or an array. This endpoint must return the complete issue list; if the
backend introduces pagination, provide the aggregate count in `GET /projects`.

The badges link to `/projects/:projectCode/issues/report?status=active`. The
existing issue log has an Active filter and displays title, category, priority
(severity), reporter, report date, and status. Resolving an issue removes it from
the Active view. Returning to Projects reloads the counts from the backend.

Only the frontend is present in this repository. No new backend route or schema
is required for the existing issue endpoint. For larger lists, the backend can
avoid one issue-list request per project by including `active_issue_count` in
`GET /projects`, counting only issue rows with status Open or In Progress.
General site reports and resolved issues must be excluded from that aggregate.

Run the focused regression tests with:

```sh
node --test --test-isolation=none tests/project-issues.test.mjs
```

With a running backend, verify a project with both Open and In Progress issues,
a resolved-only project, and a Completed project with an Open issue. Click each
badge, resolve an issue, return to Projects, and check that the count decreases.
If the count endpoint fails, the badge should read Issues unavailable.
