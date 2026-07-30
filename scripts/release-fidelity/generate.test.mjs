import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { generatePacket } from './generate.mjs'

test('generates a self-contained side-by-side packet for desktop and mobile', async () => {
  const root = await mkdtemp(join(tmpdir(), 'boxbox-fidelity-'))
  const evidence = join(root, 'evidence')
  const mockups = join(root, 'mockups')
  const references = [
    ['desktop', 'weekend-between-races'],
    ['desktop', 'weekend-live'],
    ['mobile', 'weekend-between-sessions-mobile'],
  ]
  for (const [viewport, name] of references) {
    await mkdir(join(evidence, 'candidate', viewport), { recursive: true })
    await mkdir(mockups, { recursive: true })
    await writeFile(join(evidence, 'candidate', viewport, `${name}.png`), 'candidate')
    await writeFile(join(mockups, `${name}.png`), 'mockup')
  }

  await generatePacket({ version: 'v-test', evidence, mockups })
  assert.match(await readFile(join(evidence, 'index.html'), 'utf8'), /Approved mockup/)
  assert.match(await readFile(join(evidence, 'summary.md'), 'utf8'), /human owner decision required/)
})
