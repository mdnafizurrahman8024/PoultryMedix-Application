import { useMemo, useState } from 'react'
import { Compass, Info, Layers, Sparkles, Wind } from 'lucide-react'
import {
  FARM_TYPES,
  FLOCK_SIZE_PRESETS,
  calculateShedDesign,
} from '../lib/farmBlueprintData.js'

function isoPoint(x, y, z = 0) {
  // Isometric 30-degree projection centered inside 560x320 viewport
  const cx = 278
  const cy = 228
  const sx = (x - y) * 0.866
  const sy = (x + y) * 0.44 - z
  return [Number((cx + sx).toFixed(1)), Number((cy + sy).toFixed(1))]
}

function pts(coords) {
  return coords.map(([x, y]) => `${x},${y}`).join(' ')
}

function FloorPlan2D({ design, isBn }) {
  const isEc = design.activeType === 'ec'

  // Scaled shed box inside SVG: preserve aspect ratio cleanly within max 440x155 box
  const maxBoxW = 430
  const maxBoxH = 152
  const aspect = design.widthFt / Math.max(design.lengthFt, 1)
  const drawW = maxBoxW
  const drawH = Math.min(maxBoxH, Math.max(88, Math.round(drawW * aspect * 1.45)))
  const startX = 104
  const startY = Math.round((300 - drawH) / 2) + 8

  const vestibuleW = 38
  const interiorX = startX + vestibuleW
  const interiorW = drawW - vestibuleW - 8

  // Visual sample counts for crisp blueprint layout (proportional, never cluttered)
  const visibleBrooders = Math.min(4, Math.max(1, Math.min(design.brooderGuardsCount, 4)))
  const visibleCols = Math.min(8, Math.max(3, Math.ceil(design.feedersCount / 6)))

  return (
    <figure className="blueprint-svg-card dark:bg-gray-900 dark:border-gray-700">
      <figcaption className="blueprint-svg-caption dark:text-gray-200">
        <span>{isBn ? '২ডি আর্কিটেকচারাল ফ্লোর প্ল্যান (পূর্ব–পশ্চিম অক্ষ)' : '2D Architectural Floor Plan (East–West Axis)'}</span>
        <strong>
          {design.lengthFt} × {design.widthFt} × {design.wallHeightFt}/{design.ridgeHeightFt} ft ({design.totalAreaSqFt.toLocaleString()} sq ft)
        </strong>
      </figcaption>

      <svg
        viewBox="0 0 640 330"
        className="blueprint-svg-canvas"
        role="img"
        aria-label={
          isBn
            ? `দৈর্ঘ্য ${design.lengthFt} ফু, প্রস্থ ${design.widthFt} ফু ও উচ্চতা ${design.wallHeightFt}-${design.ridgeHeightFt} ফুটের ২ডি শেড ফ্লোর প্ল্যান`
            : `2D poultry shed floor plan, ${design.lengthFt} ft L by ${design.widthFt} ft W, wall height ${design.wallHeightFt} ft and ridge ${design.ridgeHeightFt} ft`
        }
      >
        {/* Background blueprint grid */}
        <defs>
          <pattern id="bp-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeOpacity="0.06" strokeWidth="1" />
          </pattern>
          <marker id="air-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M 0 0 L 6 3 L 0 6 z" fill="#0284c7" />
          </marker>
        </defs>
        <rect x="0" y="0" width="640" height="330" rx="10" fill="url(#bp-grid)" />

        {/* East-West Sun-Safe Orientation Compass */}
        <g transform="translate(566, 48)">
          <circle cx="0" cy="0" r="24" fill="none" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="3 2" />
          <path d="M 0 -19 L 4 -5 L 0 -8 L -4 -5 Z" fill="#dc2626" />
          <path d="M 0 19 L 4 5 L 0 8 L -4 5 Z" fill="#64748b" />
          <path d="M -20 0 L 20 0" stroke="#0f766e" strokeWidth="1.5" />
          <text x="0" y="-27" textAnchor="middle" fontSize="10" fontWeight="800" fill="#dc2626">N</text>
          <text x="0" y="34" textAnchor="middle" fontSize="9" fontWeight="700" fill="#64748b">S</text>
          <text x="-29" y="3" textAnchor="middle" fontSize="10" fontWeight="800" fill="#0f766e">W</text>
          <text x="29" y="3" textAnchor="middle" fontSize="10" fontWeight="800" fill="#0f766e">E</text>
        </g>

        {/* Sun arc note */}
        <text x="320" y="24" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#64748b">
          {isBn
            ? 'পূর্ব ↔ পশ্চিম লম্বা অক্ষ (সরাসরি রোদ এড়াতে উত্তর–দক্ষিণে জালি)'
            : 'East ↔ West Long Axis (Blocks Direct Morning/Afternoon Sun Inside Shed)'}
        </text>

        {/* Top Length Dimension Line */}
        <g>
          <line x1={startX} y1={startY - 16} x2={startX + drawW} y2={startY - 16} stroke="#15803d" strokeWidth="1.5" />
          <line x1={startX} y1={startY - 22} x2={startX} y2={startY - 10} stroke="#15803d" strokeWidth="1.5" />
          <line x1={startX + drawW} y1={startY - 22} x2={startX + drawW} y2={startY - 10} stroke="#15803d" strokeWidth="1.5" />
          <rect x={startX + drawW / 2 - 78} y={startY - 26} width="156" height="18" rx="4" fill="#f0fdf4" stroke="#86efac" />
          <text x={startX + drawW / 2} y={startY - 14} textAnchor="middle" fontSize="10" fontWeight="800" fill="#166534">
            {isBn ? `দৈর্ঘ্য: ${design.lengthFt} ফু (${design.lengthM} মি)` : `L: ${design.lengthFt} ft (${design.lengthM} m)`}
          </text>
        </g>

        {/* Left Width Dimension Line */}
        <g>
          <line x1={startX - 18} y1={startY} x2={startX - 18} y2={startY + drawH} stroke="#15803d" strokeWidth="1.5" />
          <line x1={startX - 24} y1={startY} x2={startX - 12} y2={startY} stroke="#15803d" strokeWidth="1.5" />
          <line x1={startX - 24} y1={startY + drawH} x2={startX - 12} y2={startY + drawH} stroke="#15803d" strokeWidth="1.5" />
          <rect x="10" y={startY + drawH / 2 - 14} width="74" height="28" rx="4" fill="#f0fdf4" stroke="#86efac" />
          <text x="47" y={startY + drawH / 2 - 2} textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#166534">
            {isBn ? `প্রস্থ: ${design.widthFt} ফু` : `W: ${design.widthFt} ft`}
          </text>
          <text x="47" y={startY + drawH / 2 + 10} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#15803d">
            ({design.widthM} m)
          </text>
        </g>

        {/* Outer Roof Overhang shadow */}
        {!isEc && (
          <rect
            x={startX - 5}
            y={startY - 7}
            width={drawW + 10}
            height={drawH + 14}
            rx="6"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        )}

        {/* Main Shed Slab */}
        <rect
          x={startX}
          y={startY}
          width={drawW}
          height={drawH}
          rx="4"
          fill={isEc ? '#f8fafc' : '#fcfdf9'}
          stroke={isEc ? '#1e293b' : '#334155'}
          strokeWidth="2.5"
        />

        {/* Open-sided wire-mesh wall highlight on North/South walls */}
        {!isEc && (
          <>
            <line x1={startX + vestibuleW} y1={startY} x2={startX + drawW - 6} y2={startY} stroke="#16a34a" strokeWidth="3.5" strokeDasharray="7 3" />
            <line x1={startX + vestibuleW} y1={startY + drawH} x2={startX + drawW - 6} y2={startY + drawH} stroke="#16a34a" strokeWidth="3.5" strokeDasharray="7 3" />
          </>
        )}

        {/* West Entry Biosecurity Footbath & Feed Store Vestibule */}
        <rect x={startX} y={startY} width={vestibuleW} height={drawH} fill="#fef3c7" stroke="#d97706" strokeWidth="1.2" />
        <rect x={startX + 4} y={startY + drawH / 2 - 14} width="28" height="28" rx="3" fill="#bbf7d0" stroke="#15803d" strokeWidth="1" />
        <text
          x={startX + 19}
          y={startY + drawH / 2 + 3}
          textAnchor="middle"
          fontSize="7.5"
          fontWeight="800"
          fill="#14532d"
        >
          DIP
        </text>
        <text
          x={startX + 19}
          y={startY + 14}
          textAnchor="middle"
          fontSize="7.5"
          fontWeight="700"
          fill="#92400e"
        >
          {isBn ? 'স্টোর' : 'FEED'}
        </text>

        {/* EC Mode: Evaporative Cooling Pads (West) & Exhaust Tunnel Fans (East) */}
        {isEc && (
          <>
            <rect x={startX + vestibuleW - 3} y={startY + 10} width="8" height={drawH - 20} rx="2" fill="#06b6d4" stroke="#0e7490" strokeWidth="1" />
            <rect x={startX + drawW - 8} y={startY + 12} width="8" height={drawH - 24} rx="2" fill="#334155" />
            <text x={startX + drawW + 10} y={startY + drawH / 2 - 4} fontSize="8.5" fontWeight="800" fill="#1e293b">
              {design.exhaustFansCount}× Fans
            </text>
          </>
        )}

        {/* Brooder Guard Rings (dashed orange rings in clean brooding zone) */}
        {Array.from({ length: visibleBrooders }).map((_, idx) => {
          const rx = interiorX + (interiorW / (visibleBrooders + 1)) * (idx + 1)
          const ry = startY + drawH / 2
          const r = Math.min(26, drawH * 0.24)
          return (
            <circle
              key={`bg-${idx}`}
              cx={rx}
              cy={ry}
              r={r}
              fill="rgba(251, 146, 60, 0.08)"
              stroke="#ea580c"
              strokeWidth="1.4"
              strokeDasharray="4 3"
            />
          )
        })}

        {/* Feeder & Drinker Rows */}
        {Array.from({ length: visibleCols }).map((_, cIdx) => {
          const x = interiorX + 18 + (cIdx * (interiorW - 34)) / Math.max(visibleCols - 1, 1)
          const topY = startY + drawH * 0.24
          const midY = startY + drawH * 0.5
          const botY = startY + drawH * 0.76
          return (
            <g key={`col-${cIdx}`}>
              <circle cx={x} cy={topY} r="5" fill="#f59e0b" stroke="#b45309" strokeWidth="1" />
              <circle cx={x} cy={midY} r="4.5" fill="#38bdf8" stroke="#0369a1" strokeWidth="1" />
              <circle cx={x} cy={botY} r="5" fill="#f59e0b" stroke="#b45309" strokeWidth="1" />
            </g>
          )
        })}

        {/* Animated Airflow Vectors */}
        {isEc ? (
          // Longitudinal tunnel ventilation (West Cooling Pad -> East Exhaust Fans)
          <>
            {[0.28, 0.5, 0.72].map((ratio, idx) => {
              const ay = startY + drawH * ratio
              return (
                <line
                  key={`ec-air-${idx}`}
                  x1={interiorX + 6}
                  y1={ay}
                  x2={startX + drawW - 14}
                  y2={ay}
                  stroke="#0284c7"
                  strokeWidth="2"
                  className="blueprint-airflow-line"
                  markerEnd="url(#air-arrow)"
                />
              )
            })}
          </>
        ) : (
          // Natural North <-> South cross-ventilation
          <>
            {[0.25, 0.5, 0.75].map((ratio, idx) => {
              const ax = interiorX + interiorW * ratio
              return (
                <line
                  key={`open-air-${idx}`}
                  x1={ax}
                  y1={startY - 22}
                  x2={ax}
                  y2={startY + drawH + 22}
                  stroke="#0284c7"
                  strokeWidth="1.8"
                  className="blueprint-airflow-line"
                  markerEnd="url(#air-arrow)"
                />
              )
            })}
          </>
        )}

        {/* Elevation / Height Callout Strip inside 2D Blueprint */}
        <g transform={`translate(${startX + drawW / 2 - 128}, 264)`}>
          <rect x="0" y="0" width="256" height="20" rx="5" fill="#ecfdf5" stroke="#6ee7b7" />
          <text x="128" y="13.5" textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#065f46">
            {isBn
              ? `উচ্চতা: পাশ ${design.wallHeightFt} ফু · মাঝের চূড়া ${design.ridgeHeightFt} ফু`
              : `Height (Elevation): Side ${design.wallHeightFt} ft · Center Ridge ${design.ridgeHeightFt} ft`}
          </text>
        </g>

        {/* Bottom Legend Strip inside SVG */}
        <g transform="translate(96, 306)">
          <circle cx="8" cy="0" r="5" fill="#f59e0b" stroke="#b45309" strokeWidth="1" />
          <text x="18" y="3" fontSize="9.5" fontWeight="700" fill="#475569">
            {isBn ? `ফিডার: ${design.feedersCount}টি` : `Feeders: ${design.feedersCount}`}
          </text>

          <circle cx="116" cy="0" r="4.5" fill="#38bdf8" stroke="#0369a1" strokeWidth="1" />
          <text x="125" y="3" fontSize="9.5" fontWeight="700" fill="#475569">
            {isBn ? `ড্রিংকার: ${design.drinkersCount}টি` : `Drinkers: ${design.drinkersCount}`}
          </text>

          <circle cx="228" cy="0" r="6" fill="none" stroke="#ea580c" strokeWidth="1.5" strokeDasharray="3 2" />
          <text x="239" y="3" fontSize="9.5" fontWeight="700" fill="#475569">
            {isBn ? `চিক-গার্ড: ${design.brooderGuardsCount}টি` : `Brooder Rings: ${design.brooderGuardsCount}`}
          </text>

          <line x1="348" y1="0" x2="368" y2="0" stroke="#0284c7" strokeWidth="2" markerEnd="url(#air-arrow)" />
          <text x="374" y="3" fontSize="9.5" fontWeight="700" fill="#0369a1">
            {isEc
              ? (isBn ? 'টানেল বায়ুপ্রবাহ' : 'Tunnel Airflow')
              : (isBn ? 'উত্তর–দক্ষিণ বাতাস' : 'Cross Ventilation')}
          </text>
        </g>
      </svg>
    </figure>
  )
}

