# Desktop launcher (macOS)

`Tribal Gaming App.command` starts the app with one double-click: it brings up
PostgreSQL, verifies the database schema, builds if the source has changed,
serves the production build, and opens the browser.

## One-time setup

```bash
chmod +x "scripts/Tribal Gaming App.command"
```

Then drag the file to your Desktop or Dock (hold ⌥⌘ while dragging to leave a
copy in place). Double-click it to launch.

If the project does not live at `~/tribal-gaming-app`, point the launcher at it:

```bash
echo 'export TRIBAL_APP_DIR="/path/to/tribal-gaming-app"' >> ~/.zshrc
```

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Compliance | `compliance@demo.gov` | `demo-pass-2026` |
| Licensing | `licensing@demo.gov` | `demo-pass-2026` |
| Applicant | `applicant@demo.gov` | `demo-pass-2026` |

## Notes

- **`.env.local` overrides `.env`.** Next.js reads `.env.local` first, so a
  stale `DATABASE_URL` there will send the app to a different database than the
  one your migrations ran against — surfacing as `column ... does not exist`
  even though `psql` shows the column present. The launcher reports which file
  it read the URL from and applies any pending migrations before starting.
- **`AUTH_TRUST_HOST=true` is required** when serving a production build
  outside a recognised host. Without it every auth route returns 500
  (`UntrustedHost`). The launcher sets it; `next dev` does not need it.
- **`npx prisma db seed` is destructive** — it deletes all rows before
  inserting demo data. The launcher never runs it automatically; it only warns
  when the database has no user accounts.
- The server logs to `/tmp/tribal-gaming-app.log`. Close the Terminal window or
  press Ctrl-C to stop it.
