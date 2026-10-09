import { Punch, Die, MachineEnvelope, Point2D } from '../types/tooling'

/**
 * Coordinate System:
 * Origin (0,0) is at the PUNCH TIP at neutral touch.
 * +Y is UPWARDS towards the Upper Ram and Punch Holder.
 * -Y is DOWNWARDS towards the Die and Lower Bed.
 * +X is to the REAR towards the Backgauge fingers.
 * -X is to the FRONT towards the Operator.
 */

export function generatePunchPolygon(punch: Punch): Point2D[] {
  const halfAngleRad = ((punch.angle / 2) * Math.PI) / 180
  const tipRadius = punch.tipRadius || 0.8
  const h = punch.height || 105
  const shankHalfWidth = (punch.shankWidth || 13) / 2 // 6.5 mm standard European tang
  const tangBottomY = h - 20 // 20mm standard clamping tang height

  // Promecam / European Standard Clamping Tang with Anti-Fall Safety Groove (8.4mm neck)
  const tangRight: Point2D[] = [
    { x: shankHalfWidth, y: tangBottomY },
    { x: shankHalfWidth, y: h - 14 },
    { x: 4.2, y: h - 12 },
    { x: 4.2, y: h - 8 },
    { x: shankHalfWidth, y: h - 6 },
    { x: shankHalfWidth, y: h },
  ]
  const tangLeft: Point2D[] = [
    { x: -shankHalfWidth, y: h },
    { x: -shankHalfWidth, y: h - 6 },
    { x: -4.2, y: h - 8 },
    { x: -4.2, y: h - 12 },
    { x: -shankHalfWidth, y: h - 14 },
    { x: -shankHalfWidth, y: tangBottomY },
  ]

  if (punch.type === 'straight') {
    // European Standard Straight Punch (e.g. Rolleri P.105.88 / P.150.88 / P.150.60)
    // Symmetrical 24mm thick body (half-width 12mm), slender nose tapering at halfAngle
    const bodyHalfWidth = punch.angle <= 60 ? 15.0 : 12.0
    const taperH = Math.min(22, Math.max(8, (bodyHalfWidth - tipRadius) / Math.tan(halfAngleRad)))
    const taperW = taperH * Math.tan(halfAngleRad) + tipRadius

    return [
      { x: 0, y: 0 }, // Tip at (0,0)
      { x: taperW, y: taperH }, // Right nose taper
      { x: bodyHalfWidth, y: taperH + 4 }, // Transition to body
      { x: bodyHalfWidth, y: tangBottomY }, // Shoulder right
      ...tangRight,
      ...tangLeft,
      { x: -bodyHalfWidth, y: tangBottomY }, // Shoulder left
      { x: -bodyHalfWidth, y: taperH + 4 }, // Transition left
      { x: -taperW, y: taperH }, // Left nose taper
    ]
  }

  if (punch.type === 'gooseneck') {
    // Standard European Swan-Neck Gooseneck Punch (e.g. Rolleri P.130.88 / P.120.88)
    // Deep throat clearance pocket on the front (-X) for return flanges and box shapes
    const reliefDepth = punch.throatRelief || 55
    const reliefH = punch.throatHeight || 55
    const bodyRearWidth = 12.0

    // Nose taper at tip
    const noseH = 8
    const noseRightW = noseH * Math.tan(halfAngleRad) + tipRadius
    const noseLeftW = noseH * Math.tan(halfAngleRad) + tipRadius

    // Rear face (+X towards backgauge): solid structural contour
    const rearPts: Point2D[] = [
      { x: noseRightW, y: noseH },
      { x: bodyRearWidth - 3, y: 25 },
      { x: bodyRearWidth, y: 60 },
      { x: bodyRearWidth + 1, y: tangBottomY },
    ]

    // Front throat curve (-X towards operator): authentic smooth C-shaped pocket
    const frontPts: Point2D[] = [
      { x: -bodyRearWidth, y: tangBottomY }, // Shoulder left
      { x: -16, y: Math.min(tangBottomY - 6, reliefH + 32) },
      { x: -reliefDepth * 0.55, y: reliefH + 24 }, // Upper curve
      { x: -reliefDepth * 0.85, y: reliefH + 14 },
      { x: -reliefDepth, y: reliefH }, // Deepest throat point
      { x: -reliefDepth * 0.95, y: reliefH - 12 },
      { x: -reliefDepth * 0.70, y: Math.max(noseH + 12, reliefH - 24) }, // Lower curve
      { x: -reliefDepth * 0.40, y: noseH + 8 },
      { x: -noseLeftW - 3, y: noseH + 3 },
      { x: -noseLeftW, y: noseH }, // Left nose taper
    ]

    return [
      { x: 0, y: 0 }, // Tip
      ...rearPts,
      ...tangRight,
      ...tangLeft,
      ...frontPts,
    ]
  }

  if (punch.type === 'deep_gooseneck') {
    // Deep Swan-Neck Punch (e.g. Rolleri P.175.88 / UKB Deep Gooseneck)
    // 80mm throat relief for deep U-profiles, trays, and returns
    const reliefDepth = punch.throatRelief || 80
    const reliefH = punch.throatHeight || 70
    const bodyRearWidth = 14.0

    const noseH = 9
    const noseRightW = noseH * Math.tan(halfAngleRad) + tipRadius
    const noseLeftW = noseH * Math.tan(halfAngleRad) + tipRadius

    const rearPts: Point2D[] = [
      { x: noseRightW, y: noseH },
      { x: bodyRearWidth - 2, y: 35 },
      { x: bodyRearWidth, y: 90 },
      { x: bodyRearWidth + 2, y: tangBottomY },
    ]

    const frontPts: Point2D[] = [
      { x: -bodyRearWidth, y: tangBottomY },
      { x: -22, y: Math.min(tangBottomY - 8, reliefH + 42) },
      { x: -reliefDepth * 0.6, y: reliefH + 30 },
      { x: -reliefDepth * 0.9, y: reliefH + 18 },
      { x: -reliefDepth, y: reliefH }, // Deepest pocket apex
      { x: -reliefDepth * 0.95, y: reliefH - 18 },
      { x: -reliefDepth * 0.75, y: Math.max(noseH + 16, reliefH - 35) },
      { x: -reliefDepth * 0.45, y: noseH + 12 },
      { x: -noseLeftW - 4, y: noseH + 4 },
      { x: -noseLeftW, y: noseH },
    ]

    return [
      { x: 0, y: 0 },
      ...rearPts,
      ...tangRight,
      ...tangLeft,
      ...frontPts,
    ]
  }

  if (punch.type === 'acute') {
    // 30° Acute air-bending punch (e.g. Rolleri P.105.30 / Eurostamp 1021)
    // Slender nose extending ~35mm up before widening to standard body
    const bodyHalfWidth = 12.5
    const acuteNoseH = Math.min(42, Math.max(25, ((bodyHalfWidth - tipRadius) / Math.tan(halfAngleRad)) * 0.9))
    const noseW = acuteNoseH * Math.tan(halfAngleRad) + tipRadius

    return [
      { x: 0, y: 0 },
      { x: noseW, y: acuteNoseH },
      { x: bodyHalfWidth, y: acuteNoseH + 8 },
      { x: bodyHalfWidth, y: tangBottomY },
      ...tangRight,
      ...tangLeft,
      { x: -bodyHalfWidth, y: tangBottomY },
      { x: -bodyHalfWidth, y: acuteNoseH + 8 },
      { x: -noseW, y: acuteNoseH },
    ]
  }

  if (punch.type === 'hemming') {
    // Dutch Folding / Hemming Combo Punch (e.g. Rolleri P.100.HEM)
    // Asymmetric tool: 30° acute nose for pre-bend, flat vertical rear face for flattening
    const flatAnvilWidth = 18.0
    const frontReliefDepth = 35.0
    const noseH = 12.0
    const acuteAngleRad = (30 / 2) * (Math.PI / 180)
    const noseW = noseH * Math.tan(acuteAngleRad) + tipRadius

    return [
      { x: 0, y: 0 }, // Tip (pre-bend apex)
      { x: flatAnvilWidth, y: 0 }, // Flat horizontal flattening anvil step
      { x: flatAnvilWidth, y: tangBottomY }, // Vertical rear flattening face
      ...tangRight,
      ...tangLeft,
      { x: -shankHalfWidth, y: tangBottomY },
      { x: -frontReliefDepth, y: 55 }, // Front relief pocket
      { x: -frontReliefDepth * 0.6, y: 25 },
      { x: -noseW, y: noseH },
    ]
  }

  // Sash / Sword Punch (e.g. Rolleri P.135.26 / Promecam P.105.86, narrow profile punch)
  const bodyHalfWidth = 8.5
  const taperH = Math.min(14, (bodyHalfWidth - tipRadius) / Math.tan(halfAngleRad))
  const taperW = taperH * Math.tan(halfAngleRad) + tipRadius

  return [
    { x: 0, y: 0 },
    { x: taperW, y: taperH },
    { x: bodyHalfWidth, y: taperH + 5 },
    { x: bodyHalfWidth, y: tangBottomY - 12 },
    { x: 12, y: tangBottomY },
    ...tangRight,
    ...tangLeft,
    { x: -12, y: tangBottomY },
    { x: -bodyHalfWidth, y: tangBottomY - 12 },
    { x: -bodyHalfWidth, y: taperH + 5 },
    { x: -taperW, y: taperH },
  ]
}

