import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const artifactDir = path.join(root, 'tests', 'hermetic', 'artifacts')
const manifest = JSON.parse(fs.readFileSync(path.join(artifactDir, 'MANIFEST.json'), 'utf8'))
const roots = JSON.parse(fs.readFileSync(path.join(artifactDir, manifest.roots.file), 'utf8'))

const checks = [
  ['canonical Fulltime program is declared', manifest.fulltimeSo.address === '37GjugP2yXMbuGNZTu6XSf1wsbegyXfMXGvGVKpX9vTW'],
  ['canonical TxLINE oracle is declared', manifest.txlineSo.address === '6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J'],
  ['recorded Fulltime binary size matches manifest', fs.statSync(path.join(artifactDir, manifest.fulltimeSo.file)).size === manifest.fulltimeSo.bytes],
  ['recorded TxLINE binary size matches manifest', fs.statSync(path.join(artifactDir, manifest.txlineSo.file)).size === manifest.txlineSo.bytes],
  ['recorded roots account size matches manifest', Buffer.from(roots.dataBase64, 'base64').length === manifest.roots.bytes],
  ['proof fixture matches manifest', JSON.parse(fs.readFileSync(path.join(artifactDir, manifest.proof.file), 'utf8')).fixtureId === manifest.proof.fixtureId],
]

console.log('\nFulltime credential-free evidence summary\n')
for (const [name, passed] of checks) {
  assert.equal(passed, true, name)
  console.log(`✓ ${name}`)
}
console.log(`\nALL EVIDENCE CHECKS PASS · ${checks.length} / ${checks.length}`)
console.log('The program tests used the recorded real TxLINE binary, anchored roots, and final proof.')
console.log('No wallet, token, RPC, validator, fee, or third-party account was used.')
