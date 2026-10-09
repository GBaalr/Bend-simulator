import { Point2D, Punch, Die, MachineEnvelope, BackgaugeFinger } from '../types/tooling'
import { CollisionEntity, CollisionPoint, StepCollisionResult } from '../types/simulation'
import { SheetMetalPart } from '../types/sheetMetal'
import { checkPolygonCollision, getAllPolygonIntersections, translatePoint } from './geometry2d'
import { computePartKinematics } from './kinematicChain'
import { generatePunchPolygon, generateDiePolygon } from './toolingCatalog'

export interface MachineObstacles {
  punchPoly: Point2D[]
  holderPoly: Point2D[]
  ramPoly: Point2D[]
  diePoly: Point2D[]
  bedPoly: Point2D[]
  gaugePoly: Point2D[]
}

/**
 * Builds all machine and tooling obstacle polygons at a given stroke penetration depth.
 */
export function buildMachineObstacles(
  punch: Punch,
  die: Die,
  envelope: MachineEnvelope,
  sheetThickness: number,
  penetrationDepth: number,
  currentStrokeProgress: number,
  gaugeX: number,
  gaugeR: number,
  punchYOverride?: number
): MachineObstacles {
  const currentPunchY =
    punchYOverride !== undefined ? punchYOverride : -penetrationDepth * currentStrokeProgress

  // 1. Punch Polygon translated by current stroke
  const rawPunchPoly = punch.polygon2D ?? generatePunchPolygon(punch)
  const punchPoly = rawPunchPoly.map((pt) => translatePoint(pt, 0, currentPunchY))

  // 2. Punch Holder / Clamp (Intermediate Quick-Clamp Adapter)
  // Standard Promecam intermediate clamping blocks (Height: 120mm, front-to-back thickness: 60mm)
  const clampHeight = envelope.clampHolderHeight || 120
  const clampWidth = envelope.clampHolderWidth || 60
  const holderBottom = currentPunchY + punch.height - 20
  const holderTop = holderBottom + clampHeight
  const holderPoly: Point2D[] = [
    { x: -clampWidth / 2, y: holderBottom },
    { x: clampWidth / 2, y: holderBottom },
    { x: clampWidth / 2, y: holderTop },
    { x: -clampWidth / 2, y: holderTop },
  ]

  // 3. Upper Ram Beam
  // Deep steel moving beam plate extending 600mm upwards and through full throat depth
  const ramTop = holderTop + 600
  const ramBottom = holderTop
  const ramFrontX = -Math.max(160, envelope.ramWidth || 160)
  const ramRearX = Math.max(300, envelope.throatDepth || 350)
  const ramPoly: Point2D[] = [
    { x: ramFrontX, y: ramBottom },
    { x: ramRearX, y: ramBottom },
    { x: ramRearX, y: ramTop },
    { x: ramFrontX, y: ramTop },
  ]

  // 4. Die Polygon (Stationary on bed)
  const rawDiePoly = die.polygon2D ?? generateDiePolygon(die, sheetThickness)
  const diePoly = rawDiePoly

  // 5. Lower Bed & Die Rail Holder (Stationary below die)
  // Sits below the die and die rail table down towards the machine foundation
  const dieRailH = envelope.dieRailHeight || 55
  const dieBottom = -sheetThickness - die.height
  const bedBottom = dieBottom - (dieRailH + 280)
  const bedW = envelope.bedWidth || 160
  const bedPoly: Point2D[] = [
    { x: -bedW / 2, y: bedBottom },
    { x: bedW / 2, y: bedBottom },
    { x: bedW / 2, y: dieBottom },
    { x: -bedW / 2, y: dieBottom },
  ]

  // 6. Backgauge Finger at (gaugeX, gaugeR) with CNC X-retract and authentic 3-tier stop steps
  // Real CNC press brakes retract 30-50mm in +X once sheet is pinched.
  // Stepped fingers allow staged bending and return-flange clearance.
  const retractX = Math.min(50, currentStrokeProgress * 80)
  const effectiveGaugeX = gaugeX + retractX
  const fW = 35
  const fH = 45
  const step1 = envelope.step1Drop || 15
  const step2 = envelope.step2Drop || 40
  const gaugePoly: Point2D[] = [
    { x: effectiveGaugeX, y: gaugeR - 5 },
    { x: effectiveGaugeX + 15, y: gaugeR - 5 },
    { x: effectiveGaugeX + 15, y: gaugeR + step1 },
    { x: effectiveGaugeX + 40, y: gaugeR + step1 },
    { x: effectiveGaugeX + 40, y: gaugeR + step2 },
    { x: effectiveGaugeX + fW + 90, y: gaugeR + step2 },
    { x: effectiveGaugeX + fW + 90, y: gaugeR + fH + 20 },
    { x: effectiveGaugeX, y: gaugeR + fH + 20 },
  ]

  return {
    punchPoly,
    holderPoly,
    ramPoly,
    diePoly,
    bedPoly,
    gaugePoly,
  }
}

