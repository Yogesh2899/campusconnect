'use client'

import { Combobox } from '@base-ui/react/combobox'
import { Check, ChevronDown } from 'lucide-react'

export type DepartmentOption = { id: string; name: string }

export function DepartmentPicker({ departments }: { departments: DepartmentOption[] }) {
  return <div className="department-field">
    <Combobox.Root<DepartmentOption> items={departments} name="departmentId" required openOnInputClick
      itemToStringLabel={item => item.name} itemToStringValue={item => item.id}>
      <Combobox.Label className="department-label">Department</Combobox.Label>
      <Combobox.InputGroup className="department-input">
        <Combobox.Input placeholder="Search or select your department" />
        <Combobox.Trigger aria-label="Show departments"><ChevronDown size={18} /></Combobox.Trigger>
      </Combobox.InputGroup>
      <Combobox.Portal>
        <Combobox.Positioner className="department-positioner" sideOffset={6}>
          <Combobox.Popup className="department-popup">
            <Combobox.Empty className="department-empty">No matching departments.</Combobox.Empty>
            <Combobox.List>{(item: DepartmentOption) =>
              <Combobox.Item className="department-option" key={item.id} value={item}>
                <span>{item.name}</span>
                <Combobox.ItemIndicator><Check size={16} aria-hidden="true" /></Combobox.ItemIndicator>
              </Combobox.Item>
            }</Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  </div>
}
