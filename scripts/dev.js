import { spawn } from 'node:child_process'
import net from 'node:net'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appDirectory = path.join(projectRoot, 'poultry-medix')
const apiEntryPoint = path.join(appDirectory, 'server', 'index.js')
const viteEntryPoint = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js')
const firstApiPort = Number(process.env.PORT || 8787)
const maxPortAttempts = 20

function isPortAvailable(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', (error) => {
      server.close()
      if (error.code === 'EADDRINUSE') {
        resolve(false)
        return
      }
      reject(error)
    })
    server.listen(port, '127.0.0.1', () => {
      server.close(() => resolve(true))
    })
  })
}

async function findApiPort() {
  for (let offset = 0; offset < maxPortAttempts; offset += 1) {
    const port = firstApiPort + offset
    if (await isPortAvailable(port)) return port
  }
  throw new Error(`No available API port found between ${firstApiPort} and ${firstApiPort + maxPortAttempts - 1}.`)
}

const apiPort = await findApiPort()
const children = []

function startProcess(command, args, options) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    env: { ...process.env, ...options.env },
    stdio: 'inherit',
    windowsHide: false,
  })
  children.push(child)
  return child
}

const api = startProcess(process.execPath, [apiEntryPoint], {
  env: {
    NODE_ENV: 'development',
    PORT: String(apiPort),
  },
})

const vite = startProcess(process.execPath, [viteEntryPoint], {
  env: {
    API_PORT: String(apiPort),
  },
})

let shuttingDown = false
function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) {
    if (!child.killed) child.kill(signal)
  }
}

process.once('SIGINT', () => shutdown('SIGINT'))
process.once('SIGTERM', () => shutdown('SIGTERM'))

api.once('exit', (code) => {
  if (!shuttingDown && code !== 0) {
    console.error(`[dev] API server stopped with exit code ${code ?? 'unknown'}.`)
    shutdown('SIGTERM')
    process.exitCode = code || 1
  }
})

vite.once('exit', (code) => {
  if (!shuttingDown && code !== 0) {
    console.error(`[dev] Vite stopped with exit code ${code ?? 'unknown'}.`)
    shutdown('SIGTERM')
    process.exitCode = code || 1
  }
})

console.log(`[dev] API proxy configured for http://127.0.0.1:${apiPort}`)
