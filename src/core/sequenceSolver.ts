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
 * Computes an outside-in preference score for an order (lower = more outside-in).
 * Standard CNC practice prefers forming outer flanges before inner webs.
 */
function getOutsideInScore(order: number[], numBends: number): number {
  let score = 0
  for (let i = 0; i < order.length; i++) {
    const bend = order[i]
    // Distance from the sheet edges (0 or numBends - 1)
    const distFromEdge = Math.min(bend, numBends - 1 - bend)
    score += distFromEdge * (i + 1)
  }
  return score
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

  // Generate order permutations; for larger parts, prioritize outside-in heuristics
  let candidateOrders: number[][]
  if (numBends <= 6) {
    candidateOrders = permute(bendIndices).sort(
      (a, b) => getOutsideInScore(a, numBends) - getOutsideInScore(b, numBends)
    )
  } else {
    // For parts with > 6 bends, test smart heuristic orderings
    const outsideIn1: number[] = []
    for (let i = 0; i < Math.ceil(numBends / 2); i++) {
      outsideIn1.push(i)
      if (numBends - 1 - i !== i) outsideIn1.push(numBends - 1 - i)
    }
    const outsideIn2: number[] = []
    for (let i = 0; i < Math.ceil(numBends / 2); i++) {
      outsideIn2.push(numBends - 1 - i)
      if (numBends - 1 - i !== i) outsideIn2.push(i)
    }
    candidateOrders = [
      outsideIn1,
      outsideIn2,
      [...bendIndices],
      [...bendIndices].reverse(),
    ]
  }

  const evaluatedSequences: EvaluatedSequence[] = []

  // Helper to simulate a given bend order starting with an initial orientation
  function evaluateBranch(order: number[], startOrientation: 'FORWARD' | 'REVERSE') {
    const steps: EvaluatedStep[] = []
    const completedBends = new Map<number, number>()
    let currentOrientation = startOrientation
    let flips = 0
    let permHasCollision = false
    const branchSuggestions: Suggestion[] = []

    for (let stepIdx = 0; stepIdx < order.length; stepIdx++) {
      const bendIdx = order[stepIdx]

      // Evaluate both keeping orientation vs flipping
      const sameResult = evaluateStep(
        part,
        stepIdx,
        bendIdx,
        currentOrientation,
        completedBends,
        punch,
        die,
        envelope
      )

      let chosenStep: EvaluatedStep

      if (!sameResult.collisionResult.hasCollision) {
        // Preferred: no collision and no flip required
        chosenStep = sameResult
      } else {
        // Try opposite orientation
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
          // Solved by flipping!
          chosenStep = altResult
          currentOrientation = altOrientation
          flips++
        } else {
          // Both orientations have collisions: pick the one with lower collision severity
          permHasCollision = true
          const sevSame = sameResult.collisionResult.collisionPoints.reduce(
            (sum: number, c) => sum + c.penetrationDepth,
            0
          )
          const sevAlt = altResult.collisionResult.collisionPoints.reduce(
            (sum: number, c) => sum + c.penetrationDepth,
            0
          )

          if (sevAlt < sevSame) {
            chosenStep = altResult
            currentOrientation = altOrientation
            flips++
          } else {
            chosenStep = sameResult
          }

          const { suggestions } = generateStepDiagnostics(
            part,
            stepIdx,
            bendIdx,
            currentOrientation,
            chosenStep.collisionResult,
            punch,
            die,
            envelope
          )
          branchSuggestions.push(...suggestions)
        }
      }

      steps.push(chosenStep)
      completedBends.set(bendIdx, part.bends[bendIdx].angle)
    }

    const collisionStepCount = steps.filter((s) => s.collisionResult.hasCollision).length
    const totalCollisions = steps.reduce(
      (sum: number, s) => sum + s.collisionResult.collisionPoints.length,
      0
    )
    const isValid = collisionStepCount === 0
    const score = collisionStepCount * 10000 + totalCollisions * 100 + flips * 10

    return {
      isValid,
      steps,
      flipCount: flips,
      score,
      collisionStepCount,
      primaryFailureReason: permHasCollision ? 'Tool or Machine Collision' : undefined,
      suggestions: branchSuggestions,
    }
  }

  // Test permutations across both starting orientations
  for (let permIdx = 0; permIdx < candidateOrders.length; permIdx++) {
    const order = candidateOrders[permIdx]

    // Branch A: start FORWARD
    const branchA = evaluateBranch(order, 'FORWARD')
    // Branch B: start REVERSE
    const branchB = evaluateBranch(order, 'REVERSE')

    // Pick best branch for this order
    const bestBranch = branchA.score <= branchB.score ? branchA : branchB

    evaluatedSequences.push({
      id: `seq-${permIdx}`,
      isValid: bestBranch.isValid,
      steps: bestBranch.steps,
      flipCount: bestBranch.flipCount,
      score: bestBranch.score,
      primaryFailureReason: bestBranch.primaryFailureReason,
      suggestions: bestBranch.suggestions,
    })

    // If we found a perfect valid sequence with 0 flips, we can stop early
    if (bestBranch.isValid && bestBranch.flipCount === 0) {
      break
    }
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
