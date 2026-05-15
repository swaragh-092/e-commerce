/**
 * ProductCustomTabs.jsx
 *
 * Admin UI component for managing Product Custom Tabs.
 * Features:
 *   - Add / remove tabs dynamically
 *   - Quill-style rich-text editor per tab (via contentEditable + execCommand polyfill)
 *   - Move tabs up/down (drag-and-drop-style ordering with arrow buttons)
 *   - Toggle active/inactive per tab
 *   - Preview / Code toggle
 *   - Saves all tabs atomically via PUT /products/:id/tabs (full sync)
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    IconButton,
    TextField,
    Switch,
    FormControlLabel,
    Tooltip,
    Divider,
    Alert,
    CircularProgress,
    Chip,
    Collapse,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    List,
    ListItem,
    ListItemText,
    ListItemAvatar,
    Avatar,
    InputAdornment,
    Autocomplete,
} from '@mui/material';
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    KeyboardArrowUp as ArrowUpIcon,
    KeyboardArrowDown as ArrowDownIcon,
    Save as SaveIcon,
    Code as CodeIcon,
    Visibility as PreviewIcon,
    DragIndicator as DragIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    ContentCopy as CloneIcon,
    Search as SearchIcon,
} from '@mui/icons-material';
import DOMPurify from 'dompurify';
import productTabService from '../../services/productTabService';
import { getProducts } from '../../services/productService';
import { useNotification } from '../../context/NotificationContext';

// ─── Constants ──────────────────────────────────────────────────────────────
const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];

// ─── Helpers ────────────────────────────────────────────────────────────────
const isValidUrl = (url) => {
    if (!url) return false;
    try {
        const parsed = new URL(url);
        return SAFE_PROTOCOLS.includes(parsed.protocol);
    } catch {
        // Fallback for relative paths if needed, but here we require absolute for safety
        return false;
    }
};

const normalizeHtml = (html) => {
    if (!html) return '';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.innerHTML.trim();
};

let nextNewTabId = 1;
const generateUniqueId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return `new-${crypto.randomUUID()}`;
    }
    return `new-${Date.now()}-${nextNewTabId++}`;
};

// ─── Rich Text Toolbar ──────────────────────────────────────────────────────
const TOOLBAR_ACTIONS = [
    { label: 'B',    cmd: 'bold',          title: 'Bold' },
    { label: 'I',    cmd: 'italic',        title: 'Italic' },
    { label: 'U',    cmd: 'underline',     title: 'Underline' },
    { label: 'S',    cmd: 'strikeThrough', title: 'Strikethrough' },
    null, // separator
    { label: 'H2',   cmd: 'formatBlock',   value: 'H2', title: 'Heading 2' },
    { label: 'H3',   cmd: 'formatBlock',   value: 'H3', title: 'Heading 3' },
    null,
    { label: 'UL',   cmd: 'insertUnorderedList', title: 'Bullet list' },
    { label: 'OL',   cmd: 'insertOrderedList',   title: 'Numbered list' },
    null,
    { label: 'Link', cmd: 'createLink',    title: 'Insert Link' },
];

const RichToolbar = ({ editorRef }) => {
    const exec = (cmd, value) => {
        if (cmd === 'createLink') {
            const url = window.prompt('Enter URL:', 'https://');
            if (!url) return;
            if (!isValidUrl(url)) {
                alert('Invalid URL. Please use http, https, mailto, or tel.');
                return;
            }
            
            // Selection-based link insertion (replacement for execCommand)
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.rel = 'noopener noreferrer';
                anchor.target = '_blank';
                
                if (range.collapsed) {
                    anchor.textContent = url;
                    range.insertNode(anchor);
                } else {
                    anchor.appendChild(range.extractContents());
                    range.insertNode(anchor);
                }
            }
        } else {
            document.execCommand(cmd, false, value || null);
        }
        editorRef.current?.focus();
    };

    return (
        <Box
            sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 0.5,
                px: 1,
                py: 0.5,
                borderBottom: '1px solid',
                borderColor: 'divider',
                bgcolor: 'grey.50',
            }}
        >
            {TOOLBAR_ACTIONS.map((action, i) =>
                action === null ? (
                    <Divider key={`sep-${i}`} orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                ) : (
                    <Tooltip key={action.cmd + action.label} title={action.title}>
                        <Button
                            size="small"
                            variant="text"
                            sx={{
                                minWidth: 32,
                                px: 0.5,
                                py: 0.25,
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                color: 'text.secondary',
                                '&:hover': { bgcolor: 'primary.50', color: 'primary.main' },
                            }}
                            onMouseDown={(e) => {
                                e.preventDefault(); // prevent blur on editor
                                exec(action.cmd, action.value);
                            }}
                        >
                            {action.label}
                        </Button>
                    </Tooltip>
                )
            )}
        </Box>
    );
};

// ─── Rich Text Editor ───────────────────────────────────────────────────────
const RichEditor = ({ value, onChange, placeholder = 'Enter tab content…' }) => {
    const editorRef = useRef(null);
    const lastHtml = useRef(value || '');
    const [codeMode, setCodeMode] = useState(false);

    // Sync incoming value changes (e.g., on tab load)
    useEffect(() => {
        if (editorRef.current && !codeMode) {
            const current = normalizeHtml(editorRef.current.innerHTML);
            const normalizedValue = normalizeHtml(value);
            if (normalizedValue !== current) {
                editorRef.current.innerHTML = normalizedValue;
                lastHtml.current = normalizedValue;
            }
        }
    }, [value, codeMode]);

    const handleInput = () => {
        if (!editorRef.current) return;
        // Sanitize on input for defense-in-depth
        const rawHtml = editorRef.current.innerHTML;
        const sanitized = DOMPurify.sanitize(rawHtml);
        if (sanitized !== lastHtml.current) {
            lastHtml.current = sanitized;
            onChange(sanitized);
        }
    };

    return (
        <Box
            sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                overflow: 'hidden',
            }}
        >
            {/* Toolbar header row */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {!codeMode ? (
                    <RichToolbar editorRef={editorRef} />
                ) : (
                    <Box sx={{ px: 1, py: 0.5, bgcolor: 'grey.50', flex: 1 }}>
                        <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                            HTML Source
                        </Typography>
                    </Box>
                )}
                <Tooltip title={codeMode ? 'Switch to Visual' : 'Switch to HTML'}>
                    <IconButton
                        size="small"
                        sx={{ m: 0.5 }}
                        onClick={() => setCodeMode((m) => !m)}
                        color={codeMode ? 'primary' : 'default'}
                    >
                        {codeMode ? <PreviewIcon fontSize="small" /> : <CodeIcon fontSize="small" />}
                    </IconButton>
                </Tooltip>
            </Box>

            {/* Visual editor */}
            {!codeMode && (
                <Box
                    ref={editorRef}
                    contentEditable
                    role="textbox"
                    aria-multiline="true"
                    aria-label={placeholder}
                    tabIndex={0}
                    suppressContentEditableWarning
                    onInput={handleInput}
                    data-placeholder={placeholder}
                    sx={{
                        minHeight: 140,
                        px: 2,
                        py: 1.5,
                        outline: 'none',
                        fontSize: '0.875rem',
                        lineHeight: 1.7,
                        color: 'text.primary',
                        '&:focus': {
                            boxShadow: 'inset 0 0 0 2px rgba(25, 118, 210, 0.15)',
                        },
                        '&:empty:before': {
                            content: 'attr(data-placeholder)',
                            color: 'text.disabled',
                            pointerEvents: 'none',
                        },
                        // Render typical richtext styles inside the editor
                        '& h2': { fontSize: '1.25rem', fontWeight: 700, my: 1 },
                        '& h3': { fontSize: '1.1rem', fontWeight: 600, my: 0.75 },
                        '& ul, & ol': { pl: 3, my: 0.5 },
                        '& a': { color: 'primary.main' },
                        '& table': { borderCollapse: 'collapse', width: '100%' },
                        '& th, & td': { border: '1px solid', borderColor: 'divider', p: 0.75 },
                    }}
                />
            )}

            {/* Raw HTML textarea */}
            {codeMode && (
                <TextField
                    multiline
                    fullWidth
                    minRows={5}
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    inputProps={{ style: { fontFamily: 'monospace', fontSize: 13 } }}
                    sx={{ '& fieldset': { border: 'none' } }}
                />
            )}
        </Box>
    );
};

