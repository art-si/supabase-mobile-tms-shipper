# Project Instructions

- Make shared theme, font, button, and form style changes in the main repository under `supabase-mobile-pro/packages/mobile-core/src`. Use this app’s existing stylesheet and component directories for business-specific styles.
- Before creating, modifying, refactoring, or reviewing source code, read and apply the local `project-code-quality` skill.
- Before working on user-facing pages and components, apply both `professional-ui-quality` and `web-design-guidelines`. Verify touch targets, responsive layout, accessibility, and loading, empty, and error states in a mobile-width browser.
- For Supabase work, use the local `supabase` skill and the project-scoped MCP in `.mcp.json`. Verify database changes with focused queries.
- The shipper app follows the Uni-app structure and visual tokens of `supabase-mobile-tms-driver`. Persistent business data comes from the shared Art Supabase TMS database.
- Only the shipper Edge Function calls the service-role RPC. Keep tenant and customer authorization in the database contract. Client builds use a Supabase publishable or legacy anon key.
