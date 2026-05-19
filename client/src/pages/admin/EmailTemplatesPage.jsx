import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Box, Typography, Paper, Grid, TextField, Button, Chip,
  Switch, FormControlLabel, CircularProgress, Alert, Divider,
  Tooltip, IconButton, InputAdornment, Tab, Tabs, Dialog,
  DialogTitle, DialogContent, DialogActions, Snackbar,
  List, ListItem, ListItemButton, ListItemText, ListItemIcon,
  LinearProgress,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import PreviewIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import RestoreIcon from '@mui/icons-material/RestoreFromTrash';
import SendIcon from '@mui/icons-material/Send';
import SaveIcon from '@mui/icons-material/Save';
import SearchIcon from '@mui/icons-material/Search';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import {
  getEmailTemplates,
  updateEmailTemplate,
  previewEmailTemplate,
  resetEmailTemplate,
  getEmailTemplateDefault,
  sendTestNotification,
} from '../../services/adminService';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../utils/permissions';

// ── Human-readable template names ─────────────────────────────────────────────
const TEMPLATE_LABELS = {
  order_placed:       { label: 'Order Placed',       desc: 'Sent when a customer completes checkout',         icon: '🛍️' },
  order_shipped:      { label: 'Order Shipped',      desc: 'Sent when a shipment is created',                 icon: '📦' },
  order_delivered:    { label: 'Order Delivered',    desc: 'Sent when the order is marked delivered',         icon: '✅' },
  order_cancelled:    { label: 'Order Cancelled',    desc: 'Sent when an order is cancelled',                 icon: '❌' },
  order_refunded:     { label: 'Order Refunded',     desc: 'Sent when a refund is processed',                 icon: '💳' },
  welcome:            { label: 'Welcome',            desc: 'Sent on successful account registration',         icon: '👋' },
  email_verification: { label: 'Email Verification', desc: 'Sent when email verification is required',        icon: '✉️' },
  password_reset:     { label: 'Password Reset',     desc: 'Sent when a user requests a password reset',      icon: '🔑' },
  low_stock_alert:    { label: 'Low Stock Alert',    desc: 'Sent to admins when inventory drops below threshold', icon: '⚠️' },
};

const CHANNELS = [
  { value: 'email', label: 'Email', icon: '📧', testLabel: 'Send Test Email', placeholder: 'you@example.com' },
  { value: 'sms', label: 'SMS', icon: '💬', testLabel: 'Send Test SMS', placeholder: '+1234567890' },
  { value: 'whatsapp', label: 'WhatsApp', icon: '🟢', testLabel: 'Send Test WhatsApp', placeholder: 'whatsapp:+1234567890' },
];

const getDraftKey = (channel, name) => `${channel}:${name}`;

// ── Variable Chip ──────────────────────────────────────────────────────────────
const VarChip = ({ varName, onClick }) => (
  <Chip
    key={varName}
    label={`{{${varName}}}`}
    size="small"
    variant="outlined"
    onClick={() => onClick(`{{${varName}}}`)}
    sx={{
      fontFamily: 'monospace',
      fontSize: 11,
      cursor: 'pointer',
      '&:hover': { bgcolor: 'primary.50', borderColor: 'primary.main' },
    }}
  />
);

