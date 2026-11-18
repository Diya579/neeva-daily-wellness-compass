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

- Public pages (landing `/`, `/auth`, `/reset-password`) are top-level routes; the app lives under `src/routes/_authenticated/` whose layout wraps `ProfileProvider`, `NeevaProvider`, `CrisisProvider`, `AppShell` and onboarding — one gate and one shell for every signed-in page.
- Signed-in pages use container queries (`@container` on `<main>`, `@3xl:`/`@4xl:` variants) so content adapts to the space beside the sidebar; the shell itself switches sidebar/bottom-nav at `md` — there is no manual phone/desktop toggle.
- Profile and companion settings live in the Cloud `profiles` table (own-row RLS); activity (moods, journal, points, chat) stays on-device in `NeevaProvider`, namespaced per user id — private by default without new tables.
- `/api/chat` verifies the caller's bearer token before calling the model — protects AI credits.
- Crisis detection and the safety check scoring live in `src/lib/crisis.ts` (tested); chat and journal open the shared crisis overlay via `useCrisis()`.
- Language rules live in `languageRule()` (src/lib/chat-prompt.ts) with a per-device typing style (auto/roman/native) in `NeevaProvider`; crisis patterns cover both English-letter and native-script forms — users often type Indian languages in English letters.
- AI chat streams plain text from the `/api/chat` server route; journal analysis is a server function with a strict JSON schema and an on-device fallback — model calls stay server-side.
- Charts render only after hydration and use CSS token colours — avoids SSR/client mismatches and keeps theming.
