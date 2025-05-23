import React, { createContext, useContext, ReactNode, useState } from 'react'
import {
  ColumnOrderState,
  ColumnPinningState,
  functionalUpdate,
  OnChangeFn,
  VisibilityState,
  ColumnSizingState,
} from '@tanstack/react-table'

export interface ColumnSettingsContextType {
  // Column Visibility
  columnVisibility: VisibilityState
  setColumnVisibility: (columnVisibility: VisibilityState) => void
  updateColumnVisibility: (columnVisibility: VisibilityState) => void
  columnVisibilityUpdater: OnChangeFn<VisibilityState>

  // Column Pinning
  columnPinning: ColumnPinningState
  setColumnPinning: (columnPinning: ColumnPinningState) => void
  updateColumnPinning: (columnPinning: ColumnPinningState) => void
  columnPinningUpdater: OnChangeFn<ColumnPinningState>

  // Column Order
  columnOrder: ColumnOrderState
  setColumnOrder: (columnOrder: ColumnOrderState) => void
  updateColumnOrder: (columnOrder: ColumnOrderState) => void
  columnOrderUpdater: OnChangeFn<ColumnOrderState>

  // Column Sizing
  columnSizing: ColumnSizingState
  setColumnSizing: (columnSizing: ColumnSizingState) => void
  columnSizingUpdater: OnChangeFn<ColumnSizingState>

  // Global change
  setColumnsConfig: (config: ColumnsConfig) => void
}

const ColumnSettingsContext = createContext<ColumnSettingsContextType | undefined>(undefined)

export type ColumnsConfig = {
  columnVisibility: VisibilityState
  columnOrder: ColumnOrderState
  columnPinning: ColumnPinningState
  columnSizing: ColumnSizingState // Add this
}

interface ColumnSettingsProviderProps {
  children: ReactNode
  config?: Record<string, any>
  onChange: (config: ColumnsConfig) => void
}

