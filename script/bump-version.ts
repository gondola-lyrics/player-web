import { readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

import { LOCKFILE, MANIFEST, fail, isSemanticVersion } from './utils'

const main = () => {
  const { positionals } = parseArgs({ allowPositionals: true })
  const version = positionals[0]
  if (version === undefined) {
    return fail('usage: bump-version <version>')
  }
  if (!isSemanticVersion(version)) {
    return fail(`${JSON.stringify(version)} is not a semantic version`)
  }
  if (version === '0.0.0') {
    return fail('0.0.0 is the placeholder, not a release version')
  }

  const text = readFileSync(MANIFEST, 'utf8')
  if (JSON.parse(text).version === version) {
    return fail(`package.json is already ${version}`)
  }

  const lockfile = JSON.parse(readFileSync(LOCKFILE, 'utf8'))
  lockfile.version = version
  lockfile.packages[''].version = version

  // Only the version field is rewritten, so formatting elsewhere in the manifest survives untouched.
  writeFileSync(MANIFEST, text.replace(/("version":\s*)"[^"]*"/, `$1"${version}"`))
  writeFileSync(LOCKFILE, `${JSON.stringify(lockfile, null, 2)}\n`)
  console.log(`package.json and package-lock.json: ${version}`)
}

main()
