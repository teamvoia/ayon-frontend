import { ColumnDef, FilterFnOption, Row, SortingFn, sortingFns } from '@tanstack/react-table'
import { TableRow } from './types/table'
import { AttributeData, ProjectTableAttribute, BuiltInFieldOptions } from './types'
import { CellWidget, EntityNameWidget, ThumbnailWidget } from './widgets'
import { getCellId, getCellValue } from './utils/cellUtils'
import { TableCellContent } from './ProjectTreeTable.styled'
import clsx from 'clsx'
import { SelectionCell } from './components/SelectionCell'
import RowSelectionHeader from './components/RowSelectionHeader'
import { ROW_SELECTION_COLUMN_ID } from './context/SelectionCellsContext'

const MIN_SIZE = 50

// Wrapper function for sorting that pushes isLoading rows to the bottom
const withLoadingStateSort = (sortFn: SortingFn<any>): SortingFn<any> => {
  return (rowA, rowB, ...args) => {
    // If row loading states differ, prioritize non-loading rows
    if (rowA.original.isLoading !== rowB.original.isLoading) {
      return rowA.original.isLoading ? 1 : -1
    }
    // Otherwise, use the original sort function
    return sortFn(rowA, rowB, ...args)
  }
}

const nameSort: SortingFn<any> = (rowA, rowB) => {
  const labelA = rowA.original.label || rowA.original.name
  const labelB = rowB.original.label || rowB.original.name
  // sort alphabetically by label
  return labelA.localeCompare(labelB)
}
const pathSort: SortingFn<any> = (rowA, rowB) => {
  const labelA = rowA.original.path || rowA.original.name
  const labelB = rowB.original.path || rowB.original.name
  // sort alphabetically by label
  return labelA.localeCompare(labelB)
}

type AttribSortingFn = (rowA: any, rowB: any, columnId: string, attribute?: AttributeData) => number
// sort by the order of the enum options
const attribSort: AttribSortingFn = (rowA, rowB, columnId, attrib) => {
  const valueA = getCellValue(rowA.original, columnId)
  const valueB = getCellValue(rowB.original, columnId)
  // if attrib is defined and has enum options, use them
  if (attrib && attrib.enum) {
    const indexA = attrib.enum.findIndex((o) => o.value === valueA)
    const indexB = attrib.enum.findIndex((o) => o.value === valueB)
    return indexA - indexB < 0 ? 1 : -1
  } else if (attrib?.type === 'datetime') {
    return sortingFns.datetime(rowA, rowB, columnId)
  } else if (attrib?.type === 'boolean') {
    const boolA = valueA === true ? 1 : 0
    const boolB = valueB === true ? 1 : 0
    return boolA - boolB
  } else {
    // default sorting
    return sortingFns.alphanumeric(rowA, rowB, columnId)
  }
}

export type DefaultColumns =
  | typeof ROW_SELECTION_COLUMN_ID
  | 'thumbnail'
  | 'name'
  | 'status'
  | 'subType'
  | 'assignees'
  | 'tags'

export type TreeTableExtraColumn = { column: ColumnDef<TableRow>; position?: number }

export type BuildTreeTableColumnsProps = {
  attribs: ProjectTableAttribute[]
  showHierarchy: boolean
  options: BuiltInFieldOptions
  excluded?: (DefaultColumns | string)[]
  extraColumns?: TreeTableExtraColumn[]
}