export const ColumnSettingsProvider: React.FC<ColumnSettingsProviderProps> = ({
  children,
  config,
  onChange,
}) => {
  const columnsConfig = config as ColumnsConfig
  const {
    columnOrder: columnOrderInit = [],
    columnPinning: columnPinningInit = {},
    columnVisibility = {},
    columnSizing: columnsSizingExternal = {},
  } = columnsConfig

  const columnOrder = [...columnOrderInit]
  const columnPinning = { ...columnPinningInit }
  const defaultOrder = ['thumbnail', 'name', 'subType', 'status', 'tags']
  // for each default column, if it is not in the columnOrder, find the index of the column before it, if none, add to beginning
  defaultOrder.forEach((col, i) => {
    if (!columnOrder.includes(col)) {
      const defaultBefore = defaultOrder[i - 1]
      const columnAfter = defaultOrder[i + 1]
      if (!defaultBefore || !columnOrder.includes(defaultBefore)) {
        // add to beginning
        columnOrder.unshift(col)
      } else {
        // find the index of that column in the columnOrder
        const index = columnOrder.indexOf(defaultBefore)
        // add the item after that column
        columnOrder.splice(index + 1, 0, col)
      }
      if (columnAfter && columnPinning?.left && columnPinning?.left.includes(columnAfter)) {
        // pin the column
        columnPinning.left = [col, ...(columnPinning?.left || [])]
      }
    }
  })

  // DIRECT STATE UPDATES - no side effects
  const setColumnVisibility = (visibility: VisibilityState) => {
    onChange({
      ...columnsConfig,
      columnVisibility: visibility,
    })
  }

  const setColumnOrder = (order: ColumnOrderState) => {
    onChange({
      ...columnsConfig,
      columnOrder: order,
    })
  }

  const setColumnPinning = (pinning: ColumnPinningState) => {
    onChange({
      ...columnsConfig,
      columnPinning: pinning,
    })
  }

  const [internalColumnSizing, setInternalColumnSizing] = useState<ColumnSizingState | null>(null)

  // use internalColumnSizing if it exists, otherwise use the external column sizing
  const columnSizing = internalColumnSizing || columnsSizingExternal

  const resizingTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  const setColumnSizing = (sizing: ColumnSizingState) => {
    setInternalColumnSizing(sizing)

    // if there is a timeout already set, clear it
    if (resizingTimeoutRef.current) {
      clearTimeout(resizingTimeoutRef.current)
    }
    // set a timeout that tracks if the column sizing has finished
    resizingTimeoutRef.current = setTimeout(() => {
      // we have finished resizing now!
      // update the external column sizing
      onChange({
        ...columnsConfig,
        columnSizing: sizing,
      })
      // reset the internal column sizing to not be used anymore
      setInternalColumnSizing(null)
    }, 500)
  }

  // SIDE EFFECT UTILITIES
  const togglePinningOnVisibilityChange = (visibility: VisibilityState) => {
    // ensure that any columns that are now hidden are removed from the pinning
    const newPinning = { ...columnPinning }
    const pinnedColumns = newPinning.left || []
    const hiddenColumns = Object.keys(visibility).filter((col) => visibility[col] === false)
    const newPinnedColumns = pinnedColumns.filter((col) => !hiddenColumns.includes(col))

    return {
      ...newPinning,
      left: newPinnedColumns,
    }
  }

  const updatePinningOrderOnOrderChange = (order: ColumnOrderState) => {
    // ensure that the column pinning is in the order of the column order
    const newPinning = { ...columnPinning }
    const pinnedColumns = newPinning.left || []
    const pinnedColumnsOrder = order.filter((col) => pinnedColumns.includes(col))

    return {
      ...newPinning,
      left: pinnedColumnsOrder,
    }
  }

  const updateOrderOnPinningChange = (pinning: ColumnPinningState) => {
    // we resort the column order based on the pinning
    return [...columnOrder].sort((a, b) => {
      const aPinned = pinning.left?.includes(a) ? 1 : 0
      const bPinned = pinning.left?.includes(b) ? 1 : 0
      return bPinned - aPinned
    })
  }

  // UPDATE METHODS WITH SIDE EFFECTS
  const updateColumnVisibility = (visibility: VisibilityState) => {
    const newPinning = togglePinningOnVisibilityChange(visibility)
    onChange({
      ...columnsConfig,
      columnVisibility: visibility,
      columnPinning: newPinning,
    })
  }

  const updateColumnOrder = (order: ColumnOrderState) => {
    const newPinning = updatePinningOrderOnOrderChange(order)
    onChange({
      ...columnsConfig,
      columnOrder: order,
      columnPinning: newPinning,
    })
  }

  const updateColumnPinning = (pinning: ColumnPinningState) => {
    const newOrder = updateOrderOnPinningChange(pinning)
    onChange({
      ...columnsConfig,
      columnOrder: newOrder,
      columnPinning: pinning,
    })
  }

  // UPDATER FUNCTIONS
  const columnVisibilityUpdater: OnChangeFn<VisibilityState> = (columnVisibilityUpdater) => {
    const newVisibility = functionalUpdate(columnVisibilityUpdater, columnVisibility)
    updateColumnVisibility(newVisibility)
  }

  const columnOrderUpdater: OnChangeFn<ColumnOrderState> = (columnOrderUpdater) => {
    const newOrder = functionalUpdate(columnOrderUpdater, columnOrder)
    updateColumnOrder(newOrder)
  }

  const columnPinningUpdater: OnChangeFn<ColumnPinningState> = (columnPinningUpdater) => {
    const newPinning = functionalUpdate(columnPinningUpdater, columnPinning)
    updateColumnPinning(newPinning)
  }

  const columnSizingUpdater: OnChangeFn<ColumnSizingState> = (sizingUpdater) => {
    const newSizing = functionalUpdate(sizingUpdater, columnSizing)
    setColumnSizing(newSizing)
  }

  return (
    <ColumnSettingsContext.Provider
      value={{
        // column visibility
        columnVisibility,
        setColumnVisibility,
        updateColumnVisibility,
        columnVisibilityUpdater,
        // column pinning
        columnPinning,
        setColumnPinning,
        updateColumnPinning,
        columnPinningUpdater,
        // column order
        columnOrder,
        setColumnOrder,
        updateColumnOrder,
        columnOrderUpdater,
        // column sizing
        columnSizing,
        setColumnSizing,
        columnSizingUpdater,
        // global change
        setColumnsConfig: onChange,
      }}
    >
      {children}
    </ColumnSettingsContext.Provider>
  )
}

export const useColumnSettingsContext = (): ColumnSettingsContextType => {
  const context = useContext(ColumnSettingsContext)
  if (!context) {
    throw new Error('useColumnSettingsContext must be used within a ColumnSettingsProvider')
  }
  return context
}
