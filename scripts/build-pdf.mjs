// Builds docs/ORBIT-Playbook.pdf from the Markdown docs (the Markdown stays the source of truth).
// Uses `npx marked` (no repo dependency) and a locally installed Edge or Chrome in headless mode.
// Run from the repo root: npm run docs:pdf
import { execFileSync, execSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const SECTIONS = [
  ['ORBIT team playbook', 'docs/PLAYBOOK.md'],
  ['Appendix A: API and data contract', 'docs/API.md'],
  ['Appendix B: Integration contract', 'docs/INTEGRATION.md'],
  ['Appendix C: Coding-agent rules (AGENTS.md)', 'AGENTS.md'],
  ['Appendix D: Design system', 'docs/DESIGN_SYSTEM.md'],
  ['Appendix E: Personal LLM allocator', 'docs/ALLOCATOR.md'],
]

const BROWSERS = [
  process.env.BROWSER_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean)

const browser = BROWSERS.find((path) => existsSync(path))
if (!browser) {
  console.error(
    '[docs] No Edge/Chrome found. Set BROWSER_PATH to a Chromium-based browser executable.',
  )
  process.exit(1)
}

const tmp = mkdtempSync(join(tmpdir(), 'orbit-pdf-'))
const toHtml = (file) => {
  const input = join(tmp, 'in.md')
  writeFileSync(input, readFileSync(file, 'utf8'))
  return execSync(`npx -y marked@18 --gfm -i "${input}"`, { encoding: 'utf8' })
}

const generated = new Date().toISOString().slice(0, 10)
const body = SECTIONS.map(
  ([title, file], i) =>
    `<section class="doc${i ? ' break' : ''}"><p class="source">${title} · source: ${file}</p>${toHtml(file)}</section>`,
).join('\n')

const html = `<!doctype html><html><head><meta charset="utf-8"><title>ORBIT Team Playbook</title><style>
  @page { size: A4; margin: 16mm 14mm; }
  body { font: 10.5pt/1.5 'Segoe UI', system-ui, sans-serif; color: #111827; }
  .cover { height: 250mm; display: flex; flex-direction: column; justify-content: center; }
  .cover h1 { font-size: 40pt; letter-spacing: .12em; margin: 0; color: #0b1220; }
  .cover .tag { font-size: 14pt; color: #0e7490; margin: 6mm 0 12mm; }
  .cover p { color: #374151; }
  .break { break-before: page; }
  .source { font: 8.5pt Consolas, monospace; color: #0e7490; text-transform: uppercase; letter-spacing: .08em; border-bottom: 1px solid #cbd5e1; padding-bottom: 2mm; }
  h1 { font-size: 20pt; color: #0b1220; } h2 { font-size: 14pt; color: #0e7490; margin-top: 7mm; break-after: avoid; }
  h3 { font-size: 11.5pt; break-after: avoid; }
  table { border-collapse: collapse; width: 100%; margin: 3mm 0; font-size: 9pt; break-inside: auto; }
  tr { break-inside: avoid; } th, td { border: 1px solid #cbd5e1; padding: 1.5mm 2mm; text-align: left; vertical-align: top; }
  th { background: #e0f2fe; }
  code { font: 8.8pt Consolas, monospace; background: #f1f5f9; padding: 0 1mm; border-radius: 1mm; }
  pre { background: #0b1220; color: #e2e8f0; padding: 3mm; border-radius: 2mm; font-size: 7.6pt; line-height: 1.35; white-space: pre-wrap; break-inside: avoid; }
  pre code { background: none; color: inherit; padding: 0; }
  a { color: #0e7490; text-decoration: none; }
</style></head><body>
<div class="cover"><h1>ORBIT</h1><p class="tag">Team playbook: foundation reference</p>
<p>AI-powered global intelligence on a 3D globe. Global → Country → Event → Explanation → Ask ORBIT.</p>
<p>Team: Arham · Ayman · Affan · Shrey · Hardik</p>
<p>Generated ${generated} from the Markdown sources in the repository. If this PDF and the repository disagree, the repository wins.</p></div>
${body}
</body></html>`

const htmlPath = join(tmp, 'playbook.html')
writeFileSync(htmlPath, html)
const out = resolve('docs/ORBIT-Playbook.pdf')
execFileSync(
  browser,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-pdf-header-footer',
    `--print-to-pdf=${out}`,
    pathToFileURL(htmlPath).href,
  ],
  { stdio: 'ignore' },
)
console.log(`[docs] wrote ${out}`)
