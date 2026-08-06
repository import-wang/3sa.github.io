// ponytail: 单一脚本 — clone HomePage → 注入 landingPage → build → 拷到 public/welcome/
import { execSync } from 'node:child_process'
import fs from 'node:fs'

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
const lp = pkg.landingPage
if (!lp) throw new Error('package.json.landingPage missing')

const tmp = '.homepage'
execSync(`rm -rf ${tmp} && git clone --depth=1 https://github.com/SimonAKing/HomePage.git ${tmp}`, { stdio: 'inherit' })

const cfgPath = `${tmp}/config.json`
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))

cfg.head = cfg.head || {}
cfg.intro = cfg.intro || {}
cfg.main = cfg.main || {}

if (lp.name) {
  cfg.head.title = lp.name
  cfg.intro.title = lp.name
  cfg.main.name = lp.name
}
if (lp.signature) cfg.main.signature = lp.signature
if (lp.avatar) {
  cfg.main.avatar = cfg.main.avatar || {}
  cfg.main.avatar.link = lp.avatar
}

// 导航: Blog 按钮返回 Astro 主站; About 指向 Astro 的 /about; Email/Github 用真实链接
// main.pug 按位置键 first/second/third/fourth 解构,故四个都要设,不能留空导致 undefined。
cfg.main.ul = cfg.main.ul || {}
cfg.main.ul.first = { href: '/', icon: 'bokeyuan', text: 'Blog' }
cfg.main.ul.second = { href: '/about', icon: 'xiaolian', text: 'About' }
if (lp.email) cfg.main.ul.third = { href: lp.email, icon: 'email', text: 'Email' }
if (lp.github) cfg.main.ul.fourth = { href: lp.github, icon: 'github', text: 'Github' }

fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, '\t') + '\n')

execSync(`cd ${tmp} && npm install && npm run build`, { stdio: 'inherit' })

fs.rmSync('public/welcome', { recursive: true, force: true })
fs.mkdirSync('public/welcome', { recursive: true })
fs.cpSync(`${tmp}/dist`, 'public/welcome', { recursive: true })
fs.rmSync(tmp, { recursive: true, force: true })
console.log('✓ welcome built into public/welcome/')
