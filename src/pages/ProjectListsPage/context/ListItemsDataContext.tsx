import { createContext, useContext, ReactNode, useMemo, useCallback } from 'react'
import { EntityListItem } from '@shared/api'
import { ProjectDataContextProps, useProjectDataContext } from '@shared/containers/ProjectTreeTable'
import { Filter } from '@ynput/ayon-react-components'
import { useUserProjectConfig } from '@shared/hooks'
import useGetListItemsData from '../hooks/useGetListItemsData'
import { useListsContext } from './ListsContext'
import {
  FolderNodeMap,
  TableRow,
  TaskNodeMap,
  useGetEntityTypeData,
} from '@shared/containers/ProjectTreeTable'
import { functionalUpdate, OnChangeFn, SortingState } from '@tanstack/react-table'
import useDeleteListItems, { UseDeleteListItemsReturn } from '../hooks/useDeleteListItems'
import { ContextMenuItemConstructors } from '@shared/containers/ProjectTreeTable/hooks/useCellContextMenu'
import { useEntityListsContext } from './EntityListsContext'
import useReorderListItem, { UseReorderListItemReturn } from '../hooks/useReorderListItem'

export type ListItemsMap = Map<string, EntityListItem>

export interface ListItemsDataContextValue {
  // Project Info
  projectInfo?: ProjectDataContextProps['projectInfo']
  projectName: string
  users: ProjectDataContextProps['users']
  selectedListId?: string
  // Attributes
  attribFields: ProjectDataContextProps['attribFields']

  // LIST ITEMS DATA
  listItemsData: EntityListItem[]
  listItemsTableData: TableRow[]
  listItemsMap: ListItemsMap
  fetchNextPage: () => void
  isLoadingAll: boolean
  isLoadingMore: boolean
  isError?: boolean
  isInitialized: boolean
  // filters
  listItemsFilters: Filter[]
  setListItemsFilters: (filters: Filter[]) => Promise<void>
  // folders data
  foldersMap: FolderNodeMap
  tasksMap: TaskNodeMap
  // column sorting
  sorting: SortingState
  updateSorting: OnChangeFn<SortingState>
  // actions
  contextMenuItems: ContextMenuItemConstructors
  // delete (remove) from list
  deleteListItems: UseDeleteListItemsReturn['deleteListItems']
  deleteListItemAction: UseDeleteListItemsReturn['deleteListItemAction']
  // reorder list item
  reorderListItem: UseReorderListItemReturn['reorderListItem']
  // reset filters
  resetFilters: () => void
}

const ListItemsDataContext = createContext<ListItemsDataContextValue | undefined>(undefined)

interface ListItemsDataProviderProps {
  children: ReactNode
}

