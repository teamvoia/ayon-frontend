import { createContext, useContext, useState, ReactNode, useMemo, useCallback } from 'react'
import { RowSelectionState } from '@tanstack/react-table'
import useNewList, { UseNewListReturn } from '../hooks/useNewList'
import {
  useCreateEntityListMutation,
  useDeleteEntityListMutation,
  useUpdateEntityListMutation,
} from '@shared/api'
import type {
  EntityListPatchModel,
  EntityListPostModel,
  EntityList,
  EntityListSummary,
} from '@shared/api'
import { useProjectDataContext } from '@shared/containers/ProjectTreeTable'
import useDeleteList, { UseDeleteListReturn } from '../hooks/useDeleteList'
import useUpdateList, { UseUpdateListReturn } from '../hooks/useUpdateList'
import { useListsDataContext } from './ListsDataContext'
import { useQueryParam, withDefault, QueryParamConfig } from 'use-query-params'

// Custom param for RowSelectionState
const RowSelectionParam: QueryParamConfig<RowSelectionState> = {
  encode: (rowSelection: RowSelectionState | null | undefined) => {
    if (!rowSelection || Object.keys(rowSelection).length === 0) return undefined
    // Convert to array of selected row ids
    const selectedIds = Object.entries(rowSelection)
      .filter(([_, selected]) => selected)
      .map(([id]) => id)
    return selectedIds.join(',')
  },
  decode: (input: string | (string | null)[] | null | undefined) => {
    const str = Array.isArray(input) ? input[0] : input
    if (!str) return {}

    // Convert comma-separated string back to object
    const selectedIds = str.split(',')
    return selectedIds.reduce((acc, id) => ({ ...acc, [id]: true }), {})
  },
}

export interface ListsContextValue {
  rowSelection: RowSelectionState
  setRowSelection: (ids: RowSelectionState) => void
  selectedRows: string[]
  selectedLists: EntityList[]
  selectedList: EntityList | undefined
  // meta
  isReview?: boolean
  // Creating new lists
  newList: UseNewListReturn['newList']
  setNewList: UseNewListReturn['setNewList']
  openNewList: UseNewListReturn['openNewList']
  closeNewList: UseNewListReturn['closeNewList']
  createNewList: UseNewListReturn['createNewList']
  isCreatingList: boolean
  // Updating lists
  renamingList: UseUpdateListReturn['renamingList']
  openRenameList: UseUpdateListReturn['openRenameList']
  closeRenameList: UseUpdateListReturn['closeRenameList']
  submitRenameList: UseUpdateListReturn['submitRenameList']
  // Deleting lists
  deleteLists: UseDeleteListReturn['deleteLists']
  // Info dialog
  infoDialogData: null | EntityList
  setInfoDialogData: (list: EntityList | null) => void
  openDetailsPanel: (id: string) => void
  // Lists filters dialog
  listsFiltersOpen: boolean
  setListsFiltersOpen: React.Dispatch<React.SetStateAction<boolean>>
}

const ListsContext = createContext<ListsContextValue | undefined>(undefined)

interface ListsProviderProps {
  children: ReactNode
  isReview?: boolean
}