/**
 * Checks for collisions at a specific instant of the bend stroke (progress 0.0 to 1.0).
 */
export function checkInstantCollision(
  part: SheetMetalPart,
  activeBendIndex: number,
  completedBends: Map<number, number>,
  progress: number,
  orientation: 'FORWARD' | 'REVERSE',
  punch: Punch,
  die: Die,
  envelope: MachineEnvelope,
  penetrationDepth: number,
  gaugeX: number,
  gaugeR: number
): { hasCollision: boolean; collisionPoints: CollisionPoint[] } {
  const kinState = computePartKinematics(
    part,
    activeBendIndex,
    completedBends,
    progress,
    orientation,
    penetrationDepth
  )

  const obstacles = buildMachineObstacles(
    punch,
    die,
    envelope,
    part.thickness,
    penetrationDepth,
    progress,
    gaugeX,
    gaugeR
  )

  const collisionPoints: CollisionPoint[] = []
  const activeBend = part.bends[activeBendIndex]
  const targetAngle = activeBend ? activeBend.angle : 90
  const currentPunchY = -penetrationDepth * progress

  // Check each part segment polygon against all obstacle polygons
  for (const seg of kinState.segments) {
    const isAdjacentToActiveBend =
      seg.flangeIndex === activeBendIndex || seg.flangeIndex === activeBendIndex + 1

    // 1. Check Punch
    // Legitimate forming: at the active bend apex, the sheet inner corner is pressed by the punch tip.
    // Real punch collision occurs if:
    // a) targetAngle < punch.angle - 0.5 (sheet sharper than punch included angle)
    // b) For active flanges: sheet gouges into punch body/throat above the nose (y > currentPunchY + 12)
    // c) For non-active flanges: ANY contact with punch is a true collision!
    if (isAdjacentToActiveBend) {
      if (targetAngle < punch.angle - 0.5) {
        // Punch included angle is too wide for this bend angle
        collisionPoints.push({
          x: seg.p1.x,
          y: seg.p1.y,
          flangeIndex: seg.flangeIndex,
          entity: 'PUNCH',
          penetrationDepth: 5,
          atAngleProgress: progress,
        })
      } else {
        const hits = getAllPolygonIntersections(seg.polygon, obstacles.punchPoly)
        const noseClearanceH = punch.type === 'straight' ? 18 : 28
        const gougeHit = hits.find((h) => h.y > currentPunchY + noseClearanceH)
        if (gougeHit) {
          collisionPoints.push({
            x: gougeHit.x,
            y: gougeHit.y,
            flangeIndex: seg.flangeIndex,
            entity: 'PUNCH',
            penetrationDepth: 5,
            atAngleProgress: progress,
          })
        }
      }
    } else {
      // Non-active flange (e.g. return flange or prior bend swinging into punch)
      const punchHit = checkPolygonCollision(seg.polygon, obstacles.punchPoly)
      if (punchHit.hasCollision) {
        collisionPoints.push({
          x: punchHit.intersectionPoint?.x ?? seg.p2.x,
          y: punchHit.intersectionPoint?.y ?? seg.p2.y,
          flangeIndex: seg.flangeIndex,
          entity: 'PUNCH',
          penetrationDepth: punchHit.penetrationDepth ?? 5,
          atAngleProgress: progress,
        })
      }
    }

    // 2. Check Punch Holder
    const holderHit = checkPolygonCollision(seg.polygon, obstacles.holderPoly)
    if (holderHit.hasCollision) {
      collisionPoints.push({
        x: holderHit.intersectionPoint?.x ?? seg.p2.x,
        y: holderHit.intersectionPoint?.y ?? seg.p2.y,
        flangeIndex: seg.flangeIndex,
        entity: 'PUNCH_HOLDER',
        penetrationDepth: holderHit.penetrationDepth ?? 5,
        atAngleProgress: progress,
      })
    }

    // 3. Check Upper Ram
    const ramHit = checkPolygonCollision(seg.polygon, obstacles.ramPoly)
    if (ramHit.hasCollision) {
      collisionPoints.push({
        x: ramHit.intersectionPoint?.x ?? seg.p2.x,
        y: ramHit.intersectionPoint?.y ?? seg.p2.y,
        flangeIndex: seg.flangeIndex,
        entity: 'UPPER_RAM',
        penetrationDepth: ramHit.penetrationDepth ?? 10,
        atAngleProgress: progress,
      })
    }

    // 4. Check Die Shoulders (outside the V-groove opening)
    // The active bend apex naturally penetrates into the V-groove; only flanges hitting the
    // solid die shoulders outside [-V/2, +V/2] or non-active return flanges swinging into the die count as collisions.
    const halfV = die.vOpening / 2
    const dieTopY = -part.thickness

    if (isAdjacentToActiveBend) {
      // For the active forming flanges, only check if they gouge into the outer flat die shoulders (outside the V span)
      // Check if any point on this segment is below dieTopY while strictly outside the V-opening (|x| > halfV + 1.5)
      const p1Crash = Math.abs(seg.p1.x) > halfV + 1.5 && seg.p1.y < dieTopY - 1.5
      const p2Crash = Math.abs(seg.p2.x) > halfV + 1.5 && seg.p2.y < dieTopY - 1.5
      if (p1Crash || p2Crash) {
        collisionPoints.push({
          x: p1Crash ? seg.p1.x : seg.p2.x,
          y: p1Crash ? seg.p1.y : seg.p2.y,
          flangeIndex: seg.flangeIndex,
          entity: 'DIE',
          penetrationDepth: 5,
          atAngleProgress: progress,
        })
      }
    } else {
      // Non-active flange (e.g. a return flange or previously bent section)
      // If it penetrates the die envelope, it is a true collision!
      const dieHit = checkPolygonCollision(seg.polygon, obstacles.diePoly)
      if (dieHit.hasCollision) {
        collisionPoints.push({
          x: dieHit.intersectionPoint?.x ?? seg.p2.x,
          y: dieHit.intersectionPoint?.y ?? seg.p2.y,
          flangeIndex: seg.flangeIndex,
          entity: 'DIE',
          penetrationDepth: dieHit.penetrationDepth ?? 5,
          atAngleProgress: progress,
        })
      }
    }

    // 5. Check Lower Bed
    const bedHit = checkPolygonCollision(seg.polygon, obstacles.bedPoly)
    if (bedHit.hasCollision) {
      collisionPoints.push({
        x: bedHit.intersectionPoint?.x ?? seg.p2.x,
        y: bedHit.intersectionPoint?.y ?? seg.p2.y,
        flangeIndex: seg.flangeIndex,
        entity: 'LOWER_BED',
        penetrationDepth: bedHit.penetrationDepth ?? 10,
        atAngleProgress: progress,
      })
    }

    // 6. Check Backgauge (with automatic X-retraction active)
    if (progress > 0.05) {
      const gaugeHit = checkPolygonCollision(seg.polygon, obstacles.gaugePoly)
      if (gaugeHit.hasCollision) {
        collisionPoints.push({
          x: gaugeHit.intersectionPoint?.x ?? seg.p2.x,
          y: gaugeHit.intersectionPoint?.y ?? seg.p2.y,
          flangeIndex: seg.flangeIndex,
          entity: 'BACKGAUGE',
          penetrationDepth: gaugeHit.penetrationDepth ?? 5,
          atAngleProgress: progress,
        })
      }
    }
  }

  return {
    hasCollision: collisionPoints.length > 0,
    collisionPoints,
  }
}

