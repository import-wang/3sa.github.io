# Astro 博客重构 + HomePage 彩蛋开屏页 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把仓库从 Hexo 彻底重构为 astro-theme-typography，HomePage 开屏页作彩蛋藏到 `/welcome/`，CI 重写部署到 GitHub Pages + `3sa.email`。

**Architecture:** 仓库根直接成为 Astro 项目（替换 Hexo）。HomePage 构建产物拷进 Astro 的 `public/welcome/`，单次 `astro build` 产出全站。社媒栏加 `egg` 图标链接到 `/welcome/`，开屏页 enter/Blog 指向 `/` 返回博客。`package.json.landingPage` 作个人信息单一数据源，build 时注入到 HomePage config + Astro user config 两边。

**Tech Stack:** Astro 5 + UnoCSS + TypeScript（astro-theme-typography 主题）；HomePage pug+gulp 开屏页；GitHub Actions 部署 GitHub Pages。

## Global Constraints

- 自定义域名 `3sa.email` 不变，`CNAME` 落在 `public/CNAME`。
- Node 20（CI 与本地一致）。
- 文章 frontmatter 必须用主题 content schema：`title: str`、`pubDate: date`、`categories: [str]`（**数组**，非单数 `category`）；**schema 无 `tags` 字段，frontmatter 不能放 `tags`**（放了 `astro check` 类型报错）。`modDate` 可选。
- 社媒图标用 UnoCSS 内置 `@iconify-json/mdi`，图标名走 `i-mdi-${name}`，故 `socialLinks[].name` 必须是 mdi 图标 slug（如 `github`/`rss`/`email`/`egg`）。
- 个人信息单一来源：`package.json.landingPage`（`name`/`signature`/`email`/`github`/`avatar`），build 注入两边。
- 先搭框架阶段：不加评论/analytics/i18n，不动 KaTeX 默认（`katex: false`）。

## 已核实的关键事实（来自主题源码 /tmp/att-exp）

- `src/.config/`：`default.ts`（不改）、`user.ts`（覆盖）、`index.ts`（合并导出 `themeConfig`）。`userConfig: Partial<UserConfig>`，DeepPartial。
- `ConfigSite.socialLinks: { name: string, href: string }[]`。
- `src/components/SiteNavigation.astro` 渲染社媒：`<a href={href} target="_blank" ...><span class:list={[`i-mdi-${name}`,...]}>{name}</span></a>`。
- 首页路由 `src/pages/[...page].astro`，按 `pageSize` 分页，`pin` 字段置顶。
- `astro.config.ts` 用 `themeConfig.site.website` 作 `site`，`base: '/'`，集成 UnoCSS/MDX/swup/sitemap/robotsTxt/KaTeX。
- 主题 `build` = `astro check && astro build`，CI 须保证 `astro check` 通过。
- HomePage `config.json`：`main.ul.first/second/third/fourth` 是导航项（href/icon/text），`intro.enter` 是文案，`main.name/signature/avatar.link` 是个人信息。其 `dist/` 用相对资源路径。

---

### Task 1: 备份并清空 Hexo 旧文件，落地 Astro 主题骨架

**Files:**
- Backup: 旧 Hexo 文件移到 `.hexo-backup/`（`source/`、`themes/`、`_config.yml`、`package.json`、`package-lock.json`、`yarn.lock`）
- Create: Astro 项目根（从 `/tmp/att-exp` 拷贝，已浅克隆）

**Interfaces:**
- Produces: 一个能 `npm install` 的 Astro 项目根（未配置，未构建）

- [ ] **Step 1: 确认主题克隆仍在，记下来源**

Run: `ls /tmp/att-exp/package.json`
Expected: 存在

- [ ] **Step 2: 把旧 Hexo 文件移到备份目录**

```bash
cd /Users/admin/Desktop/codes/gadgets/3sa.github.io
mkdir -p .hexo-backup
git mv source _config.yml package.json package-lock.json yarn.lock .hexo-backup/ 2>/dev/null || true
# themes/ 若 git 跟踪则 git mv，否则 mv
git ls-files --error-unmatch themes >/dev/null 2>&1 && git mv themes .hexo-backup/themes || mv themes .hexo-backup/themes 2>/dev/null || true
```
Expected: 工作区只剩 `.github/`、`CNAME`、`README.md`、`.gitignore`、`.hexo-backup/`、`docs/`

