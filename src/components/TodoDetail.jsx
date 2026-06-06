import { useState, useEffect } from 'preact/hooks'
import {
  updateTodo,
  deleteTodo,
  addSubTask,
  toggleSubTask,
  deleteSubTask,
  addNote,
  addAttachment,
  deleteAttachment,
  getCategoryById,
  getActivityLogForTodo,
  canStartProgress,
  PRIORITY_COLORS,
  PRIORITIES,
  TODO_STATUSES,
  REPEAT_TYPES,
  getState,
  useStore
} from '../store.js'

const priorityLabels = { high: '高', medium: '中', low: '低' }
const statusLabels = {
  draft: '草稿',
  todo: '待办',
  in_progress: '进行中',
  completed: '已完成',
  cancelled: '已取消',
  archived: '已归档',
  overdue: '已逾期',
  deleted: '已删除'
}
const repeatLabels = {
  none: '不重复',
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
  yearly: '每年',
  custom: '自定义'
}

export default function TodoDetail({ todoId, onBack }) {
  const [todo, setTodo] = useState(null)
  const [categories, setCategories] = useState([])
  const [activityLog, setActivityLog] = useState([])
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editPriority, setEditPriority] = useState(PRIORITIES.MEDIUM)
  const [editDueDate, setEditDueDate] = useState('')
  const [editDueTime, setEditDueTime] = useState('')
  const [newSubTask, setNewSubTask] = useState('')
  const [newNote, setNewNote] = useState('')
  const [newAttachmentName, setNewAttachmentName] = useState('')
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('')
  const [showSubTaskModal, setShowSubTaskModal] = useState(false)
  const [activeTab, setActiveTab] = useState('details')
  const [editMode, setEditMode] = useState('all')

  const store = useStore()

  useEffect(() => {
    const state = getState()
    const found = state.todos.find(t => t.id === todoId)
    setTodo(found || null)
    setCategories(state.categories)
    setActivityLog(getActivityLogForTodo(todoId))

    const unsubscribe = store.subscribe((newState) => {
      const updated = newState.todos.find(t => t.id === todoId)
      setTodo(updated || null)
      setActivityLog(getActivityLogForTodo(todoId))
    })

    return () => unsubscribe()
  }, [todoId])

  useEffect(() => {
    if (todo && isEditing) {
      setEditTitle(todo.title)
      setEditDescription(todo.description || '')
      setEditCategory(todo.categoryId)
      setEditPriority(todo.priority)
      if (todo.dueDate) {
        const date = new Date(todo.dueDate)
        setEditDueDate(date.toISOString().split('T')[0])
        setEditDueTime(date.toTimeString().slice(0, 5))
      } else {
        setEditDueDate('')
        setEditDueTime('')
      }
    }
  }, [todo, isEditing])

  if (!todo) {
    return (
      <div className="todo-detail">
        <div className="detail-not-found">
          <p>任务不存在或已被删除</p>
          <button onClick={onBack}>返回列表</button>
        </div>
      </div>
    )
  }

  const category = getCategoryById(todo.categoryId)

  const handleSave = () => {
    let dueDateStr = null
    if (editDueDate) {
      const date = new Date(editDueDate + (editDueTime ? 'T' + editDueTime : ''))
      dueDateStr = date.toISOString()
    }

    const updates = {
      title: editTitle.trim(),
      description: editDescription,
      categoryId: editCategory,
      priority: editPriority,
      dueDate: dueDateStr
    }

    const result = updateTodo(todo.id, updates, editMode)
    if (result.success) {
      setIsEditing(false)
    } else {
      alert(result.error)
    }
  }

  const handleAddSubTask = () => {
    if (newSubTask.trim()) {
      addSubTask(todo.id, newSubTask.trim())
      setNewSubTask('')
    }
  }

  const handleAddNote = () => {
    if (newNote.trim()) {
      addNote(todo.id, newNote.trim())
      setNewNote('')
    }
  }

  const handleAddAttachment = () => {
    if (newAttachmentName.trim() && newAttachmentUrl.trim()) {
      addAttachment(todo.id, newAttachmentName.trim(), newAttachmentUrl.trim())
      setNewAttachmentName('')
      setNewAttachmentUrl('')
    }
  }

  const handleStatusChange = (newStatus) => {
    if (newStatus === TODO_STATUSES.IN_PROGRESS && !canStartProgress(todo)) {
      if (!confirm('该任务已超过截止日期7天，确定要开始吗？')) {
        return
      }
    }
    updateTodo(todo.id, { status: newStatus })
  }

  const handleDelete = () => {
    if (confirm('确定要删除这个任务吗？')) {
      deleteTodo(todo.id, 'trash')
      onBack()
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString('zh-CN')
  }

  const getRepeatText = (rule) => {
    if (!rule || rule.type === REPEAT_TYPES.NONE) return '不重复'
    if (rule.type === REPEAT_TYPES.DAILY) return '每天'
    if (rule.type === REPEAT_TYPES.WEEKLY) {
      if (rule.weekdays && rule.weekdays.length > 0) {
        const names = ['日', '一', '二', '三', '四', '五', '六']
        return '每周 ' + rule.weekdays.map(d => names[d]).join('、')
      }
      return '每周'
    }
    if (rule.type === REPEAT_TYPES.MONTHLY) return `每月 ${rule.dayOfMonth || 1} 号`
    if (rule.type === REPEAT_TYPES.YEARLY) return '每年'
    if (rule.type === REPEAT_TYPES.CUSTOM) return `每 ${rule.intervalDays || 1} 天`
    return '不重复'
  }

  return (
    <div className="todo-detail">
      <div className="detail-header">
        <button className="back-btn" onClick={onBack}>← 返回列表</button>
        <div className="detail-actions">
          {!isEditing ? (
            <>
              <button className="btn btn-secondary" onClick={() => setIsEditing(true)}>
                ✏️ 编辑
              </button>
              <button className="btn btn-danger" onClick={handleDelete}>
                🗑️ 删除
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={() => setIsEditing(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleSave}>
                保存
              </button>
            </>
          )}
        </div>
      </div>

      {isEditing && todo.repeatRule && todo.repeatRule.type !== REPEAT_TYPES.NONE && (
        <div className="edit-mode-selector">
          <span>修改方式：</span>
          <label>
            <input
              type="radio"
              value="single"
              checked={editMode === 'single'}
              onChange={() => setEditMode('single')}
            />
            仅本次
          </label>
          <label>
            <input
              type="radio"
              value="future"
              checked={editMode === 'future'}
              onChange={() => setEditMode('future')}
            />
            本次及以后
          </label>
          <label>
            <input
              type="radio"
              value="all"
              checked={editMode === 'all'}
              onChange={() => setEditMode('all')}
            />
            全部
          </label>
        </div>
      )}

      <div className="detail-tabs">
        <button
          className={`tab-btn ${activeTab === 'details' ? 'active' : ''}`}
          onClick={() => setActiveTab('details')}
        >
          详情
        </button>
        <button
          className={`tab-btn ${activeTab === 'subtasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('subtasks')}
        >
          子任务 ({todo.subTasks?.length || 0})
        </button>
        <button
          className={`tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
          onClick={() => setActiveTab('notes')}
        >
          备注 ({todo.notes?.length || 0})
        </button>
        <button
          className={`tab-btn ${activeTab === 'activity' ? 'active' : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          活动时间线
        </button>
      </div>

      <div className="detail-content">
        {activeTab === 'details' && (
          <div className="details-panel">
            {isEditing ? (
              <div className="edit-form">
                <div className="form-group">
                  <label>标题</label>
                  <input
                    type="text"
                    value={editTitle}
                    onInput={e => setEditTitle(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>描述</label>
                  <textarea
                    value={editDescription}
                    onInput={e => setEditDescription(e.target.value)}
                    rows="4"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>分类</label>
                    <select value={editCategory} onChange={e => setEditCategory(e.target.value)}>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>优先级</label>
                    <div className="priority-selector">
                      {Object.entries(PRIORITIES).map(([key, value]) => (
                        <button
                          key={value}
                          className={`priority-btn ${editPriority === value ? 'active' : ''}`}
                          style={{ borderColor: PRIORITY_COLORS[value] }}
                          onClick={() => setEditPriority(value)}
                        >
                          {priorityLabels[value]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>截止日期</label>
                    <input
                      type="date"
                      value={editDueDate}
                      onInput={e => setEditDueDate(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>截止时间</label>
                    <input
                      type="time"
                      value={editDueTime}
                      onInput={e => setEditDueTime(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="detail-info">
                <h1 className="detail-title">{todo.title}</h1>

                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">状态</span>
                    <span className={`status-badge status-${todo.status}`}>
                      {statusLabels[todo.status]}
                    </span>
                  </div>

                  {category && (
                    <div className="info-item">
                      <span className="info-label">分类</span>
                      <span
                        className="category-tag"
                        style={{ backgroundColor: category.color + '20', color: category.color }}
                      >
                        <span className="category-dot" style={{ backgroundColor: category.color }}></span>
                        {category.name}
                      </span>
                    </div>
                  )}

                  <div className="info-item">
                    <span className="info-label">优先级</span>
                    <span
                      className="priority-badge"
                      style={{ backgroundColor: PRIORITY_COLORS[todo.priority] }}
                    >
                      {priorityLabels[todo.priority]}
                    </span>
                  </div>

                  <div className="info-item">
                    <span className="info-label">截止日期</span>
                    <span className="info-value">{todo.dueDate ? formatDate(todo.dueDate) : '-'}</span>
                  </div>

                  <div className="info-item">
                    <span className="info-label">提醒时间</span>
                    <span className="info-value">{todo.reminderTime ? formatDate(todo.reminderTime) : '未设置'}</span>
                  </div>

                  <div className="info-item">
                    <span className="info-label">重复</span>
                    <span className="info-value">{getRepeatText(todo.repeatRule)}</span>
                  </div>

                  <div className="info-item">
                    <span className="info-label">创建时间</span>
                    <span className="info-value">{formatDate(todo.createdAt)}</span>
                  </div>

                  {todo.completedAt && (
                    <div className="info-item">
                      <span className="info-label">完成时间</span>
                      <span className="info-value">{formatDate(todo.completedAt)}</span>
                    </div>
                  )}

                  {todo.startedAt && (
                    <div className="info-item">
                      <span className="info-label">开始时间</span>
                      <span className="info-value">{formatDate(todo.startedAt)}</span>
                    </div>
                  )}
                </div>

                {todo.description && (
                  <div className="description-section">
                    <h3>描述</h3>
                    <p className="description-text">{todo.description}</p>
                  </div>
                )}

                <div className="status-actions">
                  <h3>状态操作</h3>
                  <div className="status-btn-group">
                    {todo.status === TODO_STATUSES.TODO && (
                      <>
                        <button
                          className="btn btn-primary"
                          onClick={() => handleStatusChange(TODO_STATUSES.IN_PROGRESS)}
                        >
                          ▶️ 开始
                        </button>
                        <button
                          className="btn btn-success"
                          onClick={() => handleStatusChange(TODO_STATUSES.COMPLETED)}
                        >
                          ✓ 完成
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleStatusChange(TODO_STATUSES.CANCELLED)}
                        >
                          ✕ 取消
                        </button>
                      </>
                    )}
                    {todo.status === TODO_STATUSES.IN_PROGRESS && (
                      <>
                        <button
                          className="btn btn-warning"
                          onClick={() => handleStatusChange(TODO_STATUSES.TODO)}
                        >
                          ⏸️ 暂停
                        </button>
                        <button
                          className="btn btn-success"
                          onClick={() => handleStatusChange(TODO_STATUSES.COMPLETED)}
                        >
                          ✓ 完成
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleStatusChange(TODO_STATUSES.CANCELLED)}
                        >
                          ✕ 取消
                        </button>
                      </>
                    )}
                    {todo.status === TODO_STATUSES.COMPLETED && (
                      <button
                        className="btn btn-warning"
                        onClick={() => handleStatusChange(TODO_STATUSES.TODO)}
                      >
                        ↩️ 重新打开
                      </button>
                    )}
                    {todo.status === TODO_STATUSES.CANCELLED && (
                      <button
                        className="btn btn-primary"
                        onClick={() => handleStatusChange(TODO_STATUSES.TODO)}
                      >
                        ↩️ 恢复为待办
                      </button>
                    )}
                    {todo.status === TODO_STATUSES.OVERDUE && (
                      <>
                        <button
                          className="btn btn-success"
                          onClick={() => handleStatusChange(TODO_STATUSES.COMPLETED)}
                        >
                          ✓ 标记完成
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleStatusChange(TODO_STATUSES.CANCELLED)}
                        >
                          ✕ 取消
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {todo.attachments && todo.attachments.length > 0 && (
                  <div className="attachments-section">
                    <h3>附件 ({todo.attachments.length})</h3>
                    <div className="attachment-list">
                      {todo.attachments.map(att => (
                        <div key={att.id} className="attachment-item">
                          <a href={att.url} target="_blank" rel="noopener noreferrer">
                            📎 {att.name}
                          </a>
                          <button
                            className="remove-btn"
                            onClick={() => deleteAttachment(todo.id, att.id)}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="add-attachment-section">
                  <h4>添加附件</h4>
                  <div className="attachment-form">
                    <input
                      type="text"
                      placeholder="附件名称"
                      value={newAttachmentName}
                      onInput={e => setNewAttachmentName(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="链接地址"
                      value={newAttachmentUrl}
                      onInput={e => setNewAttachmentUrl(e.target.value)}
                    />
                    <button className="btn btn-primary" onClick={handleAddAttachment}>
                      添加
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'subtasks' && (
          <div className="subtasks-panel">
            <div className="subtask-input">
              <input
                type="text"
                placeholder="添加子任务..."
                value={newSubTask}
                onInput={e => setNewSubTask(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddSubTask()}
              />
              <button className="btn btn-primary" onClick={handleAddSubTask}>
                添加
              </button>
            </div>

            {todo.subTasks && todo.subTasks.length > 0 ? (
              <div className="subtask-list">
                {todo.subTasks.map(st => (
                  <div key={st.id} className={`subtask-item ${st.completed ? 'completed' : ''}`}>
                    <input
                      type="checkbox"
                      checked={st.completed}
                      onChange={() => toggleSubTask(todo.id, st.id)}
                    />
                    <span className="subtask-title">{st.title}</span>
                    <button
                      className="remove-btn"
                      onClick={() => deleteSubTask(todo.id, st.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-subtasks">
                <p>还没有子任务，添加一个吧</p>
              </div>
            )}

            <div className="subtask-progress">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: todo.subTasks && todo.subTasks.length > 0
                      ? `${(todo.subTasks.filter(st => st.completed).length / todo.subTasks.length) * 100}%`
                      : '0%'
                  }}
                ></div>
              </div>
              <span className="progress-text">
                {todo.subTasks?.filter(st => st.completed).length || 0} / {todo.subTasks?.length || 0} 已完成
              </span>
            </div>
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="notes-panel">
            <div className="note-input">
              <textarea
                placeholder="添加备注..."
                value={newNote}
                onInput={e => setNewNote(e.target.value)}
                rows="3"
              />
              <button className="btn btn-primary" onClick={handleAddNote}>
                添加备注
              </button>
            </div>

            {todo.notes && todo.notes.length > 0 ? (
              <div className="note-list">
                {[...todo.notes].reverse().map(note => (
                  <div key={note.id} className="note-item">
                    <div className="note-content">{note.content}</div>
                    <div className="note-time">{formatDate(note.timestamp)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-notes">
                <p>还没有备注</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="activity-panel">
            {activityLog.length > 0 ? (
              <div className="activity-timeline">
                {activityLog.map(log => (
                  <div key={log.id} className="activity-item">
                    <div className="activity-dot"></div>
                    <div className="activity-content">
                      <div className="activity-header">
                        <span className="activity-action">{getActivityText(log)}</span>
                        <span className="activity-user">{log.user}</span>
                      </div>
                      <div className="activity-time">{formatDate(log.timestamp)}</div>
                      {log.details && log.fields && (
                        <div className="activity-details">
                          {log.fields.map(field => (
                            <div key={field} className="activity-change">
                              <span className="change-field">{field}:</span>
                              <span className="change-old">{String(log.oldValues?.[field] ?? '-')}</span>
                              →
                              <span className="change-new">{String(log.newValues?.[field] ?? '-')}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-activity">
                <p>暂无活动记录</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function getActivityText(log) {
  const actions = {
    create: '创建了任务',
    update: '更新了任务',
    delete: '删除了任务',
    restore: '恢复了任务',
    add_subtask: '添加了子任务',
    toggle_subtask: log.completed ? '完成了子任务' : '取消完成子任务',
    delete_subtask: '删除了子任务',
    add_note: '添加了备注',
    add_attachment: '添加了附件',
    delete_attachment: '删除了附件',
    status_change: '更改了状态',
    archive: '归档了任务',
    repeat_create: '创建了重复任务'
  }
  return actions[log.action] || log.action
}
