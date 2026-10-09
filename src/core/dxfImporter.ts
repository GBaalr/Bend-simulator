import DxfParser from 'dxf-parser'
import { SheetMetalPart, Flange, Bend } from '../types/sheetMetal'

interface ParsedPoint {
  x: number
  y: number
}

/**
 * Parses a 2D DXF cross-section file into a SheetMetalPart.
 * Extracts connected line segments/polylines to reconstruct flanges and bend angles.
 */
export function parseDxfProfile(
  dxfString: string,
  thickness: number = 2.0,
  width: number = 500
): SheetMetalPart {
  const parser = new DxfParser()
  const dxf = parser.parseSync(dxfString)

  if (!dxf || !dxf.entities || dxf.entities.length === 0) {
    throw new Error('No valid geometric entities found in DXF file.')
  }

  const rawSegments: { p1: ParsedPoint; p2: ParsedPoint }[] = []

  // Extract lines and lwpolylines
  for (const entity of dxf.entities) {
    if (entity.type === 'LINE') {
      const line = entity as any
      rawSegments.push({
        p1: { x: line.vertices[0].x, y: line.vertices[0].y },
        p2: { x: line.vertices[1].x, y: line.vertices[1].y },
      })
    } else if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') {
      const poly = entity as any
      if (poly.vertices && poly.vertices.length >= 2) {
        for (let i = 0; i < poly.vertices.length - 1; i++) {
          rawSegments.push({
            p1: { x: poly.vertices[i].x, y: poly.vertices[i].y },
            p2: { x: poly.vertices[i + 1].x, y: poly.vertices[i + 1].y },
          })
        }
      }
    } else if (entity.type === 'ARC') {
      const arc = entity as any
      if (arc.center && typeof arc.radius === 'number') {
        const startRad = typeof arc.startAngle === 'number' ? arc.startAngle : 0
        const endRad = typeof arc.endAngle === 'number' ? arc.endAngle : Math.PI
        rawSegments.push({
          p1: {
            x: arc.center.x + arc.radius * Math.cos(startRad),
            y: arc.center.y + arc.radius * Math.sin(startRad),
          },
          p2: {
            x: arc.center.x + arc.radius * Math.cos(endRad),
            y: arc.center.y + arc.radius * Math.sin(endRad),
          },
        })
      }
    }
  }

  if (rawSegments.length === 0) {
    throw new Error('No LINE, ARC, or POLYLINE elements found in the DXF drawing.')
  }

  // Chain connected segments into an ordered path
  const orderedPoints: ParsedPoint[] = [rawSegments[0].p1, rawSegments[0].p2]
  const remaining = rawSegments.slice(1)

  while (remaining.length > 0) {
    const lastPt = orderedPoints[orderedPoints.length - 1]
    let foundIdx = -1
    let reversed = false
    let minGap = 5.0 // Connection tolerance for CAD exports (supports small gaps)

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
      // End of continuous chain
      break
    }
  }

  // Convert ordered points into Flanges and Bends
  const flanges: Flange[] = []
  const bends: Bend[] = []

  for (let i = 0; i < orderedPoints.length - 1; i++) {
    const p1 = orderedPoints[i]
    const p2 = orderedPoints[i + 1]
    const len = Math.round(Math.hypot(p2.x - p1.x, p2.y - p1.y) * 10) / 10
    flanges.push({
      id: `flange-${i}`,
      length: Math.max(0.5, len),
    })

    if (i < orderedPoints.length - 2) {
      const p3 = orderedPoints[i + 2]
      // Compute angle between vectors (p2 - p1) and (p3 - p2)
      const v1x = p2.x - p1.x
      const v1y = p2.y - p1.y
      const v2x = p3.x - p2.x
      const v2y = p3.y - p2.y

      const dot = v1x * v2x + v1y * v2y
      const cross = v1x * v2y - v1y * v2x
      const angleRad = Math.atan2(Math.abs(cross), dot)
      let turnDeg = Math.round(((angleRad * 180) / Math.PI) * 10) / 10
      const interiorAngle = Math.max(30, Math.min(170, Math.round(180 - turnDeg)))

      bends.push({
        id: `bend-${i}`,
        angle: interiorAngle,
        direction: cross >= 0 ? 'UP' : 'DOWN',
        radius: 1.5,
      })
    }
  }

  return {
    name: 'Imported DXF Profile',
    thickness,
    width,
    materialId: 'mild_steel_s235',
    flanges,
    bends,
  }
}
