import { SheetMetalPart } from '../types/sheetMetal'
import { Punch, Die, MachineEnvelope } from '../types/tooling'
import { Diagnostic, Suggestion, StepCollisionResult, EvaluatedStep } from '../types/simulation'

/**
 * Analyzes step collision results to generate technical diagnostics and actionable suggestions.
 */
export function generateStepDiagnostics(
  part: SheetMetalPart,
  stepIndex: number,
  bendIndex: number,
  orientation: 'FORWARD' | 'REVERSE',
  collisionResult: StepCollisionResult,
  punch: Punch,
  die: Die,
  envelope: MachineEnvelope
): { diagnostics: Diagnostic[]; suggestions: Suggestion[] } {
  const diagnostics: Diagnostic[] = []
  const suggestions: Suggestion[] = []

  if (!collisionResult.hasCollision) {
    return { diagnostics, suggestions }
  }

  // Iterate over each colliding point/flange
  for (const flangeIdx of collisionResult.collidingFlanges) {
    const flange = part.flanges[flangeIdx]
    const curLength = flange ? flange.length : 0

    // Get collision points for this flange
    const flangeHits = collisionResult.collisionPoints.filter((c) => c.flangeIndex === flangeIdx)
    const hitEntities = Array.from(new Set(flangeHits.map((h) => h.entity)))
    const maxPen = Math.max(...flangeHits.map((h) => h.penetrationDepth), 5)
    const atRatio = flangeHits[0]?.atAngleProgress ?? 0.5
    const atDeg = Math.round(atRatio * (180 - (part.bends[bendIndex]?.angle ?? 90)))

    for (const entity of hitEntities) {
      if (entity === 'PUNCH') {
        const isReturnFlange = punch.type === 'straight' && punch.throatRelief === 0
        const safeLen = Math.max(10, Math.round(curLength - maxPen - 4))

        diagnostics.push({
          id: `diag-punch-${stepIndex}-${flangeIdx}`,
          title: `Flange ${flangeIdx + 1} Tool Body Interference`,
          description: `Flange ${flangeIdx + 1} (${curLength}mm) collides with the punch body at ~${atDeg}° forming progress (penetration depth ~${maxPen}mm).`,
          severity: 'error',
          collidingFlangeIndex: flangeIdx,
          collidingEntity: 'PUNCH',
          maxSafeLength: safeLen,
          currentLength: curLength,
        })

        if (isReturnFlange) {
          suggestions.push({
            id: `sugg-gooseneck-${stepIndex}-${flangeIdx}`,
            category: 'TOOL_SWAP',
            title: 'Switch to Gooseneck Punch (Throat Relief)',
            description: `The straight punch body has 0mm relief. Switching to a Gooseneck punch (e.g. P-120.88 with ≥${Math.ceil(maxPen + 25)}mm relief depth) will clear this return flange.`,
            confidence: 'high',
            params: {
              recommendedPunchId: 'punch_gooseneck_88',
              reliefNeededMm: Math.ceil(maxPen + 25),
            },
          })
        }

        // Part Design Feedback
        suggestions.push({
          id: `sugg-design-flange-${flangeIdx}`,
          category: 'PART_DESIGN',
          title: `Modify Flange ${flangeIdx + 1} Length / Add Notch`,
          description: `Current length is ${curLength}mm. The maximum safe collision-free length with this tool setup is ~${safeLen}mm (shorten by ~${Math.round(curLength - safeLen)}mm, or add a corner relief cutout).`,
          confidence: 'high',
          params: {
            flangeIndex: flangeIdx,
            recommendedFlangeLength: safeLen,
          },
        })
      }

      if (entity === 'PUNCH_HOLDER' || entity === 'UPPER_RAM') {
        const safeLen = Math.max(10, Math.round(punch.height - 15))
        diagnostics.push({
          id: `diag-ram-${stepIndex}-${flangeIdx}`,
          title: `Flange ${flangeIdx + 1} Upper Ram / Clamp Crash`,
          description: `Flange ${flangeIdx + 1} (${curLength}mm) is taller than the punch working height (${punch.height}mm) and collides with the upper ram beam.`,
          severity: 'error',
          collidingFlangeIndex: flangeIdx,
          collidingEntity: entity,
          maxSafeLength: safeLen,
          currentLength: curLength,
        })

        suggestions.push({
          id: `sugg-tall-punch-${stepIndex}`,
          category: 'TOOL_SWAP',
          title: 'Use Taller Working Punch',
          description: `The upright flange requires a punch with height ≥ ${Math.ceil(curLength + 25)}mm to prevent ram interference.`,
          confidence: 'high',
        })

        suggestions.push({
          id: `sugg-design-ram-${flangeIdx}`,
          category: 'PART_DESIGN',
          title: `Reduce Flange ${flangeIdx + 1} Height`,
          description: `Flange ${flangeIdx + 1} exceeds punch clearance height. Reduce flange length to ≤ ${safeLen}mm to clear the punch clamping beam.`,
          confidence: 'high',
          params: {
            flangeIndex: flangeIdx,
            recommendedFlangeLength: safeLen,
          },
        })
      }

      if (entity === 'DIE' || entity === 'LOWER_BED') {
        diagnostics.push({
          id: `diag-die-${stepIndex}-${flangeIdx}`,
          title: `Flange ${flangeIdx + 1} Die Shoulder Collision`,
          description: `Flange ${flangeIdx + 1} interferes with the lower die/bed shoulder during rotation.`,
          severity: 'error',
          collidingFlangeIndex: flangeIdx,
          collidingEntity: entity,
          currentLength: curLength,
        })

        suggestions.push({
          id: `sugg-die-${stepIndex}`,
          category: 'HANDLING',
          title: 'Review Bend Direction / Die Clearance',
          description: 'Try reversing the part insertion orientation or altering the sequence order so earlier bent flanges swing away from the die.',
          confidence: 'medium',
        })
      }

      if (entity === 'BACKGAUGE') {
        diagnostics.push({
          id: `diag-gauge-${stepIndex}-${flangeIdx}`,
          title: `Flange ${flangeIdx + 1} Backgauge Interference`,
          description: `Flange ${flangeIdx + 1} swings into the backgauge fingers during forming.`,
          severity: 'error',
          collidingFlangeIndex: flangeIdx,
          collidingEntity: 'BACKGAUGE',
          currentLength: curLength,
        })

        // Part Handling Suggestion
        suggestions.push({
          id: `sugg-flip-gauge-${stepIndex}`,
          category: 'HANDLING',
          title: 'Flip Part 180° (Face Operator)',
          description: `Rotate the part 180° horizontally so Flange ${flangeIdx + 1} faces towards the front/operator instead of swinging into the backgauge.`,
          confidence: 'high',
          params: {
            recommendedOrientation: orientation === 'FORWARD' ? 'REVERSE' : 'FORWARD',
          },
        })
      }
    }
  }

  return { diagnostics, suggestions }
}
