# Admin deployment checklist

The admin is served at `/admin` and is intentionally absent from the public navigation.

## 1. GitHub OAuth App

Create an OAuth App for administrator sign-in:

- Homepage URL: the production `APP_ORIGIN`
- Authorization callback URL: `${APP_ORIGIN}/api/auth/callback`
- OAuth scope used by the application: `read:user`

Add the Client ID and Client Secret to Vercel. OAuth is only used to identify the administrator; it is never used to write repository content.

## 2. GitHub App

Create and install a GitHub App only on the blog repository with these repository permissions:

- Contents: Read and write
- Metadata: Read-only

No other repository or organization permissions are required. Generate a private key and store the complete PEM value in Vercel. Do not add the key to this repository.

## 3. Vercel environment

Configure every variable from `.env.example` in the Production environment:

- `APP_ORIGIN` must be the exact production origin, without a path or trailing slash.
- `SESSION_SECRET` must contain at least 32 random bytes. For example, generate it with `openssl rand -base64 48`.
- `GITHUB_ADMIN_LOGINS` is a comma-separated, case-insensitive administrator allowlist.
- `GITHUB_BRANCH` should remain `main` for direct publication.
- `VERCEL_PROJECT_ID` and `VERCEL_PROJECT_NAME` identify this Vercel project.
- `VERCEL_TEAM_ID` is optional for a personal project and required when the project belongs to a team.
- `VERCEL_API_TOKEN` must be able to read deployments and create redeployments for this project.

Use the Vite framework preset and `npm run build`. The `prebuild` hook generates and validates `public/json/articles.json` and the legacy-title alias map.

The GitHub write branch and the Vercel Production Branch must be identical. The publish endpoint checks this through the Vercel Project API and refuses to write when they differ. At the time this system was implemented, the repository default branch and Vercel Production Branch were still `self`, while the confirmed publication target was `main`. Before enabling `/admin`, fast-forward `main` to the tested application commit and change the Vercel Production Branch to `main`.

## 4. Production verification

After deploying the environment configuration:

1. Open `/admin` and sign in with an allowlisted GitHub account.
2. Confirm that a non-allowlisted account receives HTTP 403.
3. Create an unpublished test article with a compressed image and one preserved original image.
4. Publish it and confirm one GitHub commit contains the Markdown and both assets.
5. Try publishing from a stale editor and confirm it stops with HTTP 409.
6. Confirm the UI remains in the deployment state until the matching Vercel deployment is `READY`.
7. Exercise a failed deployment and confirm the log summary and redeploy action are available.
8. Verify the public slug URL, a legacy Chinese-title URL, `/articleList`, and `/admin` on desktop and mobile.
