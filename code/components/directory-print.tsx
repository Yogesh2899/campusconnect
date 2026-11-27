'use client'

import { Printer } from 'lucide-react'

export function DirectoryPrint() {
  return <button type="button" onClick={() => window.print()}>
    <Printer size={16} aria-hidden="true"/> Print this list
  </button>
}
