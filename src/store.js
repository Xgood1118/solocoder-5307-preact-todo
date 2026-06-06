const STORAGE_KEY = 'preact-todo-data'
const SETTINGS_KEY = 'preact-todo-settings'
const TRASH_KEY = 'preact-todo-trash'
const SCHEMA_VERSION = 1

export const TODO_STATUSES = {
  DRAFT: 'draft',
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  ARCHIVED: 'archived',
  OVERDUE: 'overdue',
  DELETED: 'deleted'
}

export const PRIORITIES = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
}

export const PRIORITY_COLORS = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#3b82f6'
}

export const REPEAT_TYPES = {
  NONE: 'none',
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
  CUSTOM: 'custom'
}

const DEFAULT_CATEGORIES = [
  { id: 'cat-work', name: '工作', color: '#3b82f6' },
  { id: 'cat-study', name: '学习', color: '#10b981' },
  { id: 'cat-life', name: '生活', color: '#f59e0b' },
  { id: 'cat-other', name: '其他', color: '#8b5cf6' }
]

const DEFAULT_SETTINGS = {
  notificationsEnabled: false,
  notificationsAsked: false,
  subscribed: false,
  operationQuota: 200,
  quotaUsed: 0,
  quotaResetDate: null,
  maxTodos: 200,
  collapseCompleted: true,
  lastSyncTime: null
}

let state = {
  todos: [],
  categories: [...DEFAULT_CATEGORIES],
  settings: { ...DEFAULT_SETTINGS },
  trash: [],
  missedReminders: [],
  activityLog: [],
  listeners: []
}

function generateId(prefix = 'todo') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function loadFromStorage() {
  try {
    const dataStr = localStorage.getItem(STORAGE_KEY)
    if (dataStr) {
      const data = JSON.parse(dataStr)
      state.todos = data.todos || []
      state.categories = data.categories || [...DEFAULT_CATEGORIES]
      state.activityLog = data.activityLog || []
      state.missedReminders = data.missedReminders || []
    }
    const settingsStr = localStorage.getItem(SETTINGS_KEY)
    if (settingsStr) {
      state.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(settingsStr) }
    }
    const trashStr = localStorage.getItem(TRASH_KEY)
    if (trashStr) {
      state.trash = JSON.parse(trashStr)
    }
  } catch (e) {
    console.error('Failed to load from localStorage:', e)
  }
}

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      todos: state.todos,
      categories: state.categories,
      activityLog: state.activityLog,
      missedReminders: state.missedReminders,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString()
    }))
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings))
    localStorage.setItem(TRASH_KEY, JSON.stringify(state.trash))
  } catch (e) {
    console.error('Failed to save to localStorage:', e)
  }
}

function notifyListeners() {
  state.listeners.forEach(fn => fn(state))
}

function addActivityLog(todoId, action, details = {}) {
  const entry = {
    id: generateId('log'),
    todoId,
    action,
    timestamp: new Date().toISOString(),
    user: '我',
    ...details
  }
  state.activityLog.unshift(entry)
  if (state.activityLog.length > 500) {
    state.activityLog = state.activityLog.slice(0, 500)
  }
}

function checkQuota() {
  const now = new Date()
  const resetDate = state.settings.quotaResetDate
    ? new Date(state.settings.quotaResetDate)
    : null

  if (!resetDate || now >= resetDate) {
    const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    state.settings.quotaUsed = 0
    state.settings.quotaResetDate = nextReset.toISOString()
    saveToStorage()
  }

  if (!state.settings.subscribed && state.settings.quotaUsed >= state.settings.operationQuota) {
    return false
  }
  return true
}

function useQuota() {
  if (!state.settings.subscribed) {
    state.settings.quotaUsed++
    saveToStorage()
  }
}

export function useStore(initialListener) {
  if (initialListener) {
    state.listeners.push(initialListener)
  }
  return {
    getState: () => state,
    subscribe: (fn) => {
      state.listeners.push(fn)
      return () => {
        state.listeners = state.listeners.filter(l => l !== fn)
      }
    },
    unsubscribe: (fn) => {
      state.listeners = state.listeners.filter(l => l !== fn)
    }
  }
}

export function getState() {
  return state
}

