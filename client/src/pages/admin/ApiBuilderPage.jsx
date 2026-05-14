import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SaveIcon from '@mui/icons-material/Save';
import CodeIcon from '@mui/icons-material/Code';
import api from '../../services/api';
import {
  buildPublicApiUrl,
  createApiDefinition,
  deleteApiDefinition,
  getApiDefinitions,
  previewApiDefinition,
  updateApiDefinition,
} from '../../services/apiBuilderService';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';
import { getApiErrorMessage } from '../../utils/apiErrors';

const RESOURCE_FIELDS = {
  categories: ['id', 'name', 'slug', 'description', 'parentId', 'image', 'icon', 'sortOrder', 'metaTitle', 'metaDescription', 'createdAt', 'updatedAt'],
  products: ['id', 'name', 'slug', 'description', 'shortDescription', 'sku', 'price', 'salePrice', 'saleLabel', 'quantity', 'type', 'isFeatured', 'avgRating', 'reviewCount', 'brandId', 'createdAt', 'updatedAt'],
  brands: ['id', 'name', 'slug', 'description', 'image', 'isActive', 'isPromoted', 'isFeatured', 'createdAt', 'updatedAt'],
  pages: ['id', 'title', 'slug', 'content', 'linkPosition', 'linkPlacement', 'metaTitle', 'metaDescription', 'bannerUrl', 'status', 'sortOrder', 'createdAt', 'updatedAt'],
  menus: ['id', 'name', 'slug', 'location', 'isActive', 'sortOrder', 'alignment', 'createdAt', 'updatedAt'],
  menuItems: ['id', 'menuId', 'parentId', 'label', 'targetType', 'targetId', 'url', 'placement', 'sortOrder', 'isVisible', 'openInNewTab', 'createdAt', 'updatedAt'],
  productImages: ['id', 'productId', 'variantId', 'url', 'alt', 'sortOrder', 'isPrimary', 'mediaId', 'createdAt'],
  productVariants: ['id', 'productId', 'sku', 'mediaId', 'price', 'stockQty', 'reservedQty', 'isActive', 'sortOrder', 'createdAt', 'updatedAt'],
  productAttributes: ['id', 'productId', 'attributeId', 'valueId', 'customName', 'customValue', 'isVariantAttr', 'sortOrder', 'createdAt', 'updatedAt'],
  variantOptions: ['variantId', 'attributeId', 'valueId'],
  attributeTemplates: ['id', 'name', 'slug', 'displayType', 'valueType', 'unit', 'sortOrder', 'createdAt', 'updatedAt'],
  attributeValues: ['id', 'attributeId', 'value', 'slug', 'displayLabel', 'swatchColor', 'imageUrl', 'unitLabel', 'metadata', 'sortOrder', 'createdAt', 'updatedAt'],
  tags: ['id', 'name', 'slug', 'createdAt'],
  media: ['id', 'url', 'filename', 'mimeType', 'size', 'originalName', 'alt', 'description', 'caption', 'provider', 'createdAt', 'updatedAt'],
  settings: ['key', 'value', 'group'],
};

const FILTER_FIELDS = {
  categories: ['name', 'slug', 'parentId'],
  products: ['name', 'slug', 'sku', 'price', 'salePrice', 'quantity', 'type', 'isFeatured', 'brandId'],
  brands: ['name', 'slug', 'isActive', 'isPromoted', 'isFeatured'],
  pages: ['title', 'slug', 'status', 'linkPosition'],
  menus: ['name', 'slug', 'location', 'isActive', 'alignment'],
  menuItems: ['label', 'targetType', 'placement', 'isVisible'],
  productImages: ['isPrimary', 'mediaId'],
  productVariants: ['sku', 'price', 'stockQty', 'isActive'],
  productAttributes: ['attributeId', 'valueId', 'customName', 'customValue', 'isVariantAttr'],
  variantOptions: ['attributeId', 'valueId'],
  attributeTemplates: ['name', 'slug'],
  attributeValues: ['value', 'slug'],
  tags: ['name', 'slug'],
  media: ['filename', 'mimeType', 'provider'],
  settings: ['key', 'group'],
};

const RESOURCE_LABELS = {
  categories: 'Categories',
  products: 'Products',
  brands: 'Brands',
  pages: 'Pages',
  menus: 'Menus',
  menuItems: 'Menu Items',
  productImages: 'Product Images',
  productVariants: 'Product Variants',
  productAttributes: 'Product Attributes',
  variantOptions: 'Variant Options',
  attributeTemplates: 'Attribute Templates',
  attributeValues: 'Attribute Values',
  tags: 'Tags',
  media: 'Media',
  settings: 'Settings',
};