export const ListsProvider = ({ children, isReview }: ListsProviderProps) => {
  const { projectName } = useProjectDataContext()
  const { listsMap } = useListsDataContext()

  // Memoize the configurations for the query parameters
  const listParamConfig = useMemo(() => withDefault(RowSelectionParam, {}), [])
  const reviewParamConfig = useMemo(() => withDefault(RowSelectionParam, {}), [])

  const [unstableListSelection, setListSelection] = useQueryParam<RowSelectionState>(
    'list',
    listParamConfig, // Use memoized config
  )
  const [unstableReviewSelection, setReviewSelection] = useQueryParam<RowSelectionState>(
    'review',
    reviewParamConfig, // Use memoized config
  )

  const rowSelection = useMemo(
    () => (isReview ? unstableReviewSelection : unstableListSelection),
    // Simpler dependencies: unstableListSelection and unstableReviewSelection are stable state references
    [unstableListSelection, unstableReviewSelection, isReview],
  )

  const setRowSelection = useCallback(
    (ids: RowSelectionState) => {
      if (isReview) {
        console.log('setReviewSelection', ids)
        setReviewSelection(ids)
      } else {
        console.log('setListSelection', ids)
        setListSelection(ids)
      }
    },
    [isReview, setReviewSelection, setListSelection], // setReviewSelection and setListSelection are stable
  )

  // only rows that are selected
  const selectedRows = useMemo(
    () =>
      Object.entries(rowSelection)
        .filter(([_k, v]) => v)
        .map(([k]) => k),
    [JSON.stringify(rowSelection)],
  )

  const selectedLists = selectedRows.map((id) => listsMap.get(id)).filter((list) => !!list)

  // we can only ever fetch one list at a time
  const selectedList = selectedLists[0]

  // dialogs
  const [listsFiltersOpen, setListsFiltersOpen] = useState(false)

  const [infoDialogData, setInfoDialogData] = useState<ListsContextValue['infoDialogData']>(null)

  const openDetailsPanel = useCallback(
    (id: string) => {
      // get the list from the map
      const list = listsMap.get(id)
      if (list) {
        setInfoDialogData(list)
      }
    },
    [listsMap, setInfoDialogData],
  )

  // CREATE NEW LIST
  const [createNewListMutation, { isLoading: isCreatingList }] = useCreateEntityListMutation()
  const onCreateNewList = async (list: EntityListPostModel) =>
    await createNewListMutation({ entityListPostModel: list, projectName }).unwrap()

  const handleCreatedList = useCallback(
    (list: EntityListSummary) => {
      if (list.id) {
        setRowSelection({ [list.id]: true })
      }
    },
    [setRowSelection],
  )

  const { closeNewList, createNewList, newList, openNewList, setNewList } = useNewList({
    onCreateNewList,
    onCreated: handleCreatedList,
    isReview,
  })

  // UPDATE/EDIT LIST
  const [updateListMutation] = useUpdateEntityListMutation()
  const onUpdateList = async (listId: string, list: EntityListPatchModel) =>
    await updateListMutation({ listId, entityListPatchModel: list, projectName }).unwrap()
  const { closeRenameList, openRenameList, renamingList, submitRenameList } = useUpdateList({
    setRowSelection,
    onUpdateList,
  })

  // DELETE LIST
  const [deleteListMutation] = useDeleteEntityListMutation()
  const onDeleteList = async (listId: string) => {
    // delete list in the backend
    await deleteListMutation({ listId, projectName }).unwrap()
    // set the row selection to empty
    setRowSelection({})
  }
  const { deleteLists } = useDeleteList({ onDeleteList })

  const value = useMemo(() => {
    return {
      rowSelection,
      setRowSelection,
      selectedRows,
      selectedLists,
      selectedList,
      closeNewList,
      createNewList,
      newList,
      openNewList,
      setNewList,
      isCreatingList,
      isReview,
      // list editing
      closeRenameList,
      openRenameList,
      renamingList,
      submitRenameList,
      deleteLists,
      // info dialog
      infoDialogData,
      setInfoDialogData,
      openDetailsPanel,
      // lists filters dialog
      listsFiltersOpen,
      setListsFiltersOpen,
    }
  }, [
    rowSelection,
    setRowSelection,
    selectedRows,
    selectedLists,
    selectedList,
    // new list
    closeNewList,
    createNewList,
    newList,
    openNewList,
    setNewList,
    isCreatingList,
    closeRenameList,
    openRenameList,
    renamingList,
    submitRenameList,
    deleteLists,
    infoDialogData,
    setInfoDialogData,
    openDetailsPanel,
    listsFiltersOpen,
    setListsFiltersOpen,
    isReview,
  ])

  return <ListsContext.Provider value={value}>{children}</ListsContext.Provider>
}

export const useListsContext = () => {
  const context = useContext(ListsContext)
  if (context === undefined) {
    throw new Error('useListsContext must be used within a ListsProvider')
  }
  return context
}

export default ListsContext