- [ ] **Step 3: 拷贝 Astro 主题到仓库根（排除 .git）**

```bash
rsync -a --exclude='.git' --exclude='node_modules' /tmp/att-exp/ ./
```
Expected: 仓库根出现 `astro.config.ts`、`package.json`、`src/`、`public/`、`uno.config.js` 等

- [ ] **Step 4: 恢复 CNAME 到 public/ 并清理主题示例内容**

```bash
# CNAME 主题 public 里没有,从备份根取(原本在仓库根)
test -f CNAME && cp CNAME public/CNAME || cp .hexo-backup/CNAME public/CNAME 2>/dev/null || printf '3sa.email\n' > public/CNAME
# 删主题示例文章,留空目录
rm -f src/content/posts/*.md src/content/posts/*.mdx
```
Expected: `public/CNAME` 含 `3sa.email`；`src/content/posts/` 为空

- [ ] **Step 5: 安装依赖**

Run: `npm install`
Expected: 安装完成（注意主题用 pnpm，但 npm 也能装；若有 lockfile 冲突删 `pnpm-lock.yaml`）

- [ ] **Step 6: 验证 dev 能起**

Run: `timeout 30 npm run dev &` ; 等几秒后 `curl -s http://localhost:4321/ | head -5` 然后 `pkill -f 'astro dev'`
Expected: HTML 输出（空文章列表也算，因为 posts 清空了）

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Astro project from astro-theme-typography

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: 迁移并修正《记 VRP 项目》文章 frontmatter

**Files:**
- Create: `src/content/posts/记VRP项目.md`
- Source: `.hexo-backup/source/_posts/main_建模技巧说明.md`

**Interfaces:**
- Produces: 一篇符合主题 content schema 的文章（`title`/`pubDate`/`categories`，无 `tags`）

- [ ] **Step 1: 读取源文章正文（去掉旧 frontmatter）**

源 frontmatter 是：
```
---
title: 记 VRP 项目
date: 2025-12-17 14:00:00
categories:
  - coding
tags:
  - vrptw
  - pyvrp
  - modeling trick
---
```
正文从"近期做了一个 vrp项目"开始。

- [ ] **Step 2: 写新文章，frontmatter 改为主题 schema**

新建 `src/content/posts/记VRP项目.md`，frontmatter：
```
---
title: 记 VRP 项目
pubDate: 2025-12-17
categories:
  - coding
description: VRP 项目的核心建模思路与技巧点整理
---
```
正文照搬源文件正文（`main_建模技巧说明.md` 第 9 行起的全部内容）。**不要带 `tags` 字段**（schema 不认）。

- [ ] **Step 3: 验证文章被 collection 识别**

Run: `npx astro check 2>&1 | tail -20`
Expected: 无类型错误（若 posts collection 为空会警告，但有了这篇就 OK）

- [ ] **Step 4: Commit**

```bash
git add src/content/posts/记VRP项目.md
git commit -m "content: migrate 记VRP项目 post to Astro schema

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: 配置站点信息（user.ts）+ 社媒彩蛋按钮

**Files:**
- Modify: `src/.config/user.ts`

**Interfaces:**
- Consumes: `package.json.landingPage`（`name`/`signature`/`email`/`github`，已存在）
- Produces: `themeConfig.site` 含 Allen Wang 信息 + 4 个 socialLinks（github/rss/email/egg）

- [ ] **Step 1: 确认 landingPage 字段值**

`package.json.landingPage`（当前值）：
```json
{ "name": "Allen Wang", "signature": "stands in the world",
  "email": "mailto:jonyerwang@foxmail.com", "github": "https://github.com/import-wang",
  "avatar": "https://github.com/import-wang.png" }
```

- [ ] **Step 2: 写 user.ts**

替换 `src/.config/user.ts` 全部内容为：
```ts
import type { UserConfig } from '~/types'