// ── Preview Iframe ─────────────────────────────────────────────────────────────
const EmailPreviewFrame = ({ html, loading }) => {
  const iframeRef = useRef(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !html) return;
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
  }, [html]);

  return (
    <Box sx={{ position: 'relative', width: '100%', height: 600, borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider', bgcolor: '#f4f4f4' }}>
      {loading && (
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2 }}>
          <LinearProgress />
        </Box>
      )}
      <iframe
        ref={iframeRef}
        title="Email Preview"
        style={{ width: '100%', height: '100%', border: 'none', background: '#f4f4f4' }}
        sandbox="allow-same-origin"
      />
    </Box>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────────
const EmailTemplatesPage = () => {
  const { notify, confirm } = useNotification();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission(PERMISSIONS.NOTIFICATIONS_MANAGE);

  const [templates, setTemplates]           = useState([]);
  const [loading, setLoading]               = useState(true);
  const [activeChannel, setActiveChannel]   = useState('email');
  const [selected, setSelected]             = useState(null);   // template name
  const [editorTab, setEditorTab]           = useState(0);       // 0=Editor 1=Preview
  const [draft, setDraft]                   = useState({});      // name → { subject, bodyHtml, bodyText, isActive, _dirty }
  const [saving, setSaving]                 = useState(false);
  const [previewHtml, setPreviewHtml]       = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [testEmail, setTestEmail]           = useState('');
  const [testSending, setTestSending]       = useState(false);
  const [resetDialog, setResetDialog]       = useState({ open: false, name: null, defaultData: null });
  const [searchQuery, setSearchQuery]       = useState('');
  const [snack, setSnack]                   = useState({ open: false, msg: '', severity: 'success' });
  const textareaRef = useRef(null);

  // ── Load templates ─────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    getEmailTemplates()
      .then(res => {
        const tpls = res.data?.data || [];
        setTemplates(tpls);
        const initialTpl = tpls.find(t => t.channel === activeChannel) || tpls[0];
        if (initialTpl && !selected) {
          setSelected(initialTpl.name);
          setActiveChannel(initialTpl.channel || 'email');
        }
      })
      .catch(() => notify('Failed to load notification templates', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const channelTemplates = useMemo(
    () => templates.filter(t => t.channel === activeChannel),
    [templates, activeChannel]
  );

  useEffect(() => {
    if (loading) return;
    if (channelTemplates.length === 0) {
      setSelected(null);
      return;
    }

    if (!channelTemplates.some(t => t.name === selected)) {
      setSelected(channelTemplates[0].name);
    }
  }, [activeChannel, channelTemplates, loading, selected]);

  // Sync draft when template changes (only if not yet dirty)
  const currentTemplate = templates.find(t => t.name === selected && t.channel === activeChannel);
  const draftKey = selected ? getDraftKey(activeChannel, selected) : null;
  useEffect(() => {
    if (!currentTemplate) return;
    setDraft(prev => {
      const key = getDraftKey(currentTemplate.channel, currentTemplate.name);
      const d = prev[key];
      if (!d || (!d._dirty && (d.subject !== currentTemplate.subject || d.bodyHtml !== currentTemplate.bodyHtml || d.bodyText !== (currentTemplate.bodyText || '') || d.isActive !== currentTemplate.isActive))) {
        return {
          ...prev,
          [key]: {
            subject:  currentTemplate.subject,
            bodyHtml: currentTemplate.bodyHtml,
            bodyText: currentTemplate.bodyText || '',
            isActive: currentTemplate.isActive,
            _dirty:   false,
          },
        };
      }
      return prev;
    });
  }, [currentTemplate]);

  const cur = draftKey ? (draft[draftKey] || {}) : {};
  const setField = (field, value) => {
    if (!draftKey) return;
    setDraft(d => ({
      ...d,
      [draftKey]: { ...d[draftKey], [field]: value, _dirty: true },
    }));
  };

  // ── Insert variable at cursor ──────────────────────────────────────────────
  const insertVariable = useCallback((token) => {
    const ta = textareaRef.current?.querySelector('textarea');
    if (!ta) {
      setField('bodyHtml', (cur.bodyHtml || '') + token);
      return;
    }
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const newVal = (cur.bodyHtml || '').slice(0, start) + token + (cur.bodyHtml || '').slice(end);
    setField('bodyHtml', newVal);
    // Restore cursor after re-render
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = start + token.length;
      ta.selectionEnd   = start + token.length;
    });
  }, [cur.bodyHtml, selected]);

  // ── Live Preview ───────────────────────────────────────────────────────────
  useEffect(() => {
    const isPreviewTab = activeChannel === 'email' ? editorTab === 1 : editorTab === 0;
    if (!isPreviewTab || !selected) return;
    const timer = setTimeout(() => {
      setPreviewLoading(true);
      previewEmailTemplate(selected, {
        channel: activeChannel,
        customHtml: activeChannel === 'email' ? cur.bodyHtml : undefined,
        customText: activeChannel !== 'email' ? cur.bodyText : undefined,
        customSubject: cur.subject,
      })
        .then(res => setPreviewHtml(activeChannel === 'email' ? (res.data?.data?.html || '') : (res.data?.data?.text || '')))
        .catch(() => setPreviewHtml('<p style="color:red;padding:20px">Preview failed — check your template for Handlebars syntax errors.</p>'))
        .finally(() => setPreviewLoading(false));
    }, 500);
    return () => clearTimeout(timer);
  }, [editorTab, cur.bodyHtml, cur.bodyText, cur.subject, selected, activeChannel]);

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await updateEmailTemplate(selected, {
        channel:  activeChannel,
        subject:  cur.subject,
        bodyHtml: cur.bodyHtml,
        bodyText: cur.bodyText,
        isActive: cur.isActive,
      });
      setDraft(d => ({ ...d, [draftKey]: { ...d[draftKey], _dirty: false } }));
      // Update local templates list
      setTemplates(prev => prev.map(t => t.name === selected && t.channel === activeChannel ? { ...t, subject: cur.subject, isActive: cur.isActive, bodyHtml: cur.bodyHtml, bodyText: cur.bodyText } : t));
      setSnack({ open: true, msg: 'Template saved successfully!', severity: 'success' });
    } catch {
      setSnack({ open: true, msg: 'Failed to save template.', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // ── Send Test ──────────────────────────────────────────────────────────────
  const handleSendTest = async () => {
    if (!testEmail) { notify('Enter a test recipient first.', 'warning'); return; }
    setTestSending(true);
    try {
      await sendTestNotification(selected, testEmail, activeChannel);
      setSnack({ open: true, msg: `Test ${activeChannel} queued for ${testEmail}`, severity: 'success' });
    } catch {
      setSnack({ open: true, msg: `Failed to send test ${activeChannel}. Check your messaging config.`, severity: 'error' });
    } finally {
      setTestSending(false);
    }
  };

  // ── Reset to Default ───────────────────────────────────────────────────────
  const openResetDialog = async () => {
    try {
      const res = await getEmailTemplateDefault(selected, activeChannel);
      setResetDialog({ open: true, name: selected, defaultData: res.data?.data });
    } catch {
      notify('No built-in default for this template.', 'warning');
    }
  };

  const confirmReset = async () => {
    const { name, defaultData } = resetDialog;
    setResetDialog({ open: false, name: null, defaultData: null });
    setDraft(d => ({
      ...d,
      [getDraftKey(activeChannel, name)]: {
        subject:  d[getDraftKey(activeChannel, name)]?.subject ?? defaultData.subject,
        bodyHtml: defaultData.bodyHtml,
        bodyText: defaultData.bodyText || '',
        isActive: d[getDraftKey(activeChannel, name)]?.isActive ?? true,
        _dirty:   true,
      },
    }));
    setSnack({ open: true, msg: 'Template reset locally. Save to persist.', severity: 'info' });
  };

  // ── Filtered Template List ─────────────────────────────────────────────────
  const filteredTemplates = channelTemplates.filter(t => {
    const meta = TEMPLATE_LABELS[t.name] || {};
    const q = searchQuery.toLowerCase();
    return !q || t.name.includes(q) || (meta.label || '').toLowerCase().includes(q) || (meta.desc || '').toLowerCase().includes(q);
  });

  const meta = TEMPLATE_LABELS[selected] || { label: selected, desc: '', icon: '📧' };
  const channelMeta = CHANNELS.find(channel => channel.value === activeChannel) || CHANNELS[0];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (templates.length === 0) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="info">
          No notification templates found in the database. Run the notification templates seeder to populate defaults:
          <br /><code>npx sequelize-cli db:seed --seed 20240101-notification-templates</code>
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* ── Page Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Templates</Typography>
          <Typography variant="body2" color="text.secondary">
            Customize transactional Email, SMS, and WhatsApp templates. Use <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 5px', borderRadius: 4 }}>{'{{variable}}'}</code> for dynamic content.
          </Typography>
        </Box>
        {!canEdit && (
          <Alert severity="info" sx={{ py: 0.5 }}>Read-only — requires <strong>notifications.manage</strong> permission</Alert>
        )}
      </Box>

      <Grid container spacing={2} sx={{ height: 'calc(100vh - 160px)', minHeight: 600 }}>

        {/* ── Left: Template List ── */}
        <Grid item xs={12} md={3}>
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Box sx={{ px: 1.5, pt: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Tabs
                value={activeChannel}
                onChange={(_, value) => {
                  setActiveChannel(value);
                  setEditorTab(value === 'email' ? 0 : 2);
                }}
                variant="fullWidth"
                sx={{ minHeight: 36 }}
              >
                {CHANNELS.map(channel => (
                  <Tab
                    key={channel.value}
                    value={channel.value}
                    label={`${channel.icon} ${channel.label}`}
                    sx={{ minHeight: 36, fontSize: 12, textTransform: 'none' }}
                  />
                ))}
              </Tabs>
            </Box>
            {/* Search */}
            <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
              <TextField
                fullWidth size="small"
                placeholder="Search templates…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16, color: 'text.disabled' }} /></InputAdornment> }}
              />
            </Box>

            {/* List */}
            <List dense sx={{ flex: 1, overflowY: 'auto', py: 0.5 }}>
              {filteredTemplates.length === 0 && (
                <Box sx={{ p: 2 }}>
                  <Alert severity="info" sx={{ fontSize: 13 }}>
                    No {channelMeta.label} templates found.
                  </Alert>
                </Box>
              )}
              {filteredTemplates.map(tpl => {
                const m    = TEMPLATE_LABELS[tpl.name] || { label: tpl.name, icon: '📧' };
                const d    = draft[getDraftKey(activeChannel, tpl.name)];
                const dirty = d?._dirty;
                const active = d?.isActive ?? tpl.isActive;
                return (
                  <ListItem key={tpl.name} disablePadding>
                    <ListItemButton
                      selected={selected === tpl.name}
                      onClick={() => setSelected(tpl.name)}
                      sx={{
                        mx: 0.5, borderRadius: 1.5, mb: 0.25,
                        '&.Mui-selected': { bgcolor: 'primary.main', color: 'primary.contrastText' },
                        '&.Mui-selected:hover': { bgcolor: 'primary.dark' },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 32, fontSize: 16 }}>
                        {m.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <Typography variant="body2" fontWeight={600} noWrap>{m.label}</Typography>
                            {dirty && <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'warning.main', flexShrink: 0 }} />}
                          </Box>
                        }
                        primaryTypographyProps={{ component: 'div' }}
                        secondary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <FiberManualRecordIcon sx={{ fontSize: 8, color: active ? 'success.main' : 'text.disabled' }} />
                            <Typography variant="caption" sx={{ color: 'inherit', opacity: 0.7 }} noWrap>{active ? 'Active' : 'Inactive'}</Typography>
                          </Box>
                        }
                        secondaryTypographyProps={{ component: 'div' }}
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          </Paper>
        </Grid>

        {/* ── Right: Editor Panel ── */}
        <Grid item xs={12} md={9}>
          {!selected ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <Typography color="text.secondary">Select a template to edit</Typography>
            </Box>
          ) : (
            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

              {/* Template Header */}
              <Box sx={{ px: 3, py: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Typography fontSize={22}>{meta.icon}</Typography>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="subtitle1" fontWeight={700}>{meta.label}</Typography>
                      <Chip label={channelMeta.label} size="small" variant="outlined" />
                    </Box>
                    <Typography variant="caption" color="text.secondary">{meta.desc || currentTemplate?.name}</Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={cur.isActive ?? true}
                        onChange={e => setField('isActive', e.target.checked)}
                        disabled={!canEdit}
                        color="success"
                      />
                    }
                    label={<Typography variant="body2">{cur.isActive ? 'Active' : 'Inactive'}</Typography>}
                  />
                  {canEdit && (
                    <Tooltip title="Reset to built-in default">
                      <Button size="small" startIcon={<RestoreIcon />} onClick={openResetDialog} color="warning" variant="outlined">
                        Reset
                      </Button>
                    </Tooltip>
                  )}
                  <Button
                    size="small" variant="contained" startIcon={<SaveIcon />}
                    onClick={handleSave} disabled={!canEdit || saving || !cur._dirty}
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </Button>
                </Box>
              </Box>

              {/* Subject Line */}
              <Box sx={{ px: 3, pt: 2.5, pb: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                <TextField
                  fullWidth size="small" label="Subject Line"
                  value={cur.subject || ''}
                  onChange={e => setField('subject', e.target.value)}
                  disabled={!canEdit}
                  helperText="Supports {{variable}} syntax"
                  InputProps={{
                    sx: { fontFamily: 'monospace', fontSize: 13 },
                  }}
                />
              </Box>

              {/* Tabs: Editor / Preview */}
              <Box sx={{ px: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Tabs value={editorTab} onChange={(_, v) => setEditorTab(v)} sx={{ minHeight: 40 }}>
                  {activeChannel === 'email' && (
                    <Tab label="HTML Editor" icon={<EditIcon sx={{ fontSize: 14 }} />} iconPosition="start" sx={{ minHeight: 40, fontSize: 13 }} />
                  )}
                  <Tab label={activeChannel === 'email' ? 'Live Preview' : 'Rendered Preview'} icon={<PreviewIcon sx={{ fontSize: 14 }} />} iconPosition="start" sx={{ minHeight: 40, fontSize: 13 }} />
                  <Tab label={activeChannel === 'email' ? 'Plain Text' : 'Message Body'} iconPosition="start" sx={{ minHeight: 40, fontSize: 13 }} />
                </Tabs>
              </Box>

              {/* Tab Panels */}
              <Box sx={{ flex: 1, overflowY: 'auto', p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>

                {/* ── Editor Tab ── */}
                {activeChannel === 'email' && editorTab === 0 && (
                  <>
                    {/* Variable Helper */}
                    {currentTemplate?.availableVariables?.length > 0 && (
                      <Box>
                        <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={0.75}>
                          📌 Click a variable to insert at cursor:
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                          {currentTemplate.availableVariables.map(v => (
                            <VarChip key={v} varName={v} onClick={insertVariable} />
                          ))}
                        </Box>
                      </Box>
                    )}

                    {/* HTML Textarea */}
                    <Box ref={textareaRef} sx={{ flex: 1 }}>
                      <TextField
                        fullWidth multiline
                        minRows={22}
                        maxRows={40}
                        label="HTML Body"
                        value={cur.bodyHtml || ''}
                        onChange={e => setField('bodyHtml', e.target.value)}
                        disabled={!canEdit}
                        inputProps={{ style: { fontFamily: '"Fira Code", "Cascadia Code", monospace', fontSize: 12, lineHeight: 1.6 } }}
                        helperText={`${(cur.bodyHtml || '').length} chars — Full HTML. Use Handlebars {{variable}} syntax.`}
                      />
                    </Box>
                  </>
                )}

                {/* ── Preview Tab ── */}
                {((activeChannel === 'email' && editorTab === 1) || (activeChannel !== 'email' && editorTab === 0)) && (
                  <>
                    <Alert severity="info" sx={{ py: 0.5 }}>
                      Preview uses sample data — rendered output will differ with real order/user data.
                    </Alert>
                    {activeChannel === 'email' ? (
                      <EmailPreviewFrame html={previewHtml} loading={previewLoading} />
                    ) : (
                      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper', whiteSpace: 'pre-wrap', fontFamily: 'monospace', minHeight: 220 }}>
                        {previewLoading ? 'Rendering...' : (previewHtml || 'Preview will appear here.')}
                      </Paper>
                    )}
                  </>
                )}

                {/* ── Plain Text Tab ── */}
                {((activeChannel === 'email' && editorTab === 2) || (activeChannel !== 'email' && editorTab === 1)) && (
                  <>
                    {currentTemplate?.availableVariables?.length > 0 && activeChannel !== 'email' && (
                      <Box>
                        <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" mb={0.75}>
                          Click a variable to append:
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                          {currentTemplate.availableVariables.map(v => (
                            <VarChip key={v} varName={v} onClick={(token) => setField('bodyText', `${cur.bodyText || ''}${token}`)} />
                          ))}
                        </Box>
                      </Box>
                    )}
                    <TextField
                      fullWidth multiline
                      minRows={20}
                      label={activeChannel === 'email' ? 'Plain Text Fallback' : `${channelMeta.label} Message Body`}
                      value={cur.bodyText || ''}
                      onChange={e => setField('bodyText', e.target.value)}
                      disabled={!canEdit}
                      inputProps={{ style: { fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6 } }}
                      helperText={activeChannel === 'email' ? "Used by email clients that don't render HTML. Supports {{variables}}." : `${channelMeta.label} messages use this text body and support {{variables}}.`}
                    />
                  </>
                )}
              </Box>

              {/* ── Footer: Test Notification ── */}
              <Box sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', bgcolor: 'action.hover' }}>
                <Typography sx={{ fontSize: 18 }}>{channelMeta.icon}</Typography>
                <TextField
                  size="small" label={`Send test ${channelMeta.label} to`}
                  placeholder={channelMeta.placeholder}
                  value={testEmail}
                  onChange={e => setTestEmail(e.target.value)}
                  sx={{ minWidth: 260 }}
                  disabled={!canEdit}
                />
                <Button
                  variant="outlined" size="small"
                  startIcon={testSending ? <CircularProgress size={14} /> : <SendIcon />}
                  onClick={handleSendTest}
                  disabled={!canEdit || !testEmail || testSending || cur._dirty}
                >
                  {testSending ? 'Sending…' : channelMeta.testLabel}
                </Button>
                <Typography variant="caption" color={cur._dirty ? "warning.main" : "text.secondary"}>
                  {cur._dirty ? "Save your changes first to test them" : `Sends using current saved version + your ${channelMeta.label} config`}
                </Typography>
              </Box>
            </Paper>
          )}
        </Grid>
      </Grid>

      {/* ── Reset Confirmation Dialog ── */}
      <Dialog open={resetDialog.open} onClose={() => setResetDialog({ open: false, name: null, defaultData: null })} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>Reset to Default Template?</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This will overwrite your current HTML with the built-in default. Your subject and active state will be preserved. You can still undo by not saving.
          </Alert>
          {resetDialog.defaultData && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>Default subject:</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', bgcolor: 'action.hover', p: 1.5, borderRadius: 1 }}>
                {resetDialog.defaultData.subject}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setResetDialog({ open: false, name: null, defaultData: null })}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={confirmReset}>Reset to Default</Button>
        </DialogActions>
      </Dialog>

      {/* ── Snackbar ── */}
      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))} sx={{ boxShadow: 4 }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default EmailTemplatesPage;