// ─── Single Tab Card ─────────────────────────────────────────────────────────
const TabCard = ({
    tab,
    index,
    total,
    onChange,
    onRemove,
    onMoveUp,
    onMoveDown,
}) => {
    const [expanded, setExpanded] = useState(true);

    return (
        <Paper
            variant="outlined"
            sx={{
                mb: 2,
                overflow: 'hidden',
                borderColor: tab.isActive ? 'divider' : 'error.light',
                transition: 'box-shadow 0.15s',
                '&:hover': { boxShadow: 2 },
            }}
        >
            {/* ── Header ───────────────────────────────────────────────────── */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 2,
                    py: 1.25,
                    flexWrap: 'wrap',
                    bgcolor: tab.isActive ? 'grey.50' : 'error.50',
                    borderBottom: expanded ? '1px solid' : 'none',
                    borderColor: 'divider',
                }}
            >
                {/* Drag handle visual (non-interactive) */}
                <DragIcon sx={{ color: 'text.disabled', cursor: 'grab', flexShrink: 0 }} />

                {/* Tab title (inline edit) */}
                <TextField
                    size="small"
                    placeholder="Tab Title *"
                    value={tab.title}
                    onChange={(e) => onChange({ title: e.target.value })}
                    sx={{ flex: 1 }}
                    inputProps={{ maxLength: 255 }}
                    variant="standard"
                    InputProps={{ disableUnderline: !tab.title }}
                />

                {/* Active badge */}
                {!tab.isActive && (
                    <Chip label="Inactive" size="small" color="error" variant="outlined" sx={{ flexShrink: 0 }} />
                )}

                {/* Reorder arrows */}
                <Tooltip title="Move up">
                    <span>
                        <IconButton size="small" onClick={onMoveUp} disabled={index === 0}>
                            <ArrowUpIcon fontSize="small" />
                        </IconButton>
                    </span>
                </Tooltip>
                <Tooltip title="Move down">
                    <span>
                        <IconButton size="small" onClick={onMoveDown} disabled={index === total - 1}>
                            <ArrowDownIcon fontSize="small" />
                        </IconButton>
                    </span>
                </Tooltip>

                {/* Collapse toggle */}
                <Tooltip title={expanded ? 'Collapse' : 'Expand'}>
                    <IconButton size="small" onClick={() => setExpanded((v) => !v)}>
                        {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                    </IconButton>
                </Tooltip>

                {/* Remove */}
                <Tooltip title="Remove tab">
                    <IconButton size="small" color="error" onClick={onRemove}>
                        <DeleteIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Box>

            {/* ── Body ─────────────────────────────────────────────────────── */}
            <Collapse in={expanded}>
                <Box sx={{ p: 2 }}>
                    {/* Active / Inactive toggle */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', mb: 1 }}>
                        <FormControlLabel
                            control={
                                <Switch
                                    size="small"
                                    checked={tab.isActive}
                                    onChange={(e) => onChange({ isActive: e.target.checked })}
                                    color="success"
                                />
                            }
                            label={
                                <Typography variant="caption" color={tab.isActive ? 'success.main' : 'text.disabled'}>
                                    {tab.isActive ? 'Active' : 'Inactive'}
                                </Typography>
                            }
                            labelPlacement="start"
                            sx={{ ml: 0 }}
                        />
                    </Box>

                    <RichEditor
                        value={tab.content}
                        onChange={(html) => onChange({ content: html })}
                        placeholder="Enter tab content (supports rich HTML)…"
                    />
                </Box>
            </Collapse>
        </Paper>
    );
};

// ─── Empty State ─────────────────────────────────────────────────────────────
const EmptyState = ({ onAdd }) => (
    <Box
        sx={{
            textAlign: 'center',
            py: 6,
            px: 3,
            border: '2px dashed',
            borderColor: 'divider',
            borderRadius: 2,
            bgcolor: 'grey.50',
        }}
    >
        <Typography variant="h6" color="text.secondary" gutterBottom>
            No custom tabs yet
        </Typography>
        <Typography variant="body2" color="text.disabled" mb={3}>
            Add informational tabs like "Recommended Age", "Material", "Care Instructions", etc.
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={onAdd} size="large">
            Add First Tab
        </Button>
    </Box>
);

// ─── Clone from Product Dialog ─────────────────────────────────────────────
const CloneTabsDialog = ({ open, onClose, onClone, currentProductId }) => {
    const [inputValue, setInputValue] = useState('');
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open) {
            setInputValue('');
            setOptions([]);
            return;
        }

        const controller = new AbortController();

        const timer = setTimeout(async () => {
            if (!inputValue.trim()) {
                setOptions([]);
                return;
            }
            setLoading(true);
            try {
                const res = await getProducts({ 
                    search: inputValue.trim(), 
                    limit: 20,
                    exclude: currentProductId 
                }, { signal: controller.signal });
                
                if (!controller.signal.aborted) {
                    setOptions(res?.data || []);
                }
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error('Search error:', err);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }, 500);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [inputValue, open, currentProductId]);

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle sx={{ fontWeight: 700 }}>Clone Tabs from Product</DialogTitle>
            <DialogContent dividers>
                <Typography variant="body2" color="text.secondary" mb={3}>
                    Select a product to import its custom tabs into this one. 
                    This will append the cloned tabs to your current list.
                </Typography>

                <Autocomplete
                    openOnFocus
                    fullWidth
                    options={options}
                    loading={loading}
                    inputValue={inputValue}
                    onInputChange={(_, newInputValue) => setInputValue(newInputValue)}
                    onChange={(_, product) => {
                        if (product) onClone(product);
                    }}
                    getOptionLabel={(option) => option.name || ''}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    noOptionsText={inputValue.trim() ? "No products found" : "Start typing to search"}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label="Search products"
                            placeholder="Type product name..."
                            variant="outlined"
                            InputProps={{
                                ...params.InputProps,
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon color="action" />
                                    </InputAdornment>
                                ),
                                endAdornment: (
                                    <>
                                        {loading ? <CircularProgress color="inherit" size={20} /> : null}
                                        {params.InputProps.endAdornment}
                                    </>
                                ),
                            }}
                        />
                    )}
                    renderOption={(props, option) => (
                        <Box component="li" {...props} key={option.id} sx={{ py: 1 }}>
                            <ListItemAvatar sx={{ minWidth: 48 }}>
                                <Avatar
                                    src={option.images?.[0]?.url}
                                    variant="rounded"
                                    sx={{ width: 32, height: 32 }}
                                >
                                    <CloneIcon sx={{ fontSize: 16 }} />
                                </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                                primary={option.name}
                                primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }}
                                secondary={option.sku ? `SKU: ${option.sku}` : null}
                                secondaryTypographyProps={{ variant: 'caption' }}
                            />
                        </Box>
                    )}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit">Cancel</Button>
            </DialogActions>
        </Dialog>
    );
};

