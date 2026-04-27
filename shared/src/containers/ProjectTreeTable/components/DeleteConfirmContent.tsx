import { useState, useEffect } from 'react'
import styled, { keyframes } from 'styled-components'
import { EntityMap } from '../types'

export type FolderDeleteInfo = {
  id: string
  name: string
  label?: string | null
  totalFolderCount: number
  totalTaskCount: number
  totalProductCount: number
  totalVersionCount: number
}

export const pluralize = (count: number, singular: string): string =>
  `${count} ${count === 1 ? singular : singular + 's'}`

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
`

const Wrapper = styled.div`
  min-width: 350px;
`

const DetailsContainer = styled.div`
  margin-top: 12px;
  min-height: 60px;
  min-width: 350px;
`

const BoldLabel = styled.p`
  font-weight: 600;
`

const SkeletonLine = styled.div<{ $width: string; $marginBottom?: number }>`
  height: 14px;
  border-radius: 4px;
  background: var(--md-sys-color-surface-container-high);
  animation: ${pulse} 1.5s ease-in-out infinite;
  width: ${({ $width }) => $width};
  ${({ $marginBottom }) => $marginBottom && `margin-bottom: ${$marginBottom}px;`}
`

export type DeleteConfirmContentProps = {
  entityLabel: string
  topLevelFolders: (EntityMap & { rowId: string })[]
  fetchDeleteInfo: (folderIds: string[]) => Promise<Map<string, FolderDeleteInfo>>
}

export const DeleteConfirmContent = ({
  entityLabel,
  topLevelFolders,
  fetchDeleteInfo,
}: DeleteConfirmContentProps) => {
  const [loading, setLoading] = useState(topLevelFolders.length > 0)
  const [childrenDetails, setChildrenDetails] = useState<string[]>([])

  useEffect(() => {
    if (topLevelFolders.length === 0) return

    const folderIds = topLevelFolders.map((f) => f.id)
    const many = topLevelFolders.length > 1

    fetchDeleteInfo(folderIds)
      .then((folderInfoMap) => {
        const details: string[] = []
        for (const folder of topLevelFolders) {
          const info = folderInfoMap.get(folder.id)
          const prefix = many ? `"${folder.label || folder.name}" contains ` : 'Contains '

          const hasDescendants =
            info &&
            (info.totalFolderCount > 0 ||
              info.totalTaskCount > 0 ||
              info.totalProductCount > 0 ||
              info.totalVersionCount > 0)

          if (hasDescendants) {
            const parts: string[] = []
            if (info.totalFolderCount > 0) parts.push(pluralize(info.totalFolderCount, 'child folder'))
            if (info.totalTaskCount > 0) parts.push(pluralize(info.totalTaskCount, 'task'))
            if (info.totalProductCount > 0) parts.push(pluralize(info.totalProductCount, 'product'))
            if (info.totalVersionCount > 0) parts.push(pluralize(info.totalVersionCount, 'version'))
            details.push(`${prefix}${parts.join(', ')}`)
          } else {
            if ('hasChildren' in folder && folder.hasChildren) {
              details.push(`${prefix}child folders`)
            }
            if ('taskNames' in folder && folder.taskNames && folder.taskNames.length > 0) {
              details.push(`${prefix}${pluralize(folder.taskNames.length, 'task')}`)
            }
          }
        }
        setChildrenDetails(details)
      })
      .catch(() => {
        const details: string[] = []
        for (const folder of topLevelFolders) {
          const prefix = many ? `"${folder.label || folder.name}" contains ` : 'Contains '
          if ('hasChildren' in folder && folder.hasChildren) {
            details.push(`${prefix}child folders`)
          }
          if ('taskNames' in folder && folder.taskNames && folder.taskNames.length > 0) {
            details.push(`${prefix}${pluralize(folder.taskNames.length, 'task')}`)
          }
        }
        setChildrenDetails(details)
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <Wrapper>
      <p>{`Are you sure you want to delete ${entityLabel}? This action cannot be undone.`}</p>
      {topLevelFolders.length > 0 && (
        <DetailsContainer>
          {loading ? (
            <div>
              <BoldLabel>Loading affected items...</BoldLabel>
              <SkeletonLine $width="80%" $marginBottom={6} />
              <SkeletonLine $width="60%" />
            </div>
          ) : childrenDetails.length > 0 ? (
            <div>
              <BoldLabel>The following will also be affected:</BoldLabel>
              {childrenDetails.map((detail, i) => (
                <p key={i}>{detail}</p>
              ))}
            </div>
          ) : null}
        </DetailsContainer>
      )}
    </Wrapper>
  )
}
