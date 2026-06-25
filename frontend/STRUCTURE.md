# Frontend Structure

Use this structure for new frontend work:

```text
src/
  components/       shared reusable UI
  components/layout app shell, sidebar, header, notifications
  config/           frontend configuration
  context/          React providers
  features/         business modules grouped by domain
  pages/            route-level standalone pages, such as auth
  routes/           route declarations and route guards
  styles/           theme and styling helpers
  types/            shared TypeScript types
  utils/            shared utility functions
```

Feature folders should be named with the correct business domain, for example
`EmployeeDashboard`, `dashboard`, `chatbot`, and `candidateDashboard`.

Avoid placing duplicate, misspelled, or inactive feature copies inside `src`.
Old code that must be kept temporarily should live under `frontend/legacy/`
until it is deleted or merged into the active feature.
