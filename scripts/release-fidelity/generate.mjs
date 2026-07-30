import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'

const references = [
  { viewport: 'desktop', name: 'weekend-between-races' },
  { viewport: 'desktop', name: 'weekend-live' },
  { viewport: 'mobile', name: 'weekend-between-sessions-mobile' },
]

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? fallback : process.argv[index + 1]
}

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? filesBelow(path) : [path]
  }))
  return files.flat()
}

async function locateMockup(root, name) {
  const preferred = join(root, `${name}.png`)
  try {
    await stat(preferred)
    return preferred
  } catch {
    const matches = (await filesBelow(root)).filter((path) => path.endsWith(`${name}.png`))
    return matches.length === 1 ? matches[0] : null
  }
}

function imageData(path) {
  return readFile(path).then((data) => `data:image/png;base64,${data.toString('base64')}`)
}

export async function generatePacket({ version, evidence, mockups }) {
  const candidateRoot = join(evidence, 'candidate')
  const pairs = []
  const missing = []

  try {
    await stat(mockups)
  } catch {
    throw new Error(`Approved mockups directory is missing: ${mockups}. It is supplied by the product reference integration.`)
  }

  for (const { viewport, name } of references) {
    const candidate = join(candidateRoot, viewport, `${name}.png`)
    const reference = await locateMockup(mockups, name)
    try {
      await stat(candidate)
    } catch {
      missing.push(`candidate: ${candidate}`)
    }
    if (!reference) missing.push(`mockup: ${join(mockups, `${name}.png`)}`)
    if (reference) pairs.push({ viewport, name, candidate, reference })
  }

  if (missing.length) {
    throw new Error(`Release-fidelity packet is incomplete:\n${missing.join('\n')}`)
  }

  const cards = await Promise.all(pairs.map(async ({ viewport, name, candidate, reference }) => `
    <section><h2>${viewport}: ${name}</h2><div class="pair">
      <figure><figcaption>Approved mockup</figcaption><img src="${await imageData(reference)}"></figure>
      <figure><figcaption>Candidate</figcaption><img src="${await imageData(candidate)}"></figure>
    </div><p>Reference: <code>${relative(process.cwd(), reference)}</code></p></section>`))
  const summary = `# Release Fidelity Evidence: ${version}\n\n- Candidate screenshots: candidate/\n- Approved mockups: ${relative(process.cwd(), mockups)}\n- Review: human owner decision required; this packet does not approve the release.\n\nOpen index.html for side-by-side evidence.\n`
  const html = `<!doctype html><title>${version} release-fidelity review</title><style>body{background:#111;color:#eee;font:16px system-ui;margin:2rem}section{margin:3rem 0}.pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}figure{margin:0}img{max-width:100%;border:1px solid #555}figcaption{font-weight:700;margin-bottom:.5rem}code{color:#9fd}@media(max-width:700px){.pair{grid-template-columns:1fr}}</style><h1>${version} Release-Fidelity Review</h1><p>Visual regression is a separate automated gate. This packet is evidence for a subjective owner review and is not approval.</p>${cards.join('')}</html>`
  await writeFile(join(evidence, 'summary.md'), summary)
  await writeFile(join(evidence, 'index.html'), html)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const version = option('version', process.env.RELEASE_FIDELITY_VERSION ?? 'v0.4.0')
  const output = process.env.RELEASE_FIDELITY_OUTPUT ?? 'release-fidelity'
  const evidence = resolve(option('evidence', join(output, version)))
  const mockups = resolve(option('mockups', join('docs/product', version, 'mockups')))
  generatePacket({ version, evidence, mockups }).then(
    () => console.log(`Release-fidelity packet: ${join(evidence, 'index.html')}`),
    (error) => { console.error(error.message); process.exitCode = 1 },
  )
}
