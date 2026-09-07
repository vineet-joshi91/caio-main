import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

import ConvexProvider from '../integrations/convex/provider'
import { ThemeProvider, themeInitScript } from '../lib/theme'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'CAIO — Your AI Chief Intelligence Officer',
      },
      {
        name: 'description',
        content:
          'Upload your company documents and get an instant AI analysis, a living knowledge base, and a document-grounded advisor.',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
    scripts: [
      {
        children: themeInitScript,
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider>
          <ConvexProvider>{children}</ConvexProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}
