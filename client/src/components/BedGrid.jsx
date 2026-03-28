/**
 * BedGrid
 * Visual ward bed map.
 * Each bed is a coloured cell:
 *   available — green
 *   occupied  — red (with patient name tooltip)
 *   reserved  — amber
 *
 * Hovering an occupied bed shows a tooltip with the patient name and admission date.
 *
 * @param {object[]} beds — Ward.beds array from the API
 * @param {function} [onBedClick] — optional callback with bed object for admit/discharge forms
 */
import { useState } from 'react';

const BED_COLOURS = {
  available: 'bg-green-100 border-green-300 text-green-700 hover:bg-green-200',
  occupied:  'bg-red-100 border-red-300 text-red-700 hover:bg-red-200',
  reserved:  'bg-amber-100 border-amber-300 text-amber-700 hover:bg-amber-200',
};

export default function BedGrid({ beds = [], onBedClick }) {
  // tooltip stores the hovered bed and cursor position for fixed-position rendering.
  // null means no tooltip is showing.
  const [tooltip, setTooltip] = useState(null); // { bed, x, y }

  return (
    <div className="relative">
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
        {beds.map((bed) => (
          <div
            key={bed.number}
            onClick={() => onBedClick?.(bed)}
            onMouseEnter={(e) => {
              // Only show the tooltip for occupied beds — available/reserved have no patient info
              if (bed.status === 'occupied') {
                // Use client coordinates (viewport-relative) for the fixed-position tooltip
                setTooltip({ bed, x: e.clientX, y: e.clientY });
              }
            }}
            onMouseLeave={() => setTooltip(null)} // hide tooltip when cursor leaves the cell
            className={`relative border rounded-lg p-2 text-center text-xs font-semibold cursor-pointer transition-all
              ${BED_COLOURS[bed.status] || BED_COLOURS.available}`}
          >
            <div className="text-[10px] text-gray-400 font-normal">Bed</div>
            <div>{bed.number}</div>
          </div>
        ))}
      </div>

      {/* Tooltip for occupied beds */}
      {tooltip && (
        <div
          className="fixed z-50 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg pointer-events-none"
          style={{ top: tooltip.y + 12, left: tooltip.x + 8 }}
        >
          <div className="font-semibold">
            {tooltip.bed.patient?.fullName || 'Patient'}
          </div>
          {tooltip.bed.admittedAt && (
            <div className="text-gray-300 mt-0.5">
              Admitted: {new Date(tooltip.bed.admittedAt).toLocaleDateString()}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 mt-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-green-200 border border-green-300 inline-block" /> Available
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-200 border border-red-300 inline-block" /> Occupied
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-amber-200 border border-amber-300 inline-block" /> Reserved
        </span>
      </div>
    </div>
  );
}
