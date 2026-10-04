# Frontend CI

The workflow in `.github/workflows/frontend-ci.yml` runs on pull requests targeting
`main` and pushes to `main`. Its required status check is named `Frontend checks`.

Repository inspection identified React 19, Vite 8, TypeScript 5.9, and npm with a
root `package-lock.json`. There is no project-level Node engine declaration or
Node version file. Node 24 is the current LTS line as of October 4, 2026 and meets
the locked Vite and React plugin requirement of `^20.19.0 || >=22.12.0`.
The workflow resolves the latest stable Node 24 release on each run.

The workflow uses `actions/checkout` and `actions/setup-node`, caches npm's
downloaded dependencies using the lockfile, and installs with `npm ci`.
It runs only existing package scripts:

1. `npm run lint` runs ESLint.
2. `npm run test:security` runs the existing Node test suite once without watch
   mode or a live backend. There is no generic `test` script. The separate
   `tests/project-issues.test.mjs` file has no package script and is not run by CI.
3. `npm run build` runs `tsc -b && vite build`. TypeScript errors or Vite compilation
   errors fail the job. A failed earlier check also fails the job and stops later
   steps.

No GitHub Secrets are required for build validation. `VITE_BACKEND_URL` and
`VITE_LOGIN_SECURITY_FLOW` configure the application's backend URL and login flow;
both have application defaults and are unnecessary for compilation. Configure
them separately when producing a deployment build. Vite exposes `VITE_` values
in browser bundles, so they must not contain credentials.

## Fixing a failed check

Use Node 24 locally and reproduce the failed command from the Actions log:

```sh
npm ci
npm run lint
npm run test:security
npm run build
```

- Installation: if the manifest and lockfile disagree after an intentional
  dependency change, run `npm install` locally and commit both `package.json` and
  `package-lock.json`. For download failures, inspect the registry/network error.
- Lint: fix the reported code or hooks errors, then rerun `npm run lint`.
- Tests: inspect the failed assertion, fix the regression, and rerun
  `npm run test:security`. Ensure the referenced test and utility files are committed.
- Build: fix the reported TypeScript errors, missing imports, case mismatches,
  or Vite errors, then rerun `npm run build`. CI uses Linux, where import paths
  are case-sensitive.

Push the fix to the pull request branch to rerun CI. Do not disable a check or
weaken application validation merely to get a passing result.

Local validation after the ESLint fixes: `npm ci` succeeded, ESLint passed with
zero errors and warnings, all 24 security tests passed, and the TypeScript/Vite
build passed. ESLint rules remain enabled. Vite's existing bundle-size warning
does not fail compilation.

## Recommended protection for main

In GitHub Settings, create an active branch protection rule or branch ruleset
targeting `main`:

- Require a pull request before merging.
- Require at least one approving review where the repository's plan supports it
  and another reviewer is available; dismiss stale approvals after new commits.
- Require status checks to pass, selecting `Frontend checks` from GitHub Actions
  after the workflow has run once.
- Require branches to be up to date before merging.
- Enforce the rules for administrators and keep bypass permissions limited so
  routine direct pushes to `main` are blocked by the pull request requirement.
- Keep force pushes and branch deletion disabled.

These settings are recommendations; creating a workflow does not enable branch
protection. Availability depends on the repository's visibility and GitHub plan.

References: [Node.js release schedule](https://github.com/nodejs/Release#release-schedule),
[checkout](https://github.com/actions/checkout),
[setup-node and npm caching](https://github.com/actions/setup-node#caching-global-packages-data),
[GitHub protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).
