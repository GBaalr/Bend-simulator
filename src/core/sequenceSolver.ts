import { SheetMetalPart } from '../types/sheetMetal'
import { Punch, Die, MachineEnvelope } from '../types/tooling'
import { EvaluatedStep, EvaluatedSequence, SimulationResult, Suggestion } from '../types/simulation'
import { calculatePenetrationDepth, calculateBendingTonnage } from './mathEngine'
import { checkStepSweepCollision } from './collisionEngine'
import { generateStepDiagnostics } from './diagnosticEngine'
import { computePartKinematics } from './kinematicChain'

/**
 * Generates all permutations of an array.
 */
function permute<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr]
  const result: T[][] = []
  for (let i = 0; i < arr.length; i++) {
    const current = arr[i]
    const remaining = [...arr.slice(0, i), ...arr.slice(i + 1)]
    const subPerms = permute(remaining)
    for (const sub of subPerms) {
      result.push([current, ...sub])
    }
  }
  return result
}

/**
 * Evaluates a single candidate step.
 */
function evaluateStep(
  part: SheetMetalPart,
  stepIndex: number,
  bendIndex: number,
  orientation: 'FORWARD' | 'REVERSE',
  completedBends: Map<number, number>,
  punch: Punch,
  die: Die,
  envelope: MachineEnvelope
): EvaluatedStep {
  const bend = part.bends[bendIndex]
  const targetAngle = bend ? bend.angle : 90
  const penDepth = calculatePenetrationDepth(targetAngle, die.vOpening, punch.tipRadius, part.thickness)
  const tonnage = calculateBendingTonnage(part.thickness, part.width, die.vOpening)

  // Compute gauge position at 0% (flat start)
  const flatState = computePartKinematics(
    part,
    bendIndex,
    completedBends,
    0.0,
    orientation,
    penDepth
  )

  const gaugeX = Math.max(10, Math.round(flatState.gaugeContactPoint.x * 10) / 10)
  const gaugeR = 0 // gauge flush with die top for flat sheet

  // Run dynamic continuous collision check
  const collisionResult = checkStepSweepCollision(
    part,
    bendIndex,
    completedBends,
    orientation,
    punch,
    die,
    envelope,
    penDepth,
    gaugeX,
    gaugeR
  )

  const { diagnostics, suggestions } = generateStepDiagnostics(
    part,
    stepIndex,
    bendIndex,
    orientation,
    collisionResult,
    punch,
    die,
    envelope
  )

  return {
    stepIndex,
    bendIndex,
    bendId: bend?.id ?? `bend-${bendIndex}`,
    targetAngle,
    direction: bend?.direction ?? 'UP',
    orientation,
    clampedFlangeIndex: bendIndex,
    gaugeFlangeIndex: orientation === 'FORWARD' ? part.flanges.length - 1 : 0,
    gaugeX,
    gaugeR,
    ramStrokeY: Math.round(penDepth * 100) / 100,
    tonnageTonnes: tonnage.totalTonnes,
    crowningValue: Math.round((tonnage.totalTonnes * 0.015) * 100) / 100,
    collisionResult,
    diagnostics,
  }
}

/**
 * Searches and optimizes bend sequences for the given part and tooling setup.
 */
