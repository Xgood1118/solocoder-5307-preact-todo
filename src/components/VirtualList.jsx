import { useState, useEffect, useRef, useMemo } from 'preact/hooks'

export default function VirtualList({ items, itemHeight, renderItem }) {
  const containerRef = useRef(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateHeight = () => {
      setContainerHeight(container.clientHeight)
    }

    updateHeight()
    const resizeObserver = new ResizeObserver(updateHeight)
    resizeObserver.observe(container)

    return () => resizeObserver.disconnect()
  }, [])

  const handleScroll = (e) => {
    setScrollTop(e.target.scrollTop)
  }

  const totalHeight = items.length * itemHeight

  const visibleCount = Math.ceil(containerHeight / itemHeight) + 4
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - 2)
  const endIndex = Math.min(items.length, startIndex + visibleCount)

  const visibleItems = useMemo(() => {
    return items.slice(startIndex, endIndex)
  }, [items, startIndex, endIndex])

  const offsetY = startIndex * itemHeight

  return (
    <div
      ref={containerRef}
      className="virtual-list-container"
      onScroll={handleScroll}
      style={{ height: 'calc(100vh - 320px)', overflowY: 'auto' }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ position: 'absolute', top: offsetY, width: '100%' }}>
          {visibleItems.map((item, index) => (
            <div
              key={item.id}
              style={{ height: itemHeight }}
            >
              {renderItem(item, startIndex + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
