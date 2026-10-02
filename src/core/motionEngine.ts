import { EvaluatedSequence, EvaluatedStep } from '../types/simulation'

export type MotionSubPhase =
  | 'FORMING'
  | 'OPENING'
  | 'WITHDRAW'
  | 'TURNING'
  | 'INSERTING'
  | 'PINCHING'
  | 'COMPLETED'

export interface MotionState {
  stepIndex: number
  phase: MotionSubPhase
  phaseProgress: number // 0.0 to 1.0 within current subphase
  bendProgress: number // 0.0 to 1.0 forming angle progress of active bend
  punchYOverride?: number // mm, e.g. -d_pen to +140
  sheetTransform: {
    x: number // mm horizontal translation
    y: number // mm vertical translation
    rotationX: number // radians (0 to PI for face flip)
    rotationY: number // radians (0 to PI for turnaround)
  }
  gaugeOverride: {
    x: number
    r: number
  }
  activeBendIndex: number
  orientation: 'FORWARD' | 'REVERSE'
  completedBends: Map<number, number>
  statusMessage: string
  isFinished: boolean
}

// Easing functions for realistic industrial acceleration and deceleration
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t)
}

export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

// Phase durations in milliseconds at 1x speed
export const PHASE_DURATIONS = {
  FORMING: 1500,
  OPENING: 550,
  WITHDRAW: 650,
  TURNING_FLIP: 1000,
  TURNING_NO_FLIP: 650,
  INSERTING: 650,
  PINCHING: 400,
  COMPLETED: 1200,
}

const DAYLIGHT_OPENING_Y = 140 // mm daylight above die
const WITHDRAW_DISTANCE_X = -220 // mm horizontal withdraw toward operator

/**
 * Computes the exact physical CNC motion and workpiece handling state
 * at any elapsed millisecond in continuous playback.
 */
