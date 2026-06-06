import { useState, useEffect } from 'preact/hooks'
import {
  updateSettings,
  exportData,
  importData,
  requestNotificationPermission,
  createCategory,
  updateCategory,
  deleteCategory,
  getState,
  useStore,
  TODO_STATUSES
} from '../store.js'

export default function SettingsPanel({ onClose, settings }) {
  const [localSettings, setLocalSettings] = useState(settings)
  const [categories, setCategories] = useState([])
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState('#3b82f6')
  const [importResult, setImportResult] = useState(null)
  const [stats, setStats] = useState({ total: 0, completed: 0, active: 0 })

  const store = useStore()

  useEffect(() => {
    const state = getState()
    setCategories(state.categories)
    const todos = state.todos
    setStats({
      total: todos.length,
      completed: todos.filter(t => t.status === TODO_STATUSES.COMPLETED).length,
      active: todos.filter(t => t.status !== TODO_STATUSES.COMPLETED && t.status !== TODO_STATUSES.CANCELLED && t.status !== TODO_STATUSES.ARCHIVED).length
    })

    const unsubscribe = store.subscribe((state) => {
      setLocalSettings(state.settings)
      setCategories(state.categories)
      const todos = state.todos
      setStats({
        total: todos.length,
        completed: todos.filter(t => t.status === TODO_STATUSES.COMPLETED).length,
        active: todos.filter(t => t.status !== TODO_STATUSES.COMPLETED && t.status !== TODO_STATUSES.CANCELLED && t.status !== TODO_STATUSES.ARCHIVED).length
      })
    })

    return () => unsubscribe()
  }, [])

  const handleToggleSetting = (key) => {
    const newValue = !localSettings[key]
    updateSettings({ [key]: newValue })
  }

  const handleRequestNotification = async () => {
    const result = await requestNotificationPermission()
    if (result.granted) {
      alert('通知权限已开启')
    } else {
      alert(result.error || '无法获取通知权限')
    }
  }

  const handleExport = () => {
    const data = exportData()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `todo-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result
      if (typeof content !== 'string') return

      const strategy = confirm('检测到任务 ID 冲突时，点击"确定"使用导入版本覆盖，点击"取消"保留本地版本并生成新 ID。')
        ? 'overwrite'
        : 'keep_local'

      const result = importData(content, strategy)
      setImportResult(result)
      setTimeout(() => setImportResult(null), 3000)
    }
    reader.readAsText(file)
  }

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return
    createCategory(newCategoryName.trim(), newCategoryColor)
    setNewCategoryName('')
    setNewCategoryColor('#3b82f6')
  }

  const handleUpdateCategory = (id, updates) => {
    updateCategory(id, updates)
  }

  const handleDeleteCategory = (id) => {
    if (confirm('确定要删除这个分类吗？该分类下的任务将移至"其他"分类。')) {
      deleteCategory(id)
    }
  }

  const colorPresets = [
    '#ef4444', '#f97316', '#f59e0b', '#84cc16',
    '#22c55e', '#10b981', '#14b8a6', '#06b6d4',
    '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6',
    '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
    '#64748b', '#6b7280'
  ]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal settings-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>设置</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="settings-section">
            <h3>概览</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-number">{stats.total}</span>
                <span className="stat-label">总任务数</span>
              </div>
              <div className="stat-card">
                <span className="stat-number">{stats.active}</span>
                <span className="stat-label">进行中</span>
              </div>
              <div className="stat-card">
                <span className="stat-number">{stats.completed}</span>
                <span className="stat-label">已完成</span>
              </div>
            </div>
            {!localSettings.subscribed && (
              <div className="quota-info">
                <span>本月配额：{localSettings.quotaUsed || 0} / {localSettings.operationQuota}</span>
                <div className="quota-bar">
                  <div
                    className="quota-fill"
                    style={{ width: `${Math.min(100, ((localSettings.quotaUsed || 0) / localSettings.operationQuota) * 100)}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>

          <div className="settings-section">
            <h3>通知</h3>
            <div className="setting-item">
              <div className="setting-info">
                <span className="setting-label">浏览器通知</span>
                <span className="setting-desc">到达提醒时间时弹出系统通知</span>
              </div>
              <button
                className={`toggle-btn ${localSettings.notificationsEnabled ? 'active' : ''}`}
                onClick={handleRequestNotification}
              >
                {localSettings.notificationsEnabled ? '已开启' : '未开启'}
              </button>
            </div>
          </div>

          <div className="settings-section">
            <h3>显示</h3>
            <div className="setting-item">
              <div className="setting-info">
                <span className="setting-label">默认折叠已完成</span>
                <span className="setting-desc">列表中已完成的任务默认收起</span>
              </div>
              <button
                className={`toggle-btn ${localSettings.collapseCompleted ? 'active' : ''}`}
                onClick={() => handleToggleSetting('collapseCompleted')}
              >
                {localSettings.collapseCompleted ? '是' : '否'}
              </button>
            </div>
          </div>

          <div className="settings-section">
            <h3>订阅</h3>
            <div className="setting-item">
              <div className="setting-info">
                <span className="setting-label">已订阅 Pro</span>
                <span className="setting-desc">
                  {localSettings.subscribed
                    ? '无限制任务数和操作配额'
                    : `免费版限制 ${localSettings.maxTodos} 条待办，每月 ${localSettings.operationQuota} 次操作`}
                </span>
              </div>
              <button
                className={`toggle-btn ${localSettings.subscribed ? 'active' : ''}`}
                onClick={() => handleToggleSetting('subscribed')}
              >
                {localSettings.subscribed ? '是' : '否'}
              </button>
            </div>
          </div>

          <div className="settings-section">
            <h3>分类管理</h3>
            <div className="category-list">
              {categories.map(cat => (
                <div key={cat.id} className="category-item">
                  <div className="category-info">
                    <span
                      className="category-color-dot"
                      style={{ backgroundColor: cat.color }}
                    ></span>
                    <input
                      type="text"
                      value={cat.name}
                      onInput={e => handleUpdateCategory(cat.id, { name: e.target.value })}
                      className="category-name-input"
                    />
                  </div>
                  <div className="category-actions">
                    <input
                      type="color"
                      value={cat.color}
                      onInput={e => handleUpdateCategory(cat.id, { color: e.target.value })}
                      className="category-color-picker"
                    />
                    {cat.id !== 'cat-other' && (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteCategory(cat.id)}
                      >
                        删除
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="add-category">
              <input
                type="text"
                placeholder="新分类名称"
                value={newCategoryName}
                onInput={e => setNewCategoryName(e.target.value)}
              />
              <div className="color-picker-row">
                {colorPresets.map(color => (
                  <button
                    key={color}
                    className={`color-preset ${newCategoryColor === color ? 'selected' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewCategoryColor(color)}
                  />
                ))}
              </div>
              <button className="btn btn-primary btn-sm" onClick={handleAddCategory}>
                添加分类
              </button>
            </div>
          </div>

          <div className="settings-section">
            <h3>数据管理</h3>
            <div className="data-actions">
              <button className="btn btn-secondary" onClick={handleExport}>
                📤 导出 JSON 备份
              </button>
              <label className="btn btn-secondary">
                📥 导入 JSON 备份
                <input
                  type="file"
                  accept=".json"
                  style={{ display: 'none' }}
                  onChange={handleImport}
                />
              </label>
            </div>
            {importResult && (
              <div className={`import-result ${importResult.success ? 'success' : 'error'}`}>
                {importResult.success
                  ? `导入成功！新增 ${importResult.importedCount} 条任务，${importResult.conflictCount} 条冲突`
                  : `导入失败：${importResult.error}`}
              </div>
            )}
          </div>

          <div className="settings-section">
            <h3>快捷键</h3>
            <ul className="shortcut-list">
              <li><kbd>F</kbd> 聚焦搜索框</li>
              <li><kbd>Enter</kbd> 新增待办（输入框聚焦时）</li>
            </ul>
          </div>

          <div className="settings-section">
            <h3>关于</h3>
            <p className="about-text">
              Preact Todo - 本地待办事项应用<br />
              数据存储在浏览器 localStorage 中，请定期备份
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
