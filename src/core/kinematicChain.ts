import { SheetMetalPart, Flange, Bend } from '../types/sheetMetal'
import { Point2D } from '../types/tooling'
import { segmentToPolygon, rotatePoint, translatePoint } from './geometry2d'

export interface PartKinematicState {
  segments: {
    flangeIndex: number
    p1: Point2D
    p2: Point2D
    polygon: Point2D[]
  }[]
  bendPoints: {
    bendIndex: number
    pt: Point2D
    currentAngle: number
  }[]
  gaugeContactPoint: Point2D
}

/**
 * Computes the 2D spatial layout of the sheet metal part during a specific bend operation.
 *
 * @param part The sheet metal part definition
 * @param activeBendIndex Which bend (0 to N-1) is currently at the punch/die centerline
 * @param completedBends Map of bend index to its previously formed angle in degrees
 * @param currentBendProgress 0.0 (open/flat on die) to 1.0 (fully formed to target angle)
 * @param orientation 'FORWARD' (flange N toward gauge) or 'REVERSE' (flange 0 toward gauge)
 * @param penetrationDepth Ram stroke depth in die (mm)
 */
export function computePartKinematics(
  part: SheetMetalPart,
  activeBendIndex: number,
  completedBends: Map<number, number>, // bends already completed prior to this step
  currentBendProgress: number, // 0.0 to 1.0
  orientation: 'FORWARD' | 'REVERSE' = 'FORWARD',
  penetrationDepth: number = 2.0
): PartKinematicState {
  const t = part.thickness
  const numBends = part.bends.length
  const numFlanges = part.flanges.length

  // Determine current active bend forming angle
  const activeBend = part.bends[activeBendIndex]
  const targetAngle = activeBend ? activeBend.angle : 90
  const turnAngle = 180 - targetAngle // angle deviation from flat (e.g. 90° for right angle)
  const currentTurnAngle = turnAngle * currentBendProgress

  // Penetration down into the die as punch descends
  const curY = -t - penetrationDepth * currentBendProgress

  // The active bend apex sits at the die centerline (x=0)
  const apexPt: Point2D = { x: 0, y: curY }

  // In symmetric V-die air bending, each side swings upward by half the turn angle
  // Right side (+X, toward backgauge) tilts up by +turnAngle/2
  // Left side (-X, toward operator) tilts up by +turnAngle/2 (counter-clockwise)
  const halfTurnRad = ((currentTurnAngle / 2) * Math.PI) / 180

  // We trace two chains outwards from activeBend:
  // Branch A: toward lower flange indices
  // Branch B: toward higher flange indices
  // Based on orientation, Branch A goes forward or rearward.

  const isForward = orientation === 'FORWARD'

  // Let's establish direction vectors:
  // Gauge direction is ALWAYS +X (into the machine)
  // Operator direction is ALWAYS -X (out of the machine)
  // For 'FORWARD': flange activeBendIndex goes toward operator (-X),
  // and flange activeBendIndex + 1 goes toward gauge (+X).
  // For 'REVERSE': opposite!

  const segments: PartKinematicState['segments'] = []
  const bendPoints: PartKinematicState['bendPoints'] = [
    {
      bendIndex: activeBendIndex,
      pt: apexPt,
      currentAngle: 180 - currentTurnAngle,
    },
  ]

  // Helper to trace a branch
  function traceBranch(
    startFlangeIndex: number,
    direction: -1 | 1,
    initialAngleRad: number,
    startPt: Point2D
  ) {
    let curPt = { ...startPt }
    let curAngle = initialAngleRad
    let flangeIdx = startFlangeIndex

    while (flangeIdx >= 0 && flangeIdx < numFlanges) {
      const flange = part.flanges[flangeIdx]
      const len = flange.length

      // End point of current flange
      const nextPt: Point2D = {
        x: curPt.x + len * Math.cos(curAngle),
        y: curPt.y + len * Math.sin(curAngle),
      }

      // Create thick quadrilateral polygon
      const poly = segmentToPolygon(curPt, nextPt, t)
      segments.push({
        flangeIndex: flangeIdx,
        p1: curPt,
        p2: nextPt,
        polygon: poly,
      })

      // Check if there is another bend in this direction
      const nextBendIdx = direction === 1 ? flangeIdx : flangeIdx - 1
      if (nextBendIdx >= 0 && nextBendIdx < numBends && nextBendIdx !== activeBendIndex) {
        const nextBend = part.bends[nextBendIdx]
        // Has this bend been bent in a previous step?
        const isBent = completedBends.has(nextBendIdx)
        const bendTurn = isBent ? 180 - (completedBends.get(nextBendIdx) ?? nextBend.angle) : 0
        const bendDirSign = nextBend.direction === 'UP' ? 1 : -1
        const angleChangeRad = ((bendTurn * bendDirSign * direction) * Math.PI) / 180

        curAngle += angleChangeRad
        curPt = nextPt

        bendPoints.push({
          bendIndex: nextBendIdx,
          pt: curPt,
          currentAngle: isBent ? completedBends.get(nextBendIdx)! : 180,
        })
      }

      flangeIdx += direction
    }
  }

  if (isForward) {
    // Left branch (towards operator, -X): flanges activeBendIndex down to 0
    const leftInitialAngle = Math.PI - halfTurnRad // points left and tilted up
    traceBranch(activeBendIndex, -1, leftInitialAngle, apexPt)

    // Right branch (towards backgauge, +X): flanges activeBendIndex + 1 up to N
    const rightInitialAngle = halfTurnRad // points right and tilted up
    traceBranch(activeBendIndex + 1, 1, rightInitialAngle, apexPt)
  } else {
    // Reverse orientation:
    // Left branch (towards operator, -X): flanges activeBendIndex + 1 up to N
    const leftInitialAngle = Math.PI - halfTurnRad
    traceBranch(activeBendIndex + 1, 1, leftInitialAngle, apexPt)

    // Right branch (towards backgauge, +X): flanges activeBendIndex down to 0
    const rightInitialAngle = halfTurnRad
    traceBranch(activeBendIndex, -1, rightInitialAngle, apexPt)
  }

  // Find backgauge contact point: the furthest +X point on the rearward branch
  let maxRearX = -Infinity
  let gaugePoint: Point2D = { x: 50, y: 0 }

  for (const seg of segments) {
    if (seg.p2.x > maxRearX) {
      maxRearX = seg.p2.x
      gaugePoint = seg.p2
    }
    if (seg.p1.x > maxRearX) {
      maxRearX = seg.p1.x
      gaugePoint = seg.p1
    }
  }

  return {
    segments,
    bendPoints,
    gaugeContactPoint: gaugePoint,
  }
}