/**
 * Continuous dynamic sweep collision detection across the entire forming stroke.
 * Sweeps progress from 0% (flat on die) to 100% (target angle reached).
 */
export function checkStepSweepCollision(
  part: SheetMetalPart,
  activeBendIndex: number,
  completedBends: Map<number, number>,
  orientation: 'FORWARD' | 'REVERSE',
  punch: Punch,
  die: Die,
  envelope: MachineEnvelope,
  penetrationDepth: number,
  gaugeX: number,
  gaugeR: number,
  sampleSteps: number = 7 // checks at 0, 0.16, 0.33, 0.5, 0.66, 0.83, 1.0
): StepCollisionResult {
  const allCollisions: CollisionPoint[] = []
  let earliestRatio = 1.0

  for (let i = 0; i <= sampleSteps; i++) {
    const progress = i / sampleSteps
    const check = checkInstantCollision(
      part,
      activeBendIndex,
      completedBends,
      progress,
      orientation,
      punch,
      die,
      envelope,
      penetrationDepth,
      gaugeX,
      gaugeR
    )

    if (check.hasCollision) {
      if (allCollisions.length === 0) {
        earliestRatio = progress
      }
      allCollisions.push(...check.collisionPoints)
    }
  }

  const collidingEntities = Array.from(new Set(allCollisions.map((c) => c.entity)))
  const collidingFlanges = Array.from(new Set(allCollisions.map((c) => c.flangeIndex)))

  return {
    hasCollision: allCollisions.length > 0,
    collisionPoints: allCollisions,
    earliestCollidingAngleRatio: earliestRatio,
    collidingEntities,
    collidingFlanges,
  }
}
