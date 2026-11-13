import React, { useEffect, useState } from 'react';
import { Box, Button, Skeleton, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { getPublicTag } from '../../../services/tagService';

const unwrap = (value) => value?.data ?? value;
export default function TagShowcaseSection({ section = {}, mode = 'live' }) {
  const slugs = Array.isArray(section.tagSlugs) ? section.tagSlugs.slice(0, Number(section.count) || 8) : [];
  const [tags, setTags] = useState([]);
  const preview = mode === 'preview';
  useEffect(() => {
    let active = true;
    Promise.all(slugs.map((slug) => getPublicTag(slug).then(unwrap).catch(() => ({ slug, name: slug }))))
      .then((items) => { if (active) setTags(items); });
    return () => { active = false; };
  }, [section.id, slugs.join('|')]);
  const items = preview && !tags.length ? slugs.map((slug) => ({ slug, name: slug })) : tags;
  return <Box component="section" sx={{ py: 4 }}>
    <Typography variant="h4" sx={{ mb: 2 }}>{section.title || 'Shop by Tag'}</Typography>
    {tags.length === 0 && !preview && slugs.length > 0
      ? <Stack direction="row" spacing={2}>{slugs.map((slug) => <Skeleton key={slug} width={120} height={72} />)}</Stack>
      : <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
        {items.map((tag) => <Button key={tag.id || tag.slug} component={RouterLink}
          to={`/tags/${encodeURIComponent(tag.slug)}`} variant="outlined">
          {tag.name || tag.title || tag.slug}
        </Button>)}
      </Stack>}
  </Box>;
}
