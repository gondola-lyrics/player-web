import { basename, resolve } from 'node:path'
import { parse } from 'semver'

export const PACKAGE_ROOT = resolve(import.meta.dirname, '..')

export const REPO_ROOT = PACKAGE_ROOT

export const MANIFEST = resolve(PACKAGE_ROOT, 'package.json')
export const LOCKFILE = resolve(PACKAGE_ROOT, 'package-lock.json')

const SCRIPT_NAME = basename(process.argv[1] ?? 'script', '.ts')

/**
 * Stops before later release steps can run with invalid input or incomplete state.
 */
export const fail: (reason: string) => never = (reason) => {
  console.error(`${SCRIPT_NAME}: ${reason}`)
  process.exit(1)
}

/**
 * Rejects normalized prefixes and whitespace so manifest versions and release tags stay aligned.
 */
export const isSemanticVersion = (version: string): boolean => {
  const parsed = parse(version)
  if (parsed === null) {
    return false
  }
  const canonical = parsed.build.length === 0 ? parsed.version : `${parsed.version}+${parsed.build.join('.')}`
  return version === canonical
}
