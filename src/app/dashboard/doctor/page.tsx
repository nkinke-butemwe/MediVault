// src/app/dashboard/doctor/page.tsx
// Doctor dashboard — patient search, full medical history, add records, update visits

'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@/src/hooks/useAuth'
import toast from 'react-hot-toast'
import type { MedicalRecord, Visit, Medication } from '@/src/types'
import {
  SearchIcon,
  ClipboardIcon,
  AlertTriangleIcon,
  PillIcon,
  CalendarIcon,
  ArrowLeftIcon,
  CloseIcon,
  SaveIcon,
} from '@/src/components/icons'

// Patient search result type
interface PatientSearchResult {
  id: string
  fullName: string
  email: string
  studentNumber: string | null
  phone: string | null
  patientProfile: { bloodType: string | null; dateOfBirth: string | null } | null
}

// ── Visit Status Badge ────────────────────────────────────────────────────────
function VisitStatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    WAITING: 'bg-yellow-100 text-yellow-800',
    CHECKED_IN: 'bg-blue-100 text-blue-800',
    IN_CONSULTATION: 'bg-purple-100 text-purple-800',
    CHECKED_OUT: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
  }
  return (
    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${classes[status] || 'bg-gray-100 text-gray-800'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

export default function DoctorDashboard() {
  const { user } = useAuth()

  // Patient search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<PatientSearchResult[]>([])
  const [searching, setSearching] = useState(false)

  // Selected patient + their data
  const [selectedPatient, setSelectedPatient] = useState<PatientSearchResult | null>(null)
  const [patientRecords, setPatientRecords] = useState<MedicalRecord[]>([])
  const [patientVisits, setPatientVisits] = useState<Visit[]>([])
  const [loadingPatientData, setLoadingPatientData] = useState(false)

  // Active section
  const [activeSection, setActiveSection] = useState<'search' | 'add-record'>('search')

  // New medical record form state
  const [newRecord, setNewRecord] = useState({
    diagnosis: '',
    allergies: '',
    notes: '',
    followUpDate: '',
  })
  // Medications list in the new record form
  const [medications, setMedications] = useState<Medication[]>([{ name: '', dose: '', duration: '' }])
  const [savingRecord, setSavingRecord] = useState(false)

  // ── Search patients ────────────────────────────────────────────────────────
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query)
    if (query.length < 2) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const res = await fetch(`/api/patients/search?q=${encodeURIComponent(query)}`)
      const data = await res.json()
      if (data.success) setSearchResults(data.data)
    } finally {
      setSearching(false)
    }
  }, [])

  // ── Select a patient and load their records + visits ──────────────────────
  const handleSelectPatient = async (patient: PatientSearchResult) => {
    setSelectedPatient(patient)
    setSearchResults([])
    setSearchQuery('')
    setLoadingPatientData(true)
    try {
      const [recRes, visitRes] = await Promise.all([
        fetch(`/api/medical-records?patientId=${patient.id}`),
        fetch(`/api/visits?patientId=${patient.id}`),
      ])
      const [recData, visitData] = await Promise.all([recRes.json(), visitRes.json()])
      if (recData.success) setPatientRecords(recData.data)
      if (visitData.success) setPatientVisits(visitData.data)
    } catch {
      toast.error('Failed to load patient data')
    } finally {
      setLoadingPatientData(false)
    }
  }

  // ── Add a medication row ───────────────────────────────────────────────────
  const addMedication = () => {
    setMedications([...medications, { name: '', dose: '', duration: '' }])
  }

  const updateMedication = (index: number, field: keyof Medication, value: string) => {
    const updated = medications.map((med, i) =>
      i === index ? { ...med, [field]: value } : med
    )
    setMedications(updated)
  }

  const removeMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index))
  }

  // ── Save new medical record ────────────────────────────────────────────────
  const handleSaveRecord = async () => {
    if (!selectedPatient) {
      toast.error('Please select a patient first')
      return
    }
    if (!newRecord.diagnosis.trim()) {
      toast.error('Diagnosis is required')
      return
    }
    setSavingRecord(true)
    try {
      // Filter out empty medication rows before saving
      const validMeds = medications.filter(m => m.name.trim())
      const res = await fetch('/api/medical-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: selectedPatient.id,
          diagnosis: newRecord.diagnosis,
          medications: validMeds.length > 0 ? validMeds : undefined,
          allergies: newRecord.allergies || null,
          notes: newRecord.notes || null,
          followUpDate: newRecord.followUpDate || null,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Medical record saved successfully')
        setNewRecord({ diagnosis: '', allergies: '', notes: '', followUpDate: '' })
        setMedications([{ name: '', dose: '', duration: '' }])
        // Reload the patient's records
        handleSelectPatient(selectedPatient)
        setActiveSection('search')
      } else {
        toast.error(data.error || 'Failed to save record')
      }
    } finally {
      setSavingRecord(false)
    }
  }

  // ── Update visit status ────────────────────────────────────────────────────
  const handleUpdateVisitStatus = async (visitId: string, status: string) => {
    try {
      const res = await fetch(`/api/visits/${visitId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Visit updated')
        if (selectedPatient) handleSelectPatient(selectedPatient)
      } else {
        toast.error(data.error || 'Failed to update visit')
      }
    } catch {
      toast.error('Network error')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#0f3b5c]">Doctor Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Welcome, {user?.fullName}</p>
      </div>

      {/* Section tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveSection('search')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all inline-flex items-center gap-2 ${
            activeSection === 'search'
              ? 'bg-[#0f3b5c] text-white shadow'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <SearchIcon size={16} />
          Patient Search & History
        </button>
        <button
          onClick={() => {
            if (!selectedPatient) {
              toast.error('Please select a patient first')
              return
            }
            setActiveSection('add-record')
          }}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all inline-flex items-center gap-2 ${
            activeSection === 'add-record'
              ? 'bg-[#0f3b5c] text-white shadow'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <ClipboardIcon size={16} />
          Add Medical Record
        </button>
      </div>

      {/* ── Patient Search Section ─────────────────────────────────────────── */}
      {activeSection === 'search' && (
        <div className="space-y-4">
          {/* Search input */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h2 className="text-base font-semibold text-[#0f3b5c] mb-3">Search Patients</h2>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search by name, email, or student number..."
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c] pr-10"
              />
              {searching && (
                <div className="absolute right-3 top-3.5 w-5 h-5 border-2 border-[#0f3b5c] border-t-transparent rounded-full animate-spin" />
              )}
            </div>

            {/* Search results dropdown */}
            {searchResults.length > 0 && (
              <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                {searchResults.map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => handleSelectPatient(patient)}
                    className="w-full text-left px-4 py-3 hover:bg-[#e6f0f9] transition-colors border-b border-slate-100 last:border-0"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium text-slate-800">{patient.fullName}</span>
                        <span className="text-slate-400 text-xs ml-2">{patient.email}</span>
                      </div>
                      <span className="text-xs text-slate-400">{patient.studentNumber || 'No student no.'}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected patient details */}
          {selectedPatient && (
            <div className="space-y-4">
              {/* Patient info banner */}
              <div className="bg-[#0f3b5c] rounded-2xl p-5 text-white flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">{selectedPatient.fullName}</h3>
                  <p className="text-blue-200 text-sm mt-0.5">
                    {selectedPatient.studentNumber && `Student No: ${selectedPatient.studentNumber} · `}
                    {selectedPatient.email}
                    {selectedPatient.patientProfile?.bloodType && ` · Blood: ${selectedPatient.patientProfile.bloodType}`}
                  </p>
                </div>
                <button
                  onClick={() => setActiveSection('add-record')}
                  className="bg-white text-[#0f3b5c] px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-50 transition-all"
                >
                  + Add Record
                </button>
              </div>

              {loadingPatientData ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-4 border-[#0f3b5c] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  {/* Medical Records */}
                  <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-100">
                      <h3 className="font-semibold text-[#0f3b5c]">Medical Records ({patientRecords.length})</h3>
                    </div>
                    {patientRecords.length === 0 ? (
                      <div className="p-8 text-center text-slate-400">No medical records found.</div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {patientRecords.map((record) => (
                          <div key={record.id} className="p-5">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-semibold text-slate-800">{record.diagnosis}</h4>
                              <span className="text-xs text-slate-400">
                                {new Date(record.visitDate).toLocaleDateString()}
                              </span>
                            </div>
                            {record.allergies && (
                              <p className="text-xs bg-red-50 text-red-700 px-3 py-1 rounded-lg inline-flex items-center gap-1.5 mb-2">
                                <AlertTriangleIcon size={13} />
                                Allergies: {record.allergies}
                              </p>
                            )}
                            {record.medications && (record.medications as Medication[]).length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-2">
                                {(record.medications as Medication[]).map((med: Medication, i: number) => (
                                  <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full inline-flex items-center gap-1">
                                    <PillIcon size={12} />
                                    {med.name} {med.dose}
                                  </span>
                                ))}
                              </div>
                            )}
                            {record.notes && (
                              <p className="text-xs text-slate-500 italic border-l-2 border-slate-200 pl-3 mt-2">
                                {record.notes}
                              </p>
                            )}
                            {record.followUpDate && (
                              <p className="text-xs text-blue-600 mt-2 inline-flex items-center gap-1.5">
                                <CalendarIcon size={13} />
                                Follow-up: {new Date(record.followUpDate).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Visit History */}
                  <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-100">
                      <h3 className="font-semibold text-[#0f3b5c]">Visit History ({patientVisits.length})</h3>
                    </div>
                    {patientVisits.length === 0 ? (
                      <div className="p-8 text-center text-slate-400">No visits found.</div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {patientVisits.map((visit) => (
                          <div key={visit.id} className="p-5 flex justify-between items-center">
                            <div>
                              <p className="font-medium text-slate-800">{visit.reason}</p>
                              <p className="text-sm text-slate-500 mt-0.5">
                                {new Date(visit.visitDate).toLocaleDateString()}
                                {visit.vitals && ` · ${visit.vitals}`}
                              </p>
                              {visit.doctorNotes && (
                                <p className="text-xs text-slate-400 mt-1 italic">{visit.doctorNotes}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <VisitStatusBadge status={visit.status} />
                              {visit.status === 'CHECKED_IN' && (
                                <button
                                  onClick={() => handleUpdateVisitStatus(visit.id, 'IN_CONSULTATION')}
                                  className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-lg hover:bg-purple-200"
                                >
                                  Start Consult
                                </button>
                              )}
                              {visit.status === 'IN_CONSULTATION' && (
                                <button
                                  onClick={() => handleUpdateVisitStatus(visit.id, 'CHECKED_OUT')}
                                  className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg hover:bg-green-200"
                                >
                                  Complete
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Add Medical Record Section ─────────────────────────────────────── */}
      {activeSection === 'add-record' && selectedPatient && (
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-5">
            <div>
              <h2 className="text-lg font-semibold text-[#0f3b5c]">New Medical Record</h2>
              <p className="text-sm text-slate-500">Patient: <strong>{selectedPatient.fullName}</strong></p>
            </div>
            <button
              onClick={() => setActiveSection('search')}
              className="text-sm text-slate-500 hover:text-[#0f3b5c] inline-flex items-center gap-1.5"
            >
              <ArrowLeftIcon size={14} />
              Back to history
            </button>
          </div>

          <div className="space-y-4">
            {/* Diagnosis */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Diagnosis *</label>
              <input
                type="text"
                value={newRecord.diagnosis}
                onChange={(e) => setNewRecord({ ...newRecord, diagnosis: e.target.value })}
                placeholder="e.g. Acute Pharyngitis, Malaria, Tension Headache"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]"
              />
            </div>

            {/* Medications */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold text-slate-600">Medications</label>
                <button
                  onClick={addMedication}
                  className="text-xs text-[#0f3b5c] hover:underline"
                >
                  + Add medication
                </button>
              </div>
              <div className="space-y-2">
                {medications.map((med, index) => (
                  <div key={index} className="grid grid-cols-3 gap-2">
                    <input
                      value={med.name}
                      onChange={(e) => updateMedication(index, 'name', e.target.value)}
                      placeholder="Drug name"
                      className="px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]"
                    />
                    <input
                      value={med.dose}
                      onChange={(e) => updateMedication(index, 'dose', e.target.value)}
                      placeholder="Dose (e.g. 500mg)"
                      className="px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]"
                    />
                    <div className="flex gap-2">
                      <input
                        value={med.duration}
                        onChange={(e) => updateMedication(index, 'duration', e.target.value)}
                        placeholder="Duration (e.g. 7 days)"
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]"
                      />
                      {medications.length > 1 && (
                        <button
                          onClick={() => removeMedication(index)}
                          className="text-red-400 hover:text-red-600 px-2"
                          title="Remove this medication"
                        >
                          <CloseIcon size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Allergies */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Known Allergies</label>
              <input
                type="text"
                value={newRecord.allergies}
                onChange={(e) => setNewRecord({ ...newRecord, allergies: e.target.value })}
                placeholder="e.g. Penicillin, NSAIDs, Pollen (or leave blank)"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]"
              />
            </div>

            {/* Clinical Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Clinical Notes</label>
              <textarea
                value={newRecord.notes}
                onChange={(e) => setNewRecord({ ...newRecord, notes: e.target.value })}
                rows={3}
                placeholder="Additional observations, treatment plan, patient instructions..."
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c] resize-none"
              />
            </div>

            {/* Follow-up date */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Follow-up Date (optional)</label>
              <input
                type="date"
                value={newRecord.followUpDate}
                onChange={(e) => setNewRecord({ ...newRecord, followUpDate: e.target.value })}
                className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]"
              />
            </div>

            {/* Save button */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSaveRecord}
                disabled={savingRecord}
                className="bg-[#0f3b5c] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#0a2c45] transition-all disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {savingRecord ? (
                  'Saving...'
                ) : (
                  <>
                    <SaveIcon size={16} />
                    Save Medical Record
                  </>
                )}
              </button>
              <button
                onClick={() => setActiveSection('search')}
                className="bg-slate-100 text-slate-600 px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
