/**
 * PatientCard
 * Summary card for a patient record.
 * Shows name, NHS number, date of birth, blood type, and allergy badges.
 * Allergy badges are red so they stand out at a glance — clinical safety.
 *
 * @param {object} patient — Mongoose Patient document (or projection)
 * @param {function} [onClick] — optional click handler (e.g. navigate to detail)
 */
export default function PatientCard({ patient, onClick }) {
  const dob = patient.dateOfBirth
    ? new Date(patient.dateOfBirth).toLocaleDateString()
    : 'Unknown';

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-gray-200 p-4 shadow-sm
        ${onClick ? 'cursor-pointer hover:border-teal-400 hover:shadow-md transition-all' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-gray-900 text-base">{patient.fullName}</h3>
          <p className="text-xs text-gray-500 mt-0.5">NHS: {patient.nhsNumber}</p>
        </div>
        {patient.bloodType && (
          <span className="text-xs font-bold bg-red-50 text-red-700 border border-red-200 rounded px-2 py-0.5">
            {patient.bloodType}
          </span>
        )}
      </div>

      <div className="mt-2 text-sm text-gray-600 flex gap-4">
        <span>DOB: {dob}</span>
        <span className="capitalize">{patient.gender}</span>
      </div>

      {/* Allergy badges — red for clinical visibility */}
      {patient.allergies?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {patient.allergies.map((allergy) => (
            <span
              key={allergy}
              className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-medium"
            >
              ⚠ {allergy}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
