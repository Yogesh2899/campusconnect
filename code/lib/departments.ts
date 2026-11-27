import { db } from './db'

export const COMPUTING_DEPARTMENT = 'Department of Computer Science & Engineering'
const enrollmentDepartments = [
  'Basic & Engineering Sciences (Dera Bassi Campus)',
  'Department of Chemical Engineering',
  'Department of Civil Engineering',
  'Department of Electrical & Instrumentation Engineering',
  'Department of Electronics & Communication Engineering',
  'Department of Mechanical Engineering',
  'Department of Biotechnology',
  'Department of Chemistry & Biochemistry (DST-FIST Sponsored)',
  COMPUTING_DEPARTMENT,
  'Department of Energy and Environment (DST-FIST Sponsored)',
  'Department of Humanities & Social Sciences',
  'Department of Mathematics',
  'Department of Physics & Materials Science',
]

export const registrationDepartments = () => db.department.findMany({
  where: { name: { in: enrollmentDepartments } },
  select: { id: true, name: true },
  orderBy: { name: 'asc' },
})

export const validRegistrationDepartment = (name: string) => enrollmentDepartments.includes(name)
