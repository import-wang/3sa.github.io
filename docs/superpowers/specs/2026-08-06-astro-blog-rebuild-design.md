---
date: 2026-08-06
topic: 博客从 Hexo 迁移到 astro-theme-typography + HomePage 彩蛋开屏页
status: draft
---

# 设计：Hexo → Astro (astro-theme-typography) 重构

## 背景与目标

当前仓库是 Hexo 8 博客（`dashed` 主题），博客挂在 `/blog` 子路径，首页由 build 时 `git clone` 的 [SimonAKing/HomePage](https://github.com/SimonAKing/HomePage) landing 页承担（pug+gulp 构建，按 `package.json.landingPage` 注入个人信息）。托管在 GitHub Pages + 自定义域名 `3sa.email`。

目标：彻底重构，用 [astro-theme-typography](https://github.com/moeyua/astro-theme-typography)（Astro + UnoCSS + TS，极简排版风）替代 Hexo；保留 HomePage 开屏页作为"隐藏彩蛋"。先搭框架部署，看到成功后再丰富内容。

## 路由模型

| 路径 | 内容 |
|------|------|
| `/` | Astro 博客（文章列表，主页） |
| `/welcome/` | HomePage 开屏页（彩蛋入口，默认不为人知） |
| `/posts/[id]` `/archive` `/categories` `/about` | Astro 主题自带路由 |
| `/atom.xml` `/sitemap-index.xml` `/robots.txt` | Astro 主题自带 |

Astro 占根路径 `/`（标准做法，SEO/站点地图干净）。HomePage 开屏页降级为隐藏彩蛋页 `/welcome/`。

## 彩蛋机制

**触发**：Astro 站点导航栏社媒按钮区新增一个隐蔽图标 `i-mdi-egg`（UnoCSS 内置 Material Design Icons，无需额外资源），`href: '/welcome/'`。

**返回**：HomePage 开屏页的 `enter`/Blog 按钮改为指向 `/`，点击返回 Astro 主站。

**接线**：主题 `src/components/SiteNavigation.astro` 现有逻辑用 `i-mdi-${name}` 渲染社媒图标（来自 `socialLinks` 配置），故仅在 `src/.config/user.ts` 的 `socialLinks` 加一条 `{ name: 'egg', href: '/welcome/' }` 即可，不改组件。

**站内链接修正**：`SiteNavigation.astro` 现对所有社媒链接加 `target="_blank"`。对站内链接（`/welcome/`、`/atom.xml`）新窗口打开体验差——实现时改为：站内链接不开新窗口，仅外链 `target="_blank"`。判定方式：`href` 以 `http` 开头才 `target="_blank"`。

## 构建链路（方案 A）

HomePage 产物并入 Astro `public/welcome/`，单次 `astro build` 产出全站：

1. `npm ci`（Astro 依赖）
2. clone HomePage → `npm install && npm run build`（gulp）→ 产出 `dist/`
3. 拷 `dist/*` 到 Astro 的 `public/welcome/`
4. `npm run build`（astro build，自动把 `public/` 内容拷进 `dist/`）
5. 上传 `dist/` 到 GitHub Pages

**单一数据源**：`package.json.landingPage` 保持为个人信息唯一来源，build 脚本注入到两边：
- HomePage `config.json`：name/signature/email/github/avatar + 把 `main.ul.first.href` 改为 `/`、enter 动作指向 `/`
- 生成 `src/.config/user.ts` 的 site 字段：title/author = name，description/subtitle = signature，socialLinks 含真实 github/email + 彩蛋 egg

（沿用现有 build 脚本里那段 `node -e` 注入逻辑，扩展即可。）

## 仓库结构变更

删：`source/`、`themes/`、`_config.yml`(hexo)、`_config.landscape.yml`、旧 `package.json`/`package-lock.json`/`yarn.lock`、`source/_posts/*.md`（仅保留一篇）。

建（从 astro-theme-typography 取）：
```
3sa.github.io/
├─ src/
│  ├─ .config/user.ts          # Allen Wang / 3sa.email / 社媒(含彩蛋)
│  ├─ content/posts/记VRP项目.md  # 唯一保留文章
│  └─ ...（主题其余文件）
├─ public/
│  ├─ CNAME                    # 3sa.email
│  └─ welcome/                 # HomePage 构建产物落地处
├─ astro.config.ts  package.json  uno.config.js  tsconfig.json  ...
└─ .github/workflows/pages.yml  # 重写为 Astro 构建
```

## 文章处理

现有 3 篇 md：
- `main_建模技巧说明.md`（frontmatter title 已是「记 VRP 项目」）→ 保留，重命名为 `记VRP项目.md`，迁到 `src/content/posts/`
- `hello-world.md` → 删除
- `test_photo_gallery.md` → 删除

frontmatter 兼容性：Hexo 用 `categories: [name]` + `tags: [a,b]`，astro-theme-typography（基于 Astro content collections）用 `category: name` + `tags: [a,b]`。迁移时需把 `categories:` 单数化为 `category:`（按主题 content schema）。具体以主题 `content.config.ts` 为准——实现时核对。

## CI 部署（重写 `.github/workflows/pages.yml`）

```yaml
name: Deploy Astro to GitHub Pages
on:
  push: { branches: [main] }
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
        with: { fetch-depth: 1 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - name: Build HomePage landing into public/welcome
        run: |
          git clone --depth=1 https://github.com/SimonAKing/HomePage.git .homepage
          # 注入 package.json.landingPage → .homepage/config.json（沿用现有 node -e，扩展 first.href=/ 与 enter→/）
          cd .homepage && npm install && npm run build && cd ..
          mkdir -p public/welcome
          cp -R .homepage/dist/* public/welcome/
          rm -rf .homepage
      - run: npm run build   # astro build → dist/
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with: { path: ./dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: ${{ steps.deployment.outputs.page_url }} }
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

`CNAME` 进 `public/CNAME`，Astro 拷到 dist 根，自定义域名 `3sa.email` 不变。

## 不做（YAGNI · 先搭框架阶段）

- 不加评论（giscus/disqus/twikoo）
- 不加 analytics（GA/umami）
- 不加 i18n（默认 zh-cn）
- 不动 KaTeX 默认开关（latex.katex=false）
- 不动 HomePage 背景动画/supportAuthor 默认行为

部署成功后再丰富内容、配置这些。

## 验收标准

1. 本地 `npm run build` 产出 `dist/`，含：
   - `dist/index.html`（Astro 文章列表，1 篇《记 VRP 项目》）
   - `dist/welcome/index.html`（HomePage 开屏页）
2. 本地 `npm run preview` 验证：
   - `/` 显示 Astro 博客
   - 社媒栏 `egg` 图标点击 → `/welcome/` 显示开屏页
   - 开屏页 enter/Blog 点击 → `/` 返回博客
   - `/posts/记vrp项目/` 能打开文章
3. push 到 main → CI 绿 → `https://3sa.email/` 与 `https://3sa.email/welcome/` 行为同上。

## 风险与注意

- **HomePage 相对资源路径**：其 `dist/` 用相对路径（`css/style.css`、`js/main.js`、`assets/avatar.jpg`），挂在 `/welcome/` 下需确保 enter/返回链接用绝对路径 `/`。开屏页内其他 href（如 `blog/`、`about/`）指向的 Hexo 旧路由已不存在——config 注入时把这些改为 `/` 或移除，避免死链。
- **社媒图标名 `egg`**：依赖 UnoCSS 内置 `@iconify-json/mdi` 中存在 `egg`。实现时若 `i-mdi-egg` 不渲染，换 `incognito`/`puzzle`/`dots-circle` 等 Material Icons 中确定存在的。
- **Astro `astro check`**：主题 `build` 脚本是 `astro check && astro build`，CI 需保证 `astro check` 通过（类型零错误）。若主题有未修复的类型告警，临时改 build 为仅 `astro build`。
- **HomePage `npm run build` 在 CI**：其 `package.json` 无 dependencies（deps 为空），但用 gulp + pug，需 `npm install` 拉 devDependencies。脚本里已含。
