import React, { useEffect, useState } from 'react';
import { FormControl, InputLabel, MenuItem, Select, Stack, TextField } from '@mui/material';
import { getTags } from '../../../../services/tagService';
import { galleryService } from '../../../../services/galleryService';

const rowsOf = (value) => Array.isArray(value) ? value : (value?.data || value?.items || []);

export default function MerchandisingSourceControls({ section = {}, onChange, onBlur }) {
  const [tags, setTags] = useState([]);
  const [galleries, setGalleries] = useState([]);
  useEffect(() => {
    let active = true;
    getTags({ limit: 100 })
      .then((result) => { if (active) setTags(rowsOf(result)); })
      .catch(() => {});
    galleryService.list({ limit: 100 })
      .then((result) => {
        if (active) setGalleries(rowsOf(result).filter((gallery) => gallery.isActive === true));
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  const set = (key, value) => onChange?.(key, value);
  return <Stack spacing={2} sx={{ my: 2 }}>
    {section.type === 'tag-showcase' ? <>
      <FormControl fullWidth size="small">
        <InputLabel id="section-tags-label">Tags</InputLabel>
        <Select labelId="section-tags-label" multiple label="Tags"
          value={Array.isArray(section.tagSlugs) ? section.tagSlugs : []}
          onChange={(event) => set('tagSlugs', event.target.value)} onBlur={onBlur}>
          {tags.map((tag) => <MenuItem key={tag.id || tag.slug} value={tag.slug}>{tag.name}</MenuItem>)}
        </Select>
      </FormControl>
      <TextField size="small" type="number" label="Number of tags" value={section.count ?? 8}
        inputProps={{ min: 1, max: 12 }} onChange={(event) => set('count', Number(event.target.value))} onBlur={onBlur} />
    </> : <>
      <FormControl fullWidth size="small">
        <InputLabel id="section-gallery-label">Gallery</InputLabel>
        <Select labelId="section-gallery-label" label="Gallery" value={section.gallerySlug || ''}
          onChange={(event) => set('gallerySlug', event.target.value)} onBlur={onBlur}>
          {galleries.map((gallery) => <MenuItem key={gallery.id || gallery.slug} value={gallery.slug}>{gallery.title || gallery.name}</MenuItem>)}
        </Select>
      </FormControl>
      <TextField size="small" type="number" label="Number of images" value={section.count ?? 8}
        inputProps={{ min: 1, max: 24 }} onChange={(event) => set('count', Number(event.target.value))} onBlur={onBlur} />
    </>}
  </Stack>;
}
