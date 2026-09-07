// Converts the TanStack Start build (dist/client + dist/server) into a
// Vercel Build Output API v3 directory (.vercel/output): static assets plus
// a single Node serverless function that runs the SSR fetch handler.
// Run after `vite build`; deploy with `vercel deploy --prebuilt`.
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const OUT = '.vercel/output'

rmSync(OUT, { recursive: true, force: true })
mkdirSync(`${OUT}/functions/render.func`, { recursive: true })

cpSync('dist/client', `${OUT}/static`, { recursive: true })

// The SSR bundle imports react etc. from node_modules, so it must be bundled
// self-contained for the lambda. createRequire is aliased to avoid clashing
// with a same-named import inside the bundle.
execSync(
  [
    'bunx esbuild dist/server/server.js --bundle --platform=node --format=esm',
    `--outfile=${OUT}/functions/render.func/server.mjs`,
    `--banner:js="import { createRequire as __vcCreateRequire } from 'node:module'; const require = __vcCreateRequire(import.meta.url);"`,
    '--log-level=warning',
  ].join(' '),
  { stdio: 'inherit' },
)

writeFileSync(
  `${OUT}/functions/render.func/index.mjs`,
  `import { Readable } from 'node:stream'
import server from './server.mjs'

export default async function handler(req, res) {
  const proto = req.headers['x-forwarded-proto'] ?? 'https'
  const host = req.headers['x-forwarded-host'] ?? req.headers.host
  const url = new URL(req.url, \`\${proto}://\${host}\`)

  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue
    headers.set(key, Array.isArray(value) ? value.join(',') : value)
  }

  const body =
    req.method === 'GET' || req.method === 'HEAD' ? undefined : req
  const request = new Request(url, {
    method: req.method,
    headers,
    body,
    duplex: 'half',
  })

  const response = await server.fetch(request)

  res.statusCode = response.status
  for (const [key, value] of response.headers.entries()) {
    if (key !== 'set-cookie') res.setHeader(key, value)
  }
  const cookies = response.headers.getSetCookie?.() ?? []
  if (cookies.length) res.setHeader('set-cookie', cookies)

  if (response.body) Readable.fromWeb(response.body).pipe(res)
  else res.end()
}
`,
)

writeFileSync(
  `${OUT}/functions/render.func/.vc-config.json`,
  JSON.stringify(
    {
      runtime: 'nodejs22.x',
      handler: 'index.mjs',
      launcherType: 'Nodejs',
      supportsResponseStreaming: true,
    },
    null,
    2,
  ),
)

writeFileSync(
  `${OUT}/config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: [
        {
          src: '/assets/(.*)',
          headers: { 'cache-control': 'public, immutable, max-age=31536000' },
          continue: true,
        },
        { handle: 'filesystem' },
        { src: '/(.*)', dest: '/render' },
      ],
    },
    null,
    2,
  ),
)

console.log('Build Output API written to ' + OUT)