// ─── Main Component ──────────────────────────────────────────────────────────
/**
 * @param {string}  productId      — the product's UUID (required; render null when isNew)
 * @param {boolean} canEdit        — permission gate from parent
 */
const ProductCustomTabs = ({ productId, canEdit = true }) => {
    const { notify } = useNotification();
    const [tabs, setTabs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [cloneDialogOpen, setCloneDialogOpen] = useState(false);

    // ── Load existing tabs ────────────────────────────────────────────────
    const loadTabs = useCallback(async () => {
        if (!productId) return;
        setLoading(true);
        try {
            const res = await productTabService.getTabs(productId);
            const raw = res?.data?.data ?? [];
            // Ensure every tab has a stable local key for React reconciliation
            setTabs(raw.map((t) => ({ ...t, _key: t.id })));
            setDirty(false);
        } catch {
            notify('Failed to load product tabs.', 'error');
        } finally {
            setLoading(false);
        }
    }, [productId]);

    useEffect(() => {
        loadTabs();
    }, [loadTabs]);

    // ── Local mutation helpers ────────────────────────────────────────────
    const markDirty = () => setDirty(true);

    const addTab = () => {
        setTabs((prev) => [
            ...prev,
            {
                _key: generateUniqueId(),
                id: null, // no server ID yet
                title: '',
                content: '',
                type: 'html',
                sortOrder: prev.length,
                isActive: true,
            },
        ]);
        markDirty();
    };

    const handleClone = async (sourceProduct) => {
        try {
            setLoading(true);
            const res = await productTabService.getTabs(sourceProduct.id);
            const sourceTabs = res?.data?.data || [];
            
            if (sourceTabs.length === 0) {
                notify('This product has no custom tabs to clone.', 'warning');
                return;
            }

            setTabs((prev) => {
                const start = prev.length;
                const cloned = sourceTabs.map((t, index) => ({
                    ...t,
                    id: null, // Mark as new
                    _key: generateUniqueId(),
                    sortOrder: start + index,
                }));
                return [...prev, ...cloned];
            });
            markDirty();
            setCloneDialogOpen(false);
            notify(`Cloned ${sourceTabs.length} tabs from ${sourceProduct.name}.`, 'success');
        } catch (err) {
            console.error('Clone error:', err);
            notify('Failed to fetch tabs for cloning.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const updateTab = (index, patch) => {
        setTabs((prev) =>
            prev.map((t, i) => (i === index ? { ...t, ...patch } : t))
        );
        markDirty();
    };

    const removeTab = (index) => {
        setTabs((prev) => prev.filter((_, i) => i !== index));
        markDirty();
    };

    const moveTab = (from, to) => {
        if (to < 0 || to >= tabs.length) return;
        setTabs((prev) => {
            const copy = [...prev];
            const [item] = copy.splice(from, 1);
            copy.splice(to, 0, item);
            // Reassign sortOrder to match visual position
            return copy.map((t, i) => ({ ...t, sortOrder: i }));
        });
        markDirty();
    };

    // ── Save (full sync) ──────────────────────────────────────────────────
    const handleSave = async () => {
        // Validate: every tab must have a title
        const invalid = tabs.findIndex((t) => !t.title?.trim());
        if (invalid !== -1) {
            notify(`Tab #${invalid + 1} is missing a title.`, 'warning');
            return;
        }

        setSaving(true);
        try {
            const payload = tabs.map((t, i) => ({
                ...(t.id ? { id: t.id } : {}),
                title: t.title.trim(),
                content: t.content || '',
                type: t.type || 'html',
                sortOrder: i,
                isActive: t.isActive ?? true,
            }));

            const res = await productTabService.syncTabs(productId, payload);
            const updated = res?.data?.data ?? [];
            setTabs(updated.map((t) => ({ ...t, _key: t.id })));
            setDirty(false);
            notify('Custom tabs saved successfully.', 'success');
        } catch {
            notify('Failed to save tabs. Please try again.', 'error');
        } finally {
            setSaving(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────
    if (!productId) {
        return (
            <Paper sx={{ p: 3, mt: 3 }}>
                <Alert severity="info">
                    Save the product first before managing custom tabs.
                </Alert>
            </Paper>
        );
    }

    return (
        <Paper sx={{ p: 3, mt: 3 }}>
            {/* Section header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box>
                    <Typography variant="h6" fontWeight={700}>
                        Custom Tabs
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        Add custom informational sections displayed as an accordion on the product page.
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    {dirty && (
                        <Chip
                            label="Unsaved changes"
                            size="small"
                            color="warning"
                            variant="outlined"
                        />
                    )}
                    {canEdit && (
                        <>
                            <Button
                                size="small"
                                startIcon={<CloneIcon />}
                                onClick={() => setCloneDialogOpen(true)}
                                variant="text"
                                disabled={saving}
                            >
                                Clone from Product
                            </Button>
                            <Button
                                size="small"
                                startIcon={<AddIcon />}
                                onClick={addTab}
                                variant="outlined"
                                disabled={saving}
                            >
                                Add Tab
                            </Button>
                            <Button
                                size="small"
                                startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
                                onClick={handleSave}
                                variant="contained"
                                disabled={saving || !dirty}
                            >
                                {saving ? 'Saving…' : 'Save Tabs'}
                            </Button>
                        </>
                    )}
                </Box>
            </Box>

            <CloneTabsDialog
                open={cloneDialogOpen}
                onClose={() => setCloneDialogOpen(false)}
                onClone={handleClone}
                currentProductId={productId}
            />

            <Divider sx={{ mb: 2 }} />

            {/* Loading state */}
            {loading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                </Box>
            )}

            {/* Empty state */}
            {!loading && tabs.length === 0 && (
                <EmptyState onAdd={canEdit ? addTab : undefined} />
            )}

            {/* Tab cards */}
            {!loading && tabs.length > 0 && (
                <Box>
                    {tabs.map((tab, index) => (
                        <TabCard
                            key={tab._key}
                            tab={tab}
                            index={index}
                            total={tabs.length}
                            onChange={(patch) => updateTab(index, patch)}
                            onRemove={() => removeTab(index)}
                            onMoveUp={() => moveTab(index, index - 1)}
                            onMoveDown={() => moveTab(index, index + 1)}
                        />
                    ))}

                    {/* Bottom add button for convenience */}
                    {canEdit && (
                        <Button
                            startIcon={<AddIcon />}
                            onClick={addTab}
                            variant="text"
                            size="small"
                            sx={{ mt: 1 }}
                            disabled={saving}
                        >
                            Add Another Tab
                        </Button>
                    )}
                </Box>
            )}

            {/* Read-only notice */}
            {!canEdit && (
                <Alert severity="info" sx={{ mt: 2 }}>
                    You do not have permission to edit custom tabs.
                </Alert>
            )}
        </Paper>
    );
};

export default ProductCustomTabs;