// fetch all items and provide methods to update the items
export const ListItemsDataProvider = ({ children }: ListItemsDataProviderProps) => {
  // Get project data from the new context
  const {
    projectName,
    projectInfo,
    attribFields,
    users,
    isInitialized,
    isLoading: isLoadingData,
  } = useProjectDataContext()

  const getEntityTypeData = useGetEntityTypeData({ projectInfo })

  const { selectedList } = useListsContext()
  const selectedListId = selectedList?.id

  const selectors = ['lists', projectName, selectedList?.label]

  const [pageConfig, updatePageConfig, { isSuccess: columnsConfigReady }] = useUserProjectConfig({
    selectors,
  })

  const listItemsFilters = pageConfig?.filters || ([] as Filter[])
  const setListItemsFilters = async (filters: Filter[]) => {
    await updatePageConfig({ filters })
  }

  const { columnSorting = [] } = pageConfig as {
    columnSorting: SortingState
  }
  const setColumnSorting = async (sorting: SortingState) => {
    await updatePageConfig({ columnSorting: sorting })
  }

  // update in user preferences
  const updateSorting: OnChangeFn<SortingState> = (sortingUpdater) => {
    setColumnSorting(functionalUpdate(sortingUpdater, columnSorting))
  }

  const resetFilters = useCallback(() => {
    updatePageConfig({
      filters: [],
      columnSorting: [],
    })
  }, [pageConfig, updatePageConfig])

  const {
    data: listItemsData,
    isLoading,
    isFetchingNextPage,
    isError,
    fetchNextPage,
  } = useGetListItemsData({
    projectName,
    entityType: selectedList?.entityType,
    listId: selectedListId,
    sorting: columnSorting,
    filters: listItemsFilters,
  })

  // convert to a Map for easier access
  const listItemsMap: ListItemsMap = useMemo(() => {
    return new Map(listItemsData.map((item) => [item.id, item]))
  }, [listItemsData])

  const extractPath = (item: EntityListItem, entityType: string): string => {
    switch (entityType) {
      case 'folder':
        return item.path || ''
      case 'task':
        return item.folder?.path || ''
      case 'product':
        return item.folder?.path || ''
      case 'version':
        return item.product?.folder?.path || '' + item.task?.name || ''
      default:
        return ''
    }
  }

  const extractSubTypes = (
    item: EntityListItem,
    entityType?: string,
  ): {
    subType?: string
    folderType?: string
    taskType?: string
    productType?: string
  } => {
    switch (entityType) {
      case 'folder':
        return { subType: item.folderType, folderType: item.folderType }
      case 'task':
        return {
          subType: item.taskType,
          taskType: item.taskType,
          folderType: item.folder?.folderType,
        }
      case 'product':
        return { subType: item.productType || '', folderType: item.folder?.folderType }
      case 'version':
        return {
          subType: undefined,
          productType: item.product?.productType,
          folderType: item.product?.folder?.folderType,
          taskType: item.task?.taskType,
        }
      default:
        return {}
    }
  }

  // filter out attribFields by scope
  const scopedAttribFields = useMemo(
    () =>
      attribFields.filter((field) =>
        [selectedList?.entityType].some((s: any) => field.scope?.includes(s)),
      ),
    [attribFields, selectedList?.entityType],
  )

  // convert listItemsData into tableData
  const listItemsTableData = useMemo(() => {
    const tableRows: TableRow[] = listItemsData.map((item) => ({
      id: item.id,
      name: item.name,
      label:
        (item.entityType === 'version' ? `${item.product?.name} - ` : '') +
        (item.label || item.name),
      entityId: item.entityId,
      entityType: item.entityType,
      assignees: item.assignees || [],
      ...extractSubTypes(item, item.entityType), // subType, folderType, taskType, productType
      updatedAt: item.updatedAt,
      attrib: item.attrib,
      ownAttrib: item.ownAttrib || Object.keys(item.attrib),
      icon: getEntityTypeData(item.entityType, extractSubTypes(item, item.entityType).subType)
        ?.icon,
      path: extractPath(item, item.entityType),
      tags: item.tags,
      status: item.status,
      subRows: [],
    }))

    return tableRows
  }, [listItemsData])

  const foldersMap: FolderNodeMap = new Map(
    // @ts-ignore
    listItemsData.filter((item) => item.entityType === 'folder'),
  )
  const tasksMap: TaskNodeMap = new Map()

  // delete lists
  const { deleteListItems, deleteListItemMenuItem, deleteListItemAction } = useDeleteListItems({
    projectName: projectName,
    listId: selectedListId,
    listItemsMap,
  })

  const handleReorderFinished = () => {
    // remove any sorting
    setColumnSorting([])
  }

  // reorder lists item
  const { reorderListItem } = useReorderListItem({
    projectName: projectName,
    listId: selectedListId,
    listItems: listItemsData,
    onReorderFinished: handleReorderFinished,
  })

  // lists data
  const { menuItems: menuItemsAddToList } = useEntityListsContext()

  // inject in custom add to list context menu items
  const contextMenuItems: ContextMenuItemConstructors = [
    'copy-paste',
    'show-details',
    deleteListItemMenuItem,
    // add context menu to add to lists but filter out own list
    menuItemsAddToList((item) => item.id !== selectedListId),
  ]

  return (
    <ListItemsDataContext.Provider
      value={{
        projectName,
        projectInfo,
        selectedListId,
        attribFields: scopedAttribFields,
        users,
        // list items
        listItemsData,
        listItemsTableData,
        listItemsMap,
        isLoadingAll: isLoading || !columnsConfigReady || isLoadingData,
        isLoadingMore: isFetchingNextPage,
        isError,
        fetchNextPage,
        // filters
        listItemsFilters,
        setListItemsFilters,
        // folders data
        foldersMap,
        tasksMap,
        isInitialized,
        // sorting
        sorting: columnSorting,
        updateSorting,
        // actions
        contextMenuItems,
        // delete (remove) from list
        deleteListItems,
        deleteListItemAction,
        // reorder list item
        reorderListItem,
        resetFilters,
      }}
    >
      {children}
    </ListItemsDataContext.Provider>
  )
}

export const useListItemsDataContext = () => {
  const context = useContext(ListItemsDataContext)
  if (context === undefined) {
    throw new Error('useListItemsDataContext must be used within a ListItemsDataProvider')
  }
  return context
}

export default ListItemsDataContext
