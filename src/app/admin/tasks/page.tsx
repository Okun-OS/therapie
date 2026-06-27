'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/lib/toast-context'
import type { Employee } from '@/lib/types'
import { ListChecks, Plus, Trash2, ChevronDown, ChevronUp, Check } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

export default function AdminTasks() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const locationId = user?.locationId || 'loc1'
  const [allEmployees, setAllEmployees] = useState<Employee[]>([])
  const employees = allEmployees.filter(e => e.role === 'employee' && e.locationId === locationId)
  const [TASK_CATALOG, setTASK_CATALOG] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/employees').then(r => r.json()).then(d => setAllEmployees(d.employees))
  }, [])

  useEffect(() => {
    fetch('/api/task-types').then(r => r.json()).then(d => setTASK_CATALOG(d.taskTypes ?? []))
  }, [])

  const [expanded, setExpanded] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [newTask, setNewTask] = useState('')

  const toggleAssignment = async (employeeId: string, taskName: string) => {
    const emp = employees.find(e => e.id === employeeId)
    if (!emp) return
    const current = emp.allowedTasks ?? []
    const next = current.includes(taskName) ? current.filter(t => t !== taskName) : [...current, taskName]
    const updated = await fetch(`/api/employees/${employeeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowedTasks: next }),
    }).then(r => r.json()).then(d => d.employee)
    setAllEmployees(prev => prev.map(e => e.id === updated.id ? updated : e))
  }

  const handleAddTask = async () => {
    const name = newTask.trim()
    if (!name) { showToast('Bitte eine Bezeichnung angeben', 'error'); return }
    if (TASK_CATALOG.includes(name)) { showToast('Diese Aufgabe existiert bereits', 'error'); return }
    const taskTypes = await fetch('/api/task-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }).then(r => r.json()).then(d => d.taskTypes)
    setTASK_CATALOG(taskTypes)
    setNewTask('')
    setAddOpen(false)
    showToast('Aufgabe angelegt', 'success')
  }

  const handleRemoveTask = async (name: string) => {
    await fetch(`/api/tasks/${encodeURIComponent(name)}`, { method: 'DELETE' })
    setTASK_CATALOG(prev => prev.filter(t => t !== name))
    setAllEmployees(prev => prev.map(e => ({ ...e, allowedTasks: e.allowedTasks?.filter(t => t !== name) })))
    if (expanded === name) setExpanded(null)
    showToast('Aufgabe entfernt', 'success')
  }

  return (
    <>
      <Header title="Aufgaben verwalten" subtitle="Aufgabentypen definieren und Mitarbeitern zuweisen" />
      <div className="p-4 sm:p-6 space-y-5">
        <div className="flex justify-end">
          <Button className="gap-2" onClick={() => setAddOpen(true)}>
            <Plus size={16} />
            Neue Aufgabe
          </Button>
        </div>

        <div className="space-y-3">
          {TASK_CATALOG.length === 0 && (
            <Card><EmptyState icon={ListChecks} title="Noch keine Aufgaben angelegt" /></Card>
          )}
          {TASK_CATALOG.map(task => {
            const assignedCount = employees.filter(e => e.allowedTasks?.includes(task)).length
            const isOpen = expanded === task
            return (
              <Card key={task}>
                <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(isOpen ? null : task)}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-navy flex items-center justify-center flex-shrink-0">
                      <ListChecks size={16} className="text-brand" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-navy">{task}</p>
                      <p className="text-xs text-gray-500">{assignedCount} von {employees.length} Mitarbeitern zugewiesen</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={e => { e.stopPropagation(); handleRemoveTask(task) }}
                      className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                      aria-label={`${task} entfernen`}
                    >
                      <Trash2 size={15} />
                    </button>
                    {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </div>
                {isOpen && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                    {employees.length === 0 && <p className="text-xs text-gray-400">Keine Mitarbeiter in dieser Einrichtung</p>}
                    {employees.map(emp => {
                      const assigned = emp.allowedTasks?.includes(task) ?? false
                      return (
                        <label key={emp.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 cursor-pointer">
                          <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors flex-shrink-0 ${assigned ? 'bg-brand border-brand-dark' : 'border-gray-300'}`}>
                            {assigned && <Check size={12} className="text-navy" />}
                          </div>
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={assigned}
                            onChange={() => toggleAssignment(emp.id, task)}
                          />
                          <span className="text-sm text-navy flex-1">{emp.name}</span>
                          <span className="text-xs text-gray-400">{emp.position}</span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Neue Aufgabe anlegen">
        <div className="space-y-4">
          <div>
            <Input
              label="Bezeichnung"
              value={newTask}
              onChange={e => setNewTask(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTask() } }}
              placeholder="z.B. Medikamentenausgabe"
            />
          </div>
          <Button className="w-full" onClick={handleAddTask}>Anlegen</Button>
        </div>
      </Modal>
    </>
  )
}