const RESOURCE_RELATIONS = {
  categories: [
    { key: 'children', label: 'Sub categories', resource: 'categories' },
    { key: 'products', label: 'Products', resource: 'products' },
  ],
  products: [
    { key: 'categories', label: 'Categories', resource: 'categories' },
    { key: 'brand', label: 'Brand', resource: 'brands' },
    { key: 'images', label: 'Images', resource: 'productImages' },
    { key: 'variants', label: 'Variants', resource: 'productVariants' },
    { key: 'attributes', label: 'Attributes', resource: 'productAttributes' },
    { key: 'tags', label: 'Tags', resource: 'tags' },
  ],
  brands: [{ key: 'products', label: 'Products', resource: 'products' }],
  menus: [{ key: 'items', label: 'Items', resource: 'menuItems' }],
  menuItems: [{ key: 'children', label: 'Child items', resource: 'menuItems' }],
  productImages: [
    { key: 'media', label: 'Media file', resource: 'media' },
    { key: 'variant', label: 'Variant', resource: 'productVariants' },
  ],
  productVariants: [
    { key: 'options', label: 'Options', resource: 'variantOptions' },
    { key: 'images', label: 'Images', resource: 'productImages' },
    { key: 'media', label: 'Media file', resource: 'media' },
  ],
  productAttributes: [
    { key: 'attribute', label: 'Attribute template', resource: 'attributeTemplates' },
    { key: 'value', label: 'Attribute value', resource: 'attributeValues' },
  ],
  variantOptions: [
    { key: 'attribute', label: 'Attribute template', resource: 'attributeTemplates' },
    { key: 'value', label: 'Attribute value', resource: 'attributeValues' },
  ],
};
const OPERATORS = ['equals', 'contains', 'in', 'gte', 'lte', 'between'];

const newBlock = (resource = 'products', relation = null) => ({
  id: `block-${Date.now()}`,
  key: resource,
  resource,
  relation,
  enabled: true,
  mode: 'all',
  selectedIds: [],
  limit: 10,
  pagination: {
    enabled: false,
    pageParam: 'page',
    pageSizeParam: 'pageSize',
    defaultPage: 1,
    defaultPageSize: 10,
  },
  depth: 10,
  fields: RESOURCE_FIELDS[resource].slice(0, Math.min(8, RESOURCE_FIELDS[resource].length)),
  relations: [],
  filters: [],
  sortBy: resource === 'products' ? 'createdAt' : 'sortOrder',
  sortOrder: resource === 'products' ? 'DESC' : 'ASC',
});

const emptyForm = {
  name: 'Custom API',
  slug: 'custom-api',
  description: '',
  isActive: true,
  config: {
    responseMode: 'object',
    includeMeta: true,
    blocks: [newBlock('products')],
  },
};

const flattenCategories = (nodes = [], depth = 0) => nodes.flatMap((node) => [
  { ...node, label: `${'— '.repeat(depth)}${node.name}` },
  ...flattenCategories(node.children || [], depth + 1),
]);

