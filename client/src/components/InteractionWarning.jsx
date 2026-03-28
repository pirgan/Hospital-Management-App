/**
 * InteractionWarning
 * Modal shown when the AI medication interaction checker detects potential issues
 * before a prescription is saved.
 *
 * Severity badge colours:
 *   none     — green (safe)
 *   mild     — yellow
 *   moderate — orange
 *   severe   — red
 *
 * The user must explicitly confirm or cancel — this prevents accidental prescribing
 * past a severe interaction warning.
 *
 * @param {object}   result      — { safe, interactions[], recommendation } from AI
 * @param {function} onConfirm   — called when user accepts risk and saves prescription
 * @param {function} onCancel    — called when user returns to edit the prescription
 */
const SEVERITY_COLOURS = {
  none: 'bg-green-100 text-green-700',
  mild: 'bg-yellow-100 text-yellow-700',
  moderate: 'bg-orange-100 text-orange-700',
  severe: 'bg-red-100 text-red-700',
};

export default function InteractionWarning({ result, onConfirm, onCancel }) {
  if (!result) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">⚠️</span>
          <h2 className="text-lg font-bold text-gray-900">
            {result.safe ? 'Interaction Check Passed' : 'Drug Interaction Detected'}
          </h2>
        </div>

        {result.interactions?.length > 0 ? (
          <ul className="space-y-3 mb-4">
            {result.interactions.map((interaction, i) => (
              <li key={i} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize mt-0.5 ${
                    SEVERITY_COLOURS[interaction.severity] || SEVERITY_COLOURS.moderate
                  }`}
                >
                  {interaction.severity}
                </span>
                <p className="text-sm text-gray-700">{interaction.description}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-green-600 mb-4">No interactions detected.</p>
        )}

        {result.recommendation && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-5">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">Recommendation: </span>
              {result.recommendation}
            </p>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back to Edit
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-semibold text-white
              ${result.safe ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
          >
            {result.safe ? 'Save Prescription' : 'Override & Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
