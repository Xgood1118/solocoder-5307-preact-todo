import { useState, useEffect } from 'preact/hooks'
import TodoList from './components/TodoList.jsx'
import TodoDetail from './components/TodoDetail.jsx'
import SettingsPanel from './components/SettingsPanel.jsx'
import { initStore, getState, checkReminders, processOverdueTasks, markSleepingTasks, useStore, restoreFromTrash } from './store.js'

export default function App() {
  const [view, setView] = useState('list')
  const [selectedTodoId, setSelectedTodoId] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showTrash, setShowTrash] = useState(false)
  const [trashItems, setTrashItems] = useState([])
  const [settings, setSettings] = useState({})

  useEffect(() => {
    initStore()
    const state = getState()
    setSettings(state.settings)
    setTrashItems(state.trash)

    const reminderInterval = setInterval(() => {
      checkReminders()
    }, 60000)

    const dailyInterval = setInterval(() => {
      processOverdueTasks()
      markSleepingTasks()
    }, 3600000)

    const store = useStore()
    const unsubscribe = store.subscribe((state) => {
      setTrashItems(state.trash)
      setSettings(state.settings)
    })

    return () => {
      clearInterval(reminderInterval)
      clearInterval(dailyInterval)
      unsubscribe()
    }
  }, [])

  const handleSelectTodo = (todoId) => {
    setSelectedTodoId(todoId)
    setView('detail')
  }

  const handleBackToList = () => {
    setView('list')
    setSelectedTodoId(null)
  }

  const handleRestoreFromTrash = (id) => {
    restoreFromTrash(id)
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <span className="app-icon">✅</span>
          <h1>待办事项</h1>
        </div>
        <div className="header-actions">
          <button className="header-btn" onClick={() => setShowTrash(!showTrash)} title="回收站">
            🗑️
            {trashItems.length > 0 && (
              <span className="trash-badge">{trashItems.length}</span>
            )}
          </button>
          <button className="header-btn" onClick={() => setShowSettings(!showSettings)} title="设置">
            ⚙️
          </button>
        </div>
      </header>

      <main className="app-main">
        {view === 'list' && <TodoList onSelectTodo={handleSelectTodo} />}
        {view === 'detail' && selectedTodoId && (
          <TodoDetail todoId={selectedTodoId} onBack={handleBackToList} />
        )}
      </main>

      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} settings={settings} />
      )}

      {showTrash && (
        <div className="modal-overlay" onClick={() => setShowTrash(false)}>
          <div className="modal trash-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>回收站</h2>
              <button className="close-btn" onClick={() => setShowTrash(false)}>×</button>
            </div>
            <div className="modal-body">
              {trashItems.length === 0 ? (
                <p className="empty-trash">回收站为空</p>
              ) : (
                <div className="trash-list">
                  {trashItems.map(todo => (
                    <div key={todo.id} className="trash-item">
                      <span className="trash-title">{todo.title}</span>
                      <span className="trash-date">
                        删除于 {new Date(todo.deletedAt).toLocaleDateString()}
                      </span>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleRestoreFromTrash(todo.id)}
                      >
                        恢复
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="trash-hint">删除的任务保留 7 天后自动清除</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