function ShedIsometric3D({ design, isBn }) {
  const isEc = design.activeType === 'ec'

  // Isometric shed box dimensions scaled cleanly for crisp proportion
  const L = Math.min(200, Math.max(125, Math.round(design.lengthFt * 1.45)))
  const W = isEc ? 94 : 80
  const plinthH = 8
  const wallH = isEc ? 42 : 46
  const ridgeExtra = isEc ? 22 : 28

  const baseZ = plinthH
  const eaveZ = baseZ + wallH
  const ridgeZ = eaveZ + ridgeExtra

  // Four ground corners (x along East-West Length, y along North-South Width)
  const x0 = -L / 2
  const x1 = L / 2
  const y0 = -W / 2
  const y1 = W / 2
  const yMid = 0

  const overhang = isEc ? 4 : 9

  // Architectural L / W / H CAD dimension anchor points
  const wallB = isoPoint(x0 - 14, y1 + 2, baseZ)
  const wallT = isoPoint(x0 - 14, y1 + 2, eaveZ)
  const wallFloorCorner = isoPoint(x0, y1, baseZ)
  const wallEaveCorner = isoPoint(x0, y1, eaveZ)

  const ridgeB = isoPoint(x1 + 26, yMid - 28, baseZ)
  const ridgeT = isoPoint(x1 + 26, yMid - 28, ridgeZ)
  const ridgeFloorAnchor = isoPoint(x1, yMid, baseZ)
  const ridgePeakAnchor = isoPoint(x1, yMid, ridgeZ)

  const lenA = isoPoint(x0, y1 + 20, 0)
  const lenB = isoPoint(x1, y1 + 20, 0)
  const lenMidX = (lenA[0] + lenB[0]) / 2
  const lenMidY = (lenA[1] + lenB[1]) / 2

  const widA = isoPoint(x1 + 20, y0, 0)
  const widB = isoPoint(x1 + 20, y1, 0)
  const widMidX = (widA[0] + widB[0]) / 2
  const widMidY = (widA[1] + widB[1]) / 2

  return (
    <figure className="blueprint-svg-card dark:bg-gray-900 dark:border-gray-700">
      <figcaption className="blueprint-svg-caption dark:text-gray-200">
        <span>{isBn ? '৩ডি আইসোমেট্রিক শেড মডেল (দৈর্ঘ্য × প্রস্থ × উচ্চতা)' : '3D Isometric Shed Model (L × W × H Cutaway)'}</span>
        <strong>
          {design.lengthFt} × {design.widthFt} × {design.wallHeightFt}/{design.ridgeHeightFt} ft ·{' '}
          {isEc
            ? (isBn ? 'ইসি / টানেল' : 'EC / Tunnel')
            : (isBn ? 'খোলামেলা' : 'Open-Sided')}
        </strong>
      </figcaption>

      <svg
        viewBox="0 0 560 320"
        className="blueprint-svg-canvas"
        role="img"
        aria-label={
          isBn
            ? `দৈর্ঘ্য ${design.lengthFt} ফু, প্রস্থ ${design.widthFt} ফু ও উচ্চতা ${design.wallHeightFt}-${design.ridgeHeightFt} ফুটের ৩ডি শেড চিত্র`
            : `3D isometric poultry shed, ${design.lengthFt} ft long, ${design.widthFt} ft wide, ${design.wallHeightFt} to ${design.ridgeHeightFt} ft high`
        }
      >
        <defs>
          <marker id="air-arrow-3d" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M 0 0 L 6 3 L 0 6 z" fill="#0284c7" />
          </marker>
        </defs>

        {/* Ground Pad & Raised Plinth Curb (1.5-2 ft flood safety) */}
        <polygon
          points={pts([
            isoPoint(x0 - 12, y0 - 12, 0),
            isoPoint(x1 + 12, y0 - 12, 0),
            isoPoint(x1 + 12, y1 + 12, 0),
            isoPoint(x0 - 12, y1 + 12, 0),
          ])}
          fill="#e2e8f0"
          fillOpacity="0.45"
        />

        {/* Floor slab top */}
        <polygon
          points={pts([
            isoPoint(x0, y0, baseZ),
            isoPoint(x1, y0, baseZ),
            isoPoint(x1, y1, baseZ),
            isoPoint(x0, y1, baseZ),
          ])}
          fill="#f1f5f9"
          stroke="#64748b"
          strokeWidth="1.2"
        />

        {/* Front Plinth faces */}
        <polygon
          points={pts([isoPoint(x0, y1, 0), isoPoint(x1, y1, 0), isoPoint(x1, y1, baseZ), isoPoint(x0, y1, baseZ)])}
          fill="#94a3b8"
        />
        <polygon
          points={pts([isoPoint(x1, y0, 0), isoPoint(x1, y1, 0), isoPoint(x1, y1, baseZ), isoPoint(x1, y0, baseZ)])}
          fill="#64748b"
        />

        {/* Back Walls (North wall & West gable wall) */}
        <polygon
          points={pts([isoPoint(x0, y0, baseZ), isoPoint(x1, y0, baseZ), isoPoint(x1, y0, eaveZ), isoPoint(x0, y0, eaveZ)])}
          fill={isEc ? '#cbd5e1' : 'rgba(203, 213, 225, 0.35)'}
          stroke="#64748b"
          strokeWidth="1"
        />
        {/* West Gable wall */}
        <polygon
          points={pts([
            isoPoint(x0, y0, baseZ),
            isoPoint(x0, y1, baseZ),
            isoPoint(x0, y1, eaveZ),
            isoPoint(x0, yMid, ridgeZ),
            isoPoint(x0, y0, eaveZ),
          ])}
          fill={isEc ? '#0ea5e9' : '#e2e8f0'}
          fillOpacity={isEc ? '0.28' : '0.85'}
          stroke="#475569"
          strokeWidth="1.3"
        />

        {/* Interior Brooder Rings & Feeder/Drinker Rows on Slab */}
        {[-L * 0.25, 0, L * 0.25].map((bx, i) => {
          const [cx, cy] = isoPoint(bx, 0, baseZ + 1)
          return (
            <ellipse
              key={`iso-ring-${i}`}
              cx={cx}
              cy={cy}
              rx="18"
              ry="9"
              fill="rgba(251, 146, 60, 0.16)"
              stroke="#ea580c"
              strokeWidth="1.2"
              strokeDasharray="3 2"
            />
          )
        })}

        {[-L * 0.32, -L * 0.12, L * 0.12, L * 0.32].map((fx, i) => {
          const [fx1, fy1] = isoPoint(fx, -W * 0.24, baseZ + 4)
          const [dx1, dy1] = isoPoint(fx, 0, baseZ + 4)
          const [fx2, fy2] = isoPoint(fx, W * 0.24, baseZ + 4)
          return (
            <g key={`iso-equip-${i}`}>
              <circle cx={fx1} cy={fy1} r="3.4" fill="#f59e0b" stroke="#b45309" strokeWidth="0.9" />
              <circle cx={dx1} cy={dy1} r="3.1" fill="#38bdf8" stroke="#0369a1" strokeWidth="0.9" />
              <circle cx={fx2} cy={fy2} r="3.4" fill="#f59e0b" stroke="#b45309" strokeWidth="0.9" />
            </g>
          )
        })}

        {/* Open-Sided Front Dwarf Brick Wall + Wire Mesh vs EC Insulated Front Wall */}
        {isEc ? (
          <polygon
            points={pts([isoPoint(x0, y1, baseZ), isoPoint(x1, y1, baseZ), isoPoint(x1, y1, eaveZ), isoPoint(x0, y1, eaveZ)])}
            fill="rgba(226, 232, 240, 0.55)"
            stroke="#334155"
            strokeWidth="1.3"
          />
        ) : (
          <>
            {/* 3ft Brick Dwarf Wall */}
            <polygon
              points={pts([
                isoPoint(x0, y1, baseZ),
                isoPoint(x1, y1, baseZ),
                isoPoint(x1, y1, baseZ + 14),
                isoPoint(x0, y1, baseZ + 14),
              ])}
              fill="#d97706"
              fillOpacity="0.65"
              stroke="#92400e"
              strokeWidth="1.1"
            />
            {/* Wire Mesh Zone */}
            <polygon
              points={pts([
                isoPoint(x0, y1, baseZ + 14),
                isoPoint(x1, y1, baseZ + 14),
                isoPoint(x1, y1, eaveZ),
                isoPoint(x0, y1, eaveZ),
              ])}
              fill="rgba(22, 163, 74, 0.08)"
              stroke="#15803d"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          </>
        )}

        {/* East Front Gable Wall (with Tunnel Fans in EC Mode) */}
        <polygon
          points={pts([
            isoPoint(x1, y0, baseZ),
            isoPoint(x1, y1, baseZ),
            isoPoint(x1, y1, eaveZ),
            isoPoint(x1, yMid, ridgeZ),
            isoPoint(x1, y0, eaveZ),
          ])}
          fill={isEc ? '#cbd5e1' : '#f1f5f9'}
          fillOpacity="0.72"
          stroke="#475569"
          strokeWidth="1.3"
        />

        {isEc && (
          <>
            {[-20, 4, 28].filter((_, idx) => idx < Math.min(3, design.exhaustFansCount)).map((fy, idx) => {
              const [cx, cy] = isoPoint(x1 + 1, fy - 5, baseZ + 22)
              return (
                <circle key={`fan-${idx}`} cx={cx} cy={cy} r="7.5" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.3" />
              )
            })}
          </>
        )}

        {/* Back Roof Slope (Solid) */}
        <polygon
          points={pts([
            isoPoint(x0 - overhang, y0 - overhang, eaveZ - 2),
            isoPoint(x1 + overhang, y0 - overhang, eaveZ - 2),
            isoPoint(x1 + overhang, yMid, ridgeZ),
            isoPoint(x0 - overhang, yMid, ridgeZ),
          ])}
          fill={isEc ? '#334155' : '#166534'}
          fillOpacity="0.82"
          stroke="#0f172a"
          strokeWidth="1.2"
        />

        {/* Front Roof Slope (Cutaway Semi-Transparent so inside stays visible) */}
        <polygon
          points={pts([
            isoPoint(x0 - overhang, yMid, ridgeZ),
            isoPoint(x1 + overhang, yMid, ridgeZ),
            isoPoint(x1 + overhang, y1 + overhang, eaveZ - 2),
            isoPoint(x0 - overhang, y1 + overhang, eaveZ - 2),
          ])}
          fill={isEc ? 'rgba(51, 65, 85, 0.25)' : 'rgba(22, 101, 52, 0.22)'}
          stroke={isEc ? '#334155' : '#15803d'}
          strokeWidth="1.2"
          strokeDasharray="4 3"
        />

        {/* Animated 3D Airflow Streamlines */}
        {isEc ? (
          <>
            {[-12, 12].map((ay, idx) => {
              const [sx, sy] = isoPoint(x0 + 8, ay, baseZ + 24)
              const [ex, ey] = isoPoint(x1 - 8, ay, baseZ + 24)
              return (
                <line
                  key={`air3d-ec-${idx}`}
                  x1={sx}
                  y1={sy}
                  x2={ex}
                  y2={ey}
                  stroke="#0284c7"
                  strokeWidth="2.2"
                  className="blueprint-airflow-line"
                  markerEnd="url(#air-arrow-3d)"
                />
              )
            })}
          </>
        ) : (
          <>
            {[-L * 0.28, 0, L * 0.28].map((ax, idx) => {
              const [sx, sy] = isoPoint(ax, y0 - 24, baseZ + 28)
              const [ex, ey] = isoPoint(ax, y1 + 26, baseZ + 26)
              return (
                <line
                  key={`air3d-open-${idx}`}
                  x1={sx}
                  y1={sy}
                  x2={ex}
                  y2={ey}
                  stroke="#0284c7"
                  strokeWidth="2"
                  className="blueprint-airflow-line"
                  markerEnd="url(#air-arrow-3d)"
                />
              )
            })}
          </>
        )}

        {/* 3D Architectural Dimension Lines: Length, Width, Side Wall Height & Ridge Height */}
        <g>
          {/* Side Wall Height (Front-Left Vertical) */}
          <line x1={wallFloorCorner[0]} y1={wallFloorCorner[1]} x2={wallB[0]} y2={wallB[1]} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 2" />
          <line x1={wallEaveCorner[0]} y1={wallEaveCorner[1]} x2={wallT[0]} y2={wallT[1]} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 2" />
          <line x1={wallB[0]} y1={wallB[1]} x2={wallT[0]} y2={wallT[1]} stroke="#0f766e" strokeWidth="1.6" />
          <line x1={wallB[0] - 4} y1={wallB[1]} x2={wallB[0] + 4} y2={wallB[1]} stroke="#0f766e" strokeWidth="1.6" />
          <line x1={wallT[0] - 4} y1={wallT[1]} x2={wallT[0] + 4} y2={wallT[1]} stroke="#0f766e" strokeWidth="1.6" />
          <rect x={Math.max(8, wallB[0] - 90)} y={(wallB[1] + wallT[1]) / 2 - 11} width="84" height="20" rx="4" fill="#ecfdf5" stroke="#6ee7b7" />
          <text x={Math.max(50, wallB[0] - 48)} y={(wallB[1] + wallT[1]) / 2 + 2.5} textAnchor="middle" fontSize="9" fontWeight="800" fill="#065f46">
            {isBn ? `পাশ: ${design.wallHeightFt} ফু` : `Wall H: ${design.wallHeightFt} ft`}
          </text>

          {/* Center Ridge Height (East Peak Vertical) */}
          <line x1={ridgeFloorAnchor[0]} y1={ridgeFloorAnchor[1]} x2={ridgeB[0]} y2={ridgeB[1]} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 2" />
          <line x1={ridgePeakAnchor[0]} y1={ridgePeakAnchor[1]} x2={ridgeT[0]} y2={ridgeT[1]} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 2" />
          <line x1={ridgeB[0]} y1={ridgeB[1]} x2={ridgeT[0]} y2={ridgeT[1]} stroke="#0f766e" strokeWidth="1.6" />
          <line x1={ridgeB[0] - 4} y1={ridgeB[1]} x2={ridgeB[0] + 4} y2={ridgeB[1]} stroke="#0f766e" strokeWidth="1.6" />
          <line x1={ridgeT[0] - 4} y1={ridgeT[1]} x2={ridgeT[0] + 4} y2={ridgeT[1]} stroke="#0f766e" strokeWidth="1.6" />
          <rect x={Math.min(454, ridgeB[0] + 8)} y={(ridgeB[1] + ridgeT[1]) / 2 - 10} width="98" height="20" rx="4" fill="#ecfdf5" stroke="#6ee7b7" />
          <text x={Math.min(503, ridgeB[0] + 57)} y={(ridgeB[1] + ridgeT[1]) / 2 + 3.5} textAnchor="middle" fontSize="9" fontWeight="800" fill="#065f46">
            {isBn ? `চূড়া: ${design.ridgeHeightFt} ফু` : `Ridge H: ${design.ridgeHeightFt} ft`}
          </text>

          {/* Length Dimension (South Front Edge) */}
          <line x1={lenA[0]} y1={lenA[1]} x2={lenB[0]} y2={lenB[1]} stroke="#15803d" strokeWidth="1.6" />
          <rect x={lenMidX - 54} y={Math.min(296, lenMidY + 8)} width="108" height="19" rx="4" fill="#f0fdf4" stroke="#86efac" />
          <text x={lenMidX} y={Math.min(309, lenMidY + 20.5)} textAnchor="middle" fontSize="9" fontWeight="800" fill="#166534">
            {isBn ? `দৈর্ঘ্য: ${design.lengthFt} ফু` : `Length: ${design.lengthFt} ft`}
          </text>

          {/* Width Dimension (East End Edge) */}
          <line x1={widA[0]} y1={widA[1]} x2={widB[0]} y2={widB[1]} stroke="#15803d" strokeWidth="1.6" />
          <rect x={Math.min(460, widMidX + 10)} y={widMidY - 8} width="86" height="19" rx="4" fill="#f0fdf4" stroke="#86efac" />
          <text x={Math.min(503, widMidX + 53)} y={widMidY + 4.5} textAnchor="middle" fontSize="9" fontWeight="800" fill="#166534">
            {isBn ? `প্রস্থ: ${design.widthFt} ফু` : `Width: ${design.widthFt} ft`}
          </text>
        </g>

        {/* Key Callout Badges inside SVG */}
        <g transform="translate(16, 20)">
          <rect x="0" y="0" width="174" height="22" rx="6" fill="#f0fdf4" stroke="#86efac" />
          <text x="10" y="14.5" fontSize="9.5" fontWeight="800" fill="#166534">
            {isBn
              ? `উচ্চতা: পাশ ${design.wallHeightFt} ফু / চূড়া ${design.ridgeHeightFt} ফু`
              : `Height: Wall ${design.wallHeightFt}ft · Ridge ${design.ridgeHeightFt}ft`}
          </text>
        </g>

        <g transform="translate(358, 20)">
          <rect x="0" y="0" width="186" height="22" rx="6" fill="#eff6ff" stroke="#bfdbfe" />
          <text x="10" y="14.5" fontSize="9.5" fontWeight="700" fill="#1e40af">
            {isEc
              ? (isBn ? `কুলিং প্যাড (${design.coolingPadSqFt} ব.ফু) + ${design.exhaustFansCount} ফ্যান` : `Cooling Pad (${design.coolingPadSqFt} sq ft) + ${design.exhaustFansCount} Fans`)
              : (isBn ? `৩ ফুট ইটের গাঁথুনি + ${design.overhangFt} ফু কার্নিশ` : `3ft Brick Wall + Net + ${design.overhangFt}ft Overhang`)}
          </text>
        </g>
      </svg>
    </figure>
  )
}

