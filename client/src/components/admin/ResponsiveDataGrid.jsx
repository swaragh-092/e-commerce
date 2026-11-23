import { createContext, useContext, useState } from 'react';
import { Button } from '@mui/material';
import { DataGrid, GridToolbarColumnsButton, GridToolbarContainer } from '@mui/x-data-grid';

const ColumnPreferencesContext = createContext(null);

function ColumnToolbar() {
  const { hasOverrides, reset } = useContext(ColumnPreferencesContext);
  return (
    <GridToolbarContainer>
      <GridToolbarColumnsButton />
      {hasOverrides && <Button size="small" onClick={reset}>Reset columns</Button>}
    </GridToolbarContainer>
  );
}

export default function ResponsiveDataGrid({
  columnVisibilityModel: defaults,
  requiredColumns = [],
  unavailableColumns = [],
  slots,
  slotProps,
  ...props
}) {
  const [overrides, setOverrides] = useState({});
  const protectedColumns = [...requiredColumns, ...unavailableColumns];
  const visibility = {
    ...defaults,
    ...overrides,
    ...Object.fromEntries(requiredColumns.map(field => [field, true])),
    ...Object.fromEntries(unavailableColumns.map(field => [field, false])),
  };

  const updateVisibility = (next) => {
    setOverrides(previous => {
      const updated = { ...previous };
      for (const { field, hideable } of props.columns) {
        if (hideable === false || protectedColumns.includes(field)) continue;
        if ((next[field] !== false) !== (visibility[field] !== false)) {
          if ((next[field] !== false) === (defaults?.[field] !== false)) delete updated[field];
          else updated[field] = next[field] !== false;
        }
      }
      return updated;
    });
  };

  return (
    <ColumnPreferencesContext.Provider value={{
      hasOverrides: Object.keys(overrides).length > 0,
      reset: () => setOverrides({}),
    }}>
      <DataGrid
        {...props}
        columns={props.columns.map(column => protectedColumns.includes(column.field)
          ? { ...column, hideable: false }
          : column)}
        columnVisibilityModel={visibility}
        onColumnVisibilityModelChange={updateVisibility}
        slots={{ ...slots, toolbar: ColumnToolbar }}
        slotProps={{
          ...slotProps,
          columnsManagement: {
            disableResetButton: true,
            getTogglableColumns: columns => columns.filter(column => column.hideable !== false).map(column => column.field),
          },
        }}
      />
    </ColumnPreferencesContext.Provider>
  );
}
