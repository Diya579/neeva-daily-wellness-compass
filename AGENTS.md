<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules (Neeva)

- App shell, onboarding and Toaster live in `src/routes/__root.tsx` via `AppShell`; each page is its own route file — keeps nav, crisis button and privacy footer consistent.
- Pages use container queries (`@container` on `<main>`, `@3xl:`/`@4xl:` variants) rather than viewport breakpoints — so the phone-frame preview mode lays out like a real phone.
- User data (moods, journal, points, chat, preferences) is stored on-device in `NeevaProvider` (localStorage), read only after hydration — no backend accounts yet.
- AI chat streams plain text from the `/api/chat` server route; journal analysis is a server function with a strict JSON schema and an on-device fallback — model calls stay server-side.
- Employer analytics must pass through `anonymizeCohorts` in `src/lib/privacy.ts` (tested) — organisations never see small groups or individuals.
- Charts render only after hydration and use CSS token colours — avoids SSR/client mismatches and keeps theming.
