import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { createServer } from "vite";

const root = process.cwd();
const articlesDirectory = path.join(root, "public/articles");
const picturesManifest = path.join(root, "content/pictures.json");
const categoriesManifest = path.join(root, "content/categories.json");

function json(response, status, body) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

function dateString(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value || "");
}

async function readArticles() {
  const names = (await readdir(articlesDirectory)).filter((name) => name.endsWith(".md"));
  return Promise.all(names.map(async (name) => {
    const markdown = await readFile(path.join(articlesDirectory, name), "utf8");
    const parsed = matter(markdown);
    const sha = createHash("sha1").update(markdown).digest("hex");
    return {
      title: parsed.data.title,
      slug: parsed.data.slug,
      category: parsed.data.category,
      date: dateString(parsed.data.date),
      updated: dateString(parsed.data.updated),
      tags: parsed.data.tags || [],
      summary: parsed.data.summary,
      cover: parsed.data.cover || null,
      published: parsed.data.published,
      sha,
      path: `public/articles/${name}`,
      lastCommitSha: sha,
      lastCommitUrl: "https://github.com/Atr1ck/Atr1ck.github.io",
      markdown,
    };
  }));
}

async function readPictures() {
  const source = await readFile(picturesManifest, "utf8");
  return {
    manifestSha: createHash("sha1").update(source).digest("hex"),
    pictures: JSON.parse(source).pictures,
  };
}

async function readCategories() {
  const source = await readFile(categoriesManifest, "utf8");
  return { categories: JSON.parse(source), sha: createHash("sha1").update(source).digest("hex") };
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const previewApi = {
  name: "admin-preview-api",
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      if (!request.url?.startsWith("/api/")) return next();
      const url = new URL(request.url, "http://127.0.0.1");
      if (request.method === "GET" && url.pathname === "/api/auth/session") {
        return json(response, 200, {
          authenticated: true,
          user: { login: "local-preview", avatarUrl: "/images/avatar.jpg" },
          csrfToken: "local-preview-csrf",
        });
      }
      const articles = await readArticles();
      if (request.method === "GET" && url.pathname === "/api/articles") {
        return json(response, 200, { articles: articles.map(({ markdown: _markdown, ...article }) => article) });
      }
      if (request.method === "GET" && url.pathname === "/api/article") {
        const article = articles.find((item) => item.slug === url.searchParams.get("slug"));
        return article ? json(response, 200, { article }) : json(response, 404, { error: "Article not found" });
      }
      if (request.method === "GET" && url.pathname === "/api/pictures") {
        return json(response, 200, await readPictures());
      }
      if (request.method === "GET" && url.pathname === "/api/categories") {
        return json(response, 200, await readCategories());
      }
      const commitSha = url.searchParams.get("commitSha");
      if (request.method === "GET" && url.pathname === "/api/deployment" && /^[a-f0-9]{40}$/.test(commitSha || "")) {
        return json(response, 200, {
          found: true,
          commitSha,
          deploymentId: "dpl_localpreview",
          state: "READY",
          deploymentUrl: "http://127.0.0.1:5175",
          durationMs: 2400,
        });
      }
      if (request.method === "POST" && url.pathname === "/api/articles/publish") {
        return json(response, 202, {
          commitSha: "c".repeat(40),
          commitUrl: "https://github.com/Atr1ck/Atr1ck.github.io",
          articleSha: "d".repeat(40),
          articlePath: "local-preview",
          status: "submitted",
        });
      }
      if (request.method === "POST" && url.pathname === "/api/pictures/publish") {
        return json(response, 202, {
          commitSha: "c".repeat(40),
          commitUrl: "https://github.com/Atr1ck/Atr1ck.github.io",
          manifestSha: "d".repeat(40),
          pictureId: "local-preview",
          status: "submitted",
        });
      }
      if (request.method === "POST" && url.pathname === "/api/categories/publish") {
        const body = await readJsonBody(request);
        const state = await readCategories();
        const group = body.group === "pictures" ? "pictures" : "articles";
        const orders = state.categories[group].filter((item) => item.slug !== "uncategorized").map((item) => item.order);
        state.categories[group].push({ ...body.category, order: Math.max(0, ...orders) + 10 });
        state.categories[group].sort((first, second) => first.order - second.order);
        return json(response, 202, {
          categories: state.categories,
          categorySha: "d".repeat(40),
          commitSha: "c".repeat(40),
          commitUrl: "https://github.com/Atr1ck/Atr1ck.github.io",
          status: "submitted",
        });
      }
      if (request.method === "POST" && ["/api/auth/logout", "/api/deployments/redeploy"].includes(url.pathname)) {
        return json(response, 200, {});
      }
      return json(response, 404, { error: "Preview API route not found" });
    });
  },
};

const server = await createServer({
  root,
  configFile: path.join(root, "vite.config.ts"),
  plugins: [previewApi],
  server: { host: "127.0.0.1", port: 5175, strictPort: true },
});
await server.listen();
server.printUrls();
