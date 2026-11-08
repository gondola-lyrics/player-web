/**
 * Builds the changelog section of one release.
 *
 * Usage:
 *   npm run build-change-log -- <version> [--dry-run]
 *   npm run build-change-log -- <version> --extract
 *   npm run build-change-log -- <version> --check-bump
 *   npm run build-change-log -- --rebuild
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { gt, lt } from 'semver'

import { PACKAGE_ROOT, REPO_ROOT, fail, isSemanticVersion } from './utils'

const CHANGE_LOG_FILE = 'CHANGELOG.md'

/**
 * The repository ships a single package, so tags carry no target prefix.
 */
const TAG_PREFIX = 'v'

/**
 * Playground changes are demo-only and stay out of release notes, whatever their type.
 */
const EXCLUDED_SCOPES = new Set(['playground'])

const TYPE_TITLES = new Map([
  ['feat', 'Features'],
  ['fix', 'Fixes'],
  ['perf', 'Performance'],
  ['refactor', 'Refactoring'],
  ['revert', 'Reverts'],
  ['docs', 'Documentation'],
])

const SUBJECT_PATTERN = /^(?<kind>[a-z]+)(?:\((?<scope>[\w-]+)\))?: (?<message>.+)$/
const BREAKING_PATTERN = /^breaking:\s*(?<text>.+)$/i
const GITHUB_PATTERN = /github\.com[:/](?<owner>[^/]+)\/(?<name>[^/]+?)(?:\.git)?\/?$/
const RECORDED_PATTERN = /^## v(?<version>\S+) \(/
const RELEASE_HEADING_PATTERN = /^## v(?<version>\S+) \((?<date>\d{4}-\d{2}-\d{2})\)$/

interface Commit {
  full: string
  short: string
  kind: string
  scope: string | undefined
  message: string
  breaking: string[]
}