export function solveBendSequence(
  part: SheetMetalPart,
  punch: Punch,
  die: Die,
  envelope: MachineEnvelope = {
    name: 'DELEM DA-53T',
    controller: 'DELEM DA-53T',
    maxTonnageTonnes: 100,
    maxBendingLength: 2500,
    daylight: 420,
    stroke: 200,
    throatDepth: 350,
    ramWidth: 160,
    bedWidth: 160,
    backgaugeXMin: 10,
    backgaugeXMax: 650,
    backgaugeRMin: 0,
    backgaugeRMax: 180,
  }
): SimulationResult {
  const numBends = part.bends.length
  if (numBends === 0) {
    return {
      feasibleSequences: [],
      bestSequence: null,
      failedSequences: [],
      globalSuggestions: [],
    }
  }

  // Indices: [0, 1, ..., N-1]
  const bendIndices = Array.from({ length: numBends }, (_, i) => i)
  const allOrderPermutations = permute(bendIndices)

  const evaluatedSequences: EvaluatedSequence[] = []

  // Test permutations
  for (let permIdx = 0; permIdx < allOrderPermutations.length; permIdx++) {
    const order = allOrderPermutations[permIdx]

    // For this order, find best orientation combination (Forward vs Reverse)
    // Try to minimize flips: prefer maintaining orientation from step to step
    const steps: EvaluatedStep[] = []
    const completedBends = new Map<number, number>()
    let currentOrientation: 'FORWARD' | 'REVERSE' = 'FORWARD'
    let flips = 0
    let permHasCollision = false
    const permSuggestions: Suggestion[] = []

    for (let stepIdx = 0; stepIdx < order.length; stepIdx++) {
      const bendIdx = order[stepIdx]

      // 1. Try keeping current orientation first
      let stepResult = evaluateStep(
        part,
        stepIdx,
        bendIdx,
        currentOrientation,
        completedBends,
        punch,
        die,
        envelope
      )

      // 2. If it collides, check if flipping 180° resolves it!
      if (stepResult.collisionResult.hasCollision) {
        const altOrientation: 'FORWARD' | 'REVERSE' =
          currentOrientation === 'FORWARD' ? 'REVERSE' : 'FORWARD'
        const altResult = evaluateStep(
          part,
          stepIdx,
          bendIdx,
          altOrientation,
          completedBends,
          punch,
          die,
          envelope
        )

        if (!altResult.collisionResult.hasCollision) {
          // Resolved by flipping!
          stepResult = altResult
          currentOrientation = altOrientation
          flips++
        } else {
          // Both orientations collide on this step
          permHasCollision = true
          const { suggestions } = generateStepDiagnostics(
            part,
            stepIdx,
            bendIdx,
            currentOrientation,
            stepResult.collisionResult,
            punch,
            die,
            envelope
          )
          permSuggestions.push(...suggestions)
        }
      }

      steps.push(stepResult)
      completedBends.set(bendIdx, part.bends[bendIdx].angle)
    }

    const isValid = !permHasCollision
    const score = flips * 10 + (isValid ? 0 : 1000)

    evaluatedSequences.push({
      id: `seq-${permIdx}`,
      isValid,
      steps,
      flipCount: flips,
      score,
      primaryFailureReason: permHasCollision ? 'Tool or Machine Collision' : undefined,
      suggestions: permSuggestions,
    })
  }

  // Separate valid vs failed
  const feasible = evaluatedSequences
    .filter((s) => s.isValid)
    .sort((a, b) => a.score - b.score)

  const failed = evaluatedSequences
    .filter((s) => !s.isValid)
    .sort((a, b) => a.score - b.score)

  const bestSequence = feasible.length > 0 ? feasible[0] : (failed.length > 0 ? failed[0] : null)

  // Aggregate global suggestions if no sequence works
  const globalSuggestions: Suggestion[] = []
  if (feasible.length === 0 && bestSequence) {
    const seen = new Set<string>()
    for (const step of bestSequence.steps) {
      if (step.collisionResult.hasCollision) {
        const { suggestions } = generateStepDiagnostics(
          part,
          step.stepIndex,
          step.bendIndex,
          step.orientation,
          step.collisionResult,
          punch,
          die,
          envelope
        )
        for (const s of suggestions) {
          if (!seen.has(s.id)) {
            seen.add(s.id)
            globalSuggestions.push(s)
          }
        }
      }
    }
  }

  return {
    feasibleSequences: feasible,
    bestSequence,
    failedSequences: failed,
    globalSuggestions,
  }
}