export function computeContinuousMotion(
  sequence: EvaluatedSequence,
  totalElapsedMs: number,
  speedMultiplier: number = 1.0
): MotionState {
  const steps = sequence.steps
  const numSteps = steps.length

  if (numSteps === 0) {
    return {
      stepIndex: 0,
      phase: 'COMPLETED',
      phaseProgress: 1.0,
      bendProgress: 1.0,
      sheetTransform: { x: 0, y: 0, rotationX: 0, rotationY: 0 },
      gaugeOverride: { x: 50, r: 0 },
      activeBendIndex: 0,
      orientation: 'FORWARD',
      completedBends: new Map(),
      statusMessage: 'No bends in sequence',
      isFinished: true,
    }
  }

  // Pre-calculate durations of each step
  const stepDurations: {
    total: number
    forming: number
    opening: number
    withdraw: number
    turning: number
    inserting: number
    pinching: number
    hasTurnaround: boolean
    hasFaceFlip: boolean
  }[] = []

  for (let i = 0; i < numSteps; i++) {
    const isLast = i === numSteps - 1
    const curStep = steps[i]
    const nextStep = !isLast ? steps[i + 1] : null

    const hasTurnaround = nextStep ? curStep.orientation !== nextStep.orientation : false
    const hasFaceFlip = nextStep ? curStep.direction !== nextStep.direction : false
    const requiresComplexHandling = hasTurnaround || hasFaceFlip

    const forming = PHASE_DURATIONS.FORMING / speedMultiplier
    const opening = PHASE_DURATIONS.OPENING / speedMultiplier
    const withdraw = isLast ? 0 : PHASE_DURATIONS.WITHDRAW / speedMultiplier
    const turning = isLast
      ? 0
      : (requiresComplexHandling ? PHASE_DURATIONS.TURNING_FLIP : PHASE_DURATIONS.TURNING_NO_FLIP) /
        speedMultiplier
    const inserting = isLast ? 0 : PHASE_DURATIONS.INSERTING / speedMultiplier
    const pinching = isLast ? 0 : PHASE_DURATIONS.PINCHING / speedMultiplier

    const total = forming + opening + withdraw + turning + inserting + pinching
    stepDurations.push({
      total,
      forming,
      opening,
      withdraw,
      turning,
      inserting,
      pinching,
      hasTurnaround,
      hasFaceFlip,
    })
  }

  // Locate current step and elapsed time in step
  let accumulatedTime = 0
  let currentStepIdx = numSteps - 1
  let timeInStep = 0

  for (let i = 0; i < numSteps; i++) {
    const dur = stepDurations[i].total
    if (totalElapsedMs < accumulatedTime + dur) {
      currentStepIdx = i
      timeInStep = totalElapsedMs - accumulatedTime
      break
    }
    accumulatedTime += dur
    if (i === numSteps - 1) {
      currentStepIdx = numSteps - 1
      timeInStep = dur
    }
  }

  const curConfig = stepDurations[currentStepIdx]
  const currentStep = steps[currentStepIdx]
  const nextStep = currentStepIdx < numSteps - 1 ? steps[currentStepIdx + 1] : null
  const isFinalStep = currentStepIdx === numSteps - 1

  // Bends completed BEFORE this step
  const completedBends = new Map<number, number>()
  for (let i = 0; i < currentStepIdx; i++) {
    completedBends.set(steps[i].bendIndex, steps[i].targetAngle)
  }

  let phase: MotionSubPhase = 'FORMING'
  let phaseProgress = 0.0
  let bendProgress = 0.0
  let punchYOverride: number | undefined = undefined
  const sheetTransform = { x: 0, y: 0, rotationX: 0, rotationY: 0 }
  let gaugeX = currentStep.gaugeX
  let gaugeR = currentStep.gaugeR
  let activeBendIndex = currentStep.bendIndex
  let orientation = currentStep.orientation
  let statusMessage = ''
  let isFinished = false

  const penDepth = currentStep.ramStrokeY || 2.0
  let tMark = 0

  // 1. FORMING SUBPHASE: Ram strokes down into die
  if (timeInStep < tMark + curConfig.forming) {
    phase = 'FORMING'
    phaseProgress = Math.min(1.0, (timeInStep - tMark) / curConfig.forming)
    bendProgress = easeInOutCubic(phaseProgress)
    punchYOverride = -penDepth * bendProgress
    statusMessage = `Forming Step ${currentStepIdx + 1}/${numSteps}: Bend ${currentStep.bendIndex + 1} (${currentStep.targetAngle}°) at ${Math.round(bendProgress * 100)}%`
  } else {
    tMark += curConfig.forming
    bendProgress = 1.0
    // Once formed, this bend is now permanently formed on the workpiece
    completedBends.set(currentStep.bendIndex, currentStep.targetAngle)

    // 2. OPENING SUBPHASE: Ram de-pinches and returns to daylight
    if (timeInStep < tMark + curConfig.opening) {
      phase = 'OPENING'
      phaseProgress = Math.min(1.0, (timeInStep - tMark) / curConfig.opening)
      const easeT = easeInOutQuad(phaseProgress)
      punchYOverride = -penDepth + (DAYLIGHT_OPENING_Y + penDepth) * easeT
      statusMessage = `Ram de-pinch & return to daylight opening (+${DAYLIGHT_OPENING_Y}mm)`

      if (isFinalStep && phaseProgress >= 0.99) {
        phase = 'COMPLETED'
        isFinished = true
        statusMessage = `All ${numSteps} Bends Successfully Formed!`
      }
    } else {
      tMark += curConfig.opening
      punchYOverride = DAYLIGHT_OPENING_Y

      if (isFinalStep) {
        phase = 'COMPLETED'
        isFinished = true
        statusMessage = `All ${numSteps} Bends Successfully Formed!`
      } else {
        // 3. WITHDRAW SUBPHASE: Operator retracts sheet clear of tooling
        if (timeInStep < tMark + curConfig.withdraw) {
          phase = 'WITHDRAW'
          phaseProgress = Math.min(1.0, (timeInStep - tMark) / curConfig.withdraw)
          const easeT = easeInOutCubic(phaseProgress)
          sheetTransform.x = WITHDRAW_DISTANCE_X * easeT
          statusMessage = 'Withdrawing workpiece clear of tooling opening'
        } else {
          tMark += curConfig.withdraw
          sheetTransform.x = WITHDRAW_DISTANCE_X

          // 4. TURNING / HANDLING SUBPHASE: Turnaround 180°, Face Flip, or Repositioning
          if (timeInStep < tMark + curConfig.turning) {
            phase = 'TURNING'
            phaseProgress = Math.min(1.0, (timeInStep - tMark) / curConfig.turning)
            const easeT = easeInOutCubic(phaseProgress)

            // Dynamic backgauge repositioning to next step coordinates
            if (nextStep) {
              gaugeX = currentStep.gaugeX + (nextStep.gaugeX - currentStep.gaugeX) * easeT
              gaugeR = currentStep.gaugeR + (nextStep.gaugeR - currentStep.gaugeR) * easeT
            }

            // Operator hand arc elevation during turning
            sheetTransform.y = Math.sin(phaseProgress * Math.PI) * 18
            sheetTransform.x = WITHDRAW_DISTANCE_X + Math.sin(phaseProgress * Math.PI) * 35

            if (curConfig.hasTurnaround || curConfig.hasFaceFlip) {
              if (phaseProgress < 0.5) {
                // First half of rotation (0 to 90°)
                const pNorm = phaseProgress * 2 // 0 to 1
                const angle = easeInOutCubic(pNorm) * (Math.PI / 2)
                if (curConfig.hasTurnaround) sheetTransform.rotationY = angle
                if (curConfig.hasFaceFlip) sheetTransform.rotationX = angle
              } else {
                // Second half of rotation (90° to 180°), transitioning to next step's bend line
                if (nextStep) {
                  activeBendIndex = nextStep.bendIndex
                  orientation = nextStep.orientation
                  bendProgress = 0.0 // Next bend is unformed
                }
                const pNorm = (phaseProgress - 0.5) * 2 // 0 to 1
                const angle = -(Math.PI / 2) + easeInOutCubic(pNorm) * (Math.PI / 2)
                if (curConfig.hasTurnaround) sheetTransform.rotationY = angle
                if (curConfig.hasFaceFlip) sheetTransform.rotationX = angle
              }

              if (curConfig.hasTurnaround && curConfig.hasFaceFlip) {
                statusMessage = `Turning 180° & Flipping Face for Bend ${(nextStep?.bendIndex ?? 0) + 1}`
              } else if (curConfig.hasTurnaround) {
                statusMessage = 'Rotating workpiece 180° (Horizontal Turnaround)'
              } else {
                statusMessage = 'Flipping workpiece 180° (Face Flip over Die)'
              }
            } else {
              // Same orientation: smooth horizontal realignment to next bend line
              if (phaseProgress > 0.5 && nextStep) {
                activeBendIndex = nextStep.bendIndex
                orientation = nextStep.orientation
                bendProgress = 0.0
              }
              statusMessage = `Repositioning workpiece to Bend ${(nextStep?.bendIndex ?? 0) + 1} line`
            }
          } else {
            tMark += curConfig.turning
            if (nextStep) {
              activeBendIndex = nextStep.bendIndex
              orientation = nextStep.orientation
              bendProgress = 0.0
              gaugeX = nextStep.gaugeX
              gaugeR = nextStep.gaugeR
            }
            sheetTransform.rotationX = 0
            sheetTransform.rotationY = 0
            sheetTransform.y = 0
            sheetTransform.x = WITHDRAW_DISTANCE_X

            // 5. INSERTING SUBPHASE: Feed into tooling against backgauge stop
            if (timeInStep < tMark + curConfig.inserting) {
              phase = 'INSERTING'
              phaseProgress = Math.min(1.0, (timeInStep - tMark) / curConfig.inserting)
              const easeT = easeInOutCubic(phaseProgress)
              sheetTransform.x = WITHDRAW_DISTANCE_X * (1 - easeT)
              statusMessage = `Inserting workpiece against backgauge stop (X=${Math.round(gaugeX)}mm)`
            } else {
              tMark += curConfig.inserting
              sheetTransform.x = 0

              // 6. PINCHING SUBPHASE: Ram descends from daylight to sheet touch (Z touch)
              phase = 'PINCHING'
              phaseProgress = Math.min(1.0, (timeInStep - tMark) / curConfig.pinching)
              const easeT = easeInOutQuad(phaseProgress)
              punchYOverride = DAYLIGHT_OPENING_Y * (1 - easeT)
              statusMessage = 'Ram descent to pinch point (Z-axis touch)'
            }
          }
        }
      }
    }
  }

  return {
    stepIndex: currentStepIdx,
    phase,
    phaseProgress,
    bendProgress,
    punchYOverride,
    sheetTransform,
    gaugeOverride: { x: gaugeX, r: gaugeR },
    activeBendIndex,
    orientation,
    completedBends,
    statusMessage,
    isFinished,
  }
}

