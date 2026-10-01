export interface DelemProgramStep {
  step: number
  bendNumber: number
  angle: number        // e.g. 90.0°
  opening: number      // stroke retraction opening (mm)
  yAxis: number        // Y1/Y2 stroke position (mm)
  xAxis: number        // backgauge X position (mm)
  rAxis: number        // backgauge R height (mm)
  crowning: number     // crowning compensation value
  forceTonnes: number  // computed tonnage
  punchName: string
  dieName: string
  partTurn: string     // 'None', 'Turn 180°', 'Flip', etc.
}

export interface DelemPartProgram {
  programName: string
  controller: 'DELEM DA-53T'
  thickness: number
  material: string
  blankLength: number
  bendLength: number
  totalSteps: number
  steps: DelemProgramStep[]
}