export function createTodo(title, options = {}) {
  if (!checkQuota()) {
    return { success: false, error: '配额不足，请升级订阅' }
  }

  const trimmed = title.trim()
  if (!trimmed) return { success: false, error: '标题不能为空' }

  if (!state.settings.subscribed && state.todos.length >= state.settings.maxTodos) {
    return { success: false, error: `免费版最多 ${state.settings.maxTodos} 条待办，请升级订阅` }
  }

  const now = new Date().toISOString()
  const todo = {
    id: generateId(),
    title: trimmed,
    description: options.description || '',
    categoryId: options.categoryId || 'cat-other',
    priority: options.priority || PRIORITIES.MEDIUM,
    status: TODO_STATUSES.TODO,
    dueDate: options.dueDate || null,
    reminderTime: options.reminderTime || null,
    reminderShown: false,
    repeatRule: options.repeatRule || { type: REPEAT_TYPES.NONE },
    subTasks: options.subTasks || [],
    notes: [],
    attachments: options.attachments || [],
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    startedAt: null,
    cancelledAt: null,
    archivedAt: null,
    lastEditedAt: now,
    editCount: 0,
    repeatCount: 0,
    parentTodoId: null,
    assignee: null,
    isDraft: false
  }

  state.todos.unshift(todo)
  useQuota()
  addActivityLog(todo.id, 'create', { title: trimmed })
  saveToStorage()
  notifyListeners()
  return { success: true, todo }
}

export function updateTodo(id, updates, editMode = 'all') {
  if (!checkQuota()) {
    return { success: false, error: '配额不足' }
  }

  const index = state.todos.findIndex(t => t.id === id)
  if (index === -1) return { success: false, error: '任务不存在' }

  const oldTodo = { ...state.todos[index] }
  const now = new Date().toISOString()

  const updated = {
    ...oldTodo,
    ...updates,
    lastEditedAt: now,
    updatedAt: now,
    editCount: oldTodo.editCount + 1
  }

  if (updates.status === TODO_STATUSES.COMPLETED && oldTodo.status !== TODO_STATUSES.COMPLETED) {
    updated.completedAt = now
    if (updated.subTasks && updated.subTasks.length > 0) {
      updated.subTasks = updated.subTasks.map(st => ({ ...st, completed: true }))
    }
  }

  if (updates.status === TODO_STATUSES.IN_PROGRESS && oldTodo.status === TODO_STATUSES.TODO) {
    updated.startedAt = now
  }

  if (updates.status === TODO_STATUSES.CANCELLED && oldTodo.status !== TODO_STATUSES.CANCELLED) {
    updated.cancelledAt = now
  }

  if (updates.subTasks) {
    const allCompleted = updated.subTasks.length > 0 && updated.subTasks.every(st => st.completed)
    const someCompleted = updated.subTasks.some(st => st.completed)
    
    if (allCompleted && updated.status !== TODO_STATUSES.COMPLETED) {
      updated.status = TODO_STATUSES.COMPLETED
      updated.completedAt = now
    } else if (someCompleted && updated.status === TODO_STATUSES.TODO) {
      updated.status = TODO_STATUSES.IN_PROGRESS
      updated.startedAt = now
    } else if (!allCompleted && updated.status === TODO_STATUSES.COMPLETED) {
      updated.status = TODO_STATUSES.IN_PROGRESS
      updated.completedAt = null
    }
  }

  state.todos[index] = updated
  useQuota()

  const changedFields = Object.keys(updates).filter(k => oldTodo[k] !== updates[k])
  if (changedFields.length > 0) {
    addActivityLog(id, 'update', {
      fields: changedFields,
      oldValues: changedFields.reduce((acc, k) => ({ ...acc, [k]: oldTodo[k] }), {}),
      newValues: changedFields.reduce((acc, k) => ({ ...acc, [k]: updates[k] }), {})
    })
  }

  if (updated.status === TODO_STATUSES.COMPLETED && updated.repeatRule && updated.repeatRule.type !== REPEAT_TYPES.NONE) {
    generateNextRepeat(updated)
  }

  saveToStorage()
  notifyListeners()
  return { success: true, todo: updated }
}