/**
 * Calculates start time in milliseconds for a specific step index.
 */
export function getElapsedTimeForStep(
  sequence: EvaluatedSequence,
  stepIndex: number
): number {
  let elapsed = 0
  const maxIdx = Math.min(stepIndex, sequence.steps.length - 1)
  for (let i = 0; i < maxIdx; i++) {
    const isLast = i === sequence.steps.length - 1
    const curStep = sequence.steps[i]
    const nextStep = !isLast ? sequence.steps[i + 1] : null
    const hasTurnaround = nextStep ? curStep.orientation !== nextStep.orientation : false
    const hasFaceFlip = nextStep ? curStep.direction !== nextStep.direction : false
    const requiresComplexHandling = hasTurnaround || hasFaceFlip

    elapsed += PHASE_DURATIONS.FORMING
    elapsed += PHASE_DURATIONS.OPENING
    if (!isLast) {
      elapsed += PHASE_DURATIONS.WITHDRAW
      elapsed += requiresComplexHandling ? PHASE_DURATIONS.TURNING_FLIP : PHASE_DURATIONS.TURNING_NO_FLIP
      elapsed += PHASE_DURATIONS.INSERTING
      elapsed += PHASE_DURATIONS.PINCHING
    }
  }
  return elapsed
}

/**
 * Calculates total sequence duration in milliseconds at 1x speed.
 */
export function getTotalSequenceDuration(sequence: EvaluatedSequence): number {
  return getElapsedTimeForStep(sequence, sequence.steps.length) + PHASE_DURATIONS.FORMING + PHASE_DURATIONS.OPENING
}