export const userConfig: Partial<UserConfig> = {
  site: {
    title: 'Allen Wang',
    subtitle: 'stands in the world',
    author: 'Allen Wang',
    description: 'stands in the world',
    website: 'https://3sa.email',
    pageSize: 5,
    socialLinks: [
      { name: 'github', href: 'https://github.com/import-wang' },
      { name: 'rss', href: '/atom.xml' },
      { name: 'email', href: 'mailto:jonyerwang@foxmail.com' },
      { name: 'egg', href: '/welcome/' },
    ],
    navLinks: [
      { name: 'Posts', href: '/' },
      { name: 'Archive', href: '/archive' },
      { name: 'Categories', href: '/categories' },
      { name: 'About', href: '/about' },
    ],
    categoryMap: [],
    footer: [
      '© %year <a target="_blank" href="%website">%author</a>',
      'Theme <a target="_blank" href="https://github.com/Moeyua/astro-theme-typography">Typography</a> by <a target="_blank" href="https://moeyua.com">Moeyua</a>',
      'Proudly published with <a target="_blank" href="https://astro.build/">Astro</a>',
    ],
  },
}
```

- [ ] **Step 3: 验证类型**

Run: `npx astro check 2>&1 | tail -20`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/.config/user.ts
git commit -m "feat: configure site info + egg easter egg social link

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: 修社媒站内链接不开新窗口

**Files:**
- Modify: `src/components/SiteNavigation.astro`

**Interfaces:**
- Consumes: `socialLinks`（含 `/welcome/`、`/atom.xml` 站内链接）
- Produces: 站内社媒链接同窗跳转，外链新窗

- [ ] **Step 1: 改 SiteNavigation 社媒渲染逻辑**

把 `src/components/SiteNavigation.astro` 里社媒那段：
```astro
{
  socialLinks.map(({ href, name }) => (
    <li>
      <a href={href} target="_blank" title={name} class="not-underline-hover inline-flex items-center">
        <span class:list={[`i-mdi-${name}`, 'w-6 h-6']}>{name}</span>
      </a>
    </li>
  ))
}
```
改为（外链才 `target="_blank"`）：
```astro
{
  socialLinks.map(({ href, name }) => {
    const external = href.startsWith('http')
    return (
      <li>
        <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined} title={name} class="not-underline-hover inline-flex items-center">
          <span class:list={[`i-mdi-${name}`, 'w-6 h-6']}>{name}</span>
        </a>
      </li>
    )
  })
}
```

- [ ] **Step 2: 验证 build**

Run: `npm run build 2>&1 | tail -25`
Expected: 构建成功，`dist/` 产出（此时 `/welcome/` 还没有，彩蛋链接 404 是预期的，下个 Task 补）

- [ ] **Step 3: Commit**

```bash
git add src/components/SiteNavigation.astro
git commit -m "feat: open internal social links in same tab

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: HomePage 开屏页接入 public/welcome/ + 返回 / 接线

**Files:**
- Create: `scripts/build-welcome.mjs`（构建脚本，CI 与本地共用）
- Create: `public/welcome/`（构建产物落地处，gitignore）

**Interfaces:**
- Consumes: `package.json.landingPage`
- Produces: `public/welcome/index.html`（开屏页，enter/Blog 指向 `/`）

- [ ] **Step 1: 加 welcome 到 gitignore**

在 `.gitignore` 末尾加：
```
# HomePage landing build output (regenerated on build)
public/welcome/
```

- [ ] **Step 2: 写构建脚本 scripts/build-welcome.mjs**

```js
// ponytail: 单一脚本,clone HomePage → 注入 landingPage → build → 拷到 public/welcome/
import { execSync } from 'node:child_process'
import fs from 'node:fs'

const landingPage = JSON.parse(fs.readFileSync('package.json', 'utf8')).landingPage
if (!landingPage) throw new Error('package.json.landingPage missing')

const tmp = '.homepage'
execSync(`rm -rf ${tmp} && git clone --depth=1 https://github.com/SimonAKing/HomePage.git ${tmp}`, { stdio: 'inherit' })

const cfgPath = `${tmp}/config.json`
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))

cfg.head = cfg.head || {}; cfg.intro = cfg.intro || {}; cfg.main = cfg.main || {}
if (landingPage.name) { cfg.head.title = landingPage.name; cfg.intro.title = landingPage.name; cfg.main.name = landingPage.name }
if (landingPage.signature) cfg.main.signature = landingPage.signature
if (landingPage.avatar) { cfg.main.avatar = cfg.main.avatar || {}; cfg.main.avatar.link = landingPage.avatar }
cfg.main.ul = cfg.main.ul || {}
cfg.main.ul.first = { href: '/', icon: 'bokeyuan', text: 'Blog' }       // 返回博客
if (landingPage.email) { cfg.main.ul.third = { href: landingPage.email, icon: 'email', text: 'Email' } }
if (landingPage.github) { cfg.main.ul.fourth = { href: landingPage.github, icon: 'github', text: 'Github' } }
// intro.enter 点击 → 返回 / : HomePage 用 intro.enter 文案,main 显示导航;enter 行为由其 JS 驱动到 main.ul.first.href('/')
cfg.intro.enter = landingPage.enter || 'enter'

fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, '\t') + '\n')

execSync(`cd ${tmp} && npm install && npm run build`, { stdio: 'inherit' })

fs.rmSync('public/welcome', { recursive: true, force: true })
fs.mkdirSync('public/welcome', { recursive: true })
// 拷 dist 全部内容到 public/welcome/
fs.cpSync(`${tmp}/dist`, 'public/welcome', { recursive: true })
fs.rmSync(tmp, { recursive: true, force: true })
console.log('✓ welcome built into public/welcome/')
```

- [ ] **Step 3: 加 npm script**

在 `package.json` 的 `scripts` 加：
```json
"build:welcome": "node scripts/build-welcome.mjs",
"build": "astro check && astro build"
```
（注意 `build` 主题原本是 `astro check && astro build`，保持不变；新增 `build:welcome`。最终 CI 先跑 `build:welcome` 再 `build`。）

- [ ] **Step 4: 本地跑构建脚本**

Run: `npm run build:welcome`
Expected: `public/welcome/index.html` 存在，含注入的 `Allen Wang` / `/` 链接

- [ ] **Step 5: 验证返回链已注入**

Run: `grep -o 'href="/"' public/welcome/index.html | head -3` ; `grep -c 'Allen Wang' public/welcome/index.html`
Expected: 至少 1 个 `href="/"`；Allen Wang 出现 ≥1 次

- [ ] **Step 6: 完整 build 验证**

Run: `npm run build`
Expected: `dist/welcome/index.html` 存在（astro 把 public/ 拷进 dist）；`dist/index.html` 存在

- [ ] **Step 7: Commit**

```bash
git add .gitignore scripts/build-welcome.mjs package.json
git commit -m "feat: build HomePage landing into public/welcome as easter egg

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: 重写 CI 部署 workflow

**Files:**
- Modify: `.github/workflows/pages.yml`

**Interfaces:**
- Consumes: Task 5 的 `build:welcome` + `build`
- Produces: push 到 main → 部署到 GitHub Pages

- [ ] **Step 1: 重写 pages.yml**

替换 `.github/workflows/pages.yml` 全部内容为：
```yaml
name: Deploy Astro to GitHub Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 1

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - name: Build HomePage landing into public/welcome
        run: npm run build:welcome

      - run: npm run build

      - uses: actions/configure-pages@v5

      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/pages.yml
git commit -m "ci: deploy Astro build to GitHub Pages

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: 本地端到端验收

**Files:** 无（验证步骤）

- [ ] **Step 1: 完整构建**

Run: `npm run build:welcome && npm run build`
Expected: `dist/index.html`、`dist/welcome/index.html` 都存在

- [ ] **Step 2: 起预览服务器测彩蛋往返**

Run: `npm run preview &` ; 等 3 秒
- `curl -s http://localhost:4321/ | grep -o 'i-mdi-egg'` → 应有
- `curl -s -o /dev/null -w '%{http_code}' http://localhost:4321/welcome/` → 200
- `curl -s http://localhost:4321/welcome/ | grep -o 'Allen Wang'` → 应有
- `curl -s http://localhost:4321/welcome/ | grep -o 'href="/"'` → 应有（返回博客链）
然后 `pkill -f 'astro preview'`
Expected: 全部通过

- [ ] **Step 3: 推送触发 CI**

Run: `git push origin main`
Expected: push 成功，GitHub Actions 触发

- [ ] **Step 4: 报告**

向用户报告：本地构建已通过，已 push，CI 进行中，等部署成功后访问 `https://3sa.email/` 与 `https://3sa.email/welcome/` 验收。

## 验收标准（来自 spec）

1. 本地 `npm run build` 产出 `dist/`，含 `dist/index.html`（1 篇《记 VRP 项目》）+ `dist/welcome/index.html`。
2. 社媒 `egg` 图标 → `/welcome/`；开屏页 enter/Blog → `/`。
3. push → CI 绿 → `https://3sa.email/` 与 `/welcome/` 行为正确。