const extractArray = (response) => {
  const data = response?.data?.data ?? response?.data ?? response;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const parseQueryText = (text = '') => {
  const trimmed = text.trim().replace(/^\?/, '');
  if (!trimmed) return {};
  return Object.fromEntries(new URLSearchParams(trimmed).entries());
};

const idsFrom = (items = []) => new Set(items.filter(Boolean));

const getRelatedOptionIds = (parentNode, relationMeta, allOptions) => {
  if (!parentNode || !relationMeta || parentNode.mode !== 'selected') return null;
  const parentIds = idsFrom(parentNode.selectedIds || []);
  if (!parentIds.size) return new Set();

  if (parentNode.resource === 'categories' && relationMeta.key === 'products') {
    return new Set((allOptions.products || [])
      .filter((product) => (product.categories || []).some((category) => parentIds.has(category.id)))
      .map((product) => product.id));
  }

  if (parentNode.resource === 'products' && relationMeta.key === 'categories') {
    return new Set((allOptions.products || [])
      .filter((product) => parentIds.has(product.id))
      .flatMap((product) => product.categories || [])
      .map((category) => category.id));
  }

  if (parentNode.resource === 'products' && relationMeta.key === 'brand') {
    return new Set((allOptions.products || [])
      .filter((product) => parentIds.has(product.id) && product.brandId)
      .map((product) => product.brandId));
  }

  if (parentNode.resource === 'brands' && relationMeta.key === 'products') {
    return new Set((allOptions.products || [])
      .filter((product) => parentIds.has(product.brandId))
      .map((product) => product.id));
  }

  return null;
};

const pruneRelatedSelections = (node, allOptions) => {
  if (!Array.isArray(node.relations) || node.relations.length === 0) return node;

  const relations = node.relations.map((relationNode) => {
    const relationMeta = (RESOURCE_RELATIONS[node.resource] || []).find((item) => item.key === relationNode.relation);
    const relatedIds = getRelatedOptionIds(node, relationMeta, allOptions);
    const selectedIds = relationNode.mode === 'selected' && relatedIds
      ? (relationNode.selectedIds || []).filter((id) => relatedIds.has(id))
      : relationNode.selectedIds;

    return pruneRelatedSelections({ ...relationNode, selectedIds }, allOptions);
  });

  return { ...node, relations };
};

const ApiBuilderPage = () => {
  const [definitions, setDefinitions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [options, setOptions] = useState({ categories: [], products: [], brands: [], pages: [], menus: [], media: [] });
  const [preview, setPreview] = useState(null);
  const [previewQueryText, setPreviewQueryText] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { notify } = useNotification();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.SETTINGS_MANAGE);

  const selectedDefinition = useMemo(
    () => definitions.find((item) => item.id === selectedId),
    [definitions, selectedId]
  );
  const publicUrl = form.slug ? buildPublicApiUrl(form.slug) : '';

  const loadDefinitions = async () => {
    const response = await getApiDefinitions({ includeInactive: true });
    const rows = response.data || [];
    setDefinitions(rows);
    if (!selectedId && rows.length) {
      setSelectedId(rows[0].id);
      setForm({
        name: rows[0].name,
        slug: rows[0].slug,
        description: rows[0].description || '',
        isActive: rows[0].isActive,
        config: rows[0].config || emptyForm.config,
      });
    }
  };

  useEffect(() => {
    loadDefinitions().catch((error) => notify(getApiErrorMessage(error, 'Failed to load API definitions.'), 'error'));
    Promise.allSettled([
      api.get('/categories'),
      api.get('/products', { params: { limit: 100 } }),
      api.get('/brands', { params: { limit: 100 } }),
      api.get('/pages'),
      api.get('/menus', { params: { includeInactive: true } }),
      api.get('/media', { params: { limit: 100 } }),
    ]).then(([categories, products, brands, pages, menus, media]) => {
      setOptions({
        categories: categories.status === 'fulfilled' ? flattenCategories(extractArray(categories.value)) : [],
        products: products.status === 'fulfilled' ? extractArray(products.value) : [],
        brands: brands.status === 'fulfilled' ? extractArray(brands.value) : [],
        pages: pages.status === 'fulfilled' ? extractArray(pages.value) : [],
        menus: menus.status === 'fulfilled' ? extractArray(menus.value) : [],
        media: media.status === 'fulfilled' ? extractArray(media.value) : [],
      });
    });
  }, []);

  const setRoot = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const setConfig = (patch) => setForm((current) => ({ ...current, config: { ...current.config, ...patch } }));
  const setBlocks = (blocks) => setConfig({ blocks });
  const updateBlock = (index, patch) => {
    const blocks = [...(form.config.blocks || [])];
    blocks[index] = { ...blocks[index], ...patch };
    setBlocks(blocks);
  };

  const updateNode = (blockIndex, path, patch) => {
    const blocks = [...(form.config.blocks || [])];
    if (!path.length) {
      blocks[blockIndex] = pruneRelatedSelections({ ...blocks[blockIndex], ...patch }, options);
      setBlocks(blocks);
      return;
    }

    const visit = (node, depth = 0) => {
      const relationIndex = path[depth];
      const relations = [...(node.relations || [])];
      if (depth === path.length - 1) {
        relations[relationIndex] = pruneRelatedSelections({ ...relations[relationIndex], ...patch }, options);
      } else {
        relations[relationIndex] = visit(relations[relationIndex], depth + 1);
      }
      return { ...node, relations };
    };

    blocks[blockIndex] = visit(blocks[blockIndex]);
    setBlocks(blocks);
  };

  const addRelation = (blockIndex, path, relationMeta) => {
    const blocks = [...(form.config.blocks || [])];
    const relationNode = {
      ...newBlock(relationMeta.resource, relationMeta.key),
      key: relationMeta.key,
    };

    if (!path.length) {
      blocks[blockIndex] = {
        ...blocks[blockIndex],
        relations: [...(blocks[blockIndex].relations || []), relationNode],
      };
      setBlocks(blocks);
      return;
    }

    const visit = (node, depth = 0) => {
      const relationIndex = path[depth];
      const relations = [...(node.relations || [])];
      if (depth === path.length - 1) {
        relations[relationIndex] = {
          ...relations[relationIndex],
          relations: [...(relations[relationIndex].relations || []), relationNode],
        };
      } else {
        relations[relationIndex] = visit(relations[relationIndex], depth + 1);
      }
      return { ...node, relations };
    };

    blocks[blockIndex] = visit(blocks[blockIndex]);
    setBlocks(blocks);
  };

  const removeRelation = (blockIndex, path) => {
    const blocks = [...(form.config.blocks || [])];
    const visit = (node, depth = 0) => {
      const relationIndex = path[depth];
      const relations = [...(node.relations || [])];
      if (depth === path.length - 1) {
        relations.splice(relationIndex, 1);
      } else {
        relations[relationIndex] = visit(relations[relationIndex], depth + 1);
      }
      return { ...node, relations };
    };
    blocks[blockIndex] = visit(blocks[blockIndex]);
    setBlocks(blocks);
  };

  const handleSelectDefinition = (definition) => {
    if (!definition) {
      setSelectedId(null);
      setForm({ ...emptyForm, config: { ...emptyForm.config, blocks: [newBlock('products')] } });
      setPreview(null);
      return;
    }
    setSelectedId(definition.id);
    setForm({
      name: definition.name,
      slug: definition.slug,
      description: definition.description || '',
      isActive: definition.isActive,
      config: definition.config || emptyForm.config,
    });
    setPreview(null);
  };

  const handleAddBlock = () => setBlocks([...(form.config.blocks || []), newBlock('products')]);
  const handleRemoveBlock = (index) => setBlocks((form.config.blocks || []).filter((_, itemIndex) => itemIndex !== index));

  const handleSave = async () => {
    if (!canManage) {
      notify('You do not have permission to manage API Builder.', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        slug: form.slug,
        description: form.description,
        isActive: form.isActive,
        config: form.config,
      };
      const response = selectedId
        ? await updateApiDefinition(selectedId, payload)
        : await createApiDefinition(payload);
      const saved = response.data;
      setSelectedId(saved.id);
      setForm({
        name: saved.name,
        slug: saved.slug,
        description: saved.description || '',
        isActive: saved.isActive,
        config: saved.config,
      });
      await loadDefinitions();
      notify('API definition saved.', 'success');
    } catch (error) {
      notify(getApiErrorMessage(error, 'Failed to save API definition.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    setLoading(true);
    try {
      const response = await previewApiDefinition(form.config, parseQueryText(previewQueryText));
      setPreview(response.data);
    } catch (error) {
      notify(getApiErrorMessage(error, 'Failed to generate preview.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    notify('API URL copied.', 'success');
  };

  const handleDelete = async () => {
    if (!selectedId || !canManage) return;
    await deleteApiDefinition(selectedId);
    notify('API definition deleted.', 'success');
    setSelectedId(null);
    setForm({ ...emptyForm, config: { ...emptyForm.config, blocks: [newBlock('products')] } });
    await loadDefinitions();
  };

  const renderFieldPicker = (node, onPatch) => (
    <Autocomplete
      multiple
      size="small"
      options={RESOURCE_FIELDS[node.resource] || []}
      value={node.fields || []}
      onChange={(_, value) => onPatch({ fields: value })}
      renderTags={(value, getTagProps) => value.map((option, tagIndex) => (
        <Chip size="small" label={option} {...getTagProps({ index: tagIndex })} key={option} />
      ))}
      renderInput={(params) => <TextField {...params} label="Fields in response" placeholder="Pick fields" />}
    />
  );

  const renderFilters = (node, onPatch) => (
    <Box>
      <Stack spacing={1.25}>
        {(node.filters || []).map((filter, filterIndex) => (
          <Grid container spacing={1} key={`${node.id}-filter-${filterIndex}`}>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Field</InputLabel>
                <Select
                  label="Field"
                  value={filter.field || ''}
                  onChange={(event) => {
                    const filters = [...(node.filters || [])];
                    filters[filterIndex] = { ...filters[filterIndex], field: event.target.value };
                    onPatch({ filters });
                  }}
                >
                  {(FILTER_FIELDS[node.resource] || []).map((field) => <MenuItem key={field} value={field}>{field}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Operator</InputLabel>
                <Select
                  label="Operator"
                  value={filter.operator || 'equals'}
                  onChange={(event) => {
                    const filters = [...(node.filters || [])];
                    filters[filterIndex] = { ...filters[filterIndex], operator: event.target.value };
                    onPatch({ filters });
                  }}
                >
                  {OPERATORS.map((operator) => <MenuItem key={operator} value={operator}>{operator}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Source</InputLabel>
                <Select
                  label="Source"
                  value={filter.source || (filter.param ? 'query' : 'static')}
                  onChange={(event) => {
                    const filters = [...(node.filters || [])];
                    filters[filterIndex] = {
                      ...filters[filterIndex],
                      source: event.target.value,
                      param: filters[filterIndex].param || filters[filterIndex].field,
                    };
                    onPatch({ filters });
                  }}
                >
                  <MenuItem value="query">URL query</MenuItem>
                  <MenuItem value="static">Fixed value</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2.5}>
              <TextField
                fullWidth
                size="small"
                label={(filter.source || (filter.param ? 'query' : 'static')) === 'static' ? 'Value' : 'Query param'}
                value={(filter.source || (filter.param ? 'query' : 'static')) === 'static' ? (filter.value ?? '') : (filter.param || filter.field || '')}
                onChange={(event) => {
                  const filters = [...(node.filters || [])];
                  filters[filterIndex] = (filters[filterIndex].source || (filters[filterIndex].param ? 'query' : 'static')) === 'static'
                    ? { ...filters[filterIndex], value: event.target.value }
                    : { ...filters[filterIndex], param: event.target.value };
                  onPatch({ filters });
                }}
                helperText={(filter.source || (filter.param ? 'query' : 'static')) === 'query' ? `Use ?${filter.param || filter.field || 'param'}=...` : undefined}
              />
            </Grid>
            <Grid item xs={10} md={1.5}>
              <TextField
                fullWidth
                size="small"
                label="Fallback"
                value={filter.defaultValue ?? ''}
                onChange={(event) => {
                  const filters = [...(node.filters || [])];
                  filters[filterIndex] = { ...filters[filterIndex], defaultValue: event.target.value };
                  onPatch({ filters });
                }}
              />
            </Grid>
            <Grid item xs={2} md={1}>
              <IconButton
                color="error"
                onClick={() => onPatch({ filters: (node.filters || []).filter((_, itemIndex) => itemIndex !== filterIndex) })}
                aria-label="Remove filter"
              >
                <DeleteOutlineIcon />
              </IconButton>
            </Grid>
          </Grid>
        ))}
      </Stack>
      <Button
        size="small"
        startIcon={<AddIcon />}
        sx={{ mt: 1.25 }}
        onClick={() => {
          const field = (FILTER_FIELDS[node.resource] || [])[0] || '';
          onPatch({ filters: [...(node.filters || []), { field, operator: 'equals', source: 'query', param: field, defaultValue: '' }] });
        }}
      >
        Add Filter
      </Button>
    </Box>
  );

  const renderSelectedPicker = (node, onPatch, relationMeta = null, parentNode = null) => {
    const baseOptions = options[node.resource] || [];
    const relatedIds = getRelatedOptionIds(parentNode, relationMeta, options);
    const resourceOptions = relatedIds
      ? baseOptions.filter((option) => relatedIds.has(option.id))
      : baseOptions;
    const scopedOutSelectedIds = relatedIds
      ? (node.selectedIds || []).filter((id) => !relatedIds.has(id))
      : [];

    if (!resourceOptions.length) {
      return (
        <TextField
          fullWidth
          size="small"
          label="Selected IDs"
          value={(node.selectedIds || []).join(', ')}
          onChange={(event) => onPatch({ selectedIds: event.target.value.split(',').map((id) => id.trim()).filter(Boolean) })}
          helperText={relatedIds ? 'No related records found for the selected parent records.' : 'Enter comma-separated IDs for resources that do not have a picker.'}
        />
      );
    }
    return (
      <Box>
        <Autocomplete
          multiple
          size="small"
          options={resourceOptions}
          getOptionLabel={(option) => option.label || option.name || option.title || option.filename || option.slug || option.id}
          value={resourceOptions.filter((option) => (node.selectedIds || []).includes(option.id))}
          onChange={(_, value) => onPatch({ selectedIds: value.map((item) => item.id) })}
          renderInput={(params) => (
            <TextField
              {...params}
              label={`Pick ${RESOURCE_LABELS[node.resource]}`}
              placeholder="Search and select"
              helperText={relatedIds ? `Showing only records related to the selected ${RESOURCE_LABELS[parentNode.resource] || parentNode.resource}.` : undefined}
            />
          )}
        />
        {scopedOutSelectedIds.length > 0 && (
          <Alert severity="warning" sx={{ mt: 1 }}>
            {scopedOutSelectedIds.length} previously selected item(s) are not related to the selected parent and will not appear in this include.
          </Alert>
        )}
      </Box>
    );
  };

  const renderPaginationControls = (node, onPatch) => {
    const pagination = node.pagination || {};
    const updatePagination = (patch) => onPatch({ pagination: { ...pagination, ...patch } });

    if (!pagination.enabled) {
      return (
        <Grid container spacing={1.5} alignItems="center">
          <Grid item xs={12} md={5}>
            <TextField
              fullWidth
              size="small"
              type="number"
              label="Limit"
              value={node.limit || 10}
              onChange={(event) => onPatch({ limit: Number(event.target.value) })}
              inputProps={{ min: 1, max: 200 }}
            />
          </Grid>
          <Grid item xs={12} md={7}>
            <FormControlLabel
              control={<Switch checked={false} onChange={(event) => updatePagination({ enabled: event.target.checked })} />}
              label="Use pagination instead"
            />
          </Grid>
        </Grid>
      );
    }

    return (
      <Grid container spacing={1.5} alignItems="center">
        <Grid item xs={12} md={3}>
          <FormControlLabel
            control={<Switch checked onChange={(event) => updatePagination({ enabled: event.target.checked })} />}
            label="Paginate"
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            size="small"
            label="Page param"
            value={pagination.pageParam || 'page'}
            onChange={(event) => updatePagination({ pageParam: event.target.value })}
          />
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth
            size="small"
            label="Size param"
            value={pagination.pageSizeParam || 'pageSize'}
            onChange={(event) => updatePagination({ pageSizeParam: event.target.value })}
          />
        </Grid>
        <Grid item xs={6} md={1.5}>
          <TextField
            fullWidth
            size="small"
            type="number"
            label="Page"
            value={pagination.defaultPage || 1}
            onChange={(event) => updatePagination({ defaultPage: Number(event.target.value) })}
            inputProps={{ min: 1 }}
          />
        </Grid>
        <Grid item xs={6} md={1.5}>
          <TextField
            fullWidth
            size="small"
            type="number"
            label="Page size"
            value={pagination.defaultPageSize || node.limit || 10}
            onChange={(event) => updatePagination({ defaultPageSize: Number(event.target.value) })}
            inputProps={{ min: 1, max: 200 }}
            helperText={`?${pagination.pageParam || 'page'}=2&${pagination.pageSizeParam || 'pageSize'}=20`}
          />
        </Grid>
      </Grid>
    );
  };

  const renderRelationNode = (node, blockIndex, path = []) => {
    const relationOptions = RESOURCE_RELATIONS[node.resource] || [];
    const patchNode = (patch) => updateNode(blockIndex, path, patch);

    return (
      <Box>
        {node.resource === 'settings' && (
          <TextField
            fullWidth
            size="small"
            label="Settings group"
            value={node.group || ''}
            onChange={(event) => patchNode({ group: event.target.value })}
            helperText="Optional. Example: general, seo, catalog, homepage, features."
            sx={{ mb: 2 }}
          />
        )}

        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
          {relationOptions.map((relation) => (
            <Button
              key={relation.key}
              size="small"
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => addRelation(blockIndex, path, relation)}
            >
              {relation.label}
            </Button>
          ))}
          {!relationOptions.length && (
            <Typography variant="body2" color="text.secondary">
              No relations available for this resource.
            </Typography>
          )}
        </Stack>

        <Stack spacing={1.5}>
          {(node.relations || []).map((relationNode, relationIndex) => {
            const childPath = [...path, relationIndex];
            const childPatch = (patch) => updateNode(blockIndex, childPath, patch);
            const relationMeta = (RESOURCE_RELATIONS[node.resource] || []).find((item) => item.key === relationNode.relation);

            return (
              <Paper key={`${relationNode.relation}-${relationIndex}`} variant="outlined" sx={{ p: 2, borderRadius: 1.5, bgcolor: 'action.hover' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2" fontWeight={800}>
                      {relationMeta?.label || relationNode.relation} → {RESOURCE_LABELS[relationNode.resource] || relationNode.resource}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      This include has its own selection, filters, fields, limits, and nested includes.
                    </Typography>
                  </Box>
                  <FormControlLabel
                    control={<Switch checked={relationNode.enabled !== false} onChange={(event) => childPatch({ enabled: event.target.checked })} />}
                    label="On"
                  />
                  <IconButton color="error" onClick={() => removeRelation(blockIndex, childPath)} aria-label="Remove include">
                    <DeleteOutlineIcon />
                  </IconButton>
                </Box>

                <Grid container spacing={1.5}>
                  <Grid item xs={12} md={4}>
                    <TextField fullWidth size="small" label="Response key" value={relationNode.key || ''} onChange={(event) => childPatch({ key: event.target.value })} />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Selection</InputLabel>
                      <Select label="Selection" value={relationNode.mode || 'all'} onChange={(event) => childPatch({ mode: event.target.value })}>
                        <MenuItem value="all">All matching records</MenuItem>
                        <MenuItem value="selected">Only picked records</MenuItem>
                        <MenuItem value="filtered">Only filter results</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    {renderPaginationControls(relationNode, childPatch)}
                  </Grid>
                  {relationNode.mode === 'selected' && (
                    <Grid item xs={12}>{renderSelectedPicker(relationNode, childPatch, relationMeta, node)}</Grid>
                  )}
                  <Grid item xs={12}>{renderFieldPicker(relationNode, childPatch)}</Grid>
                  <Grid item xs={12}>
                    <Typography variant="caption" color="text.secondary">Filters</Typography>
                    {renderFilters(relationNode, childPatch)}
                  </Grid>
                  <Grid item xs={12}>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="caption" color="text.secondary">Nested includes</Typography>
                    {renderRelationNode(relationNode, blockIndex, childPath)}
                  </Grid>
                </Grid>
              </Paper>
            );
          })}
        </Stack>
      </Box>
    );
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4">API Builder</Typography>
          <Typography variant="body2" color="text.secondary">
            Build public, dynamic API responses from catalog, content, menu, and setting data.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<PlayArrowIcon />} onClick={handlePreview} disabled={loading}>
            Preview
          </Button>
          <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={saving || !canManage}>
            Save
          </Button>
        </Stack>
      </Box>

      {!canManage && (
        <Alert severity="info" sx={{ mb: 2 }}>
          You have read-only access. API definitions can be previewed, but saving is disabled.
        </Alert>
      )}

      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={3}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
            <Button fullWidth variant="outlined" startIcon={<AddIcon />} onClick={() => handleSelectDefinition(null)} sx={{ mb: 1.5 }}>
              New API
            </Button>
            <Stack spacing={1}>
              {definitions.map((definition) => (
                <Paper
                  key={definition.id}
                  variant="outlined"
                  onClick={() => handleSelectDefinition(definition)}
                  sx={{
                    p: 1.5,
                    borderRadius: 1.5,
                    cursor: 'pointer',
                    borderColor: selectedId === definition.id ? 'primary.main' : 'divider',
                    bgcolor: selectedId === definition.id ? 'primary.light' : 'background.paper',
                  }}
                >
                  <Typography variant="body2" fontWeight={800}>{definition.name}</Typography>
                  <Typography variant="caption" color="text.secondary">/{definition.slug}</Typography>
                  <Box sx={{ mt: 0.75 }}>
                    <Chip size="small" color={definition.isActive ? 'success' : 'default'} label={definition.isActive ? 'Active' : 'Off'} />
                  </Box>
                </Paper>
              ))}
              {!definitions.length && (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                  No APIs created yet.
                </Typography>
              )}
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} lg={6}>
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, mb: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={5}>
                <TextField fullWidth size="small" label="API Name" value={form.name} onChange={(event) => setRoot('name', event.target.value)} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth size="small" label="Slug" value={form.slug} onChange={(event) => setRoot('slug', event.target.value)} />
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControlLabel
                  control={<Switch checked={Boolean(form.isActive)} onChange={(event) => setRoot('isActive', event.target.checked)} />}
                  label="Active"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth size="small" label="Description" value={form.description} onChange={(event) => setRoot('description', event.target.value)} />
              </Grid>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <TextField fullWidth size="small" label="API URL" value={publicUrl} InputProps={{ readOnly: true }} />
                  <Tooltip title="Copy API URL">
                    <span>
                      <IconButton color="primary" onClick={handleCopy} disabled={!form.slug}>
                        <ContentCopyIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              </Grid>
            </Grid>
          </Paper>

          <Stack spacing={2}>
            {(form.config.blocks || []).map((block, index) => (
              <Paper key={block.id || index} variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <CodeIcon color="primary" />
                  <Typography variant="h6" sx={{ flex: 1 }}>Block {index + 1}</Typography>
                  <FormControlLabel
                    control={<Switch checked={block.enabled !== false} onChange={(event) => updateBlock(index, { enabled: event.target.checked })} />}
                    label="Enabled"
                  />
                  <IconButton color="error" onClick={() => handleRemoveBlock(index)} disabled={(form.config.blocks || []).length <= 1} aria-label="Remove block">
                    <DeleteOutlineIcon />
                  </IconButton>
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <TextField fullWidth size="small" label="Response key" value={block.key || ''} onChange={(event) => updateBlock(index, { key: event.target.value })} />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Resource</InputLabel>
                      <Select
                        label="Resource"
                        value={block.resource}
                        onChange={(event) => {
                          const next = newBlock(event.target.value);
                          updateBlock(index, { ...next, id: block.id, key: event.target.value });
                        }}
                      >
                        {Object.entries(RESOURCE_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Selection</InputLabel>
                      <Select label="Selection" value={block.mode || 'all'} onChange={(event) => updateBlock(index, { mode: event.target.value })}>
                        <MenuItem value="all">All matching records</MenuItem>
                        <MenuItem value="selected">Only picked records</MenuItem>
                        <MenuItem value="filtered">Only filter results</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  {block.mode === 'selected' && (
                    <Grid item xs={12}>{renderSelectedPicker(block, (patch) => updateNode(index, [], patch))}</Grid>
                  )}
                  <Grid item xs={12}>
                    {renderPaginationControls(block, (patch) => updateNode(index, [], patch))}
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField fullWidth size="small" label="Sort by" value={block.sortBy || ''} onChange={(event) => updateBlock(index, { sortBy: event.target.value })} />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Sort order</InputLabel>
                      <Select label="Sort order" value={block.sortOrder || 'ASC'} onChange={(event) => updateBlock(index, { sortOrder: event.target.value })}>
                        <MenuItem value="ASC">Ascending</MenuItem>
                        <MenuItem value="DESC">Descending</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>{renderFieldPicker(block, (patch) => updateNode(index, [], patch))}</Grid>
                  <Grid item xs={12}>
                    <Divider sx={{ my: 0.5 }} />
                    <Typography variant="subtitle2" sx={{ mt: 1, mb: 1 }}>Filters</Typography>
                    {renderFilters(block, (patch) => updateNode(index, [], patch))}
                  </Grid>
                  <Grid item xs={12}>
                    <Divider sx={{ my: 0.5 }} />
                    <Typography variant="subtitle2" sx={{ mt: 1, mb: 1 }}>Includes</Typography>
                    {renderRelationNode(block, index, [])}
                  </Grid>
                </Grid>
              </Paper>
            ))}
          </Stack>

          <Button startIcon={<AddIcon />} variant="outlined" onClick={handleAddBlock} sx={{ mt: 2 }}>
            Add Resource Block
          </Button>
        </Grid>

        <Grid item xs={12} lg={3}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={800} gutterBottom>Response</Typography>
            <Stack spacing={1.25}>
              <FormControl fullWidth size="small">
                <InputLabel>Response mode</InputLabel>
                <Select
                  label="Response mode"
                  value={form.config.responseMode || 'object'}
                  onChange={(event) => setConfig({ responseMode: event.target.value })}
                >
                  <MenuItem value="object">Object by block key</MenuItem>
                  <MenuItem value="array">Array of blocks</MenuItem>
                </Select>
              </FormControl>
              <FormControlLabel
                control={<Switch checked={form.config.includeMeta !== false} onChange={(event) => setConfig({ includeMeta: event.target.checked })} />}
                label="Include metadata"
              />
              <TextField
                fullWidth
                size="small"
                label="Preview query"
                placeholder="name=shirt&minPrice=100"
                value={previewQueryText}
                onChange={(event) => setPreviewQueryText(event.target.value)}
                helperText="Matches the public URL query string used by dynamic filters."
              />
              {selectedDefinition && canManage && (
                <Button color="error" variant="outlined" startIcon={<DeleteOutlineIcon />} onClick={handleDelete}>
                  Delete API
                </Button>
              )}
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight={800} gutterBottom>Preview JSON</Typography>
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 1.5,
                bgcolor: '#111827',
                color: '#f9fafb',
                borderRadius: 1,
                minHeight: 420,
                maxHeight: 620,
                overflow: 'auto',
                fontSize: 12,
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                border: '1px solid',
                borderColor: 'rgba(255,255,255,0.12)',
                textShadow: 'none',
                '&::selection': {
                  bgcolor: '#2563eb',
                  color: '#ffffff',
                },
              }}
            >
              {preview ? JSON.stringify(preview, null, 2) : 'Click Preview to test this API response.'}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ApiBuilderPage;
