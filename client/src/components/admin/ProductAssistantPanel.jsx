import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  IconButton,
  LinearProgress,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AutoAwesome as AutoAwesomeIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  ContentCopy as ContentCopyIcon,
  Description as DescriptionIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  Label as LabelIcon,
  UploadFile as UploadFileIcon,
} from '@mui/icons-material';
import { generateProductDraft, extractProductSpecs } from '../../services/productAssistantService';
import { useNotification } from '../../context/NotificationContext';
import { getApiErrorMessage } from '../../utils/apiErrors';

// ─── Attribute chip colour mapping ───────────────────────────────────────────
const ATTRIBUTE_COLORS = {
  brand:   'primary',
  model:   'secondary',
  storage: 'success',
  color:   'warning',
  display: 'info',
  sku:     'default',
  unit:    'default',
};

const ATTRIBUTE_LABELS = {
  brand: 'Brand', model: 'Model', storage: 'Storage',
  color: 'Color', display: 'Display', sku: 'SKU', unit: 'Unit',
};

// ─── Small copy-to-clipboard button ──────────────────────────────────────────
const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (_) { /* browser blocked */ }
  };
  return (
    <Tooltip title={copied ? 'Copied!' : 'Copy'}>
      <IconButton size="small" onClick={handleCopy} sx={{ opacity: 0.6, '&:hover': { opacity: 1 } }}>
        {copied ? <CheckCircleOutlineIcon fontSize="small" color="success" /> : <ContentCopyIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
};

// ─── Section row: label + copy icon + content ─────────────────────────────────
const PreviewRow = ({ label, children, text, monospace = false }) => (
  <Box sx={{ mb: 2 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {label}
      </Typography>
      {text && <CopyButton text={text} />}
    </Box>
    <Box sx={monospace ? { fontFamily: 'monospace', fontSize: '0.82rem', color: 'text.secondary' } : {}}>
      {children}
    </Box>
  </Box>
);

// ─── Main component ───────────────────────────────────────────────────────────
const ProductAssistantPanel = ({ initialInput, canUseAssistant, onApplyResult }) => {
  const { notify } = useNotification();
  const fileInputRef = useRef(null);
  const [assistantInput, setAssistantInput] = useState(initialInput || '');
  const [tone, setTone] = useState('neutral');
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [result, setResult] = useState(null);
  const [seoOpen, setSeoOpen] = useState(false);

  useEffect(() => {
    if (!assistantInput && initialInput) setAssistantInput(initialInput);
  }, [assistantInput, initialInput]);

  const handleGenerate = async () => {
    if (!assistantInput.trim()) {
      notify('Enter a product prompt before generating AI content.', 'warning');
      return;
    }
    setLoadingDraft(true);
    setResult(null);
    try {
      const response = await generateProductDraft({ input: assistantInput.trim(), tone });
      setResult(response?.data || null);
      notify('AI product draft generated.', 'success');
    } catch (err) {
      notify(getApiErrorMessage(err), 'error');
    } finally {
      setLoadingDraft(false);
    }
  };

  const handlePdfSelected = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setLoadingPdf(true);
    setResult(null);
    try {
      const response = await extractProductSpecs(file);
      setResult(response?.data || null);
      notify('Specs extracted from PDF.', 'success');
    } catch (err) {
      notify(getApiErrorMessage(err), 'error');
    } finally {
      setLoadingPdf(false);
    }
  };

  const hasAttributes = result?.attributes && Object.values(result.attributes).some(Boolean);
  const hasFeatureBullets = Array.isArray(result?.draft?.featureBullets) && result.draft.featureBullets.length > 0;
  const hasSeoKeywords = Array.isArray(result?.draft?.seoKeywords) && result.draft.seoKeywords.length > 0;

  return (
    <Paper
      variant="outlined"
      sx={{
        mb: 3,
        borderRadius: 2,
        overflow: 'hidden',
        borderColor: 'primary.light',
        background: (theme) =>
          theme.palette.mode === 'dark'
            ? 'linear-gradient(135deg, rgba(25,118,210,0.08) 0%, rgba(0,0,0,0) 60%)'
            : 'linear-gradient(135deg, rgba(25,118,210,0.04) 0%, rgba(255,255,255,0) 60%)',
      }}
    >
      {/* ── Header ── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
          py: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <AutoAwesomeIcon color="primary" />
          <Box>
            <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>
              Product Creation Assistant
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Generate copy from a prompt · or extract specs from a manufacturer PDF
            </Typography>
          </Box>
        </Box>
        <Chip
          icon={<LabelIcon fontSize="small" />}
          label="AI Assist"
          color="primary"
          size="small"
          sx={{ fontWeight: 700 }}
        />
      </Box>

      <Box sx={{ px: 3, py: 2.5 }}>
        <Alert severity="info" sx={{ mb: 2.5, borderRadius: 1.5 }}>
          The assistant <strong>never auto-saves</strong>. Review the preview below, then click
          <strong> Apply to Form</strong> to hydrate the fields.
        </Alert>

        {(loadingDraft || loadingPdf) && (
          <Box sx={{ mb: 2 }}>
            <LinearProgress />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {loadingPdf ? 'Extracting specs from PDF…' : 'Generating product content…'}
            </Typography>
          </Box>
        )}

        {/* ── Prompt input ── */}
        <TextField
          fullWidth
          multiline
          minRows={2}
          label="Product Prompt"
          placeholder="Apple iPhone 16 Pro 256GB Natural Titanium"
          value={assistantInput}
          onChange={(e) => setAssistantInput(e.target.value)}
          disabled={!canUseAssistant || loadingDraft || loadingPdf}
          size="small"
          sx={{ mb: 1.5 }}
        />

        {/* ── Tone selector ── */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2.5 }}>
          {['neutral', 'premium', 'technical', 'sales'].map((t) => (
            <Chip
              key={t}
              label={t.charAt(0).toUpperCase() + t.slice(1)}
              variant={tone === t ? 'filled' : 'outlined'}
              color={tone === t ? 'primary' : 'default'}
              onClick={() => setTone(t)}
              disabled={!canUseAssistant || loadingDraft || loadingPdf}
              size="small"
              sx={{ cursor: 'pointer', textTransform: 'capitalize', fontWeight: tone === t ? 700 : 400 }}
            />
          ))}
          <Typography variant="caption" color="text.secondary" alignSelf="center">
            Tone
          </Typography>
        </Box>

        {/* ── Action buttons ── */}
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            startIcon={<AutoAwesomeIcon />}
            onClick={handleGenerate}
            disabled={!canUseAssistant || loadingDraft || loadingPdf}
            size="small"
          >
            {loadingDraft ? 'Generating…' : 'Generate Content'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<UploadFileIcon />}
            onClick={() => fileInputRef.current?.click()}
            disabled={!canUseAssistant || loadingDraft || loadingPdf}
            size="small"
          >
            {loadingPdf ? 'Extracting…' : 'Upload Spec PDF'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            hidden
            onChange={handlePdfSelected}
          />
        </Box>

        {!canUseAssistant && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            You do not have permission to use AI product creation tools.
          </Alert>
        )}

        {/* ──────────────────────── Preview ──────────────────────── */}
        {result && (
          <Box sx={{ mt: 3 }}>
            <Divider sx={{ mb: 2.5 }} />

            {/* Header row */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>
                  ✨ Assistant Preview
                </Typography>
                {result?.source?.fileName && (
                  <Typography variant="caption" color="text.secondary">
                    Source: {result.source.fileName} ({result.source.extractedTextLength?.toLocaleString()} chars extracted)
                  </Typography>
                )}
              </Box>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<DescriptionIcon />}
                onClick={() => onApplyResult(result)}
                disabled={!canUseAssistant}
                size="small"
              >
                Apply to Form
              </Button>
            </Box>

            {/* Extracted attributes */}
            {hasAttributes && (
              <Box sx={{ mb: 2.5 }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', mb: 1 }}>
                  Extracted Attributes
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {Object.entries(result.attributes)
                    .filter(([, v]) => Boolean(v))
                    .map(([key, value]) => (
                      <Chip
                        key={key}
                        label={`${ATTRIBUTE_LABELS[key] || key}: ${value}`}
                        size="small"
                        color={ATTRIBUTE_COLORS[key] || 'default'}
                        variant="outlined"
                        sx={{ fontWeight: 600 }}
                      />
                    ))}
                </Box>
              </Box>
            )}

            {/* Title */}
            <PreviewRow label="Title" text={result?.draft?.title}>
              <Typography variant="body1" fontWeight={600}>
                {result?.draft?.title || <em style={{ opacity: 0.4 }}>No title generated</em>}
              </Typography>
            </PreviewRow>

            {/* Short description */}
            {result?.draft?.shortDescription && (
              <PreviewRow label="Short Description" text={result.draft.shortDescription}>
                <Typography variant="body2" color="text.secondary">
                  {result.draft.shortDescription}
                </Typography>
              </PreviewRow>
            )}

            {/* Feature bullets */}
            {hasFeatureBullets && (
              <PreviewRow label="Feature Bullets">
                <Box component="ul" sx={{ pl: 2.5, my: 0 }}>
                  {result.draft.featureBullets.map((bullet) => (
                    <li key={bullet}>
                      <Typography variant="body2">{bullet}</Typography>
                    </li>
                  ))}
                </Box>
              </PreviewRow>
            )}

            {/* SEO/Meta accordion */}
            <Divider sx={{ my: 1.5 }} />
            <Box
              onClick={() => setSeoOpen((o) => !o)}
              sx={{
                display: 'flex', alignItems: 'center', cursor: 'pointer',
                color: 'text.secondary', userSelect: 'none', mb: seoOpen ? 2 : 0,
              }}
            >
              <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.6, flex: 1 }}>
                SEO &amp; Meta Fields
              </Typography>
              {seoOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </Box>

            <Collapse in={seoOpen}>
              <Box
                sx={{
                  mt: 1, p: 2, borderRadius: 1.5, bgcolor: 'action.hover',
                  border: '1px solid', borderColor: 'divider',
                }}
              >
                <PreviewRow label="Meta Title" text={result?.draft?.metaTitle}>
                  <Typography variant="body2">{result?.draft?.metaTitle || '—'}</Typography>
                </PreviewRow>

                <PreviewRow label="Meta Description" text={result?.draft?.metaDescription}>
                  <Typography variant="body2" color="text.secondary">
                    {result?.draft?.metaDescription || '—'}
                  </Typography>
                </PreviewRow>

                {hasSeoKeywords && (
                  <PreviewRow label="SEO Keywords" text={result.draft.seoKeywords.join(', ')}>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {result.draft.seoKeywords.map((kw) => (
                        <Chip key={kw} label={kw} size="small" variant="outlined" />
                      ))}
                    </Box>
                  </PreviewRow>
                )}
              </Box>
            </Collapse>
          </Box>
        )}
      </Box>
    </Paper>
  );
};

export default ProductAssistantPanel;
