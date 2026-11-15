# TMS Shipper

The mobile shipper workspace for Art Supabase TMS. Customers submit shipment requests, track their source transport orders and individual dispatch batches, and view delivery receipts. The TMS web app continues to handle load planning and dispatch.

The app uses the driver app's Uni-app, Vue 3, TypeScript, Pinia, Wot Design Uni, themes, and complete set of repository skills. It builds for H5 and WeChat Mini Programs.

```powershell
pnpm install --frozen-lockfile
pnpm dev:h5
pnpm typecheck
pnpm build:h5
pnpm build:mp-weixin
```

Choose **进入演示** on the development login page to try shipment submission, status filters, split batches, and an example receipt.

The workspace also includes shipment updates, saved goods and addresses, and confirmed customer statements. Staff use their existing TMS permissions for dispatch, split and merge, master data, and settlement. Set `VITE_TMS_WEB_URL` to connect the management workspaces.

For a live environment, apply the migration to an existing Art Supabase TMS database, deploy the `tms-shipper` Edge Function, provision a dedicated Supabase Auth account and customer binding, and configure the client with the project URL and publishable key.

See the [Chinese README](README.md) for deployment and account setup.
