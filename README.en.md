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

For a live environment, use the database interfaces maintained by Art Supabase Pro, deploy the `tms-shipper` Edge Function, provision an account through User Management, and configure the client with the project URL and publishable key.

Provision personal shipper accounts in Pro under User Management → Mobile Accounts. Each account belongs to one customer; an optional order owner enables shipment creation. WeChat phone sign-in uses Pro's canonical `mobile-wechat-auth` service. For current acceptance, the shipper shares the driver's WeChat AppID and server credentials until a complete shipper pair is configured. Enable `VITE_ENABLE_WECHAT_PHONE_LOGIN=true` in the WeChat build. First sign in with a password and bind the authorized phone under My Account within 10 minutes. Every subsequent login rechecks business access. H5 uses password sign-in. See the parent repository's `supabase/README.md` for setup.

See the [Chinese README](README.md) for deployment and account setup.