const buildTreeTableColumns = ({
  attribs,
  showHierarchy,
  options,
  excluded,
  extraColumns,
}: BuildTreeTableColumnsProps) => {
  const staticColumns: ColumnDef<TableRow>[] = []

  // Helper to check if a column should be included
  const isIncluded = (id: DefaultColumns | string) => !excluded?.includes(id)

  // Conditionally add static columns
  if (isIncluded(ROW_SELECTION_COLUMN_ID)) {
    staticColumns.push({
      id: ROW_SELECTION_COLUMN_ID,
      enableResizing: false,
      enableSorting: false,
      enablePinning: false,
      enableHiding: false,

      header: () => <RowSelectionHeader />,
      cell: () => <SelectionCell />,
      size: 20,
    })
  }

  if (isIncluded('thumbnail')) {
    staticColumns.push({
      id: 'thumbnail',
      header: 'Thumbnail',
      size: 63,
      minSize: 64,
      enableResizing: true,
      enableSorting: false,
      cell: ({ row, table }) => {
        const meta = table.options.meta
        if (!meta) return null
        return (
          <ThumbnailWidget
            entityId={row.original.entityId || row.id}
            entityType={row.original.entityType}
            updatedAt={row.original.updatedAt}
            icon={row.original.icon}
            projectName={meta?.projectName as string}
            className={clsx('thumbnail', {
              loading: row.original.isLoading,
            })}
          />
        )
      },
    })
  }

  if (isIncluded('name')) {
    staticColumns.push({
      id: 'name',
      accessorKey: 'name',
      header: () => 'Folder / Task',
      minSize: MIN_SIZE,
      sortingFn: withLoadingStateSort(showHierarchy ? nameSort : pathSort),
      enableSorting: true,
      enableResizing: true,
      enablePinning: true,
      enableHiding: true,
      cell: ({ row, column, table }) => {
        const meta = table.options.meta
        const cellId = getCellId(row.id, column.id)
        return (
          <TableCellContent
            id={cellId}
            className={clsx('large', row.original.entityType, {
              loading: row.original.isLoading,
              hierarchy: showHierarchy,
            })}
            style={{
              paddingLeft: `calc(${row.depth * 1}rem + 8px)`,
            }}
            tabIndex={0}
          >
            <EntityNameWidget
              id={row.id}
              label={row.original.label}
              name={row.original.name}
              path={!showHierarchy ? row.original.path : undefined}
              showHierarchy={showHierarchy}
              icon={row.original.icon}
              type={row.original.entityType}
              isExpanded={row.getIsExpanded()}
              toggleExpandAll={() => meta?.toggleExpandAll?.([row.id])}
              toggleExpanded={row.getToggleExpandedHandler()}
            />
          </TableCellContent>
        )
      },
    })
  }

  if (isIncluded('status')) {
    staticColumns.push({
      id: 'status',
      accessorKey: 'status',
      minSize: MIN_SIZE,
      header: () => 'Status',
      sortingFn: withLoadingStateSort((a, b, c) =>
        attribSort(a, b, c, { enum: options.status, type: 'string' }),
      ),
      sortDescFirst: true,
      enableSorting: true,
      enableResizing: true,
      enablePinning: true,
      enableHiding: true,
      cell: ({ row, column, table }) => {
        const { value, id, type } = getValueIdType(row, column.id)
        const meta = table.options.meta

        return (
          <CellWidget
            rowId={id}
            className={clsx('status', { loading: row.original.isLoading })}
            columnId={column.id}
            value={value}
            attributeData={{ type: 'string' }}
            options={meta?.options?.status.filter((s) => s.scope?.includes(type))}
            isCollapsed={!!row.original.childOnlyMatch}
            onChange={(value) =>
              meta?.updateEntities?.([{ field: column.id, value, id, type, rowId: id }])
            }
            isReadOnly={meta?.readOnly?.includes(column.id)}
          />
        )
      },
    })
  }

  if (isIncluded('subType')) {
    staticColumns.push({
      id: 'subType',
      accessorKey: 'subType',
      header: () => 'Type',
      minSize: MIN_SIZE,
      enableSorting: true,
      enableResizing: true,
      enablePinning: true,
      enableHiding: true,
      cell: ({ row, column, table }) => {
        const { value, id, type } = getValueIdType(row, column.id)
        const fieldId = type === 'folder' ? 'folderType' : 'taskType'
        const meta = table.options.meta
        return (
          <CellWidget
            rowId={id}
            className={clsx('subType', { loading: row.original.isLoading })}
            columnId={column.id}
            value={value}
            attributeData={{ type: 'string' }}
            options={
              type === 'folder'
                ? meta?.options?.folderType
                : type === 'task'
                ? meta?.options?.taskType
                : []
            }
            isCollapsed={!!row.original.childOnlyMatch}
            onChange={(value) =>
              meta?.updateEntities?.([{ field: fieldId, value, id, type, rowId: row.id }])
            }
            isReadOnly={meta?.readOnly?.includes(column.id)}
          />
        )
      },
    })
  }

  if (isIncluded('assignees')) {
    staticColumns.push({
      id: 'assignees',
      accessorKey: 'assignees',
      header: () => 'Assignees',
      minSize: MIN_SIZE,
      enableSorting: true,
      enableResizing: true,
      enablePinning: true,
      enableHiding: true,
      cell: ({ row, column, table }) => {
        const meta = table.options.meta
        const { value, id, type } = getValueIdType(row, column.id)
        if (type === 'folder')
          return (
            <CellWidget
              rowId={id}
              className={clsx('assignees', { loading: row.original.isLoading })}
              columnId={column.id}
              value=""
              isPlaceholder
            />
          )
        return (
          <CellWidget
            rowId={id}
            className={clsx('assignees', { loading: row.original.isLoading })}
            columnId={column.id}
            value={value}
            attributeData={{ type: 'list_of_strings' }}
            options={meta?.options?.assignee}
            isCollapsed={!!row.original.childOnlyMatch}
            onChange={(value) =>
              meta?.updateEntities?.([{ field: column.id, value, id, type, rowId: row.id }])
            }
            isReadOnly={meta?.readOnly?.includes(column.id)}
            pt={{
              enum: {
                multiSelectClose: value?.length === 0, // close the dropdown on first assignment
                search: true, // enable search at all times
                multipleOverride: false,
              },
            }}
          />
        )
      },
    })
  }

  if (isIncluded('tags')) {
    staticColumns.push({
      id: 'tags',
      accessorKey: 'tags',
      header: () => 'Tags',
      minSize: MIN_SIZE,
      enableSorting: true,
      enableResizing: true,
      enablePinning: true,
      enableHiding: true,
      cell: ({ row, column, table }) => {
        const meta = table.options.meta
        const { value, id, type } = getValueIdType(row, column.id)
        return (
          <CellWidget
            rowId={id}
            className={clsx('tags', { loading: row.original.isLoading })}
            columnId={column.id}
            value={value}
            attributeData={{ type: 'list_of_strings' }}
            options={meta?.options?.tag}
            isCollapsed={!!row.original.childOnlyMatch}
            onChange={(value) =>
              meta?.updateEntities?.([{ field: column.id, value, id, type, rowId: row.id }])
            }
            isReadOnly={meta?.readOnly?.includes(column.id)}
            enableCustomValues
          />
        )
      },
    })
  }

  const attributeColumns: ColumnDef<TableRow>[] = attribs
    .filter((attrib) => {
      const columnId = 'attrib_' + attrib.name
      // Check if the specific attribute column is excluded
      // or if all built-in attributes are excluded and this is a built-in attribute
      if (excluded?.includes(columnId)) return false
      if (attrib.builtin && excluded?.includes('attrib')) return false
      return true
    })
    .map((attrib) => {
      const attribColumn: ColumnDef<TableRow> = {
        id: 'attrib_' + attrib.name,
        accessorKey: 'attrib.' + attrib.name,
        header: () => attrib.data.title || attrib.name,
        minSize: MIN_SIZE,
        filterFn: 'fuzzy' as FilterFnOption<TableRow>,
        sortingFn: withLoadingStateSort((a, b, c) => attribSort(a, b, c, attrib.data)),
        enableSorting: true,
        enableResizing: true,
        enablePinning: true,
        enableHiding: true,
        cell: ({ row, column, table }) => {
          const meta = table.options.meta
          const columnIdParsed = column.id.replace('attrib_', '')
          const { value, id, type } = getValueIdType(row, columnIdParsed, 'attrib')
          const isInherited = !row.original.ownAttrib.includes(columnIdParsed)

          return (
            <CellWidget
              rowId={id}
              className={clsx('attrib', { loading: row.original.isLoading })}
              columnId={column.id}
              value={value}
              attributeData={{ type: attrib.data.type || 'string' }}
              options={attrib.data.enum || []}
              isCollapsed={!!row.original.childOnlyMatch}
              isInherited={isInherited && ['folder', 'task'].includes(type)}
              isReadOnly={
                attrib.readOnly ||
                meta?.readOnly?.some(
                  (id) => id === columnIdParsed || (id === 'attrib' && attrib.builtin),
                )
              }
              onChange={(value) =>
                meta?.updateEntities?.([
                  { field: columnIdParsed, value, id, type, isAttrib: true, rowId: row.id },
                ])
              }
            />
          )
        },
      }
      return attribColumn
    })

  const allColumns = [...staticColumns, ...attributeColumns]

  // Add extra columns if provided
  if (extraColumns) {
    extraColumns.forEach(({ column, position = -1 }) => {
      if (position >= 0 && position < allColumns.length) {
        allColumns.splice(position, 0, column)
      } else {
        allColumns.push(column)
      }
    })
  }

  return allColumns
}

export default buildTreeTableColumns

export const getValueIdType = (
  row: Row<TableRow>,
  field: string,
  nestedField?: keyof TableRow,
): {
  value: any
  id: string
  type: string
} => ({
  value: nestedField
    ? (row.original[nestedField as keyof TableRow] as any)?.[field]
    : (row.original[field as keyof TableRow] as any),
  id: row.id,
  type: row.original.entityType,
})
