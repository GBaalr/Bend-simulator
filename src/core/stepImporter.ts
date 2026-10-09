import { SheetMetalPart, Flange, Bend } from '../types/sheetMetal'

interface Point3D {
  x: number
  y: number
  z: number
}

interface Point2D {
  x: number
  y: number
}

/**
 * Parses a STEP file (.step / .stp) exported from SolidWorks, Autodesk Inventor, Fusion 360, etc.
 * Extracts Cartesian points and connects edges along the bending profile cross-section.
 */
export function parseStepProfile(
  stepString: string,
  thickness: number = 2.0,
  width: number = 500
): SheetMetalPart {
  if (!stepString.includes('ISO-10303-21') && !stepString.includes('FILE_SCHEMA')) {
    throw new Error('Not a valid STEP file (missing ISO-10303-21 header).')
  }

  // 1. Extract CARTESIAN_POINT entries: #id = CARTESIAN_POINT('', (x, y, z));
  const cartesianPoints = new Map<number, Point3D>()
  const pointRegex = /#(\d+)\s*=\s*CARTESIAN_POINT\s*\(\s*'[^']*'\s*,\s*\(\s*([-\d.eE+]+)\s*,\s*([-\d.eE+]+)\s*,\s*([-\d.eE+]+)\s*\)\s*\)/g
  let match: RegExpExecArray | null

  while ((match = pointRegex.exec(stepString)) !== null) {
    const id = parseInt(match[1], 10)
    const x = parseFloat(match[2])
    const y = parseFloat(match[3])
    const z = parseFloat(match[4])
    if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
      cartesianPoints.set(id, { x, y, z })
    }
  }

  if (cartesianPoints.size < 2) {
    throw new Error('No 3D/2D geometry points found in STEP file.')
  }

  // 2. Extract VERTEX_POINT mappings: #id = VERTEX_POINT('', #pointId);
  const vertexToPoint = new Map<number, number>()
  const vertexRegex = /#(\d+)\s*=\s*VERTEX_POINT\s*\(\s*'[^']*'\s*,\s*#(\d+)\s*\)/g
  while ((match = vertexRegex.exec(stepString)) !== null) {
    const vId = parseInt(match[1], 10)
    const pId = parseInt(match[2], 10)
    vertexToPoint.set(vId, pId)
  }

  // 3. Extract EDGE_CURVE connections: #id = EDGE_CURVE('', #startVertex, #endVertex, ...);
  const edges: { p1: Point3D; p2: Point3D }[] = []
  const edgeRegex = /#(\d+)\s*=\s*EDGE_CURVE\s*\(\s*'[^']*'\s*,\s*#(\d+)\s*,\s*#(\d+)/g
  while ((match = edgeRegex.exec(stepString)) !== null) {
    const v1 = parseInt(match[2], 10)
    const v2 = parseInt(match[3], 10)
    const pId1 = vertexToPoint.get(v1) ?? v1
    const pId2 = vertexToPoint.get(v2) ?? v2
    const pt1 = cartesianPoints.get(pId1)
    const pt2 = cartesianPoints.get(pId2)
    if (pt1 && pt2) {
      const dist = Math.hypot(pt2.x - pt1.x, pt2.y - pt1.y, pt2.z - pt1.z)
      if (dist > 0.5) {
        edges.push({ p1: pt1, p2: pt2 })
      }
    }
  }

  // If no explicit EDGE_CURVE found, connect cartesian points by sequential ID order
  if (edges.length === 0) {
    const sortedPts = Array.from(cartesianPoints.values())
    for (let i = 0; i < sortedPts.length - 1; i++) {
      const p1 = sortedPts[i]
      const p2 = sortedPts[i + 1]
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z)
      if (dist > 0.5) {
        edges.push({ p1, p2 })
      }
    }
  }

  if (edges.length === 0) {
    throw new Error('Unable to resolve connected profile edges in STEP file.')
  }

  // 4. Project edges onto the 2D cross-section plane with greatest variation
  // Compute variance in X, Y, Z
  let spanX = 0, spanY = 0, spanZ = 0
  for (const e of edges) {
    spanX = Math.max(spanX, Math.abs(e.p1.x - e.p2.x))
    spanY = Math.max(spanY, Math.abs(e.p1.y - e.p2.y))
    spanZ = Math.max(spanZ, Math.abs(e.p1.z - e.p2.z))
  }

  // Choose the two dimensions that form the bending profile
  // Usually sheet metal thickness/length is perpendicular to width (which has largest constant span)
  const to2D = (p: Point3D): Point2D => {
    if (spanZ >= spanX && spanZ >= spanY && spanX >= spanY) {
      return { x: p.x, y: p.y }
    } else if (spanY >= spanX && spanY >= spanZ) {
      return { x: p.x, y: p.z }
    }
    return { x: p.x, y: p.y }
  }

  // 5. Chain 2D segments into a sequence
  const segments2D = edges.map((e) => ({
    p1: to2D(e.p1),
    p2: to2D(e.p2),
  })).filter((s) => Math.hypot(s.p2.x - s.p1.x, s.p2.y - s.p1.y) > 0.5)

  if (segments2D.length === 0) {
    throw new Error('No 2D profile segments found after projection.')
  }

  const orderedPoints: Point2D[] = [segments2D[0].p1, segments2D[0].p2]
  const remaining = segments2D.slice(1)

  while (remaining.length > 0) {
    const lastPt = orderedPoints[orderedPoints.length - 1]
    let foundIdx = -1
    let reversed = false
    let minGap = 5.0

    for (let i = 0; i < remaining.length; i++) {
      const seg = remaining[i]
      const distStart = Math.hypot(seg.p1.x - lastPt.x, seg.p1.y - lastPt.y)
      const distEnd = Math.hypot(seg.p2.x - lastPt.x, seg.p2.y - lastPt.y)

      if (distStart < minGap) {
        minGap = distStart
        foundIdx = i
        reversed = false
      } else if (distEnd < minGap) {
        minGap = distEnd
        foundIdx = i
        reversed = true
      }
    }

    if (foundIdx !== -1) {
      const seg = remaining.splice(foundIdx, 1)[0]
      orderedPoints.push(reversed ? seg.p1 : seg.p2)
    } else {
      break
    }
  }

  // 6. Convert ordered points into Flanges and Bends
  const flanges: Flange[] = []
  const bends: Bend[] = []

  for (let i = 0; i < orderedPoints.length - 1; i++) {
    const p1 = orderedPoints[i]
    const p2 = orderedPoints[i + 1]
    const len = Math.round(Math.hypot(p2.x - p1.x, p2.y - p1.y) * 10) / 10
    if (len < 0.5) continue

    flanges.push({
      id: `flange-${i}`,
      length: Math.max(0.5, len),
    })

    if (i < orderedPoints.length - 2) {
      const p3 = orderedPoints[i + 2]
      const v1x = p2.x - p1.x
      const v1y = p2.y - p1.y
      const v2x = p3.x - p2.x
      const v2y = p3.y - p2.y

      const dot = v1x * v2x + v1y * v2y
      const cross = v1x * v2y - v1y * v2x
      const angleRad = Math.atan2(Math.abs(cross), dot)
      const turnDeg = Math.round(((angleRad * 180) / Math.PI) * 10) / 10
      const interiorAngle = Math.max(30, Math.min(170, Math.round(180 - turnDeg)))

      bends.push({
        id: `bend-${i}`,
        angle: interiorAngle,
        direction: cross >= 0 ? 'UP' : 'DOWN',
        radius: 1.5,
      })
    }
  }

  if (flanges.length === 0) {
    throw new Error('Could not identify flanges in STEP geometry.')
  }

  return {
    name: 'Imported SolidWorks STEP Part',
    thickness,
    width,
    materialId: 'mild_steel_s235',
    flanges,
    bends,
  }
}
