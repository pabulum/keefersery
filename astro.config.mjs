// @ts-check
import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import { remarkReadingTime } from './src/lib/reading-time.mjs'

export default defineConfig({
  site: 'https://keefersery.com',
  // Static output. Everything — including the GitHub activity feed — is resolved at
  // build time, so the deployed site is plain HTML with no runtime data fetching.
  output: 'static',
  trailingSlash: 'always',
  integrations: [sitemap()],
  markdown: {
    remarkPlugins: [remarkReadingTime],
    shikiConfig: { theme: 'github-dark-dimmed', wrap: true },
  },
})
