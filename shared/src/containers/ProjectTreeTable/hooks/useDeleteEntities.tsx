import { useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { OperationWithRowId, useProjectTableContext, useProjectTableQueriesContext } from '@shared/containers'
// TODO: confirmDelete uses prime react, so we should find a different solution
import { confirmDelete } from '@shared/util'
import { useProjectContext } from '@shared/context'
import { toast } from 'react-toastify'
import { EntityMap } from '../types'
import { gqlApi } from '../../../api/generated'
import { DeleteConfirmContent, FolderDeleteInfo, pluralize } from '../components/DeleteConfirmContent'

type UseDeleteEntitiesProps = {
  onSuccess?: () => void
}

const useDeleteEntities = ({ onSuccess }: UseDeleteEntitiesProps) => {
  const { updateEntities } = useProjectTableQueriesContext()
  const { projectName } = useProjectContext()
  const dispatch = useDispatch()

  const { getEntityById } = useProjectTableContext()

  const getValidEntity = (entityId: string): (EntityMap & { rowId: string }) | null => {
    const entity = getEntityById(entityId) as EntityMap & { rowId: string }
    return entity || null
  }

  const fetchFolderDeleteInfo = async (
    folderIds: string[],
  ): Promise<Map<string, FolderDeleteInfo>> => {
    const map = new Map<string, FolderDeleteInfo>()
    if (!folderIds.length || !projectName) return map

    try {
      const result = await dispatch(
        gqlApi.endpoints.GetFolderDeleteInfo.initiate({
          projectName,
          folderIds,
        }),
      )

      const edges = result?.data?.project?.folders?.edges
      if (edges) {
        for (const edge of edges) {
          const node = edge.node
          if (node) {
            map.set(node.id, {
              id: node.id,
              name: node.name,
              label: node.label,
              totalFolderCount: node.totalFolderCount ?? 0,
              totalTaskCount: node.totalTaskCount ?? 0,
              totalProductCount: node.totalProductCount ?? 0,
              totalVersionCount: node.totalVersionCount ?? 0,
            })
          }
        }
      }
    } catch (error) {
      console.warn('Failed to fetch folder delete info, falling back to local data', error)
    }

    return map
  }

  return useCallback(
    async (entityIds: string[]) => {
      if (!entityIds || entityIds.length === 0) {
        toast.error('No entities selected')
        return
      }

      const fullEntities: (EntityMap & { rowId: string })[] = []
      const addedEntityIds = new Set<string>()

      for (const id of entityIds) {
        const entity = getValidEntity(id)
        if (entity && !addedEntityIds.has(entity.id)) {
          fullEntities.push(entity)
          addedEntityIds.add(entity.id)
        }
      }

      if (fullEntities.length === 0) {
        toast.error('No entities found')
        return
      }

      const selectedIdSet = new Set(fullEntities.map((e) => e.id))
      const topLevelEntities = fullEntities.filter((e) => {
        if (e.entityType === 'folder' && 'parentId' in e && e.parentId) {
          return !selectedIdSet.has(e.parentId)
        }
        if ('folderId' in e && e.folderId) {
          return !selectedIdSet.has(e.folderId)
        }
        return true
      })

      const deleteEntities = async (force = false) => {
        const operations: OperationWithRowId[] = []
        for (const e of fullEntities) {
          if (!e) continue
          operations.push({
            entityType: 'folderId' in e ? 'task' : 'folder',
            type: 'delete',
            entityId: e.id,
            rowId: e.rowId,
            force,
          })
        }
        try {
          await updateEntities?.({ operations })
          if (onSuccess) {
            onSuccess()
          }
        } catch (error: any) {
          const message = error?.error || 'Failed to delete entities'
          console.error(`Failed to delete entities:`, error)
          throw { message, ...error }
        }
      }

      const counts: Record<string, number> = {}
      for (const e of topLevelEntities) {
        counts[e.entityType] = (counts[e.entityType] || 0) + 1
      }

      let entityLabel: string
      if (topLevelEntities.length === 1) {
        const entity = topLevelEntities[0]
        entityLabel = `"${entity.label || entity.name}"`
      } else {
        const typeLabels = ['folder', 'task', 'product', 'version'] as const
        const parts = typeLabels
          .filter((type) => counts[type] > 0)
          .map((type) => pluralize(counts[type], type))
        entityLabel = parts.join(', ')
      }

      const topLevelFolders = topLevelEntities.filter((e) => e.entityType === 'folder')

      confirmDelete({
        label: 'folders and tasks',
        message: (
          <DeleteConfirmContent
            entityLabel={entityLabel}
            topLevelFolders={topLevelFolders}
            fetchDeleteInfo={fetchFolderDeleteInfo}
          />
        ),
        accept: deleteEntities,
        onError: (error: any) => {
          const FOLDER_WITH_CHILDREN_CODE = 'delete-folder-with-children'
          if (error?.errorCodes?.includes(FOLDER_WITH_CHILDREN_CODE)) {
            const confirmForce = window.confirm(
              `Are you really sure you want to delete ${entityLabel} and all of its dependencies? This cannot be undone. (NOT RECOMMENDED)`,
            )
            if (confirmForce) {
              deleteEntities(true)
            } else {
              console.log('User cancelled forced delete')
            }
          }
        },
        deleteLabel: 'Delete forever',
      })
    },
    [getEntityById, updateEntities, onSuccess, projectName, dispatch],
  )
}

export default useDeleteEntities
