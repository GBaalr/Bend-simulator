import { SAMPLE_PRESETS } from '../src/core/presets'
import { STANDARD_PUNCHES, STANDARD_DIES, DEFAULT_MACHINE_ENVELOPE } from '../src/core/toolingCatalog'
import { solveBendSequence } from '../src/core/sequenceSolver'

const deepGoose = STANDARD_PUNCHES.find(p => p.type === 'deep_gooseneck')!
const uResult = solveBendSequence(SAMPLE_PRESETS.u_channel.part, deepGoose, STANDARD_DIES[3], DEFAULT_MACHINE_ENVELOPE, 2.0)
const s1 = uResult.bestSequence!.steps[1]
console.log('Step 1 collisions with deep gooseneck:')
for (const cp of s1.collisionResult.collisionPoints) {
  console.log(`Hit with ${cp.entity} at flange ${cp.flangeIndex}, point (${cp.x.toFixed(1)}, ${cp.y.toFixed(1)})`)
}