export function generateDiePolygon(die: Die, sheetThickness: number): Point2D[] {
  const v = die.vOpening
  const halfAngleRad = ((die.vAngle / 2) * Math.PI) / 180
  const vDepth = (v / 2) / Math.tan(halfAngleRad)
  const baseW = die.baseWidth / 2
  const dieTopY = -sheetThickness // Die sits directly below sheet
  const dieBottomY = dieTopY - die.height
  const tangHalfW = 6.5 // 13mm centering tang

  // 1. 4-Way Multi-V Die Block (80x80mm square with 4 V-grooves)
  if (die.type === 'multi_v' || die.id.includes('multi')) {
    const blockHalf = die.baseWidth / 2
    return [
      { x: -v / 2, y: dieTopY }, // Top V left shoulder
      { x: 0, y: dieTopY - vDepth }, // Top V apex
      { x: v / 2, y: dieTopY }, // Top V right shoulder
      { x: blockHalf, y: dieTopY }, // Top right corner
      { x: blockHalf, y: dieTopY - 25 }, // Right side V opening
      { x: blockHalf - 8, y: dieTopY - 40 },
      { x: blockHalf, y: dieTopY - 55 },
      { x: blockHalf, y: dieBottomY }, // Bottom right
      { x: -blockHalf, y: dieBottomY }, // Bottom left
      { x: -blockHalf, y: dieTopY - 55 }, // Left side V opening
      { x: -blockHalf + 8, y: dieTopY - 40 },
      { x: -blockHalf, y: dieTopY - 25 },
      { x: -blockHalf, y: dieTopY }, // Top left corner
    ]
  }

  // 2. Hemming Combo Spring Flattening Die
  if (die.type === 'hemming' || die.id.includes('hem')) {
    const anvilW = 25
    return [
      { x: -v / 2 - anvilW, y: dieTopY }, // Far left flattening spring pad
      { x: -v / 2, y: dieTopY }, // Acute V left shoulder
      { x: -anvilW / 2, y: dieTopY - vDepth }, // Acute V apex
      { x: 0, y: dieTopY }, // Acute V right shoulder
      { x: baseW, y: dieTopY }, // Right flat table
      { x: baseW, y: dieTopY - 20 },
      { x: tangHalfW + 6, y: dieBottomY + 20 },
      { x: tangHalfW, y: dieBottomY + 20 }, // Tang shoulder
      { x: tangHalfW, y: dieBottomY }, // Tang bottom right
      { x: -tangHalfW, y: dieBottomY }, // Tang bottom left
      { x: -tangHalfW, y: dieBottomY + 20 }, // Tang shoulder
      { x: -tangHalfW - 6, y: dieBottomY + 20 },
      { x: -baseW, y: dieTopY - 20 },
    ]
  }

  // 3. Standard Single V-Die & Acute V-Die with 13mm Standard Centering Tang
  return [
    { x: -v / 2, y: dieTopY }, // Left V shoulder
    { x: 0, y: dieTopY - vDepth }, // V Bottom
    { x: v / 2, y: dieTopY }, // Right V shoulder
    { x: baseW, y: dieTopY }, // Top right shoulder
    { x: baseW, y: dieTopY - 18 },
    { x: baseW * 0.88, y: dieBottomY + 22 }, // Body taper
    { x: tangHalfW + 5, y: dieBottomY + 20 }, // Shoulder step to tang
    { x: tangHalfW, y: dieBottomY + 20 },
    { x: tangHalfW, y: dieBottomY }, // 13mm Tang bottom right
    { x: -tangHalfW, y: dieBottomY }, // 13mm Tang bottom left
    { x: -tangHalfW, y: dieBottomY + 20 },
    { x: -(tangHalfW + 5), y: dieBottomY + 20 },
    { x: -baseW * 0.88, y: dieBottomY + 22 },
    { x: -baseW, y: dieTopY - 18 },
    { x: -baseW, y: dieTopY }, // Top left shoulder
  ]
}

