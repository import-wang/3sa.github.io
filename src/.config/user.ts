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
