# TMS 货主端

亿企工场 TMS 的货主移动端。货主提交发货委托，按原始运输单跟踪发运、到达、分批签收和回单。服务商在 Art Supabase TMS 中继续配载、派车和归档。

项目使用 Uni-app、Vue 3、TypeScript、Pinia 和 Wot Design Uni，从主仓复用以司机端为基准的样式与主题组件，支持 H5 和微信小程序。`.agents/skills` 和 `skills-lock.json` 原样来自司机端。

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

H5 输出到 `dist/build/h5`，小程序输出到 `dist/build/mp-weixin`。小程序发布时，在 `src/manifest.json` 配置货主端 AppID，并在微信公众平台配置 Supabase 或 HTTPS 代理的 request、downloadFile 合法域名。

H5 浏览器回归可在 dev server 运行后执行 `pnpm audit:h5`。默认检查 `http://127.0.0.1:5186/`，如需其他端口可设置 `TMS_SMOKE_URL`。

## 接入现有 TMS

1. 在已安装 Art Supabase TMS 的数据库执行 [货主端迁移](supabase/migrations/20261115002155_tms_shipper_mobile.sql)。它复用现有订单、配载明细、运单、编号规则，并建立货主账号绑定。通过 TMS 的迁移流程或 Supabase SQL Editor 应用此脚本。
2. 发布 Edge Function。函数使用项目内置的 Auth 和 service-role 环境变量。

   ```powershell
   supabase functions deploy tms-shipper --project-ref <project-ref>
   ```

3. 在 Supabase Auth 开通独立的货主账号，用邮箱和密码登录。若项目启用了手机号认证，已绑定验证手机号的货主也可用手机号和密码登录。用货主的 Auth UID 绑定 `mdm_customer.id` 和对应服务商租户。提交委托还需配置同租户可用的开单归属人 `sys_user.id`，并启用 `tms.order` 自动编号。没有开单归属人的绑定可以查单。

   ```sql
   insert into tms_shipper_private.accounts (
     auth_user_id, tenant_id, customer_id, order_actor_id, display_name
   ) values (
     '<货主 Auth UID>'::uuid,
     '<服务商租户 ID>'::uuid,
     '<发货客户 ID>'::uuid,
     '<开单归属人 ID>'::uuid,
     '<货主姓名>'
   );
   ```

4. 复制 `.env.example` 为 `.env.local`。填写 `VITE_SUPABASE_URL` 和该项目的 `VITE_SUPABASE_KEY`（publishable key 或旧版 anon key）。小程序需要代理时填 `VITE_SUPABASE_MP_URL`，代理应提供 `/auth/v1`、`/rest/v1`、`/functions/v1` 和 `/storage/v1`。
5. 为员工操作配置 `VITE_TMS_WEB_URL`，填 Art Supabase Pro 的完整部署根地址，保留子目录路径。微信小程序还需将 Web TMS 域名登记为 `web-view` 业务域名。Web 工作台沿用独立登录会话及现有角色、按钮权限。已在 Web TMS 用户资料登记手机号的员工可通过 `login-with-phone` 登录员工工作台，货主绑定使用独立的 Auth UID。

## 业务规则

- 委托保存为 `tms_order` 的待配载原始运输单。收发站点来自服务商已启用的站点，运输、配送和结算字段沿用 Web 开单的公路、送货上门、到付初始值。运价和费用由服务商处理。
- 账号范围由服务端按租户和发货客户绑定校验。停用账号、客户或租户会停止访问。货主 Auth UID 单独用于货主端，开单归属人对应 TMS 内部审计，提交记录保留实际货主 Auth UID。
- 拆单按配载明细展示每个批次。合单只展示本单的签收数量和时间，整车共用附件需由服务商按单提供。独占批次可查看带有该运单归属的签收图片。
- 提交以请求标识去重。网络重试使用同一个标识，只有第一次提交生成运输单号。
- 常用货物、地址和已读状态保存在货主账号下。对账单按发货客户和租户读取。

[English](README.en.md)
