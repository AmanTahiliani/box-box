import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? fallback : process.argv[index + 1]
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

const version = option('version', process.env.RELEASE_FIDELITY_VERSION ?? 'v0.4.0')
const output = process.env.RELEASE_FIDELITY_OUTPUT ?? 'release-fidelity'
const evidence = resolve(option('evidence', join(output, version)))
const signoff = option('signoff', join('docs/release/owner-reviews', `${version}.md`))
const required = ['index.html', 'summary.md']

try {
  for (const file of required) await readFile(join(evidence, file))
  git('cat-file', '-e', `HEAD:${signoff}`)
  const text = await readFile(signoff, 'utf8')
  const candidate = text.match(/^- Candidate commit: ([0-9a-f]{40})$/mi)?.[1]
  if (!candidate) throw new Error(`${signoff} must contain a full candidate commit SHA`)
  git('cat-file', '-e', `${candidate}^{commit}`)
  const parent = git('rev-parse', 'HEAD^')
  const changed = git('diff', '--name-only', 'HEAD^', 'HEAD').split('\n').filter(Boolean)
  if (changed.length !== 1 || changed[0] !== signoff) {
    throw new Error(`HEAD must contain only the sign-off file change: ${signoff}`)
  }
  if (candidate.toLowerCase() !== parent.toLowerCase()) {
    throw new Error(`${signoff} candidate must equal HEAD^ (${parent})`)
  }
  const fields = [
    ['Version', version],
    ['Reviewed by', '.+'],
    ['Reviewed on', '\\d{4}-\\d{2}-\\d{2}'],
    ['Decision', 'approved'],
  ]
  for (const [name, value] of fields) {
    if (!new RegExp(`^- ${name}: ${value}$`, 'm').test(text)) {
      throw new Error(`${signoff} must contain "- ${name}: ${value}"`)
    }
  }
  console.log(`Release-fidelity evidence and committed owner approval verified for ${version} at ${candidate}.`)
} catch (error) {
  console.error(`Release-fidelity gate blocked: ${error.message}`)
  process.exitCode = 1
}