function generateNextRepeat(todo) {
  const nextDueDate = calculateNextDueDate(todo.dueDate, todo.repeatRule)
  if (!nextDueDate) return

  const newTodo = {
    ...todo,
    id: generateId(),
    status: TODO_STATUSES.TODO,
    dueDate: nextDueDate,
    reminderTime: todo.reminderTime
      ? adjustReminderTime(todo.reminderTime, todo.dueDate, nextDueDate)
      : null,
    reminderShown: false,
    completedAt: null,
    startedAt: null,
    cancelledAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastEditedAt: new Date().toISOString(),
    editCount: 0,
    repeatCount: (todo.repeatCount || 0) + 1,
    subTasks: todo.subTasks.map(st => ({ ...st, completed: false })),
    notes: []
  }

  state.todos.unshift(newTodo)
  addActivityLog(newTodo.id, 'repeat_create', {
    fromTodo: todo.id,
    repeatCount: newTodo.repeatCount
  })

  if (newTodo.repeatCount === 30) {
    state.missedReminders.push({
      id: generateId('reminder'),
      todoId: newTodo.id,
      title: `重复任务提醒`,
      message: `任务「${newTodo.title}」已运行 30 次，是否继续？`,
      timestamp: new Date().toISOString(),
      type: 'repeat_threshold'
    })
  }
}

function calculateNextDueDate(currentDueDate, rule) {
  if (!currentDueDate) return null
  const date = new Date(currentDueDate)

  switch (rule.type) {
    case REPEAT_TYPES.DAILY:
      date.setDate(date.getDate() + 1)
      break
    case REPEAT_TYPES.WEEKLY:
      if (rule.weekdays && rule.weekdays.length > 0) {
        const today = date.getDay()
        let nextDay = null
        const sortedDays = [...rule.weekdays].sort((a, b) => a - b)
        for (const d of sortedDays) {
          if (d > today) { nextDay = d; break }
        }
        if (nextDay === null) nextDay = sortedDays[0]
        const daysToAdd = (nextDay - today + 7) % 7 || 7
        date.setDate(date.getDate() + daysToAdd)
      } else {
        date.setDate(date.getDate() + 7)
      }
      break
    case REPEAT_TYPES.MONTHLY:
      const targetDay = rule.dayOfMonth || date.getDate()
      date.setMonth(date.getMonth() + 1)
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
      date.setDate(Math.min(targetDay, lastDay))
      break
    case REPEAT_TYPES.YEARLY:
      date.setFullYear(date.getFullYear() + 1)
      break
    case REPEAT_TYPES.CUSTOM:
      date.setDate(date.getDate() + (rule.intervalDays || 1))
      break
    default:
      return null
  }

  return date.toISOString()
}

function adjustReminderTime(reminderTime, oldDueDate, newDueDate) {
  if (!reminderTime || !oldDueDate || !newDueDate) return reminderTime
  const reminder = new Date(reminderTime)
  const oldDue = new Date(oldDueDate)
  const newDue = new Date(newDueDate)
  const diffMs = reminder.getTime() - oldDue.getTime()
  return new Date(newDue.getTime() + diffMs).toISOString()
}

export function deleteTodo(id, strategy = 'trash') {
  const index = state.todos.findIndex(t => t.id === id)
  if (index === -1) return { success: false }

  const todo = state.todos[index]

  if (strategy === 'trash') {
    todo.deletedAt = new Date().toISOString()
    todo.status = TODO_STATUSES.DELETED
    state.trash.unshift(todo)
    addActivityLog(id, 'delete', { strategy: 'trash' })
  }

  state.todos.splice(index, 1)
  useQuota()
  saveToStorage()
  notifyListeners()
  return { success: true }
}

export function restoreFromTrash(id) {
  const index = state.trash.findIndex(t => t.id === id)
  if (index === -1) return { success: false }

  const todo = state.trash[index]
  delete todo.deletedAt
  if (todo.status === TODO_STATUSES.DELETED) {
    todo.status = TODO_STATUSES.TODO
  }
  state.todos.unshift(todo)
  state.trash.splice(index, 1)
  addActivityLog(id, 'restore')
  saveToStorage()
  notifyListeners()
  return { success: true }
}

