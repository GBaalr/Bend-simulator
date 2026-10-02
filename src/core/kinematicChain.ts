import { SheetMetalPart } from '../types/sheetMetal'
import { Point2D } from '../types/tooling'
import { segmentToPolygon } from './geometry2d'

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
 * Computes the exact 2D spatial layout and polygon cross-section of the sheet metal part
 * during any bend operation in a CNC press brake.
 *
 * Grounded in exact industrial CAD/CAM kinematics:
 * 1. Constructs the intrinsic rigid/articulated neutral sheet profile using true flange lengths
 *    and formed bend angles.
 * 2. Positions the active bend apex at the tooling centerline (0, y_apex) with the bend bisector
 *    vertically aligned with the punch/die axis (+Y).
 * 3. Inverts face orientation if a bend is 'DOWN' (since press brakes only bend upward).
 * 4. Respects machine handling: 'FORWARD' (lower flanges to operator, higher to gauge)
 *    vs 'REVERSE' (180° turnaround: higher flanges to operator, lower to gauge).
 */
export function computePartKinematics(
  part: SheetMetalPart,
  activeBendIndex: number,
  completedBends: Map<number, number>, // bends already completed prior to this step
  currentBendProgress: number, // 0.0 (flat on die) to 1.0 (fully formed)
  orientation: 'FORWARD' | 'REVERSE' = 'FORWARD',
  penetrationDepth: number = 2.0
): PartKinematicState {
  const t = part.thickness
  const numFlanges = part.flanges.length
  const numBends = part.bends.length

  if (numFlanges === 0) {
    return { segments: [], bendPoints: [], gaugeContactPoint: { x: 50, y: 0 } }
  }

  // 1. Determine active bend target & instantaneous formed angle
  const clampedBendIdx = Math.max(0, Math.min(activeBendIndex, numBends - 1))
  const activeBend = part.bends[clampedBendIdx]
  const targetAngle = activeBend ? activeBend.angle : 90
  const activeTurn = 180 - targetAngle
  const currentActiveTurn = activeTurn * currentBendProgress
  const currentActiveAngle = 180 - currentActiveTurn

  // On a press brake, the punch moves down into the die, so every active bend folds UP.
  // If a bend was sketched 'DOWN', the operator flips the sheet upside down (face flip).
  const isSheetFlipped = activeBend ? activeBend.direction === 'DOWN' : false
  const flipSign = isSheetFlipped ? -1 : 1

  // 2. Build the intrinsic 2D vertex chain V_0, ..., V_N in sheet coordinates
  const vertices: Point2D[] = [{ x: 0, y: 0 }]
  let curAngle = 0 // heading along +X

  for (let f = 0; f < numFlanges; f++) {
    const len = part.flanges[f].length
    const lastV = vertices[vertices.length - 1]
    vertices.push({
      x: lastV.x + len * Math.cos(curAngle),
      y: lastV.y + len * Math.sin(curAngle),
    })

    if (f < numBends) {
      const b = part.bends[f]
      let angle = 180
      if (f === clampedBendIdx) {
        angle = currentActiveAngle
      } else if (completedBends.has(f)) {
        angle = completedBends.get(f)!
      }
      const turnDeg = 180 - angle
      const bSign = (b.direction === 'UP' ? 1 : -1) * flipSign
      curAngle += (turnDeg * bSign * Math.PI) / 180
    }
  }

  // 3. Transform intrinsic chain into Machine Space:
  // Apex is at vertices[clampedBendIdx + 1]
  const apexIdx = clampedBendIdx + 1
  const apex = vertices[apexIdx]
  const prevV = vertices[apexIdx - 1]
  const nextV = vertices[apexIdx + 1]

  // Arm entering apex (lower flange): from apex towards prevV
  const inArm = { x: prevV.x - apex.x, y: prevV.y - apex.y }
  const inLen = Math.hypot(inArm.x, inArm.y) || 1
  const uIn = { x: inArm.x / inLen, y: inArm.y / inLen }

  // Arm leaving apex (higher flange): from apex towards nextV
  const outArm = { x: nextV.x - apex.x, y: nextV.y - apex.y }
  const outLen = Math.hypot(outArm.x, outArm.y) || 1
  const uOut = { x: outArm.x / outLen, y: outArm.y / outLen }

  // Bisector vector pointing inside the V (towards punch, +Y)
  const bisector = { x: uIn.x + uOut.x, y: uIn.y + uOut.y }
  const bMag = Math.hypot(bisector.x, bisector.y)

  let rot: number
  if (bMag < 1e-4) {
    // Perfectly flat (180°): sheet normal pointing up towards punch is (-uOut.y, uOut.x)
    const normal = { x: -uOut.y, y: uOut.x }
    const normAngle = Math.atan2(normal.y, normal.x)
    rot = Math.PI / 2 - normAngle
  } else {
    const bisectorAngle = Math.atan2(bisector.y, bisector.x)
    rot = Math.PI / 2 - bisectorAngle
  }

  const rotate = (p: Point2D, angle: number): Point2D => {
    const c = Math.cos(angle)
    const s = Math.sin(angle)
    return {
      x: p.x * c - p.y * s,
      y: p.x * s + p.y * c,
    }
  }

  // Determine horizontal mirroring to satisfy orientation:
  // 'FORWARD': lower flanges (inArm) go toward operator (-X), higher flanges (outArm) go toward gauge (+X).
  // 'REVERSE': lower flanges (inArm) go toward gauge (+X), higher flanges (outArm) go toward operator (-X).
  const rotIn = rotate(uIn, rot)
  const isForward = orientation === 'FORWARD'
  let mirrorX = false
  if (isForward) {
    if (rotIn.x > 0) mirrorX = true
  } else {
    if (rotIn.x < 0) mirrorX = true
  }

  // Active bend apex descends into die: y = -t - penetrationDepth * currentBendProgress
  const curY = -t - penetrationDepth * currentBendProgress

  const machineVertices: Point2D[] = vertices.map((v) => {
    const rel = { x: v.x - apex.x, y: v.y - apex.y }
    let r = rotate(rel, rot)
    if (mirrorX) r.x = -r.x
    return {
      x: r.x,
      y: r.y + curY,
    }
  })

  // 4. Build segments with exact thick polygons
  const segments: PartKinematicState['segments'] = []
  for (let f = 0; f < numFlanges; f++) {
    const p1 = machineVertices[f]
    const p2 = machineVertices[f + 1]
    const polygon = segmentToPolygon(p1, p2, t)
    segments.push({
      flangeIndex: f,
      p1,
      p2,
      polygon,
    })
  }

  // 5. Build bend points
  const bendPoints: PartKinematicState['bendPoints'] = []
  for (let b = 0; b < numBends; b++) {
    let angle = 180
    if (b === clampedBendIdx) {
      angle = currentActiveAngle
    } else if (completedBends.has(b)) {
      angle = completedBends.get(b)!
    }
    bendPoints.push({
      bendIndex: b,
      pt: machineVertices[b + 1],
      currentAngle: angle,
    })
  }

  // 6. Find accurate backgauge contact point:
  // The rear gauge finger (+X) stops against the furthest rear edge of the workpiece.
  let maxRearX = -Infinity
  let gaugePoint: Point2D = { x: 50, y: 0 }

  for (const v of machineVertices) {
    if (v.x > maxRearX) {
      maxRearX = v.x
      gaugePoint = v
    }
  }

  // Ensure contact point is positive and realistic
  if (gaugePoint.x < 5) {
    gaugePoint = { x: 50, y: 0 }
  }

  return {
    segments,
    bendPoints,
    gaugeContactPoint: gaugePoint,
  }
}
