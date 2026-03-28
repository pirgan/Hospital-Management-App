/**
 * AppointmentSlotPicker
 * Visual slot grid for booking appointments.
 * Slots are grouped into morning (08:00–11:30), afternoon (12:00–16:30),
 * and evening (17:00–19:30) rows, each in 30-minute increments.
 *
 * Slot states:
 *   available — green, clickable
 *   booked    — grey, disabled (already taken)
 *   selected  — blue, currently chosen by user
 *
 * @param {string[]} bookedSlots    — ISO time strings that are already taken
 * @param {string}   selectedSlot  — currently selected slot (ISO string or null)
 * @param {function} onSelect       — called with the clicked slot string
 * @param {string}   date           — YYYY-MM-DD date string to build full ISO times
 */

/**
 * buildSlots
 * Generates an array of ISO-8601 datetime strings for a given date and hour range.
 * Each slot is 30 minutes apart. The final hour only gets the :00 slot (not :30).
 * Example: buildSlots('2025-06-01', 8, 9) → ['2025-06-01T08:00', '2025-06-01T08:30', '2025-06-01T09:00']
 */
function buildSlots(date, startHour, endHour) {
  const slots = [];
  for (let h = startHour; h <= endHour; h++) {
    for (let m = 0; m < 60; m += 30) {
      // Stop at the end hour's :00 — don't add a :30 for the last hour
      if (h === endHour && m > 0) break;
      // Zero-pad hours and minutes so they produce valid ISO time strings (e.g. "08:00")
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      slots.push(`${date}T${hh}:${mm}`);
    }
  }
  return slots;
}

const PERIODS = [
  { label: 'Morning', startHour: 8, endHour: 11 },
  { label: 'Afternoon', startHour: 12, endHour: 16 },
  { label: 'Evening', startHour: 17, endHour: 19 },
];

export default function AppointmentSlotPicker({ bookedSlots = [], selectedSlot, onSelect, date }) {
  // Convert bookedSlots array to a Set for O(1) lookup per slot — avoids an O(n²) includes() loop
  const bookedSet = new Set(bookedSlots);

  return (
    <div className="space-y-4">
      {PERIODS.map(({ label, startHour, endHour }) => {
        const slots = buildSlots(date, startHour, endHour);
        return (
          <div key={label}>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{label}</p>
            <div className="flex flex-wrap gap-2">
              {slots.map((slot) => {
                const isBooked = bookedSet.has(slot);    // true if another patient has this slot
                const isSelected = selectedSlot === slot; // true if the user clicked this slot
                // Display only the time portion of the ISO string (e.g. "09:00")
                const time = slot.split('T')[1];

                // Build button classes imperatively — three mutually exclusive visual states
                let cls = 'px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ';
                if (isSelected) {
                  cls += 'bg-blue-600 text-white border-blue-600';
                } else if (isBooked) {
                  cls += 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed';
                } else {
                  cls += 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100 cursor-pointer';
                }

                return (
                  <button
                    key={slot}
                    disabled={isBooked}
                    onClick={() => onSelect(slot)}
                    className={cls}
                  >
                    {time}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
