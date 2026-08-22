// src/lib/unza-sis-mock.ts
// Simulates the UNZA SIS external verification endpoint.
// In production, replace this with a real fetch() to unzasis.com

export interface SISStudent {
  studentNumber: string
  fullName: string
  programme: string
  year: number
  faculty: string
  status: 'registered' | 'suspended' | 'alumni'
  dob: string
  gender: string
}

const MOCK_SIS_DATABASE: Record<string, SISStudent> = {
  "2022082613": { studentNumber: "2022082613", fullName: "Butemwe Nkinke",    programme: "BSc Computer Science",        year: 3, faculty: "Natural Sciences", status: "registered", dob: "2002-04-12", gender: "Male"   },
  "2022009908": { studentNumber: "2022009908", fullName: "Keila Ngandu",      programme: "BSc Computer Science",        year: 3, faculty: "Natural Sciences", status: "registered", dob: "2001-11-30", gender: "Female" },
  "2021089932": { studentNumber: "2021089932", fullName: "Chanda Mutale",     programme: "Bachelor of Medicine",        year: 4, faculty: "Medicine",         status: "registered", dob: "2000-06-18", gender: "Male"   },
  "2023040215": { studentNumber: "2023040215", fullName: "Luyando Phiri",     programme: "BEng Electrical Engineering", year: 2, faculty: "Engineering",      status: "registered", dob: "2003-01-25", gender: "Female" },
  "2019031233": { studentNumber: "2019031233", fullName: "Mwamba Sichone",    programme: "LLB Law",                     year: 5, faculty: "Law",              status: "registered", dob: "1999-09-07", gender: "Male"   },
  "2023050999": { studentNumber: "2023050999", fullName: "Natasha Bwalya",    programme: "BA Economics",                year: 3, faculty: "Social Sciences",  status: "suspended",  dob: "2001-03-14", gender: "Female" },
  "2018010001": { studentNumber: "2018010001", fullName: "Gerald Tembo",      programme: "BSc Mathematics",             year: 6, faculty: "Natural Sciences", status: "alumni",     dob: "1997-08-22", gender: "Male"   },
}

export function queryUNZASIS(studentNumber: string): 
  | { found: false }
  | { found: true; eligible: false; reason: string }
  | { found: true; eligible: true; student: SISStudent } 
{
  const student = MOCK_SIS_DATABASE[studentNumber.trim()]

  if (!student) return { found: false }
  if (student.status === 'suspended') return { found: true, eligible: false, reason: 'Student account is suspended. Contact the Registrar.' }
  if (student.status === 'alumni')    return { found: true, eligible: false, reason: 'This student number belongs to an alumnus.' }

  return { found: true, eligible: true, student }
}