import { useState, useEffect, useRef, useMemo } from 'preact/hooks'
import {
  createTodo,
  updateTodo,
  deleteTodo,
  getCategoryById,
  getFilteredTodos,
  sortTodos,
  isOverdue,
  getDaysRemaining,
  getStats,
  PRIORITY_COLORS,
  PRIORITIES,
  TODO_STATUSES,
  REPEAT_TYPES,
  getState,
  useStore,
  clearAllMissedReminders
} from '../store.js'
import AdvancedAddModal from './AdvancedAddModal.jsx'
import VirtualList from './VirtualList.jsx'

const priorityLabels = {
  high: '高',
  medium: '中',
  low: '低'
}

const priorityEmojis = {
  high: '🔴',
  medium: '🟡',
  low: '🔵'
}

export default function TodoList({ onSelectTodo }) {
  const [todos, setTodos] = useState([])
  const [categories, setCategories] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [stats, setStats] = useState({})
  const [missedReminders, setMissedReminders] = useState([])
  const [showMissedReminders, setShowMissedReminders] = useState(false)
  const [collapseCompleted, setCollapseCompleted] = useState(true)
  const [includeArchived, setIncludeArchived] = useState(false)
  const [isReadOnly, setIsReadOnly] = useState(false)

  const [filters, setFilters] = useState({
    categories: [],
    priorities: [],
    statuses: [TODO_STATUSES.TODO, TODO_STATUSES.IN_PROGRESS],
    search: ''
  })

  const [sortBy, setSortBy] = useState('dueDate')

  const store = useStore()

  const applyFilters = (currentFilters, includeArchivedFlag) => {
    let filtered = getFilteredTodos(currentFilters)
    if (!includeArchivedFlag) {
      filtered = filtered.filter(t => t.status !== TODO_STATUSES.ARCHIVED)
    }
    return sortTodos(filtered, sortBy)
  }

  const checkReadOnly = (settings) => {
    if (settings.subscribed) return false
    return settings.quotaUsed >= settings.operationQuota
  }

  useEffect(() => {
    const state = getState()
    setCategories(state.categories)
    setCollapseCompleted(state.settings.collapseCompleted)
    setMissedReminders(state.missedReminders)
    setIsReadOnly(checkReadOnly(state.settings))

    const filtered = applyFilters(filters, includeArchived)
    setTodos(filtered)
    setStats(getStats())

    const unsubscribe = store.subscribe((newState) => {
      setCategories(newState.categories)
      setMissedReminders(newState.missedReminders)
      setCollapseCompleted(newState.settings.collapseCompleted)
      setIsReadOnly(checkReadOnly(newState.settings))

      const newFiltered = applyFilters(filters, includeArchived)
      setTodos(newFiltered)
      setStats(getStats())
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const filtered = applyFilters(filters, includeArchived)
    setTodos(filtered)
  }, [filters, sortBy, includeArchived])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      const result = createTodo(inputValue)
      if (result.success) {
        setInputValue('')
      } else {
        alert(result.error)
      }
    }
  }

  const handleToggleComplete = (e, todo) => {
    e.stopPropagation()
    const newStatus = todo.status === TODO_STATUSES.COMPLETED
      ? TODO_STATUSES.TODO
      : TODO_STATUSES.COMPLETED
    updateTodo(todo.id, { status: newStatus })
  }

  const handleDelete = (e, todoId) => {
    e.stopPropagation()
    if (confirm('确定要删除这个任务吗？')) {
      deleteTodo(todoId, 'trash')
    }
  }

  const toggleFilter = (type, value) => {
    setFilters(prev => {
      const current = prev[type]
      if (current.includes(value)) {
        return { ...prev, [type]: current.filter(v => v !== value) }
      } else {
        return { ...prev, [type]: [...current, value] }
      }
    })
  }

  const clearAllFilters = () => {
    setFilters({
      categories: [],
      priorities: [],
      statuses: [TODO_STATUSES.TODO, TODO_STATUSES.IN_PROGRESS],
      search: ''
    })
    setSearchQuery('')
  }

  const handleSearchChange = (e) => {
    const val = e.target.value
    setSearchQuery(val)
    setFilters(prev => ({ ...prev, search: val }))
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'f' && !e.target.matches('input, textarea')) {
        e.preventDefault()
        setShowFilters(true)
        setTimeout(() => {
          const searchInput = document.getElementById('search-input')
          if (searchInput) searchInput.focus()
        }, 100)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const { activeTodos, completedTodos } = useMemo(() => {
    const active = todos.filter(t =>
      t.status !== TODO_STATUSES.COMPLETED &&
      t.status !== TODO_STATUSES.CANCELLED &&
      t.status !== TODO_STATUSES.ARCHIVED
    )
    const completed = todos.filter(t => t.status === TODO_STATUSES.COMPLETED)
    return { activeTodos: active, completedTodos: completed }
  }, [todos])

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const month = date.getMonth() + 1
    const day = date.getDate()
    return `${month}月${day}日`
  }

  const formatLastCompleted = (dateStr) => {
    if (!dateStr) return '暂无'
    const date = new Date(dateStr)
    const now = new Date()
    const diff = Math.floor((now - date) / 1000)
    if (diff < 60) return `${diff}秒前`
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
    return `${Math.floor(diff / 86400)}天前`
  }

  const getDueLabel = (todo) => {
    const days = getDaysRemaining(todo)
    if (days === null) return ''
    if (isOverdue(todo)) return `过期 ${Math.abs(days)} 天`
    if (days === 0) return '今天到期'
    if (days === 1) return '明天到期'
    return `${days} 天后到期`
  }

  const getDueClass = (todo) => {
    if (!todo.dueDate) return ''
    if (isOverdue(todo)) return 'due-overdue'
    const days = getDaysRemaining(todo)
    if (days <= 1) return 'due-soon'
    return 'due-normal'
  }

  const renderTodoItem = (todo) => {
    const category = getCategoryById(todo.categoryId)
    const overdue = isOverdue(todo)
    const isCompleted = todo.status === TODO_STATUSES.COMPLETED
    const isCancelled = todo.status === TODO_STATUSES.CANCELLED
    const isSleeping = todo.isSleeping

    return (
      <div
        className={`todo-item ${isCompleted ? 'completed' : ''} ${isCancelled ? 'cancelled' : ''} ${overdue ? 'overdue' : ''} ${isSleeping ? 'sleeping' : ''}`}
        onClick={() => onSelectTodo(todo.id)}
      >
        <div className="todo-checkbox" onClick={(e) => handleToggleComplete(e, todo)}>
          <input type="checkbox" checked={isCompleted} readOnly />
        </div>

        <div className="todo-content">
          <div className="todo-title-row">
            <span className="todo-title">{todo.title}</span>
            <span
              className="priority-badge"
              style={{ backgroundColor: PRIORITY_COLORS[todo.priority] }}
              title={`优先级: ${priorityLabels[todo.priority]}`}
            >
              {priorityEmojis[todo.priority]}
            </span>
          </div>

          <div className="todo-meta">
            {category && (
              <span
                className="category-tag"
                style={{ backgroundColor: category.color + '20', color: category.color }}
              >
                <span className="category-dot" style={{ backgroundColor: category.color }}></span>
                {category.name}
              </span>
            )}

            {todo.dueDate && (
              <span className={`due-date ${getDueClass(todo)}`}>
                📅 {formatDate(todo.dueDate)} ({getDueLabel(todo)})
              </span>
            )}

            {todo.subTasks && todo.subTasks.length > 0 && (
              <span className="subtask-count">
                ✓ {todo.subTasks.filter(st => st.completed).length}/{todo.subTasks.length}
              </span>
            )}

            {todo.repeatRule && todo.repeatRule.type !== REPEAT_TYPES.NONE && (
              <span className="repeat-badge">🔁</span>
            )}
          </div>
        </div>

        <button className="delete-btn" onClick={(e) => handleDelete(e, todo.id)}>
          🗑️
        </button>
      </div>
    )
  }

  const hasFilters = filters.categories.length > 0 || filters.priorities.length > 0 || filters.search

  return (
    <div className="todo-list-container">
      {missedReminders.length > 0 && (
        <div className="missed-reminders-banner" onClick={() => setShowMissedReminders(!showMissedReminders)}>
          🔔 {missedReminders.length} 条未送达提醒
          <span className="expand-icon">{showMissedReminders ? '▲' : '▼'}</span>
        </div>
      )}

      {showMissedReminders && missedReminders.length > 0 && (
        <div className="missed-reminders-list">
          {missedReminders.map(reminder => (
            <div key={reminder.id} className="missed-reminder-item">
              <div className="reminder-title">{reminder.title}</div>
              <div className="reminder-message">{reminder.message}</div>
              <div className="reminder-time">{new Date(reminder.timestamp).toLocaleString()}</div>
            </div>
          ))}
          <button className="clear-reminders-btn" onClick={() => {
            clearAllMissedReminders()
          }}>
            清空所有提醒
          </button>
        </div>
      )}

      {isReadOnly && (
        <div className="readonly-banner">
          ⚠️ 本月操作配额已用完，已进入只读模式。可以勾选完成任务，但不能创建或编辑新任务。月底自动重置配额。
        </div>
      )}

      <div className="input-section">
        <input
          type="text"
          className={`todo-input ${isReadOnly ? 'disabled' : ''}`}
          placeholder={isReadOnly ? "只读模式，无法新增待办" : "输入待办事项，按回车添加..."}
          value={inputValue}
          onInput={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isReadOnly}
        />
        <button
          className={`advanced-btn ${isReadOnly ? 'disabled' : ''}`}
          onClick={() => !isReadOnly && setShowAdvanced(true)}
          disabled={isReadOnly}
        >
          ⚙️ 高级添加
        </button>
      </div>

      <div className="filter-bar">
        <button className={`filter-toggle ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}>
          🔍 筛选排序 {hasFilters && <span className="filter-badge">●</span>}
        </button>

        <div className="sort-controls">
          <span className="sort-label">排序：</span>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="dueDate">截止日期</option>
            <option value="createdAt">创建时间</option>
            <option value="priority">优先级</option>
          </select>
        </div>
      </div>

      {showFilters && (
        <div className="filter-panel">
          <div className="filter-section">
            <label className="filter-label">搜索：</label>
            <input
              id="search-input"
              type="text"
              className="search-input"
              placeholder="按 F 键快速聚焦..."
              value={searchQuery}
              onInput={handleSearchChange}
            />
          </div>

          <div className="filter-section">
            <label className="filter-label">分类：</label>
            <div className="filter-chips">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  className={`filter-chip ${filters.categories.includes(cat.id) ? 'active' : ''}`}
                  style={{ borderColor: cat.color }}
                  onClick={() => toggleFilter('categories', cat.id)}
                >
                  <span className="chip-dot" style={{ backgroundColor: cat.color }}></span>
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-section">
            <label className="filter-label">优先级：</label>
            <div className="filter-chips">
              {Object.entries(PRIORITIES).map(([key, value]) => (
                <button
                  key={value}
                  className={`filter-chip ${filters.priorities.includes(value) ? 'active' : ''}`}
                  style={{ borderColor: PRIORITY_COLORS[value] }}
                  onClick={() => toggleFilter('priorities', value)}
                >
                  {priorityEmojis[value]} {priorityLabels[value]}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-section">
            <label className="filter-label">状态：</label>
            <div className="filter-chips">
              <button
                className={`filter-chip ${filters.statuses.includes(TODO_STATUSES.TODO) ? 'active' : ''}`}
                onClick={() => toggleFilter('statuses', TODO_STATUSES.TODO)}
              >
                待办
              </button>
              <button
                className={`filter-chip ${filters.statuses.includes(TODO_STATUSES.IN_PROGRESS) ? 'active' : ''}`}
                onClick={() => toggleFilter('statuses', TODO_STATUSES.IN_PROGRESS)}
              >
                进行中
              </button>
              <button
                className={`filter-chip ${filters.statuses.includes(TODO_STATUSES.COMPLETED) ? 'active' : ''}`}
                onClick={() => toggleFilter('statuses', TODO_STATUSES.COMPLETED)}
              >
                已完成
              </button>
              <button
                className={`filter-chip ${filters.statuses.includes(TODO_STATUSES.CANCELLED) ? 'active' : ''}`}
                onClick={() => toggleFilter('statuses', TODO_STATUSES.CANCELLED)}
              >
                已取消
              </button>
              <button
                className={`filter-chip ${filters.statuses.includes(TODO_STATUSES.OVERDUE) ? 'active' : ''}`}
                onClick={() => toggleFilter('statuses', TODO_STATUSES.OVERDUE)}
              >
                已逾期
              </button>
              <button
                className={`filter-chip ${filters.statuses.includes(TODO_STATUSES.ARCHIVED) ? 'active' : ''}`}
                onClick={() => toggleFilter('statuses', TODO_STATUSES.ARCHIVED)}
              >
                已归档
              </button>
            </div>
          </div>

          <div className="filter-section">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(e) => setIncludeArchived(e.target.checked)}
              />
              显示已归档任务
            </label>
          </div>

          {hasFilters && (
            <button className="clear-filters-btn" onClick={clearAllFilters}>
              清除所有筛选
            </button>
          )}
        </div>
      )}

      <div className="todo-list">
        {activeTodos.length === 0 && completedTodos.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <div className="empty-text">暂无待办事项</div>
            <div className="empty-hint">在上方输入框添加你的第一个任务吧</div>
          </div>
        ) : (
          <>
            {activeTodos.length > 100 ? (
              <VirtualList
                items={activeTodos}
                itemHeight={72}
                renderItem={renderTodoItem}
              />
            ) : (
              <div className="todo-items">
                {activeTodos.map(todo => renderTodoItem(todo))}
              </div>
            )}

            {completedTodos.length > 0 && (
              <div className="completed-section">
                <div
                  className="completed-header"
                  onClick={() => setCollapseCompleted(!collapseCompleted)}
                >
                  <span className="completed-toggle">{collapseCompleted ? '▶' : '▼'}</span>
                  <span className="completed-title">已完成 ({completedTodos.length})</span>
                </div>
                {!collapseCompleted && (
                  <div className="completed-items">
                    {completedTodos.map(todo => renderTodoItem(todo))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="status-bar">
        <div className="status-item">
          <span className="status-count">{stats.dueTodayCount || 0}</span>
          <span className="status-label">今日到期</span>
        </div>
        <div className="status-item">
          <span className="status-count">{stats.dueThisWeekCount || 0}</span>
          <span className="status-label">本周可做</span>
        </div>
        <div className="status-item">
          <span className="status-count">{stats.completedThisWeekCount || 0}</span>
          <span className="status-label">本周完成</span>
        </div>
        <div className="status-item">
          <span className="status-label">最近完成：</span>
          <span className="status-value">
            {stats.lastCompletedTitle
              ? `${stats.lastCompletedTitle} (${formatLastCompleted(stats.lastCompletedTime)})`
              : '暂无'}
          </span>
        </div>
      </div>

      {showAdvanced && (
        <AdvancedAddModal
          onClose={() => setShowAdvanced(false)}
          onAdd={(todoData) => {
            const result = createTodo(todoData.title, todoData)
            if (result.success) {
              setShowAdvanced(false)
            } else {
              alert(result.error)
            }
          }}
          categories={categories}
        />
      )}
    </div>
  )
}
