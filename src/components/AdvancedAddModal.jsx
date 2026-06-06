import { useState } from 'preact/hooks'
import { PRIORITIES, PRIORITY_COLORS, REPEAT_TYPES } from '../store.js'

const priorityLabels = {
  high: '高',
  medium: '中',
  low: '低'
}

const repeatLabels = {
  none: '不重复',
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
  yearly: '每年',
  custom: '自定义'
}

const weekdayNames = ['日', '一', '二', '三', '四', '五', '六']

export default function AdvancedAddModal({ onClose, onAdd, categories }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState(categories[0]?.id || 'cat-other')
  const [priority, setPriority] = useState(PRIORITIES.MEDIUM)
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [reminderEnabled, setReminderEnabled] = useState(false)
  const [reminderOffset, setReminderOffset] = useState(0)
  const [repeatType, setRepeatType] = useState(REPEAT_TYPES.NONE)
  const [repeatWeekdays, setRepeatWeekdays] = useState([])
  const [repeatDayOfMonth, setRepeatDayOfMonth] = useState(1)
  const [customInterval, setCustomInterval] = useState(1)

  const handleSubmit = () => {
    if (!title.trim()) {
      alert('请输入任务标题')
      return
    }

    let dueDateStr = null
    if (dueDate) {
      const date = new Date(dueDate + (dueTime ? 'T' + dueTime : ''))
      dueDateStr = date.toISOString()
    }

    let reminderTime = null
    if (reminderEnabled && dueDateStr) {
      const due = new Date(dueDateStr)
      due.setMinutes(due.getMinutes() - reminderOffset)
      reminderTime = due.toISOString()
    }

    let repeatRule = { type: repeatType }
    if (repeatType === REPEAT_TYPES.WEEKLY) {
      repeatRule.weekdays = repeatWeekdays
    } else if (repeatType === REPEAT_TYPES.MONTHLY) {
      repeatRule.dayOfMonth = repeatDayOfMonth
    } else if (repeatType === REPEAT_TYPES.CUSTOM) {
      repeatRule.intervalDays = customInterval
    }

    onAdd({
      title: title.trim(),
      description,
      categoryId,
      priority,
      dueDate: dueDateStr,
      reminderTime,
      repeatRule
    })
  }

  const toggleWeekday = (day) => {
    if (repeatWeekdays.includes(day)) {
      setRepeatWeekdays(repeatWeekdays.filter(d => d !== day))
    } else {
      setRepeatWeekdays([...repeatWeekdays, day])
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal advanced-add-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>高级添加待办</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>标题 *</label>
            <input
              type="text"
              value={title}
              onInput={e => setTitle(e.target.value)}
              placeholder="输入任务标题..."
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>描述</label>
            <textarea
              value={description}
              onInput={e => setDescription(e.target.value)}
              placeholder="添加任务描述..."
              rows="3"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>分类</label>
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)}>
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
                    className={`priority-btn ${priority === value ? 'active' : ''}`}
                    style={{ borderColor: PRIORITY_COLORS[value] }}
                    onClick={() => setPriority(value)}
                  >
                    <span className="priority-dot" style={{ backgroundColor: PRIORITY_COLORS[value] }}></span>
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
                value={dueDate}
                onInput={e => setDueDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>截止时间</label>
              <input
                type="time"
                value={dueTime}
                onInput={e => setDueTime(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={reminderEnabled}
                onChange={e => setReminderEnabled(e.target.checked)}
              />
              开启提醒
            </label>
            {reminderEnabled && (
              <select
                value={reminderOffset}
                onChange={e => setReminderOffset(Number(e.target.value))}
                className="reminder-select"
              >
                <option value={0}>准时提醒</option>
                <option value={5}>提前 5 分钟</option>
                <option value={15}>提前 15 分钟</option>
                <option value={30}>提前 30 分钟</option>
                <option value={60}>提前 1 小时</option>
                <option value={1440}>提前 1 天</option>
              </select>
            )}
          </div>

          <div className="form-group">
            <label>重复规则</label>
            <select value={repeatType} onChange={e => setRepeatType(e.target.value)}>
              {Object.entries(REPEAT_TYPES).map(([key, value]) => (
                <option key={value} value={value}>{repeatLabels[value]}</option>
              ))}
            </select>

            {repeatType === REPEAT_TYPES.WEEKLY && (
              <div className="weekday-selector">
                {weekdayNames.map((name, index) => (
                  <button
                    key={index}
                    className={`weekday-btn ${repeatWeekdays.includes(index) ? 'active' : ''}`}
                    onClick={() => toggleWeekday(index)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}

            {repeatType === REPEAT_TYPES.MONTHLY && (
              <div className="monthly-selector">
                <label>每月</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={repeatDayOfMonth}
                  onInput={e => setRepeatDayOfMonth(Number(e.target.value))}
                />
                <span>号</span>
              </div>
            )}

            {repeatType === REPEAT_TYPES.CUSTOM && (
              <div className="custom-selector">
                <label>每</label>
                <input
                  type="number"
                  min="1"
                  value={customInterval}
                  onInput={e => setCustomInterval(Number(e.target.value))}
                />
                <span>天</span>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSubmit}>添加</button>
        </div>
      </div>
    </div>
  )
}
