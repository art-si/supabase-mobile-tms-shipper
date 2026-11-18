# TMS 货主端

亿企工场 TMS 的货主移动端。货主提交发货委托，按原始运输单跟踪发运、到达、分批签收和回单。服务商在 Art Supabase TMS 中继续配载、派车和归档。

项目使用 Uni-app、Vue 3、TypeScript、Pinia 和 Wot Design Uni，从主仓复用以司机端为基准的样式与主题组件，支持 H5 和微信小程序。项目技能位于 `.agents/skills`，上游来源和版本记录在 `skills-lock.json`。

## 功能

| 入口 | 功能 |
| --- | --- |
| 发货 | 货主提交原始运输单，支持多项货物和选用常用地址。员工进入 Web TMS 开单。 |
| 运单 | 货主查看订单、运输批次和回单。员工可查看待配载、已配载运单，并进入 Web TMS 办理配载、合单、拆单。 |
| 消息 | 货主查看自己订单的运输更新并标记已读。员工查看已有的通知和待办。 |
| 我的 · 基础数据 | 货主管理自己的常用货物、地址。员工按授权进入货物、常用地址、司机、线路、车辆、挂车管理。 |
| 我的 · 业务结算 | 货主查看本企业已确认的客户对账单和明细。员工可按司机核对运单费用、借款、还款和报销，按授权进入客户对账、承运商对账和运单费用工作台。 |

## 本地运行

开发和构建使用 [supabase-mobile-pro](https://gitee.com/art-si/supabase-mobile-pro) 的公共样式。可在主仓的 `modules/` 中开发。单独检出时，在同一级放好对应版本的主仓，或用 `MOBILE_PRO_ROOT` 指向主仓目录。

使用 Node.js 22 或更高版本及 pnpm 11。

```powershell
pnpm install --frozen-lockfile
pnpm dev:h5
```

开发环境可从登录页进入演示。演示包含分批运输、部分签收和样例回单，试填的委托保存在当前页面会话中。设置 `VITE_ENABLE_DEMO=true` 可在预览构建中开启演示入口。

```powershell
pnpm typecheck
pnpm build:h5
pnpm build:mp-weixin
```

H5 输出到 `docs/`，小程序输出到 `dist/build/mp-weixin`。小程序发布时，在 `src/manifest.json` 配置货主端 AppID，并在微信公众平台配置 Supabase 或 HTTPS 代理的 request、downloadFile 合法域名。

H5 浏览器回归可在 dev server 运行后执行 `pnpm audit:h5`。默认检查 `http://127.0.0.1:5186/`，如需其他端口可设置 `TMS_SMOKE_URL`。

发布到 GitHub Pages 时，运行 `pnpm build:h5`，将生成的 `docs/`（包括 `.nojekyll`）提交到货主端仓库的发布分支。打开仓库的 **Settings → Pages**，选择 **Deploy from a branch**，设置该分支和 `/docs`。H5 使用相对资源路径和 hash 路由，可以直接部署在仓库子路径下。要让线上预览保留「进入演示」，构建前设置 `VITE_ENABLE_DEMO=true`。正式登录的环境配置见下节。

## 接入现有 TMS

1. 当前 Supabase 项目已配置货主端数据库接口。数据库变更由 Art Supabase Pro 统一维护和直接校验，不在移动仓保留逐版本 SQL。复用现有订单、配载明细、运单和编号规则。
2. 发布 Edge Function。函数使用项目内置的 Auth 和 service-role 环境变量。

   ```powershell
   supabase functions deploy tms-shipper --project-ref <project-ref>
   ```

3. 在后台「用户管理 → 移动端账号 → 新建货主账号」为每位客户联系人开通个人账号，关联客户企业和可选的开单归属人。支持邮箱密码及后台登记的登录手机号密码；微信手机号另由本人授权绑定。没有开单归属人的账号显示只读状态，可查单，不能发货。启用 `tms.order` 自动编号后才可提交委托。已有账号不能更换客户企业，换企业需新建个人账号。

4. 复制 `.env.example` 为 `.env.local`。填写 `VITE_SUPABASE_URL` 和该项目的 `VITE_SUPABASE_KEY`（publishable key 或旧版 anon key）。小程序需要代理时填 `VITE_SUPABASE_MP_URL`，代理应提供 `/auth/v1`、`/rest/v1`、`/functions/v1` 和 `/storage/v1`。
5. 为员工操作配置 `VITE_TMS_WEB_URL`，填 Art Supabase Pro 的完整部署根地址，保留子目录路径。微信小程序还需将 Web TMS 域名登记为 `web-view` 业务域名。Web 工作台沿用独立登录会话及现有角色、按钮权限。已在 Web TMS 用户资料登记手机号的员工可通过 `login-with-phone` 登录员工工作台，货主绑定使用独立的 Auth UID。
6. 微信小程序的「手机一键登录」通过 `VITE_ENABLE_WECHAT_PHONE_LOGIN=true` 开启。统一服务 `mobile-wechat-auth` 由 Art Supabase Pro 部署。当前验收共用司机 AppID 和服务端凭据，独立凭据配置完整后可切换。先凭密码登录，10 分钟内在「我的」授权绑定；以后可一键登录，每次检查当前客户或员工权限。配置和接口约定见主仓 `supabase/README.md`。H5 使用账号密码。

## 业务规则

- 委托保存为 `tms_order` 的待配载原始运输单。收发站点来自服务商已启用的站点，运输、配送和结算字段沿用 Web 开单的公路、送货上门、到付初始值。运价和费用由服务商处理。
- 账号范围由服务端按租户和发货客户绑定校验。停用账号、客户或租户会停止访问。货主 Auth UID 单独用于货主端，开单归属人对应 TMS 内部审计，提交记录保留实际货主 Auth UID。
- 拆单按配载明细展示每个批次。合单只展示本单的签收数量和时间，整车共用附件需由服务商按单提供。独占批次可查看带有该运单归属的签收图片。
- 提交以请求标识去重。网络重试使用同一个标识，只有第一次提交生成运输单号。
- 常用货物、地址和已读状态保存在货主账号下。对账单按发货客户和租户读取。

[English](README.en.md)
