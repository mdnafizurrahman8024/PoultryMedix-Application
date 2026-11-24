#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const targetDir = path.join(projectRoot, 'poultry-medix', 'src')

const AI_SLOP_TELLS = [
  { pattern: /bg-gradient-to-[a-z]+-from-(indigo|purple|violet)/i, label: 'Purple/Indigo AI gradient tell' },
  { pattern: /✨|🚀|🪄|🤖/u, label: 'Emoji magic/sparkle badge in UI code' },
  { pattern: /revolutionary\s+breakthrough|cutting-edge\s+paradigm|unleash\s+the\s+power/i, label: 'Robotic buzzword marketing copy' },
  { pattern: /glow-[a-z]+|shadow-purple|shadow-indigo/i, label: 'AI neon glow/shadow effect' },
]

function scanFile(filePath) {
  const content = readFileSync(filePath, 'utf8')
  const lines = content.split('\n')
  const findings = []

  lines.forEach((line, index) => {
    for (const tell of AI_SLOP_TELLS) {
      if (tell.pattern.test(line)) {
        findings.push({ line: index + 1, label: tell.label, snippet: line.trim() })
      }
    }
  })

  return findings
}

function walkDir(dir) {
  let results = []
  if (!existsSync(dir)) return results
  const list = readdirSync(dir)
  for (const item of list) {
    const fullPath = path.join(dir, item)
    const stat = statSync(fullPath)
    if (stat.isDirectory() && !item.includes('node_modules') && !item.startsWith('.')) {
      results = results.concat(walkDir(fullPath))
    } else if (/\.(jsx?|tsx?|css|html)$/.test(item)) {
      results.push(fullPath)
    }
  }
  return results
}

console.log('[unslop] Scanning PoultryMedix source for AI slop anti-patterns & robotic copy...')
const files = walkDir(targetDir)
let issueCount = 0

for (const file of files) {
  const relative = path.relative(projectRoot, file)
  const findings = scanFile(file)
  if (findings.length > 0) {
    console.log(`\n  File: ${relative}`)
    for (const item of findings) {
      issueCount++
      console.log(`    Line ${item.line}: [${item.label}] -> "${item.snippet.slice(0, 80)}"`)
    }
  }
}

if (issueCount === 0) {
  console.log(`\n[unslop] Clean! Scanned ${files.length} files. Zero AI cliches, purple glows, or buzzwords found.`)
} else {
  console.log(`\n[unslop] Found ${issueCount} potential slop tells across ${files.length} files.`)
}
