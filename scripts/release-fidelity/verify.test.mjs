import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

const verifier = resolve('scripts/release-fidelity/verify.mjs')

function git(directory, ...args) {
  return execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim()
}

test('accepts a committed sign-off for an ancestor candidate', async () => {
  const root = await mkdtemp(join(tmpdir(), 'boxbox-fidelity-verify-'))
  git(root, 'init')
  git(root, 'config', 'user.email', 'test@example.com')
  git(root, 'config', 'user.name', 'Test')
  await writeFile(join(root, 'candidate.txt'), 'candidate')
  git(root, 'add', 'candidate.txt')
  git(root, 'commit', '-m', 'candidate')
  const candidate = git(root, 'rev-parse', 'HEAD')

  await mkdir(join(root, 'docs/release/owner-reviews'), { recursive: true })
  await writeFile(join(root, 'docs/release/owner-reviews/v-test.md'), `- Version: v-test\n- Candidate commit: ${candidate}\n- Reviewed by: Owner\n- Reviewed on: 2026-07-30\n- Decision: approved\n`)
  git(root, 'add', 'docs/release/owner-reviews/v-test.md')
  git(root, 'commit', '-m', 'owner sign-off')

  const evidence = join(root, 'evidence')
  await mkdir(evidence)
  await writeFile(join(evidence, 'index.html'), '')
  await writeFile(join(evidence, 'summary.md'), '')
  const output = execFileSync(process.execPath, [verifier, '--version', 'v-test', '--evidence', evidence], {
    cwd: root,
    encoding: 'utf8',
  })
  assert.match(output, new RegExp(candidate))
})
