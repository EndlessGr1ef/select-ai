import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const pkgPath = join(__dirname, '..', 'package.json')
const manifestPath = join(__dirname, '..', 'manifest.json')
const versionPath = join(__dirname, '..', 'src', 'version.ts')

const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))

manifest.version = pkg.version

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8')

const versionContent = `export const APP_VERSION = '${pkg.version}'\n`
writeFileSync(versionPath, versionContent, 'utf-8')

console.log(`Updated manifest.json and version.ts to ${pkg.version}`)
