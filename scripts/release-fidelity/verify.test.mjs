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

function verify(root, evidence) {
  return execFileSync(process.execPath, [verifier, '--version', 'v-test', '--evidence', evidence], {
    cwd: root,
    encoding: 'utf8',
  })
}

async function approvedCandidate({ changeCodeWithSignoff = false, decision = 'approved' } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'boxbox-fidelity-verify-'))
  git(root, 'init')
  git(root, 'config', 'user.email', 'test@example.com')
  git(root, 'config', 'user.name', 'Test')
  await writeFile(join(root, 'candidate.txt'), 'candidate')
  git(root, 'add', 'candidate.txt')
  git(root, 'commit', '-m', 'candidate')
  const candidate = git(root, 'rev-parse', 'HEAD')

  await mkdir(join(root, 'docs/release/owner-reviews'), { recursive: true })
  await writeFile(join(root, 'docs/release/owner-reviews/v-test.md'), `- Version: v-test\n- Candidate commit: ${candidate}\n- Reviewed by: Owner\n- Reviewed on: 2026-07-30\n- Decision: ${decision}\n`)
  if (changeCodeWithSignoff) await writeFile(join(root, 'candidate.txt'), 'changed with approval')
  git(root, 'add', 'docs/release/owner-reviews/v-test.md')
  if (changeCodeWithSignoff) git(root, 'add', 'candidate.txt')
  git(root, 'commit', '-m', 'owner sign-off')

  const evidence = join(root, 'evidence')
  await mkdir(evidence)
  await writeFile(join(evidence, 'index.html'), '')
  await writeFile(join(evidence, 'summary.md'), '')
  return { candidate, evidence, root }
}

function assertBlocked(root, evidence) {
  assert.throws(() => verify(root, evidence), (error) => {
    assert.match(String(error.stderr), /HEAD must contain only the sign-off file change/)
    return true
  })
}

test('accepts a sign-off-only HEAD for its direct parent candidate', async () => {
  const { candidate, evidence, root } = await approvedCandidate()
  const output = verify(root, evidence)
  assert.match(output, new RegExp(candidate))
})

test('rejects code committed after approval', async () => {
  const { evidence, root } = await approvedCandidate()
  await writeFile(join(root, 'candidate.txt'), 'changed after review')
  git(root, 'add', 'candidate.txt')
  git(root, 'commit', '-m', 'code after approval')

  assertBlocked(root, evidence)
})

test('rejects a sign-off commit that also changes code', async () => {
  const { evidence, root } = await approvedCandidate({ changeCodeWithSignoff: true })
  assertBlocked(root, evidence)
})

test('rejects a dirty working-tree edit that spoofs approval', async () => {
  const { candidate, evidence, root } = await approvedCandidate({ decision: 'rejected' })
  await writeFile(join(root, 'docs/release/owner-reviews/v-test.md'), `- Version: v-test\n- Candidate commit: ${candidate}\n- Reviewed by: Owner\n- Reviewed on: 2026-07-30\n- Decision: approved\n`)

  assert.throws(() => verify(root, evidence), (error) => {
    assert.match(String(error.stderr), /Decision: approved/)
    return true
  })
})