export const STANDARD_PUNCHES: Punch[] = [
  // --- 1. Standard European Straight Punches ---
  {
    id: 'punch_straight_105_88',
    name: 'P.105.88 Straight Punch (88°, R0.8, H=105mm)',
    catalogCode: 'Rolleri P.105.88',
    type: 'straight',
    height: 105,
    angle: 88,
    tipRadius: 0.8,
    throatRelief: 0,
    throatHeight: 0,
    shankWidth: 13,
    maxTonnage: 1000,
  },
  {
    id: 'punch_straight_150_88',
    name: 'P.150.88 Tall Straight Punch (88°, R0.8, H=150mm)',
    catalogCode: 'Rolleri P.150.88',
    type: 'straight',
    height: 150,
    angle: 88,
    tipRadius: 0.8,
    throatRelief: 0,
    throatHeight: 0,
    shankWidth: 13,
    maxTonnage: 1000,
  },
  {
    id: 'punch_straight_150_60',
    name: 'P.150.60 Heavy Duty Punch (60°, R1.5, H=150mm)',
    catalogCode: 'Rolleri P.150.60',
    type: 'straight',
    height: 150,
    angle: 60,
    tipRadius: 1.5,
    throatRelief: 0,
    throatHeight: 0,
    shankWidth: 13,
    maxTonnage: 1200,
  },

  // --- 2. Standard European Gooseneck / Swan-Neck Punches ---
  {
    id: 'punch_gooseneck_130_88',
    name: 'P.130.88 Gooseneck Punch (88°, R0.8, 55mm Relief)',
    catalogCode: 'Rolleri P.130.88',
    type: 'gooseneck',
    height: 130,
    angle: 88,
    tipRadius: 0.8,
    throatRelief: 55,
    throatHeight: 55,
    shankWidth: 13,
    maxTonnage: 650,
  },
  {
    id: 'punch_gooseneck_175_88',
    name: 'P.175.88 Deep Swan Gooseneck (88°, R0.8, 80mm Relief)',
    catalogCode: 'Rolleri P.175.88',
    type: 'deep_gooseneck',
    height: 175,
    angle: 88,
    tipRadius: 0.8,
    throatRelief: 80,
    throatHeight: 70,
    shankWidth: 13,
    maxTonnage: 550,
  },
  {
    id: 'punch_gooseneck_120_88',
    name: 'P.120.88 Compact Gooseneck (88°, R0.8, 45mm Relief)',
    catalogCode: 'Promecam P.120.88',
    type: 'gooseneck',
    height: 120,
    angle: 88,
    tipRadius: 0.8,
    throatRelief: 45,
    throatHeight: 45,
    shankWidth: 13,
    maxTonnage: 700,
  },

  // --- 3. Acute & Sash Clearance Punches ---
  {
    id: 'punch_acute_105_30',
    name: 'P.105.30 Acute Punch (30°, R0.8, H=105mm)',
    catalogCode: 'Rolleri P.105.30',
    type: 'acute',
    height: 105,
    angle: 30,
    tipRadius: 0.8,
    throatRelief: 0,
    throatHeight: 0,
    shankWidth: 13,
    maxTonnage: 500,
  },
  {
    id: 'punch_sash_135_26',
    name: 'P.135.26 Acute Tall Sash Punch (26°, R1.0, H=135mm)',
    catalogCode: 'Rolleri P.135.26',
    type: 'sash',
    height: 135,
    angle: 26,
    tipRadius: 1.0,
    throatRelief: 18,
    throatHeight: 45,
    shankWidth: 13,
    maxTonnage: 500,
  },
  {
    id: 'punch_sash_105_86',
    name: 'P.105.86 Narrow Sash Sword Punch (86°, R0.8, H=105mm)',
    catalogCode: 'Promecam P.105.86',
    type: 'sash',
    height: 105,
    angle: 86,
    tipRadius: 0.8,
    throatRelief: 16,
    throatHeight: 40,
    shankWidth: 13,
    maxTonnage: 750,
  },

  // --- 4. Hemming / Dutch Folding Combination ---
  {
    id: 'punch_hemming_100',
    name: 'P.100.HEM Dutch Folding Combo Punch (30° / Flattening)',
    catalogCode: 'Rolleri P.100.HEM',
    type: 'hemming',
    height: 100,
    angle: 30,
    tipRadius: 0.8,
    throatRelief: 35,
    throatHeight: 50,
    shankWidth: 13,
    maxTonnage: 1000,
  },
]

