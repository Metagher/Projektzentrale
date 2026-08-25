import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

function resolveCommit(environment: Record<string, string | undefined>): string {
  const providedCommit = environment.VITE_COMMIT_SHA
    || environment.GITHUB_SHA
    || environment.VERCEL_GIT_COMMIT_SHA
    || environment.CF_PAGES_COMMIT_SHA

  if (providedCommit) return providedCommit.slice(0, 8)

  try {
    return execFileSync('git', ['rev-parse', '--short=8', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    return 'local'
  }
}

export default defineConfig(({ mode }) => {
  const environment = { ...process.env, ...loadEnv(mode, process.cwd(), '') }

  return {
    base: '/Projektzentrale/',
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version),
      __COMMIT_HASH__: JSON.stringify(resolveCommit(environment)),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
  }
})