export function purgeOldTrash() {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 7)
  const before = state.trash.length
  state.trash = state.trash.filter(t => new Date(t.deletedAt) >= cutoff)
  if (state.trash.length !== before) {
    saveToStorage()
    notifyListeners()
  }
}

export function addSubTask(todoId, title) {
  const todo = state.todos.find(t => t.id === todoId)
  if (!todo) return { success: false }

  const subTask = {
    id: generateId('sub'),
    title: title.trim(),
    completed: false,
    createdAt: new Date().toISOString()
  }

  todo.subTasks.push(subTask)
  todo.lastEditedAt = new Date().toISOString()
  todo.editCount++

  if (todo.status === TODO_STATUSES.TODO) {
    todo.status = TODO_STATUSES.IN_PROGRESS
    todo.startedAt = new Date().toISOString()
  }

  useQuota()
  addActivityLog(todoId, 'add_subtask', { subTaskTitle: subTask.title })
  saveToStorage()
  notifyListeners()
  return { success: true, subTask }
}

export function toggleSubTask(todoId, subTaskId) {
  const todo = state.todos.find(t => t.id === todoId)
  if (!todo) return { success: false }

  const subTask = todo.subTasks.find(st => st.id === subTaskId)
  if (!subTask) return { success: false }

  subTask.completed = !subTask.completed
  todo.lastEditedAt = new Date().toISOString()

  const allCompleted = todo.subTasks.every(st => st.completed)
  if (allCompleted && todo.status !== TODO_STATUSES.COMPLETED) {
    todo.status = TODO_STATUSES.COMPLETED
    todo.completedAt = new Date().toISOString()
  } else if (!allCompleted && todo.status === TODO_STATUSES.COMPLETED) {
    todo.status = TODO_STATUSES.IN_PROGRESS
    todo.completedAt = null
  }

  if (subTask.completed && todo.status === TODO_STATUSES.TODO) {
    todo.status = TODO_STATUSES.IN_PROGRESS
    todo.startedAt = new Date().toISOString()
  }

  useQuota()
  addActivityLog(todoId, 'toggle_subtask', {
    subTaskId,
    subTaskTitle: subTask.title,
    completed: subTask.completed
  })
  saveToStorage()
  notifyListeners()
  return { success: true }
}

export function deleteSubTask(todoId, subTaskId) {
  const todo = state.todos.find(t => t.id === todoId)
  if (!todo) return { success: false }

  todo.subTasks = todo.subTasks.filter(st => st.id !== subTaskId)
  todo.lastEditedAt = new Date().toISOString()
  todo.editCount++

  useQuota()
  addActivityLog(todoId, 'delete_subtask', { subTaskId })
  saveToStorage()
  notifyListeners()
  return { success: true }
}

export function addNote(todoId, content) {
  const todo = state.todos.find(t => t.id === todoId)
  if (!todo) return { success: false }

  const note = {
    id: generateId('note'),
    content,
    timestamp: new Date().toISOString()
  }

  todo.notes.push(note)
  todo.lastEditedAt = new Date().toISOString()
  todo.editCount++

  useQuota()
  addActivityLog(todoId, 'add_note', { notePreview: content.slice(0, 50) })
  saveToStorage()
  notifyListeners()
  return { success: true, note }
}

export function addAttachment(todoId, name, url) {
  const todo = state.todos.find(t => t.id === todoId)
  if (!todo) return { success: false }

  const attachment = {
    id: generateId('att'),
    name,
    url,
    addedAt: new Date().toISOString()
  }

  todo.attachments.push(attachment)
  todo.lastEditedAt = new Date().toISOString()
  todo.editCount++

  useQuota()
  addActivityLog(todoId, 'add_attachment', { attachmentName: name })
  saveToStorage()
  notifyListeners()
  return { success: true, attachment }
}

export function deleteAttachment(todoId, attachmentId) {
  const todo = state.todos.find(t => t.id === todoId)
  if (!todo) return { success: false }

  todo.attachments = todo.attachments.filter(a => a.id !== attachmentId)
  todo.lastEditedAt = new Date().toISOString()
  todo.editCount++

  useQuota()
  addActivityLog(todoId, 'delete_attachment', { attachmentId })
  saveToStorage()
  notifyListeners()
  return { success: true }
}

