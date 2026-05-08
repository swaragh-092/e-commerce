import React, { useState, useMemo } from 'react';
import {
  Box,
  Chip,
  Divider,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListSubheader,
  Paper,
  TextField,
  Typography,
  IconButton,
  Tooltip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import MenuService from '../../../services/menuService';
import { useNotification } from '../../../context/NotificationContext';

const MenuSelector = ({ menus, selectedMenuId, setSelectedMenuId, onRefresh }) => {
  const [search, setSearch] = useState('');
  const { notify } = useNotification();

  const filteredMenus = useMemo(() => 
    (menus || []).filter((menu) =>
      (menu.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (menu.location || '').toLowerCase().includes(search.toLowerCase())
    ), [menus, search]
  );


  const groupedMenus = useMemo(() => {
    return filteredMenus.reduce((acc, menu) => {
      const location = menu.location || 'unassigned';
      if (!acc[location]) acc[location] = [];
      acc[location].push(menu);
      return acc;
    }, {});
  }, [filteredMenus]);

  const locations = useMemo(() => Object.keys(groupedMenus).sort(), [groupedMenus]);

  const onDragEnd = async (result) => {
    if (!result.destination || search) return;

    const { source, destination } = result;
    if (source.droppableId !== destination.droppableId || source.index === destination.index) return;

    const locationGroup = [...groupedMenus[source.droppableId]];
    const [removed] = locationGroup.splice(source.index, 1);
    locationGroup.splice(destination.index, 0, removed);

    // Update sort orders locally for immediate feedback
    const updatedMenus = locationGroup.map((m, index) => ({
      id: m.id,
      sortOrder: index * 10,
    }));

    try {
      await MenuService.adminReorderMenus(updatedMenus);
      notify('Menu order updated.', 'success');
      if (onRefresh) onRefresh();
    } catch (error) {
      notify('Failed to reorder menus.', 'error');
    }
  };

  return (
    <Paper sx={{ p: 0, height: '100%', display: 'flex', flexDirection: 'column', minHeight: 500 }}>
      <Box p={2}>
        <Typography variant="h6" mb={2}>
          Menus
        </Typography>
        <TextField
          fullWidth
          size="small"
          placeholder="Search menus or locations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      </Box>
      <Divider />
      <Box sx={{ overflowY: 'auto', flexGrow: 1 }}>
        <DragDropContext onDragEnd={onDragEnd}>
          <List sx={{ pt: 0 }}>
            {locations.map((location) => (
              <Droppable key={location} droppableId={location} isDropDisabled={!!search}>
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef}>
                    <ListSubheader sx={{ 
                      bgcolor: 'grey.50', 
                      lineHeight: '36px', 
                      fontWeight: 800, 
                      color: 'text.primary',
                      borderBottom: '1px solid', 
                      borderColor: 'divider', 
                      mb: 0.5,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      px: 2
                    }}>
                      <span>{location.toUpperCase()}</span>
                      <Chip 
                        label={`${groupedMenus[location].filter(m => m.isActive).length} Active`} 
                        size="small" 
                        sx={{ height: 18, fontSize: '0.6rem', fontWeight: 600, bgcolor: 'success.light', color: 'success.dark' }} 
                      />
                    </ListSubheader>
                    {groupedMenus[location].map((menu, index) => (
                      <Draggable key={menu.id} draggableId={String(menu.id)} index={index} isDragDisabled={!!search}>

                        {(dragProvided, snapshot) => (
                          <ListItem
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            disablePadding
                            sx={{
                              mb: 0.5,
                              opacity: snapshot.isDragging ? 0.8 : 1,
                              bgcolor: snapshot.isDragging ? 'action.hover' : 'transparent',
                            }}
                          >
                            <ListItemButton
                              selected={menu.id === selectedMenuId}
                              onClick={() => setSelectedMenuId(menu.id)}
                              sx={{
                                py: 1,
                                borderRadius: 1,
                                mx: 1,
                                '&.Mui-selected': {
                                  bgcolor: 'primary.main',
                                  color: 'primary.contrastText',
                                  '&:hover': { bgcolor: 'primary.dark' },
                                  '& .MuiListItemText-secondary': { color: 'rgba(255,255,255,0.7)' },
                                  '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.5)' },
                                },
                              }}
                            >
                              {!search && (
                                <Box {...dragProvided.dragHandleProps} sx={{ display: 'flex', mr: 1 }}>
                                  <DragIndicatorIcon fontSize="small" color="action" />
                                </Box>
                              )}
                              <ListItemText
                                primary={menu.name}
                                secondary={menu.slug}
                                primaryTypographyProps={{ variant: 'body2', fontWeight: 600, noWrap: true }}
                                secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
                              />
                              {menu.isActive ? (
                                <Tooltip title="Currently visible on storefront">
                                  <Chip label="LIVE" size="small" color="success" variant="filled" sx={{ ml: 1, height: 18, fontSize: '0.6rem', fontWeight: 800 }} />
                                </Tooltip>
                              ) : (
                                <Chip label="DRAFT" size="small" color="default" variant="outlined" sx={{ ml: 1, height: 18, fontSize: '0.6rem', fontWeight: 800 }} />
                              )}
                            </ListItemButton>
                          </ListItem>
                        )}
                      </Draggable>
                    ))}

                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            ))}
            {filteredMenus.length === 0 && (
              <Box p={3} textAlign="center">
                <Typography variant="body2" color="text.secondary">
                  {search ? 'No menus matching search.' : 'No menus created yet.'}
                </Typography>
              </Box>
            )}
          </List>
        </DragDropContext>
      </Box>
    </Paper>
  );
};

export default MenuSelector;
