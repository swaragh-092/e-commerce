import React, { useState, useMemo } from 'react';
import {
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tooltip,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import MoveToInboxIcon from '@mui/icons-material/MoveToInbox';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ViewListIcon from '@mui/icons-material/ViewList';
import SortIcon from '@mui/icons-material/Sort';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { locationHelp } from './constants';
import MenuService from '../../../services/menuService';
import { useNotification } from '../../../context/NotificationContext';

const MenuItemGrid = ({
  rows,
  loading,
  canManage,
  selectedMenu,
  menus,
  openItemDialog,
  nudgeItem,
  deleteItem,
  selectedIds,
  setSelectedIds,
  bulkDeleteItems,
  bulkMoveItems,
  onRefresh,
}) => {
  const [moveAnchor, setMoveAnchor] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'sort'
  const { notify } = useNotification();

  const onDragEnd = async (result) => {
    if (!result.destination) return;
    const { source, destination } = result;

    if (source.droppableId !== destination.droppableId || source.index === destination.index) return;

    // Filter items belonging to this specific parent/level
    const levelItems = rows.filter(r => (r.parentId || 'root') === source.droppableId);
    const reordered = [...levelItems];
    const [removed] = reordered.splice(source.index, 1);
    reordered.splice(destination.index, 0, removed);

    const updatedItems = reordered.map((item, index) => ({
      id: item.id,
      sortOrder: (index + 1) * 10,
      parentId: item.parentId,
    }));

    try {
      await MenuService.adminReorderMenuItems(selectedMenu.id, updatedItems);
      notify('Item order updated.', 'success');
      if (onRefresh) onRefresh();
    } catch (error) {
      notify('Failed to reorder items.', 'error');
    }
  };

  const renderSortableList = (parentId = 'root', depth = 0) => {
    const levelItems = rows.filter(r => (r.parentId || 'root') === parentId);
    if (levelItems.length === 0 && parentId !== 'root') return null;

    return (
      <Droppable droppableId={parentId} type="items">
        {(provided) => (
          <div {...provided.droppableProps} ref={provided.innerRef}>
            {levelItems.map((item, index) => (
              <Draggable key={item.id} draggableId={item.id} index={index}>
                {(dragProvided, snapshot) => (
                  <Box 
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    sx={{ 
                      ml: depth * 4,
                      mb: 1,
                      border: '1px solid',
                      borderColor: snapshot.isDragging ? 'primary.main' : 'divider',
                      borderRadius: 1,
                      bgcolor: snapshot.isDragging ? 'action.hover' : 'background.paper',
                      boxShadow: snapshot.isDragging ? 3 : 0,
                    }}
                  >
                    <Stack direction="row" alignItems="center" p={1}>
                      <Box {...dragProvided.dragHandleProps} sx={{ mr: 1, cursor: 'grab', display: 'flex' }}>
                        <DragIndicatorIcon color="action" fontSize="small" />
                      </Box>
                      <ListItemText 
                        primary={item.label} 
                        secondary={item.url || 'No link'} 
                        primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                        secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
                      />
                      <Box ml="auto" mr={1}>
                        <Chip label={item.targetType} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                      </Box>
                      <IconButton size="small" onClick={() => openItemDialog(item)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                    {renderSortableList(item.id, depth + 1)}
                  </Box>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    );
  };

  const columns = [
    {
      field: 'displayLabel',
      headerName: 'Label',
      flex: 1,
      renderCell: (params) => (
        <Typography sx={{ pl: params.row.depth * 2, fontWeight: params.row.depth === 0 ? 700 : 400 }}>
          {params.row.label}
        </Typography>
      ),
    },
    { field: 'placement', headerName: 'Placement', width: 130 },
    { field: 'targetType', headerName: 'Type', width: 130 },
    { field: 'url', headerName: 'URL', flex: 1 },
    { field: 'sortOrder', headerName: 'Order', width: 90 },
    {
      field: 'isVisible',
      headerName: 'Visible',
      width: 100,
      renderCell: (params) => (
        <Chip
          label={params.value ? 'Visible' : 'Hidden'}
          color={params.value ? 'success' : 'default'}
          size="small"
        />
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 190,
      sortable: false,
      renderCell: (params) => (
        <Box>
          <Tooltip title="Move up">
            <span>
              <IconButton
                disabled={!canManage}
                onClick={() => nudgeItem(params.row, -1)}
                aria-label={`Move ${params.row.label} up`}
              >
                <KeyboardArrowUpIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Move down">
            <span>
              <IconButton
                disabled={!canManage}
                onClick={() => nudgeItem(params.row, 1)}
                aria-label={`Move ${params.row.label} down`}
              >
                <KeyboardArrowDownIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Edit">
            <span>
              <IconButton
                disabled={!canManage}
                onClick={() => openItemDialog(params.row)}
                aria-label={`Edit ${params.row.label}`}
              >
                <EditIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Delete">
            <span>
              <IconButton
                disabled={!canManage}
                color="error"
                onClick={() => deleteItem(params.row)}
                aria-label={`Delete ${params.row.label}`}
              >
                <DeleteIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Paper sx={{ height: 700, width: '100%', display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" p={2}>
        <Box>
          <Typography variant="h6">Items</Typography>
          <Typography variant="body2" color="text.secondary">
            {selectedMenu ? locationHelp[selectedMenu.location] || locationHelp.header : 'Create a menu to begin.'}
          </Typography>
        </Box>
        <Stack direction="row" spacing={2} alignItems="center">
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(e, next) => next && setViewMode(next)}
            size="small"
            sx={{ mr: 1 }}
          >
            <ToggleButton value="grid" aria-label="grid view">
              <Tooltip title="Manage View"><ViewListIcon fontSize="small" /></Tooltip>
            </ToggleButton>
            <ToggleButton value="sort" aria-label="sort view">
              <Tooltip title="Reorder View"><SortIcon fontSize="small" /></Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>

          {selectedIds.length > 0 && canManage && viewMode === 'grid' && (
            <>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={bulkDeleteItems}
                size="small"
              >
                Delete ({selectedIds.length})
              </Button>
              <Button
                variant="outlined"
                startIcon={<MoreVertIcon />}
                onClick={(e) => setMoveAnchor(e.currentTarget)}
                size="small"
              >
                Bulk Move
              </Button>
              <Menu
                anchorEl={moveAnchor}
                open={Boolean(moveAnchor)}
                onClose={() => setMoveAnchor(null)}
              >
                <ListSubheader>Move selected to:</ListSubheader>
                {menus
                  .filter((m) => m.id !== selectedMenu?.id)
                  .map((m) => (
                    <MenuItem
                      key={m.id}
                      onClick={() => {
                        bulkMoveItems(m.id);
                        setMoveAnchor(null);
                      }}
                    >
                      {m.name} ({m.location})
                    </MenuItem>
                  ))}
              </Menu>
            </>
          )}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            disabled={!canManage || !selectedMenu}
            onClick={() => openItemDialog()}
          >
            Add Item
          </Button>
        </Stack>
      </Stack>
      <Divider />
      
      <Box sx={{ flexGrow: 1, overflowY: 'auto', p: viewMode === 'sort' ? 2 : 0 }}>
        {viewMode === 'grid' ? (
          <DataGrid
            rows={rows}
            columns={columns}
            loading={loading}
            checkboxSelection
            disableRowSelectionOnClick
            onRowSelectionModelChange={(newSelection) => setSelectedIds(newSelection)}
            rowSelectionModel={selectedIds}
            pageSizeOptions={[25, 50, 100]}
            initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
            sx={{ border: 0 }}
          />
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            {renderSortableList()}
            {rows.length === 0 && (
              <Box p={4} textAlign="center">
                <Typography variant="body2" color="text.secondary">No items to reorder.</Typography>
              </Box>
            )}
          </DragDropContext>
        )}
      </Box>
    </Paper>
  );
};

export default MenuItemGrid;