const git = (...args: string[]): string => {
  try {
    // stderr is captured rather than forwarded, so a failure surfaces once, in the message below.
    return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (error) {
    return fail(`git ${args.join(' ')} failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * A missing remote still permits release notes without commit links.
 */
const tryGit = (...args: string[]): string | null => {
  try {
    return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return null
  }
}

const readFile = (relative: string): string | null => {
  const path = resolve(PACKAGE_ROOT, relative)
  if (!existsSync(path)) {
    return null
  }
  return readFileSync(path, 'utf8')
}

const writeFile = (relative: string, content: string) => {
  writeFileSync(resolve(PACKAGE_ROOT, relative), content, 'utf8')
}

const repoUrl = (): string | null => {
  const remote = tryGit('remote', 'get-url', 'origin')
  if (remote === null) {
    return null
  }
  const match = GITHUB_PATTERN.exec(remote.trim())
  const owner = match?.groups?.owner
  const name = match?.groups?.name
  if (owner === undefined || name === undefined) {
    return null
  }
  return `https://github.com/${owner}/${name}`
}

/**
 * Finds the newest tag below the version being built, which bounds the commits the section covers.
 */
const previousTag = (version: string): string | null => {
  if (!isSemanticVersion(version)) {
    return fail(`not a semantic version: ${version}`)
  }
  const versions = git('tag', '--list', `${TAG_PREFIX}*`)
    .split(/\s+/)
    .filter((tag) => tag !== '')
    .map((tag) => tag.slice(TAG_PREFIX.length))
    .filter((found) => {
      return isSemanticVersion(found) && lt(found, version)
    })
  if (versions.length === 0) {
    return null
  }

  const latest = versions.reduce((best, found) => {
    return gt(found, best) ? found : best
  })
  return `${TAG_PREFIX}${latest}`
}

const collectCommits = (since: string | null, until = 'HEAD'): Commit[] => {
  const revision = since === null ? until : `${since}..${until}`
  const output = git('log', revision, '--format=%H%x1f%h%x1f%s%x1f%b%x1e')
  const commits: Commit[] = []

  for (const raw of output.split('\x1e')) {
    const record = raw.replace(/^\n+|\n+$/g, '')
    if (record === '') {
      continue
    }

    const parts = record.split('\x1f')
    const full = parts[0] ?? ''
    const short = parts[1] ?? ''
    const subject = parts[2] ?? ''
    const body = parts.slice(3).join('\x1f')
    const match = SUBJECT_PATTERN.exec(subject)
    const kind = match?.groups?.kind
    const scope = match?.groups?.scope
    const message = match?.groups?.message
    if (kind === undefined || message === undefined) {
      continue
    }
    if (!TYPE_TITLES.has(kind)) {
      continue
    }
    if (scope !== undefined && EXCLUDED_SCOPES.has(scope)) {
      continue
    }

    const breaking = body.split(/\r?\n/).flatMap((line) => {
      const text = BREAKING_PATTERN.exec(line.trim())?.groups?.text?.trim()
      return text === undefined ? [] : [text]
    })

    commits.push({ full, short, kind, scope, message, breaking })
  }

  return commits
}

const formatCommit = (commit: Commit, url: string | null, message = commit.message): string => {
  const link = url === null ? commit.short : `[${commit.short}](${url}/commit/${commit.full})`
  return `${message} (${link})`
}

interface Entry {
  scope: string | undefined
  text: string
}

/**
 * Related changes stay adjacent so readers can scan one area at a time.
 * Scope order follows first occurrence to keep the newest work first.
 */
const renderEntries = (entries: Entry[]): string[] => {
  const groups = new Map<string, string[]>()
  const plain: string[] = []

  for (const entry of entries) {
    if (entry.scope === undefined) {
      plain.push(`- ${entry.text}`)
      continue
    }
    const text = `- **${entry.scope}:** ${entry.text}`
    const group = groups.get(entry.scope)
    if (group) {
      group.push(text)
    } else {
      groups.set(entry.scope, [text])
    }
  }

  return [...[...groups.values()].flat(), ...plain]
}

const formatDay = (day: Date): string => {
  const year = String(day.getFullYear())
  const month = String(day.getMonth() + 1).padStart(2, '0')
  const date = String(day.getDate()).padStart(2, '0')
  return `${year}-${month}-${date}`
}

const buildSection = (version: string, commits: Commit[], url: string | null, day: Date): string => {
  const lines = [`## v${version} (${formatDay(day)})`]

  const breaking = commits.flatMap((commit) => {
    return commit.breaking.map((text) => {
      return { scope: commit.scope, text: formatCommit(commit, url, text) }
    })
  })
  if (breaking.length > 0) {
    lines.push('', '### Breaking Changes', '')
    lines.push(...renderEntries(breaking))
  }

  for (const [kind, title] of TYPE_TITLES) {
    const group = commits.filter((commit) => commit.kind === kind)
    if (group.length === 0) {
      continue
    }
    lines.push('', `### ${title}`, '')
    const entries = group.map((commit) => {
      return { scope: commit.scope, text: formatCommit(commit, url) }
    })
    lines.push(...renderEntries(entries))
  }

  if (breaking.length === 0 && commits.length === 0) {
    lines.push('', 'No notable changes.')
  }

  return `${lines.join('\n')}\n`
}

/**
 * Tags bound each release so rebuilding never pulls later work into published notes.
 */
const rebuildChangelog = (existing: string | null, url: string | null): string => {
  if (existing === null) {
    return fail(`${CHANGE_LOG_FILE} does not exist`)
  }
  const headings = existing.split(/\r?\n/).filter((line) => line.startsWith('## v'))
  if (headings.length === 0) {
    return fail(`${CHANGE_LOG_FILE} has no recorded releases`)
  }

  return headings
    .map((heading) => {
      const match = RELEASE_HEADING_PATTERN.exec(heading)
      const version = match?.groups?.version
      const date = match?.groups?.date
      if (version === undefined || date === undefined) {
        return fail(`cannot rebuild malformed release heading: ${JSON.stringify(heading)}`)
      }
      const day = new Date(`${date}T00:00:00`)
      if (formatDay(day) !== date) {
        return fail(`cannot rebuild release with invalid date: ${date}`)
      }
      const tag = `${TAG_PREFIX}${version}`
      if (git('tag', '--list', tag).trim() !== tag) {
        return fail(`cannot rebuild ${version}: tag ${tag} does not exist`)
      }
      return buildSection(version, collectCommits(previousTag(version), tag), url, day)
    })
    .join('\n')
}

const extractSection = (text: string, version: string): string | null => {
  const lines = text.split(/\r?\n/)
  const heading = `## v${version} (`
  const start = lines.findIndex((line) => line.startsWith(heading))
  if (start === -1) {
    return null
  }

  const next = lines.findIndex((line, index) => {
    return index > start && line.startsWith('## v')
  })
  const end = next === -1 ? lines.length : next
  return `${lines
    .slice(start + 1, end)
    .join('\n')
    .trim()}\n`
}

/**
 * The first recorded release is the lower bound for the next version.
 */
const newestRelease = (text: string): string | null => {
  for (const line of text.split(/\r?\n/)) {
    const version = RECORDED_PATTERN.exec(line)?.groups?.version
    if (version === undefined) {
      continue
    }
    if (!isSemanticVersion(version)) {
      fail(`${CHANGE_LOG_FILE} records a heading that is not a semantic version: ${JSON.stringify(version)}`)
    }
    return version
  }
  return null
}

/**
 * A version that does not move forward would publish over a section already recorded.
 */
const checkBump = (version: string, existing: string | null) => {
  const previous = existing === null ? null : newestRelease(existing)
  if (previous === null) {
    return
  }
  if (!gt(version, previous)) {
    fail(`${version} does not come after ${previous}, the newest release ${CHANGE_LOG_FILE} records`)
  }
}

const main = () => {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      extract: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      'check-bump': { type: 'boolean', default: false },
      rebuild: { type: 'boolean', default: false },
    },
  })

  const version = positionals[0]
  if ([values['dry-run'], values.extract, values['check-bump'], values.rebuild].filter(Boolean).length > 1) {
    return fail('--dry-run, --extract, --check-bump and --rebuild are mutually exclusive')
  }
  const existing = readFile(CHANGE_LOG_FILE)
  if (values.rebuild) {
    if (positionals.length > 0) {
      return fail('--rebuild regenerates recorded releases and does not take a version')
    }
    writeFile(CHANGE_LOG_FILE, rebuildChangelog(existing, repoUrl()))
    console.log(`rebuilt ${CHANGE_LOG_FILE}`)
    return
  }
  if (version === undefined) {
    return fail('usage: build-change-log <version> [--dry-run | --extract | --check-bump] | --rebuild')
  }
  if (!isSemanticVersion(version)) {
    return fail(`not a semantic version: ${version}`)
  }

  const recorded = existing === null ? null : extractSection(existing, version)

  if (values.extract) {
    if (recorded === null) {
      return fail(`${CHANGE_LOG_FILE} has no section for v${version}`)
    }
    process.stdout.write(recorded)
    return
  }

  // Release preparation checks ordering before changing the manifest.
  if (values['check-bump']) {
    checkBump(version, existing)
    return
  }

  // Writing a version twice would leave two sections, and extraction only ever reaches the first.
  if (recorded !== null && !values['dry-run']) {
    return fail(`${CHANGE_LOG_FILE} already has a section for v${version}`)
  }
  // Previewing an existing release does not change the recorded version order.
  if (!values['dry-run']) {
    checkBump(version, existing)
  }

  const since = previousTag(version)
  const commits = collectCommits(since)
  const section = buildSection(version, commits, repoUrl(), new Date())

  if (values['dry-run']) {
    process.stdout.write(section)
    return
  }

  writeFile(CHANGE_LOG_FILE, existing === null ? section : `${section}\n${existing}`)
  console.log(`wrote ${CHANGE_LOG_FILE} for v${version}`)
}

main()
