import { Children, cloneElement, useState } from 'react';
import { Box, MenuItem, Table, TableBody, TablePagination, TableSortLabel, TextField, Typography } from '@mui/material';
import { useAnalyticsDisplay } from './AnalyticsCustomization';

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export default function ReportTable({ rows, fields, metric, renderRow, children: head, ...props }) {
  const { preferences, widgets } = useAnalyticsDisplay();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [value, setValue] = useState('');
  const [sort, setSort] = useState(null);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const headerRow = head.props.children;
  const headers = Children.toArray(headerRow.props.children);
  const firstField = widgets.find(({ id }) => id === metric)?.fields?.[0]?.[0];
  const columns = headers.map((header, index) => ({
    field: fields[index], label: header.props.children, name: header.props.name,
  })).map((column) => ({
    ...column,
    visible: column.name === firstField || !preferences.hiddenFields[metric]?.includes?.(column.name),
  }));
  const searchable = columns.filter(({ field, visible }) => field && visible);
  const activeFilter = searchable.some(({ field }) => field === filter) ? filter : '';
  const options = activeFilter ? [...new Set(rows.map((row) => String(row[activeFilter] ?? '')))].filter(Boolean).sort(collator.compare) : [];
  const activeValue = options.includes(value) ? value : '';
  const query = search.trim().toLowerCase();
  const filtered = rows.filter((row) =>
    (!activeValue || String(row[activeFilter] ?? '') === activeValue) &&
    (!query || searchable.some(({ field }) => String(row[field] ?? '').toLowerCase().includes(query))));
  if (sort && searchable.some(({ field }) => field === sort.field)) {
    filtered.sort((left, right) => {
      const a = left[sort.field];
      const b = right[sort.field];
      if (a == null || b == null) return Number(a == null) - Number(b == null);
      const result = typeof a === 'number' && typeof b === 'number' ? a - b : collator.compare(String(a), String(b));
      return sort.direction === 'asc' ? result : -result;
    });
  }
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / size) - 1));
  return <>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, my: 2 }}>
      <TextField size="small" label="Search rows" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} />
      <TextField select size="small" label="Filter column" sx={{ minWidth: 160 }} value={activeFilter}
        onChange={(event) => { setFilter(event.target.value); setValue(''); setPage(0); }}>
        <MenuItem value="">All columns</MenuItem>
        {searchable.map(({ field, label }) => <MenuItem key={field} value={field}>{label}</MenuItem>)}
      </TextField>
      {activeFilter && (
        <TextField select size="small" label="Filter value" sx={{ minWidth: 160 }} value={activeValue}
          onChange={(event) => { setValue(event.target.value); setPage(0); }}>
          <MenuItem value="">All values</MenuItem>
          {options.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
        </TextField>
      )}
    </Box>
    <Box sx={{ overflowX: 'auto' }}>
      <Table {...props}>
        {cloneElement(head, {}, cloneElement(headerRow, {}, headers.map((header, index) => {
          const { field, label, visible } = columns[index];
          if (!visible) return null;
          if (!field) return header;
          const active = field === sort?.field;
          return cloneElement(header, { sortDirection: active ? sort.direction : false },
            <TableSortLabel active={active} direction={active ? sort.direction : 'asc'} onClick={() => {
              setSort({ field, direction: active && sort.direction === 'asc' ? 'desc' : 'asc' });
              setPage(0);
            }}>{label}</TableSortLabel>);
        })))}
        <TableBody>{filtered.slice(currentPage * size, (currentPage + 1) * size).map((row, index) =>
          renderRow(row, currentPage * size + index))}</TableBody>
      </Table>
    </Box>
    {!filtered.length && <Typography sx={{ py: 2 }}>No rows match your search and filters.</Typography>}
    <TablePagination component="div" count={filtered.length} page={currentPage} rowsPerPage={size} rowsPerPageOptions={[10, 25, 50]}
      onPageChange={(_, next) => setPage(next)} onRowsPerPageChange={(event) => { setSize(Number(event.target.value)); setPage(0); }} />
  </>;
}