export function createCategory(name, color) {
  const category = {
    id: generateId('cat'),
    name,
    color
  }
  state.categories.push(category)
  saveToStorage()
  notifyListeners()
  return category
}

export function updateCategory(id, updates) {
  const category = state.categories.find(c => c.id === id)
  if (!category) return { success: false }

  Object.assign(category, updates)
  saveToStorage()
  notifyListeners()
  return { success: true, category }
}

export function deleteCategory(id) {
  state.categories = state.categories.filter(c => c.id !== id)
  state.todos.forEach(todo => {
    if (todo.categoryId === id) {
      todo.categoryId = 'cat-other'
    }
  })
  saveToStorage()
  notifyListeners()
  return { success: true }
}

export function getCategoryById(id) {
  return state.categories.find(c => c.id === id)
}

export function getFilteredTodos(filters) {
  let todos = state.todos.filter(t => t.status !== TODO_STATUSES.DELETED)

  if (filters.categories && filters.categories.length > 0) {
    todos = todos.filter(t => filters.categories.includes(t.categoryId))
  }

  if (filters.priorities && filters.priorities.length > 0) {
    todos = todos.filter(t => filters.priorities.includes(t.priority))
  }

  if (filters.statuses && filters.statuses.length > 0) {
    todos = todos.filter(t => filters.statuses.includes(t.status))
  }

  if (filters.search) {
    const q = filters.search.toLowerCase()
    todos = todos.filter(t =>
      t.title.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q))
    )
  }

  return todos
}

export function sortTodos(todos, sortBy) {
  const sorted = [...todos]

  switch (sortBy) {
    case 'dueDate':
      sorted.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        const aOverdue = isOverdue(a)
        const bOverdue = isOverdue(b)
        if (aOverdue && !bOverdue) return -1
        if (!aOverdue && bOverdue) return 1
        return new Date(a.dueDate) - new Date(b.dueDate)
      })
      break
    case 'createdAt':
      sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      break
    case 'priority':
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      sorted.sort((a, b) => {
        const aOverdue = isOverdue(a)
        const bOverdue = isOverdue(b)
        if (aOverdue && !bOverdue) return -1
        if (!aOverdue && bOverdue) return 1
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      })
      break
    default:
      break
  }

  return sorted
}

export function isOverdue(todo) {
  if (!todo.dueDate) return false
  if (todo.status === TODO_STATUSES.COMPLETED || todo.status === TODO_STATUSES.CANCELLED) return false
  const due = new Date(todo.dueDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return due < today
}

export function getDaysRemaining(todo) {
  if (!todo.dueDate) return null
  const due = new Date(todo.dueDate)
  due.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24))
  return diff
}

export function getStats() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const endOfWeek = new Date(today)
  endOfWeek.setDate(today.getDate() + (7 - today.getDay()))
  endOfWeek.setHours(23, 59, 59, 999)

  const activeTodos = state.todos.filter(t =>
    t.status !== TODO_STATUSES.COMPLETED &&
    t.status !== TODO_STATUSES.CANCELLED &&
    t.status !== TODO_STATUSES.ARCHIVED &&
    t.status !== TODO_STATUSES.DELETED
  )

  const dueToday = activeTodos.filter(t => {
    if (!t.dueDate) return false
    const due = new Date(t.dueDate)
    due.setHours(0, 0, 0, 0)
    return due.getTime() === today.getTime()
  })

  const dueThisWeek = activeTodos.filter(t => {
    if (!t.dueDate) return false
    const due = new Date(t.dueDate)
    return due >= today && due <= endOfWeek
  })

  const completedTodos = state.todos.filter(t => t.status === TODO_STATUSES.COMPLETED)
  const lastCompleted = completedTodos.length > 0
    ? completedTodos.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0]
    : null

  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay())
  const completedThisWeek = completedTodos.filter(t =>
    new Date(t.completedAt) >= weekStart
  )

  return {
    dueTodayCount: dueToday.length,
    dueThisWeekCount: dueThisWeek.length,
    lastCompletedTime: lastCompleted ? lastCompleted.completedAt : null,
    lastCompletedTitle: lastCompleted ? lastCompleted.title : null,
    completedThisWeekCount: completedThisWeek.length,
    totalActive: activeTodos.length,
    totalCompleted: completedTodos.length
  }
}

