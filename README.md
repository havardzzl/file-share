# 拾享 · File Share

一个给自己用的文件与文本分享空间。Next.js + Supabase，可部署到 Vercel。

- 上传单个文件，或粘贴纯文本，生成无需登录即可访问的随机链接。
- 文件下载；文本直接展示、复制，也可以下载为 `.txt`。
- 文件与文本上限均为 **5MiB（5 × 1024 × 1024 字节）**；中文、emoji 按 UTF-8 字节计算。
- 仅管理员可以上传、查看分享清单、删除内容。
- 有效期为 1 天、7 天、30 天或永久；默认 7 天。
- 私有 Storage、服务端身份验证、实际大小复核、自动清理。
- 中文界面，适配桌面和手机。

## 1. 创建 Supabase 项目

1. 在 [Supabase](https://supabase.com/) 创建项目。个人小规模使用可以先选免费套餐；容量、流量和休眠政策以平台当前规则为准。
2. 打开 **SQL Editor**，粘贴并执行 [`supabase/schema.sql`](supabase/schema.sql)。它会创建 `shares` 数据表和同名的**私有**存储桶，并设置 5MiB 大小限制。
3. 打开 **Authentication → Users → Add user / Create new user**，创建自己的邮箱和强密码，并勾选 **Auto Confirm User**。不需要邮件服务，也不需要前端注册页。
4. 在 Authentication 的登录/注册设置中关闭 **Allow new users to sign up**。页面只允许 `OWNER_EMAIL` 对应的已确认账号登录。
5. 在项目 **Settings → API / API Keys** 中找到项目 URL、anon（或 publishable）key、service_role（或 secret）key。不同控制台版本名称可能略有差异。

**不要**将存储桶改成 public，不要为匿名用户增加数据库或存储的读写策略。公开访问由应用服务端检查分享状态后签发短期地址完成。

## 2. 本地启动

需要 Node.js **22.12+**，推荐 Node.js 22 LTS。

```bash
npm ci
cp .env.example .env.local
```

编辑 `.env.local`：

| 环境变量                    | 内容                                            |
| --------------------------- | ----------------------------------------------- |
| `SUPABASE_URL`              | 例如 `https://xxxx.supabase.co`，不是控制台 URL |
| `SUPABASE_ANON_KEY`         | anon key 或 publishable key，用于密码登录       |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key 或 secret key，仅在服务端使用  |
| `OWNER_EMAIL`               | 上一步创建的已确认用户邮箱                      |
| `CRON_SECRET`               | 至少 32 位随机字符串，用于保护清理接口          |

生成随机清理密钥：

```bash
openssl rand -hex 32
```

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)，点击“管理登录”，输入刚才创建的账号密码。

未配置环境变量时仍可浏览界面，会显示连接存储的提示。**这个模式不会保存内容。** 修改环境变量后需要重启开发服务。

## 3. 部署到 Vercel

1. 在 [Vercel](https://vercel.com/new) 导入这个 GitHub 仓库。
2. Framework 选 **Next.js**，Root Directory 保持项目根目录；使用默认安装和构建命令。
3. Node.js 选择 **22.x**。
4. 在项目 Environment Variables 中添加上述 5 个变量。Preview 和 Production 使用哪些环境变量，由你按需要选择；建议正式分享使用 Production 固定域名。
5. 点击 Deploy。之后修改环境变量需要重新部署。
6. 打开部署后的站点，登录，分别创建一个文件分享和文本分享，再用未登录的浏览器窗口检查链接。

无需把 Supabase key 配成 `NEXT_PUBLIC_`，浏览器只会拿到指定对象的临时上传地址。

`vercel.json` 配置每天 **02:00 UTC / 北京时间 10:00** 调用 `/api/cleanup`。设置 `CRON_SECRET` 后 Vercel 自动在 cron 请求中加入 `Authorization: Bearer ...`。每天一次的频率适用于个人使用；Cron 的套餐限制以 Vercel 当前规则为准。

手动触发清理也可以，例如在已加载 `CRON_SECRET` 的终端中：

```bash
curl --fail --header "Authorization: Bearer ${CRON_SECRET}" https://你的域名/api/cleanup
```

## 工作方式

```text
浏览器 → 应用服务端验证管理员 → 创建待上传记录并签发上传地址
浏览器 ────────────────→ Supabase Storage 直传文件 / 文本
浏览器 → 服务端复核 Storage 中实际大小 → 开放分享链接
访客 → /s/随机UUID → 查看文件信息 / 在浏览器直接读取纯文本
访客 → 下载接口 → 服务端检查状态与过期时间 → 临时下载地址
```

5MiB 内容不会作为 Vercel Functions 的上传请求体或文本页面响应体。应用接口只传小体积元数据；文本读取也由浏览器从存储直读，以适配 Vercel 的请求/响应体大小限制。

## 行为与边界

- 管理员会话使用 HttpOnly、SameSite=Strict cookie；生产环境加 Secure。服务端每次验证 Supabase 用户及邮箱。会话持续到 Supabase access token 过期（通常 1 小时），过期后重新登录；本版本不在浏览器保存 refresh token。
- 分享链接相当于访问凭证，任何得到链接的人都可访问。随机 UUID 不可枚举，页面关闭搜索引擎索引，但这不等同于文件密码保护。
- 仅支持纯文本展示，不执行 HTML、Markdown 或 JavaScript。文件下载使用 attachment，原始文件名不作为存储路径。
- 5MiB 在前端、服务端元数据、Storage 桶限制、上传完成校验四处落实；禁止空文件和空白文本。
- 链接到期立即停止签发下载地址。临时下载地址最多有效 60 秒，并按分享剩余有效期缩短。删除分享后不再签发地址；先前签发的地址最多还可使用 60 秒。已经下载的内容无法撤回。
- 每日清理物理删除到期内容、超过 24 小时未完成的上传以及删除残留，每次最多处理 500 条。删除时会先移除对象；在上传签名可能被重试的窗口内保留不可访问的删除标记，由后续清理再次回收。
- Supabase 签名上传地址默认有效 2 小时。本应用禁止覆盖对象，上传完成前不公开分享。
- 永久有效的内容需要自己删除；未启用 cron 时，过期链接仍不可访问，但存储空间不会自动回收。
- 密码错误、限流等由 Supabase Auth 处理；请使用强密码，并关闭公开注册。本项目按个人低流量用途设计。
- 浏览器和 Supabase 之间需要能够直连；网络、免费套餐休眠、配额用尽都可能影响上传和访问。

## 检查

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

测试覆盖身份验证、跨站请求、上传大小边界、未完成/已删除/已过期分享、UTF-8 校验、下载地址有效期和清理鉴权。单元测试使用模拟的 Supabase 连接，不替代部署后的真实存储验收。CI 会自动执行以上检查，不需要生产密钥。

## 项目结构

```text
app/                  页面与 API
components/           上传、文本预览、分享管理界面
lib/                  身份校验、Supabase、分享逻辑
supabase/schema.sql   数据表、权限与存储桶初始化
tests/               关键边界与权限测试
vercel.json           每日清理任务
```

## License

MIT