export default function ShedBlueprintVisualizer({
  flockSize,
  onFlockSizeChange,
  farmType,
  onFarmTypeChange,
  isBn,
}) {
  const [shedMode, setShedMode] = useState('auto')
  const [viewMode, setViewMode] = useState('both') // 'both' | '2d' | '3d'
  const [customFlockDraft, setCustomFlockDraft] = useState(() => String(flockSize))

  function applyFlockSize(nextValue) {
    const clamped = Math.max(10, Math.min(100000, Math.round(Number(nextValue)) || 1000))
    setCustomFlockDraft(String(clamped))
    onFlockSizeChange(clamped)
  }

  function handleCustomFlockChange(rawValue) {
    const digits = String(rawValue).replace(/\D/g, '').slice(0, 6)
    setCustomFlockDraft(digits)
    if (!digits) return
    const parsed = Number.parseInt(digits, 10)
    if (Number.isFinite(parsed) && parsed >= 10) {
      onFlockSizeChange(Math.min(100000, parsed))
    }
  }

  function handleCustomFlockBlur() {
    const parsed = Number.parseInt(customFlockDraft, 10)
    if (!Number.isFinite(parsed) || parsed < 10) {
      applyFlockSize(10)
    } else {
      applyFlockSize(parsed)
    }
  }

  const design = useMemo(
    () => calculateShedDesign({ flockSize, farmType, shedMode }),
    [flockSize, farmType, shedMode]
  )

  const openComparison = useMemo(
    () => calculateShedDesign({ flockSize, farmType, shedMode: 'open' }),
    [flockSize, farmType]
  )
  const ecComparison = useMemo(
    () => calculateShedDesign({ flockSize, farmType, shedMode: 'ec' }),
    [flockSize, farmType]
  )

  const isRecommendedEc = design.recommendedType === 'ec'

  return (
    <section className="blueprint-card dark:bg-gray-800 dark:border-gray-700" aria-labelledby="shed-blueprint-heading">
      <div className="blueprint-section-head">
        <div>
          <span className="veterinary-kicker">
            {isBn ? '১ · ২ডি ফ্লোর প্ল্যান ও ৩ডি আইসোমেট্রিক শেড' : '1 · INTERACTIVE 2D & 3D SHED ARCHITECT'}
          </span>
          <h2 id="shed-blueprint-heading">
            {isBn ? 'আধুনিক পোল্ট্রি শেড নকশা ও সরঞ্জামের হিসাব' : '2D Architectural Floor Plan & 3D Shed Visualizer'}
          </h2>
          <p>
            {isBn
              ? 'পাখির সংখ্যা ও জাত নির্বাচন করলে বাংলাদেশ DLS ও Cobb/Aviagen স্ট্যান্ডার্ড অনুযায়ী মাপ, বায়ুপ্রবাহ ও সরঞ্জাম স্বয়ংক্রিয়ভাবে হিসাব হবে।'
              : 'Select flock size and species for exact dimensions, East–West orientation, airflow dynamics, and Cobb/Aviagen/DLS equipment counts.'}
          </p>
        </div>

        <div className="blueprint-view-pills" role="group" aria-label={isBn ? 'ভিউ পরিবর্তন' : 'Visualizer layout'}>
          {[
            ['both', isBn ? '২ডি + ৩ডি' : '2D + 3D'],
            ['2d', '2D'],
            ['3d', '3D'],
          ].map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={viewMode === mode ? 'is-active' : undefined}
              onClick={() => setViewMode(mode)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Controls: Target Flock Size + Farm Type */}
      <div className="blueprint-controls-grid">
        <div>
          <label className="blueprint-control-label" htmlFor="custom-flock-size-input">
            {isBn ? 'লক্ষ্যমাত্রা পাখির সংখ্যা — কাস্টম লিখুন বা বাছুন (Flock Size)' : 'Target Flock Size — Enter Custom Count or Select Preset'}
          </label>
          <div className="blueprint-custom-flock-row">
            <button
              type="button"
              className="blueprint-step-btn dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200"
              aria-label={isBn ? '১০০ পাখি কমান' : 'Decrease flock size by 100'}
              onClick={() => applyFlockSize(Math.max(10, (Number(flockSize) || 1000) - 100))}
            >
              -100
            </button>
            <div className="blueprint-custom-input-wrap dark:bg-gray-900 dark:border-gray-700">
              <input
                id="custom-flock-size-input"
                type="text"
                inputMode="numeric"
                className="blueprint-custom-flock-input dark:text-white"
                value={customFlockDraft}
                onChange={(e) => handleCustomFlockChange(e.target.value)}
                onBlur={handleCustomFlockBlur}
                placeholder="1000"
                aria-label={isBn ? 'কাস্টম পাখির সংখ্যা লিখুন' : 'Enter custom bird count'}
              />
              <span className="blueprint-custom-unit">{isBn ? 'টি পাখি' : 'birds'}</span>
            </div>
            <button
              type="button"
              className="blueprint-step-btn dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200"
              aria-label={isBn ? '১০০ পাখি বাড়ান' : 'Increase flock size by 100'}
              onClick={() => applyFlockSize((Number(flockSize) || 1000) + 100)}
            >
              +100
            </button>
          </div>
          <div className="blueprint-chip-row" role="radiogroup" aria-label={isBn ? 'দ্রুত পাখির সংখ্যা নির্বাচন' : 'Quick Flock Size Presets'}>
            {FLOCK_SIZE_PRESETS.map((size) => (
              <button
                key={size}
                type="button"
                role="radio"
                aria-checked={flockSize === size}
                className={`blueprint-chip${flockSize === size ? ' is-active' : ''}`}
                onClick={() => applyFlockSize(size)}
              >
                {size.toLocaleString()} {isBn ? 'টি' : 'birds'}
              </button>
            ))}
          </div>
          <small className="blueprint-custom-hint dark:text-gray-400">
            {isBn
              ? '১০ থেকে ১,০০,০০০ পর্যন্ত যেকোনো সংখ্যা লিখলে মাপ, ফ্যান, ফিডার ও খরচ স্বয়ংক্রিয়ভাবে হিসাব হবে।'
              : 'Enter any number from 10 to 100,000 birds — shed size, equipment & DAM costs recalculate live.'}
          </small>
        </div>

        <div>
          <span className="blueprint-control-label">
            {isBn ? 'খামারের ধরন / প্রজাতি (Farm Type)' : 'Farm Type / Species'}
          </span>
          <div className="blueprint-chip-row" role="radiogroup" aria-label="Farm Type">
            {FARM_TYPES.map((ft) => (
              <button
                key={ft.id}
                type="button"
                role="radio"
                aria-checked={farmType === ft.id}
                className={`blueprint-chip${farmType === ft.id ? ' is-active' : ''}`}
                onClick={() => onFarmTypeChange(ft.id)}
              >
                {isBn ? ft.labelBn : ft.labelEn}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Smart Scale Recommendation + Manual Toggle */}
      <div className="blueprint-recommend-bar dark:bg-gray-900/70 dark:border-gray-700">
        <div className="blueprint-recommend-copy">
          <Sparkles size={16} aria-hidden="true" className="shrink-0 text-emerald-700 dark:text-emerald-400" />
          <div>
            <strong>
              {isBn ? 'স্মার্ট স্কেল পরামর্শ: ' : 'Smart Scale Recommendation: '}
              {isRecommendedEc
                ? (isBn ? 'ইসি / টানেল নিয়ন্ত্রিত শেড (≥ ২,৫০০ পাখি)' : 'EC / Tunnel Controlled Shed (≥ 2,500 birds)')
                : (isBn ? 'খোলামেলা প্রাকৃতিক বায়ুচলাচল শেড (< ২,৫০০ পাখি)' : 'Open-Sided Natural Ventilation Shed (< 2,500 birds)')}
            </strong>
            <p>
              {isRecommendedEc
                ? (isBn
                    ? `বড় ব্যাচের (${flockSize} পাখি) হিট-স্ট্রেস কমাতে ইসি/টানেল শেড উত্তম; চাইলে নিচের বাটনে খোলা শেডের সাথে তুলনা করতে পারেন।`
                    : `Recommended for commercial heat control at ${flockSize.toLocaleString()} birds. Toggle below to compare Open-Sided vs. EC dimensions.`)
                : (isBn
                    ? `নতুন ও মাঝারি উদ্যোক্তাদের (${flockSize} পাখি) জন্য কম খরচে ও বিদ্যুৎ সাশ্রয়ী খোলামেলা প্রাকৃতিক শেড সবচেয়ে উপযোগী।`
                    : `Lower build cost and electrical resilience for ${flockSize.toLocaleString()} birds. Toggle below to compare with EC / Tunnel specs.`)}
            </p>
          </div>
        </div>

        <div className="blueprint-mode-toggle" role="group" aria-label={isBn ? 'শেডের ধরন তুলনা' : 'Shed Design Mode'}>
          {[
            ['auto', isBn ? 'প্রস্তাবিত (Auto)' : 'Auto Recommended'],
            ['open', isBn ? 'খোলামেলা প্রাকৃতিক' : 'Open-Sided Natural'],
            ['ec', isBn ? 'ইসি / টানেল শেড' : 'EC / Tunnel'],
          ].map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              className={shedMode === mode ? 'is-active' : undefined}
              onClick={() => setShedMode(mode)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 2D & 3D SVG Canvas Grid */}
      <div className={`blueprint-visualizer-grid${viewMode !== 'both' ? ' is-single' : ''}`}>
        {(viewMode === 'both' || viewMode === '2d') && <FloorPlan2D design={design} isBn={isBn} />}
        {(viewMode === 'both' || viewMode === '3d') && <ShedIsometric3D design={design} isBn={isBn} />}
      </div>

      {/* Exact Auto-Calculated Equipment & Structural Specs Strip */}
      <div className="blueprint-specs-grid">
        <div className="blueprint-spec-tile dark:bg-gray-900/60 dark:border-gray-700">
          <span><Compass size={14} aria-hidden="true" /> {isBn ? 'শেডের মাপ (দৈর্ঘ্য × প্রস্থ × উচ্চতা)' : 'Shed Dimensions (L × W × H)'}</span>
          <strong>{design.lengthFt} × {design.widthFt} × {design.wallHeightFt}/{design.ridgeHeightFt} ft</strong>
          <small>
            {design.totalAreaSqFt.toLocaleString()} sq ft ({design.sqFtPerBird} sq ft/{isBn ? 'পাখি' : 'bird'}) ·{' '}
            {isBn ? 'পাশ/চূড়া · পূর্ব–পশ্চিম অক্ষ' : 'Wall/Ridge H · East–West Axis'}
          </small>
        </div>

        <div className="blueprint-spec-tile dark:bg-gray-900/60 dark:border-gray-700">
          <span><Layers size={14} aria-hidden="true" /> {isBn ? 'মোট খাবার পাত্র (Feeders)' : 'Feeders Required'}</span>
          <strong>{design.feedersCount} {isBn ? 'টি বড় ফিডার' : 'Round / Pan'}</strong>
          <small>
            + {design.chickTraysCount} {isBn ? 'টি চিক ট্রে (সপ্তাহ ১)' : 'Chick Trays (Week 1)'}
          </small>
        </div>

        <div className="blueprint-spec-tile dark:bg-gray-900/60 dark:border-gray-700">
          <span><Wind size={14} aria-hidden="true" /> {isBn ? 'পানির পাত্র (Drinkers)' : 'Drinkers Required'}</span>
          <strong>{design.drinkersCount} {isBn ? 'টি বেল ড্রিংকার' : 'Auto Bell'}</strong>
          <small>
            {isBn
              ? `অথবা ${design.nippleDrinkersCount}টি নিপল + ${design.chickDrinkersCount}টি চিক পাত্র`
              : `Or ${design.nippleDrinkersCount} Nipples + ${design.chickDrinkersCount} Chick Pots`}
          </small>
        </div>

        <div className="blueprint-spec-tile dark:bg-gray-900/60 dark:border-gray-700">
          <span><Info size={14} aria-hidden="true" /> {isBn ? 'ব্রুডার গার্ড ও বাতাস' : 'Brooders & Airflow'}</span>
          <strong>{design.brooderGuardsCount} {isBn ? 'টি চিক-গার্ড রিং' : 'Brooder Guards'}</strong>
          <small>
            {design.activeType === 'ec'
              ? (isBn ? `${design.exhaustFansCount}টি টানেল ফ্যান · ${design.coolingPadSqFt} ব.ফু প্যাড` : `${design.exhaustFansCount} Tunnel Fans · ${design.coolingPadSqFt} sq ft Pad`)
              : (isBn ? `${design.roofFansCount}টি সিলিং ফ্যান · ${design.overhangFt} ফু কার্নিশ` : `${design.roofFansCount} Stir Fans · ${design.overhangFt}ft Roof Overhang`)}
          </small>
        </div>
      </div>

      {/* Compact Side-by-Side Open-Sided vs EC Comparison Summary */}
      <div className="blueprint-compare-note dark:bg-gray-900/40 dark:border-gray-700 dark:text-gray-300">
        <span>
          <strong>{isBn ? 'তুলনা: ' : 'Design Comparison: '}</strong>
          {isBn ? 'খোলামেলা শেড' : 'Open-Sided'}: {openComparison.lengthFt}×{openComparison.widthFt} ft ({openComparison.totalAreaSqFt} sq ft) ·{' '}
          {isBn ? 'ইসি / টানেল শেড' : 'EC Tunnel'}: {ecComparison.lengthFt}×{ecComparison.widthFt} ft ({ecComparison.totalAreaSqFt} sq ft)
        </span>
        <small>
          {isBn
            ? 'সূত্র: প্রাণিসম্পদ অধিদপ্তর (DLS বাংলাদেশ) এবং Cobb / Aviagen হাউজিং ম্যানুয়াল'
            : 'Source: DLS Bangladesh & Cobb / Aviagen Housing Manuals'}
        </small>
      </div>
    </section>
  )
}
