import { useEffect, useState } from 'react';
import { Box, Button, Card, CardMedia, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, TextField, Typography } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import EditIcon from '@mui/icons-material/Edit';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import MediaPicker from '../../components/common/MediaPicker';
import { galleryService } from '../../services/galleryService';
import { mediaService } from '../../services/mediaService';
import { getMediaUrl } from '../../utils/media';

export default function GalleriesPage() {
  const [gallery, setGallery] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editMedia, setEditMedia] = useState(null);
  const [editForm, setEditForm] = useState({ originalName: '', alt: '', caption: '', description: '' });

  const load = async () => {
    const res = await galleryService.listAdmin({ page: 1, limit: 100 });
    const rows = res.data || [];
    const defaultGallery = rows.find((g) => g.slug === 'gallery') || rows.find((g) => g.slug === 'home-gallery') || rows[0] || null;
    setGallery(defaultGallery);
  };

  const ensureDefaultGallery = async () => {
    const res = await galleryService.listAdmin({ page: 1, limit: 100 });
    const rows = res.data || [];
    const preferred = rows.find((g) => g.slug === 'gallery');
    if (preferred) {
      setGallery(preferred);
      return;
    }

    const legacy = rows.find((g) => g.slug === 'home-gallery');
    if (legacy) {
      try {
        const updated = await galleryService.update(legacy.id, { title: 'Gallery', slug: 'gallery' });
        setGallery(updated.data || legacy);
      } catch (_) {
        setGallery(legacy);
      }
      return;
    }

    const existing = rows[0];
    if (existing) {
      setGallery(existing);
      return;
    }
    try {
      await galleryService.create({ title: 'Gallery', slug: 'gallery', isActive: true });
    } catch (err) {
      if (err?.response?.status !== 409) throw err;
    }
    await load();
  };

  useEffect(() => {
    ensureDefaultGallery();
  }, []);

  const onSelectMedia = async (items) => {
    if (!gallery || !items?.length) return;
    await galleryService.addItems(gallery.id, items.map((m) => m.id));
    await load();
    setPickerOpen(false);
  };

  const onDragEnd = async (result) => {
    if (!result.destination || !gallery?.items) return;
    const reordered = Array.from(gallery.items);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    await galleryService.reorder(gallery.id, reordered.map((x) => x.id));
    await load();
  };

  const onDeleteItem = async (itemId) => { await galleryService.deleteItem(gallery.id, itemId); load(); };
  const openEdit = (media) => { setEditMedia(media); setEditForm({ originalName: media.originalName || '', alt: media.alt || '', caption: media.caption || '', description: media.description || '' }); };
  const saveEdit = async () => { await mediaService.update(editMedia.id, editForm); setEditMedia(null); load(); };

  return <Box>
    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
      <Typography variant="h5" fontWeight={700}>Gallery</Typography>
      {gallery && (
        <Button startIcon={<AddPhotoAlternateIcon />} variant="contained" onClick={() => setPickerOpen(true)}>
          Add Images
        </Button>
      )}
    </Stack>
    {gallery && <>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="gallery-list" direction="horizontal">
          {(provided) => (
            <Box
              ref={provided.innerRef}
              {...provided.droppableProps}
              sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-start' }}
            >
              {(gallery.items || []).map((item, index) => (
                <Draggable key={item.id} draggableId={item.id} index={index}>
                  {(drag) => (
                    <Card
                      ref={drag.innerRef}
                      {...drag.draggableProps}
                      sx={{
                        width: { xs: 'calc(50% - 8px)', sm: 220, md: 240 },
                        maxWidth: '100%',
                        borderRadius: 2,
                        overflow: 'hidden',
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 0.5 }}>
                        <IconButton size="small" {...drag.dragHandleProps}>
                          <DragIndicatorIcon />
                        </IconButton>
                        <Box>
                          <IconButton size="small" onClick={() => openEdit(item.media)}><EditIcon /></IconButton>
                          <IconButton size="small" color="error" onClick={() => onDeleteItem(item.id)}><DeleteIcon /></IconButton>
                        </Box>
                      </Box>
                      <CardMedia component="img" image={getMediaUrl(item.media?.url)} sx={{ height: 150, objectFit: 'cover' }} />
                      <Box sx={{ p: 1 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>{item.media?.originalName || item.media?.filename || 'Image'}</Typography>
                      </Box>
                    </Card>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </Box>
          )}
        </Droppable>
      </DragDropContext>
    </>}

    <MediaPicker open={pickerOpen} onClose={()=>setPickerOpen(false)} onSelect={onSelectMedia} multiple title="Add Gallery Images" />
    <Dialog open={Boolean(editMedia)} onClose={()=>setEditMedia(null)} fullWidth maxWidth="xs"><DialogTitle>Edit Media Metadata</DialogTitle><DialogContent><Stack spacing={2} mt={1}><TextField label="Filename" value={editForm.originalName} onChange={(e)=>setEditForm({...editForm,originalName:e.target.value})}/><TextField label="Alt Text" value={editForm.alt} onChange={(e)=>setEditForm({...editForm,alt:e.target.value})}/><TextField label="Caption" value={editForm.caption} onChange={(e)=>setEditForm({...editForm,caption:e.target.value})}/><TextField label="Description" multiline rows={3} value={editForm.description} onChange={(e)=>setEditForm({...editForm,description:e.target.value})}/></Stack></DialogContent><DialogActions><Button onClick={()=>setEditMedia(null)}>Cancel</Button><Button variant="contained" onClick={saveEdit}>Save Changes</Button></DialogActions></Dialog>
  </Box>;
}
