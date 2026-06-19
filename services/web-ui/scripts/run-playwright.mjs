import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

const port = process.env.PLAYWRIGHT_PORT || '4174'
const baseUrl = `http://127.0.0.1:${port}`
const rootDir = process.cwd()

function spawnNode(args, env, stdio = 'pipe') {
  return spawn(process.execPath, args, {
    cwd: rootDir,
    env,
    stdio,
  })
}

async function stopProcess(child) {
  if (!child?.pid || child.killed) return

  if (process.platform === 'win32') {
    await new Promise((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
        stdio: 'ignore',
      })
      killer.on('exit', () => resolve())
      killer.on('error', () => resolve())
    })
    return
  }

  child.kill('SIGTERM')
  await new Promise((resolve) => {
    child.once('exit', () => resolve())
    setTimeout(resolve, 3000)
  })
}

async function waitForServer(url, timeoutMs = 30000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${url}/login`)
      if (response.ok) return
    } catch {
      // Retry until server is ready.
    }
    await delay(500)
  }
  throw new Error(`Vite server did not become ready at ${url}`)
}

const viteEnv = {
  ...process.env,
  VITE_MOCK_AUTH: 'true',
  VITE_REQUIRE_AUTH: 'true',
  VITE_DEV_HOST: '127.0.0.1',
  VITE_PORT: port,
}

const vite = spawnNode(
  ['./node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', port],
  viteEnv,
)

vite.stdout?.on('data', (chunk) => process.stdout.write(chunk))
vite.stderr?.on('data', (chunk) => process.stderr.write(chunk))

let finished = false

async function cleanupAndExit(code) {
  if (finished) return
  finished = true
  await stopProcess(vite)
  process.exit(code)
}

process.on('SIGINT', () => {
  void cleanupAndExit(130)
})

process.on('SIGTERM', () => {
  void cleanupAndExit(143)
})

vite.on('exit', (code) => {
  if (!finished && code && code !== 0) {
    void cleanupAndExit(code)
  }
})

try {
  await waitForServer(baseUrl)

  const runner = spawnNode(
    ['./node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)],
    {
      ...process.env,
      PLAYWRIGHT_EXTERNAL_SERVER: 'true',
      PLAYWRIGHT_PORT: port,
    },
    'inherit',
  )

  runner.on('exit', (code) => {
    void cleanupAndExit(code ?? 1)
  })

  runner.on('error', () => {
    void cleanupAndExit(1)
  })
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  await cleanupAndExit(1)
}
