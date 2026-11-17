# TMS Shipper

The app uses the shared design system in supabase-mobile-pro. Build it from the main repository’s modules directory, or use MOBILE_PRO_ROOT to locate the matching main repository checkout.

The mobile shipper workspace for Art Supabase TMS. Customers submit shipment requests, track their source transport orders and individual dispatch batches, and view delivery receipts. The TMS web app continues to handle load planning and dispatch.

The app uses Uni-app, Vue 3, TypeScript, Pinia, Wot Design Uni, and the shared driver-based themes. It builds for H5 and WeChat Mini Programs. Repository skills live in `.agents/skills`; `skills-lock.json` records their upstream sources and versions.

```powershell
pnpm install --frozen-lockfile
pnpm dev:h5
pnpm typecheck
pnpm build:h5
pnpm build:mp-weixin
```

Choose **进入演示** on the development login page to try shipment submission, status filters, split batches, and an example receipt.

`pnpm build:h5` writes the H5 site to `docs/`. For GitHub Pages, commit that folder (including `.nojekyll`) to the shipper repository. In **Settings → Pages → Deploy from a branch**, select the branch containing the build and the `/docs` folder. Relative assets and hash routing support hosting under the repository subpath. Set `VITE_ENABLE_DEMO=true` before building to include the demo entry in a hosted preview.

The workspace also includes shipment updates, saved goods and addresses, and confirmed customer statements. Staff use their existing TMS permissions for dispatch, split and merge, master data, and settlement. Set `VITE_TMS_WEB_URL` to connect the management workspaces.

For a live environment, apply the migration to an existing Art Supabase TMS database, deploy the `tms-shipper` Edge Function, provision a dedicated Supabase Auth account and customer binding, and configure the client with the project URL and publishable key.

WeChat phone sign-in is off by default. Register the shipper Mini Program's own AppID and phone capability, deploy the shared `mobile-wechat-auth` and shipper services to the same Supabase project, then set `VITE_ENABLE_WECHAT_PHONE_LOGIN=true` for the WeChat build. Customers and staff must first sign in with a password and authorize and link their WeChat phone number under My Account within 10 minutes. The existing customer or staff access check still applies on every sign-in. H5 continues to use password sign-in.

See the [Chinese README](README.md) for deployment and account setup.
