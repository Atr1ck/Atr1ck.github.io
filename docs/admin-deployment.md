# 管理后台部署清单

管理后台固定通过 `/admin` 访问，并且不会在公开导航中展示入口。

## 1. GitHub OAuth App

创建一个用于管理员登录的 GitHub OAuth App：

- Homepage URL：生产环境的 `APP_ORIGIN`
- Authorization callback URL：`${APP_ORIGIN}/api/auth/callback`
- 应用使用的 OAuth 权限范围：`read:user`

将 Client ID 和 Client Secret 添加到 Vercel 环境变量。OAuth 只用于识别管理员身份，不用于写入仓库内容。

## 2. GitHub App

创建 GitHub App，并且只将它安装到博客仓库。仓库权限配置如下：

- Contents：Read and write
- Metadata：Read-only

不需要授予其他仓库权限或组织权限。生成 Private Key 后，将完整的 PEM 内容保存到 Vercel 环境变量，禁止把密钥提交到此仓库。

## 3. Vercel 环境

在 Vercel 的 Production 环境中配置 `.env.example` 列出的全部变量：

- `APP_ORIGIN` 必须是准确的生产环境 Origin，不能包含路径或结尾斜杠。
- `SESSION_SECRET` 必须包含至少 32 个随机字节，例如使用 `openssl rand -base64 48` 生成。
- `GITHUB_ADMIN_LOGINS` 是不区分大小写、使用逗号分隔的管理员 GitHub 用户名白名单。
- `GITHUB_BRANCH` 必须与 Vercel Production Branch 一致。当前仓库的默认分支和生产分支都是 `self`，因此填写 `self`。
- `VERCEL_PROJECT_ID` 和 `VERCEL_PROJECT_NAME` 用于标识当前 Vercel 项目。
- 个人项目可以不配置 `VERCEL_TEAM_ID`；项目属于团队时必须配置。
- `VERCEL_API_TOKEN` 必须拥有读取此项目 Deployment 和创建重新部署的权限。

Vercel Framework Preset 选择 Vite，构建命令使用 `npm run build`。`prebuild` 会生成并校验 `public/json/articles.json` 和旧标题别名映射。

GitHub 写入分支必须与 Vercel Production Branch 完全一致。发布接口会通过 Vercel Project API 检查两者，不一致时拒绝写入。当前生产环境使用 `self`，后台发布会直接向 `self` 创建原子 commit，并由 Vercel 自动触发 Production Deployment。

## 4. 生产环境验收

部署并配置环境变量后，依次完成以下检查：

1. 打开 `/admin`，使用白名单内的 GitHub 账户登录。
2. 确认非白名单账户登录时返回 HTTP 403。
3. 新建一篇未公开的测试文章，添加一张压缩图片和一张选择保留原图的图片。
4. 发布文章，确认同一个 GitHub commit 同时包含 Markdown 和两张图片资源。
5. 使用过期的编辑页面再次发布，确认接口返回 HTTP 409 并停止发布。
6. 确认匹配的 Vercel Deployment 达到 `READY` 前，界面始终显示部署中状态。
7. 制造一次部署失败，确认界面能够显示日志摘要并提供重新部署操作。
8. 分别在桌面端和移动端检查公开 slug 地址、旧中文标题地址、`/articleList` 和 `/admin`。
