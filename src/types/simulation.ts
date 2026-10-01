import { Point2D } from './tooling'

export type CollisionEntity = 'PUNCH' | 'PUNCH_HOLDER' | 'UPPER_RAM' | 'DIE' | 'LOWER_BED' | 'BACKGAUGE'

export interface CollisionPoint {
  x: number
  y: number
  flangeIndex: number
  entity: CollisionEntity
  penetrationDepth: number
  atAngleProgress: number // 0.0 (open/flat) to 1.0 (fully bent)
}

export interface StepCollisionResult {
  hasCollision: boolean
  collisionPoints: CollisionPoint[]
  earliestCollidingAngleRatio: number // 0.0 - 1.0
  collidingEntities: CollisionEntity[]
  collidingFlanges: number[]
}

export interface Diagnostic {
  id: string
  title: string
  description: string
  severity: 'error' | 'warning' | 'info'
  collidingFlangeIndex: number
  collidingEntity: CollisionEntity
  maxSafeLength?: number
  currentLength?: number
}

export interface Suggestion {
  id: string
  category: 'HANDLING' | 'PART_DESIGN' | 'TOOL_SWAP'
  title: string
  description: string
  actionLabel?: string
  confidence: 'high' | 'medium'
  params?: {
    recommendedOrientation?: 'FORWARD' | 'REVERSE'
    recommendedFlangeLength?: number
    flangeIndex?: number
    reliefNeededMm?: number
    recommendedPunchId?: string
    recommendedDieId?: string
  }
}

export interface EvaluatedStep {
  stepIndex: number
  bendIndex: number
  bendId: string
  targetAngle: number
  direction: 'UP' | 'DOWN'
  orientation: 'FORWARD' | 'REVERSE'
  clampedFlangeIndex: number
  gaugeFlangeIndex: number
  gaugeX: number
  gaugeR: number
  ramStrokeY: number
  tonnageTonnes: number
  crowningValue: number
  collisionResult: StepCollisionResult
  diagnostics: Diagnostic[]
}

export interface EvaluatedSequence {
  id: string
  isValid: boolean
  steps: EvaluatedStep[]
  flipCount: number
  score: number // lower is better
  primaryFailureReason?: string
  suggestions: Suggestion[]
}

export interface SimulationResult {
  feasibleSequences: EvaluatedSequence[]
  bestSequence: EvaluatedSequence | null
  failedSequences: EvaluatedSequence[]
  globalSuggestions: Suggestion[]
}
