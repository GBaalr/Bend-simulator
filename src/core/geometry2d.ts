import { Point2D } from '../types/tooling'

export interface LineSegment {
  p1: Point2D
  p2: Point2D
}

export interface BoundingBox {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export function rotatePoint(p: Point2D, angleRad: number, center: Point2D = { x: 0, y: 0 }): Point2D {
  const cos = Math.cos(angleRad)
  const sin = Math.sin(angleRad)
  const dx = p.x - center.x
  const dy = p.y - center.y
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  }
}

export function translatePoint(p: Point2D, dx: number, dy: number): Point2D {
  return { x: p.x + dx, y: p.y + dy }
}

export function transformPoints(
  points: Point2D[],
  dx: number,
  dy: number,
  angleRad: number,
  origin: Point2D = { x: 0, y: 0 }
): Point2D[] {
  return points.map((p) => {
    const rotated = rotatePoint(p, angleRad, origin)
    return translatePoint(rotated, dx, dy)
  })
}

export function getBoundingBox(points: Point2D[]): BoundingBox {
  if (points.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 }
  }
  let minX = points[0].x
  let maxX = points[0].x
  let minY = points[0].y
  let maxY = points[0].y

  for (let i = 1; i < points.length; i++) {
    const pt = points[i]
    if (pt.x < minX) minX = pt.x
    if (pt.x > maxX) maxX = pt.x
    if (pt.y < minY) minY = pt.y
    if (pt.y > maxY) maxY = pt.y
  }

  return { minX, maxX, minY, maxY }
}

export function doBoundingBoxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY)
}

/**
 * Checks if two line segments (p1-p2 and p3-p4) intersect.
 * Returns intersection point if they cross, or null.
 */
export function checkLineIntersection(
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  p4: Point2D
): Point2D | null {
  const dX1 = p2.x - p1.x
  const dY1 = p2.y - p1.y
  const dX2 = p4.x - p3.x
  const dY2 = p4.y - p3.y

  const denom = dX1 * dY2 - dY1 * dX2
  if (Math.abs(denom) < 1e-8) return null // Parallel or collinear

  const s = (-dY1 * (p1.x - p3.x) + dX1 * (p1.y - p3.y)) / denom
  const t = (dX2 * (p1.y - p3.y) - dY2 * (p1.x - p3.x)) / denom

  if (s >= 0.001 && s <= 0.999 && t >= 0.001 && t <= 0.999) {
    return {
      x: p1.x + t * dX1,
      y: p1.y + t * dY1,
    }
  }

  return null
}

/**
 * Standard ray-casting algorithm to test if point is inside a polygon.
 */
export function isPointInsidePolygon(pt: Point2D, polygon: Point2D[]): boolean {
  if (polygon.length < 3) return false
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x,
      yi = polygon[i].y
    const xj = polygon[j].x,
      yj = polygon[j].y

    const intersect = yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 1e-12) + xi
    if (intersect) inside = !inside
  }
  return inside
}

/**
 * Detailed polygon-polygon collision check.
 * Returns true and intersection point/penetration if polygons overlap.
 */
export function checkPolygonCollision(
  polyA: Point2D[],
  polyB: Point2D[]
): { hasCollision: boolean; intersectionPoint?: Point2D; penetrationDepth?: number } {
  if (polyA.length < 3 || polyB.length < 3) {
    return { hasCollision: false }
  }

  // Quick Bounding Box test
  const boxA = getBoundingBox(polyA)
  const boxB = getBoundingBox(polyB)
  if (!doBoundingBoxesOverlap(boxA, boxB)) {
    return { hasCollision: false }
  }

  // 1. Edge-edge intersections
  for (let i = 0; i < polyA.length; i++) {
    const a1 = polyA[i]
    const a2 = polyA[(i + 1) % polyA.length]

    for (let j = 0; j < polyB.length; j++) {
      const b1 = polyB[j]
      const b2 = polyB[(j + 1) % polyB.length]

      const hit = checkLineIntersection(a1, a2, b1, b2)
      if (hit) {
        return {
          hasCollision: true,
          intersectionPoint: hit,
          penetrationDepth: 5.0, // estimated
        }
      }
    }
  }

  // 2. Vertex inside polygon test (one polygon entirely inside another)
  for (const pt of polyA) {
    if (isPointInsidePolygon(pt, polyB)) {
      return {
        hasCollision: true,
        intersectionPoint: pt,
        penetrationDepth: 10.0,
      }
    }
  }

  for (const pt of polyB) {
    if (isPointInsidePolygon(pt, polyA)) {
      return {
        hasCollision: true,
        intersectionPoint: pt,
        penetrationDepth: 10.0,
      }
    }
  }

  return { hasCollision: false }
}

/**
 * Converts a 2D line segment with thickness T into a 4-point quadrilateral polygon.
 */
export function segmentToPolygon(p1: Point2D, p2: Point2D, thickness: number): Point2D[] {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const len = Math.hypot(dx, dy)
  if (len < 1e-6) return [p1, p2, p2, p1]

  // Normal vector
  const nx = (-dy / len) * (thickness / 2)
  const ny = (dx / len) * (thickness / 2)

  return [
    { x: p1.x + nx, y: p1.y + ny },
    { x: p2.x + nx, y: p2.y + ny },
    { x: p2.x - nx, y: p2.y - ny },
    { x: p1.x - nx, y: p1.y - ny },
  ]
}