export const STANDARD_DIES: Die[] = [
  // --- 1. European Standard 88°/85° Single V-Dies ---
  {
    id: 'die_v6_88',
    name: 'M.80.V6 Single V-Die (V=6mm, 88°, H=80mm)',
    catalogCode: 'Rolleri M.80.V6',
    type: 'single_v',
    height: 80,
    vOpening: 6,
    vAngle: 88,
    shoulderRadius: 0.8,
    baseWidth: 55,
    maxTonnage: 800,
  },
  {
    id: 'die_v8_88',
    name: 'M.80.V8 Single V-Die (V=8mm, 88°, H=80mm)',
    catalogCode: 'Rolleri M.80.V8',
    type: 'single_v',
    height: 80,
    vOpening: 8,
    vAngle: 88,
    shoulderRadius: 1.0,
    baseWidth: 55,
    maxTonnage: 800,
  },
  {
    id: 'die_v10_88',
    name: 'M.80.V10 Single V-Die (V=10mm, 88°, H=80mm)',
    catalogCode: 'Rolleri M.80.V10',
    type: 'single_v',
    height: 80,
    vOpening: 10,
    vAngle: 88,
    shoulderRadius: 1.2,
    baseWidth: 55,
    maxTonnage: 900,
  },
  {
    id: 'die_v12_88',
    name: 'M.80.V12 Single V-Die (V=12mm, 88°, H=80mm)',
    catalogCode: 'Rolleri M.80.V12',
    type: 'single_v',
    height: 80,
    vOpening: 12,
    vAngle: 88,
    shoulderRadius: 1.5,
    baseWidth: 55,
    maxTonnage: 900,
  },
  {
    id: 'die_v16_88',
    name: 'M.80.V16 Single V-Die (V=16mm, 88°, H=80mm)',
    catalogCode: 'Rolleri M.80.V16',
    type: 'single_v',
    height: 80,
    vOpening: 16,
    vAngle: 88,
    shoulderRadius: 2.0,
    baseWidth: 60,
    maxTonnage: 1000,
  },
  {
    id: 'die_v20_88',
    name: 'M.80.V20 Single V-Die (V=20mm, 88°, H=80mm)',
    catalogCode: 'Rolleri M.80.V20',
    type: 'single_v',
    height: 80,
    vOpening: 20,
    vAngle: 88,
    shoulderRadius: 2.5,
    baseWidth: 65,
    maxTonnage: 1100,
  },
  {
    id: 'die_v24_88',
    name: 'M.80.V24 Single V-Die (V=24mm, 88°, H=80mm)',
    catalogCode: 'Rolleri M.80.V24',
    type: 'single_v',
    height: 80,
    vOpening: 24,
    vAngle: 88,
    shoulderRadius: 3.0,
    baseWidth: 70,
    maxTonnage: 1200,
  },
  {
    id: 'die_v32_85',
    name: 'M.80.V32 Heavy V-Die (V=32mm, 85°, H=80mm)',
    catalogCode: 'Rolleri M.80.V32',
    type: 'single_v',
    height: 80,
    vOpening: 32,
    vAngle: 85,
    shoulderRadius: 3.5,
    baseWidth: 80,
    maxTonnage: 1300,
  },
  {
    id: 'die_v50_85',
    name: 'M.100.V50 Heavy V-Die (V=50mm, 85°, H=100mm)',
    catalogCode: 'Rolleri M.100.V50',
    type: 'single_v',
    height: 100,
    vOpening: 50,
    vAngle: 85,
    shoulderRadius: 5.0,
    baseWidth: 100,
    maxTonnage: 1500,
  },

  // --- 2. Acute 30° Single V-Dies ---
  {
    id: 'die_v8_30',
    name: 'M.80.V8-30 Acute V-Die (V=8mm, 30°, H=80mm)',
    catalogCode: 'Rolleri M.80.V8-30',
    type: 'acute_v',
    height: 80,
    vOpening: 8,
    vAngle: 30,
    shoulderRadius: 1.0,
    baseWidth: 60,
    maxTonnage: 600,
  },
  {
    id: 'die_v12_30',
    name: 'M.80.V12-30 Acute V-Die (V=12mm, 30°, H=80mm)',
    catalogCode: 'Rolleri M.80.V12-30',
    type: 'acute_v',
    height: 80,
    vOpening: 12,
    vAngle: 30,
    shoulderRadius: 1.5,
    baseWidth: 65,
    maxTonnage: 800,
  },
  {
    id: 'die_v16_30',
    name: 'M.80.V16-30 Acute V-Die (V=16mm, 30°, H=80mm)',
    catalogCode: 'Rolleri M.80.V16-30',
    type: 'acute_v',
    height: 80,
    vOpening: 16,
    vAngle: 30,
    shoulderRadius: 2.0,
    baseWidth: 70,
    maxTonnage: 900,
  },

  // --- 3. 4-Way Multi-V Block ---
  {
    id: 'die_multi_v_80',
    name: '4-Way Multi-V Die Block (V12/V16/V22/V30, 80x80mm)',
    catalogCode: 'European 4-Way Block',
    type: 'multi_v',
    height: 80,
    vOpening: 16, // Default active opening
    vAngle: 88,
    shoulderRadius: 2.0,
    baseWidth: 80,
    maxTonnage: 1000,
  },

  // --- 4. Hemming / Dutch Folding Die Table ---
  {
    id: 'die_hemming_80',
    name: 'Dutch Hemming Spring Flattening Die (V8-30° + Flat Bed)',
    catalogCode: 'Rolleri D-HEM.80',
    type: 'hemming',
    height: 80,
    vOpening: 8,
    vAngle: 30,
    shoulderRadius: 1.0,
    baseWidth: 90,
    maxTonnage: 1000,
  },
]

export const DEFAULT_MACHINE_ENVELOPE: MachineEnvelope = {
  name: 'DELEM DA-53T Synchronized CNC Press Brake (100T x 2500mm)',
  controller: 'DELEM DA-53T',
  maxTonnageTonnes: 100,
  maxBendingLength: 2500,
  daylight: 420,
  stroke: 200,
  throatDepth: 350,
  ramWidth: 160,
  bedWidth: 160,
  clampHolderHeight: 120, // European Quick-Clamp Intermediate Adapter
  clampHolderWidth: 100,
  dieRailHeight: 55,      // Lower Die Rail Table Adapter
  dieRailWidth: 95,
  tableHeightFromFloor: 880,
  step1Drop: 15,          // 3-step backgauge finger step 1
  step2Drop: 40,          // 3-step backgauge finger step 2
  backgaugeXMin: 10,
  backgaugeXMax: 650,
  backgaugeRMin: 0,
  backgaugeRMax: 180,
}
