import { TableContainer as BaseTableContainer } from '@containers/Slicer/SlicerTable.styled'
import styled from 'styled-components'
import SimpleEditableCell from './Cells/SimpleEditableCell'

export const TableCellContent = styled.div`
  display: flex;
  align-items: center;
  gap: var(--base-gap-small);
  height: 100%;
  padding: 0px 4px;
  border-radius: var(--border-radius-m);
  user-select: none;

  width: 100%;
  height: auto;
  &.bold {
    font-weight: 600;
  }
`

export const ResizedHandler = styled.div`
  position: absolute;
  right: -2px;
  top: 0;
  bottom: 0;
  width: 4px;
  cursor: col-resize;
`

export const EditableCellContent = styled(SimpleEditableCell)`
  color: red;
  &.bold {
    font-weight: 600;
  }
`

export const HeaderCell = styled.div`
  box-shadow: inset 0 0 0 1px var(--md-sys-color-surface-container-highest);
  display: flex;
  align-items: center;
  min-height: fit-content;
  min-width: 160px;
  &.large {
    min-width: 300px;
  }
`

export const TableCell = styled.td`
  box-shadow: inset 0 0 0 1px var(--md-sys-color-surface-container-highest);
  &.selected {
    border-color: white;
    background-color: var(--md-sys-color-primary-container);
  }
`

export const TableHeader = styled.div`
  display: grid !important;
  position: sticky;
  top: 0;
  min-height: 34px;
  z-index: 10;
  background-color: var(--md-sys-color-surface-container-lowest);
`

export const TableContainer = styled(BaseTableContainer)`
  padding-top: 0;
`

export const TableContainerWrapper = styled.div`
  padding: 0 4px 4px 4px;
`