export function exportData() {
  const data = {
    todos: state.todos,
    categories: state.categories,
    activityLog: state.activityLog,
    settings: state.settings,
    trash: state.trash,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString()
  }
  return JSON.stringify(data, null, 2)
}

export function importData(jsonStr, conflictStrategy = 'keep_local') {
  try {
    const data = JSON.parse(jsonStr)
    if (!data.todos || !Array.isArray(data.todos)) {
      return { success: false, error: '无效的备份文件' }
    }

    const existingIds = new Set(state.todos.map(t => t.id))
    let importedCount = 0
    let conflictCount = 0

    for (const todo of data.todos) {
      if (existingIds.has(todo.id)) {
        conflictCount++
        if (conflictStrategy === 'overwrite') {
          const idx = state.todos.findIndex(t => t.id === todo.id)
          if (idx !== -1) {
            state.todos[idx] = todo
            importedCount++
          }
        } else {
          const newTodo = { ...todo, id: generateId() }
          state.todos.push(newTodo)
          importedCount++
        }
      } else {
        state.todos.push(todo)
        importedCount++
        existingIds.add(todo.id)
      }
    }

    if (data.categories && Array.isArray(data.categories)) {
      const catIds = new Set(state.categories.map(c => c.id))
      for (const cat of data.categories) {
        if (!catIds.has(cat.id)) {
          state.categories.push(cat)
        }
      }
    }

    saveToStorage()
    notifyListeners()
    return { success: true, importedCount, conflictCount }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

export function updateSettings(updates) {
  state.settings = { ...state.settings, ...updates }
  saveToStorage()
  notifyListeners()
  return state.settings
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return { granted: false, error: '浏览器不支持通知' }
  }

  if (state.settings.notificationsEnabled === false && state.settings.notificationsAsked) {
    return { granted: false, error: '用户已拒绝通知权限' }
  }

  const permission = await Notification.requestPermission()
  const granted = permission === 'granted'

  state.settings.notificationsEnabled = granted
  state.settings.notificationsAsked = true
  saveToStorage()

  return { granted }
}

export function checkReminders() {
  const now = new Date()
  const dueReminders = []

  for (const todo of state.todos) {
    if (todo.reminderTime && !todo.reminderShown && todo.status !== TODO_STATUSES.COMPLETED && todo.status !== TODO_STATUSES.CANCELLED) {
      const reminderTime = new Date(todo.reminderTime)
      if (reminderTime <= now) {
        dueReminders.push(todo)
        todo.reminderShown = true
      }
    }
  }

  if (dueReminders.length > 0) {
    if (state.settings.notificationsEnabled && 'Notification' in window) {
      showNotificationsQueue(dueReminders)
    } else {
      dueReminders.forEach(todo => {
        state.missedReminders.push({
          id: generateId('reminder'),
          todoId: todo.id,
          title: todo.title,
          message: '提醒时间已到',
          timestamp: todo.reminderTime,
          type: 'reminder'
        })
      })
    }
    saveToStorage()
    notifyListeners()
  }

  return dueReminders
}

function showNotificationsQueue(todos) {
  if (todos.length === 0) return

  let index = 0
  function showNext() {
    if (index >= todos.length) return
    const todo = todos[index]
    try {
      new Notification('待办提醒', {
        body: todo.title,
        tag: todo.id
      })
    } catch (e) {
      state.missedReminders.push({
        id: generateId('reminder'),
        todoId: todo.id,
        title: todo.title,
        message: '提醒时间已到',
        timestamp: todo.reminderTime,
        type: 'reminder'
      })
    }
    index++
    setTimeout(showNext, 3000)
  }
  showNext()
}

export function clearMissedReminder(id) {
  state.missedReminders = state.missedReminders.filter(r => r.id !== id)
  saveToStorage()
  notifyListeners()
}

export function clearAllMissedReminders() {
  state.missedReminders = []
  saveToStorage()
  notifyListeners()
}

export function processOverdueTasks() {
  const now = new Date()
  let changed = false

  for (const todo of state.todos) {
    if (todo.status === TODO_STATUSES.IN_PROGRESS && todo.dueDate) {
      const dueDate = new Date(todo.dueDate)
      const diffDays = Math.ceil((now - dueDate) / (1000 * 60 * 60 * 24))
      if (diffDays > 30 && todo.status !== TODO_STATUSES.OVERDUE) {
        todo.status = TODO_STATUSES.OVERDUE
        addActivityLog(todo.id, 'status_change', {
          from: 'in_progress',
          to: 'overdue',
          reason: '超过截止日期30天自动转逾期'
        })
        changed = true
      }
    }

    if (todo.status === TODO_STATUSES.COMPLETED && todo.completedAt) {
      const completedAt = new Date(todo.completedAt)
      const diffDays = Math.ceil((now - completedAt) / (1000 * 60 * 60 * 24))
      if (diffDays >= 27 && diffDays < 30) {
        if (!todo.archiveWarningShown) {
          todo.archiveWarningShown = true
          state.missedReminders.push({
            id: generateId('reminder'),
            todoId: todo.id,
            title: '任务即将归档',
            message: `任务「${todo.title}」即将在 ${30 - diffDays} 天后归档`,
            timestamp: now.toISOString(),
            type: 'archive_warning'
          })
          changed = true
        }
      }
      if (diffDays >= 30 && !todo.archivedAt) {
        todo.status = TODO_STATUSES.ARCHIVED
        todo.archivedAt = now.toISOString()
        addActivityLog(todo.id, 'archive', { reason: '完成30天后自动归档' })
        changed = true
      }
    }
  }

  if (changed) {
    saveToStorage()
    notifyListeners()
  }
}

export function markSleepingTasks() {
  const now = new Date()
  let changed = false

  for (const todo of state.todos) {
    if (todo.status === TODO_STATUSES.COMPLETED || todo.status === TODO_STATUSES.ARCHIVED) continue

    const lastEdited = new Date(todo.lastEditedAt)
    const daysSinceEdit = Math.ceil((now - lastEdited) / (1000 * 60 * 60 * 24))

    if (daysSinceEdit >= 90 && !todo.isSleeping) {
      todo.isSleeping = true
      changed = true
    }

    if (daysSinceEdit >= 365 && todo.categoryId !== 'cat-sleeping') {
      todo.categoryId = 'cat-sleeping'
      changed = true
    }
  }

  if (changed) {
    if (!state.categories.find(c => c.id === 'cat-sleeping')) {
      state.categories.push({ id: 'cat-sleeping', name: '沉睡', color: '#9ca3af' })
    }
    saveToStorage()
    notifyListeners()
  }
}

export function canStartProgress(todo) {
  if (!todo.dueDate) return true
  const dueDate = new Date(todo.dueDate)
  const now = new Date()
  const diffDays = Math.ceil((now - dueDate) / (1000 * 60 * 60 * 24))
  return diffDays <= 7
}

export function getActivityLogForTodo(todoId) {
  return state.activityLog.filter(log => log.todoId === todoId)
}

let broadcastChannel = null
if (typeof BroadcastChannel !== 'undefined') {
  try {
    broadcastChannel = new BroadcastChannel('todo-sync')
    broadcastChannel.onmessage = (event) => {
      if (event.data && event.data.type === 'todo_updated') {
        const remoteTodo = event.data.todo
        const localTodo = state.todos.find(t => t.id === remoteTodo.id)
        if (localTodo) {
          const remoteEdited = new Date(remoteTodo.lastEditedAt)
          const localEdited = new Date(localTodo.lastEditedAt)
          if (remoteEdited > localEdited) {
            const idx = state.todos.findIndex(t => t.id === remoteTodo.id)
            state.todos[idx] = remoteTodo
            saveToStorage()
            notifyListeners()
          }
        }
      }
    }
  } catch (e) {
    console.log('BroadcastChannel not supported')
  }
}

export function broadcastTodoUpdate(todo) {
  if (broadcastChannel) {
    broadcastChannel.postMessage({ type: 'todo_updated', todo })
  }
}

window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY || e.key === SETTINGS_KEY) {
    loadFromStorage()
    notifyListeners()
  }
})

export function initStore() {
  loadFromStorage()
  purgeOldTrash()
  processOverdueTasks()
  markSleepingTasks()
  checkReminders()
}

export { generateId, TODO_STATUSES as STATUSES }
