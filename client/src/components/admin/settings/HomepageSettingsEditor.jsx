import {
  Alert,
  Box,
  Button,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';

const bool = (value, fallback = true) =>
  value === undefined || value === null ? fallback : value !== false && value !== 'false' && value !== '0';

const HomepageSettingsEditor = ({
  heroSlides,
  removeHeroSlide,
  updateHeroSlide,
  addHeroSlide,
  homepageSections,
  updateHomepageSection,
  sectionTypes,
  moveHomepageSection,
  removeHomepageSection,
  productSources,
  addHomepageSection,
  homepageValueProps,
  valueIcons,
  updateValueProp,
  removeValueProp,
  addValueProp,
  homepagePromos,
  removeHomepagePromo,
  updateHomepagePromo,
  addHomepagePromo,
  brandPrimary,
}) => (
    <>
      <Alert severity="info" sx={{ mb: 2.5 }}>
        These controls now edit the same configurable homepage schema used by the storefront. Reorder sections, hide blocks, and update slide/banner content here, then click Save All.
      </Alert>

      <Typography variant="subtitle2" sx={{ mb: 1 }}>Hero Slides</Typography>
      {heroSlides.map((slide, index) => (
        <Paper key={`hero-slide-${index}`} variant="outlined" sx={{ p: 2, mb: 1.5, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography variant="body2" fontWeight={700}>Slide {index + 1}</Typography>
            {heroSlides.length > 1 && (
              <IconButton size="small" color="error" onClick={() => removeHeroSlide(index)} aria-label="Remove hero slide">
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Eyebrow" value={slide.eyebrow || ''} onChange={(e) => updateHeroSlide(index, { eyebrow: e.target.value })} sx={{ mb: 2 }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Text Color" type="color" value={slide.color || '#ffffff'} onChange={(e) => updateHeroSlide(index, { color: e.target.value })} sx={{ mb: 2 }} />
            </Grid>
          </Grid>
          <TextField fullWidth size="small" label="Headline" value={slide.title || ''} onChange={(e) => updateHeroSlide(index, { title: e.target.value })} sx={{ mb: 2 }} />
          <TextField fullWidth size="small" label="Subheading" value={slide.subtitle || ''} onChange={(e) => updateHeroSlide(index, { subtitle: e.target.value })} multiline rows={2} sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Primary Button Label" value={slide.buttonText || ''} onChange={(e) => updateHeroSlide(index, { buttonText: e.target.value })} sx={{ mb: 2 }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Primary Button Link" value={slide.buttonLink || ''} onChange={(e) => updateHeroSlide(index, { buttonLink: e.target.value })} sx={{ mb: 2 }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Secondary Button Label" value={slide.secondaryButtonText || ''} onChange={(e) => updateHeroSlide(index, { secondaryButtonText: e.target.value })} sx={{ mb: 2 }} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Secondary Button Link" value={slide.secondaryButtonLink || ''} onChange={(e) => updateHeroSlide(index, { secondaryButtonLink: e.target.value })} sx={{ mb: 2 }} />
            </Grid>
          </Grid>
          <TextField fullWidth size="small" label="Hero Image URL" value={slide.image || ''} onChange={(e) => updateHeroSlide(index, { image: e.target.value })} sx={{ mb: 2 }} />
          <TextField fullWidth size="small" label="Image Position" value={slide.position || 'center'} onChange={(e) => updateHeroSlide(index, { position: e.target.value })} />
        </Paper>
      ))}
      <Button startIcon={<AddIcon />} variant="outlined" size="small" onClick={addHeroSlide} sx={{ mb: 3 }}>
        Add Hero Slide
      </Button>

      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Homepage Sections</Typography>
      {homepageSections.map((item, index) => (
        <Paper key={`${item.id}-${index}`} variant="outlined" sx={{ p: 2, mb: 1.5, borderRadius: 2 }}>
          <Grid container spacing={1.5} alignItems="center">
            <Grid item xs={12} md={3}>
              <TextField fullWidth size="small" label="Section ID" value={item.id || ''} onChange={(e) => updateHomepageSection(index, { id: e.target.value })} />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Type</InputLabel>
                <Select label="Type" value={item.type || 'product-row'} onChange={(e) => updateHomepageSection(index, { type: e.target.value })}>
                  {sectionTypes.map((type) => (
                    <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControlLabel
                control={<Switch checked={bool(item.enabled)} onChange={(e) => updateHomepageSection(index, { enabled: e.target.checked })} />}
                label="Visible"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' }, gap: 0.5 }}>
                <IconButton size="small" disabled={index === 0} onClick={() => moveHomepageSection(index, -1)} aria-label="Move section up">
                  <ArrowBackIosNewIcon fontSize="small" sx={{ transform: 'rotate(90deg)' }} />
                </IconButton>
                <IconButton size="small" disabled={index === homepageSections.length - 1} onClick={() => moveHomepageSection(index, 1)} aria-label="Move section down">
                  <ArrowForwardIosIcon fontSize="small" sx={{ transform: 'rotate(90deg)' }} />
                </IconButton>
                <IconButton size="small" color="error" onClick={() => removeHomepageSection(index)} aria-label="Remove section">
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Box>
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mt: 0.5 }}>
                <FormControlLabel
                  control={<Switch size="small" checked={!bool(item.hideOnMobile, false)} onChange={(e) => updateHomepageSection(index, { hideOnMobile: !e.target.checked })} />}
                  label="Show on Mobile"
                />
                <FormControlLabel
                  control={<Switch size="small" checked={!bool(item.hideOnDesktop, false)} onChange={(e) => updateHomepageSection(index, { hideOnDesktop: !e.target.checked })} />}
                  label="Show on Desktop"
                />
              </Box>
            </Grid>
          </Grid>

          {item.type !== 'hero-carousel' && item.type !== 'value-props' && (
            <TextField fullWidth size="small" label="Section Title" value={item.title || ''} onChange={(e) => updateHomepageSection(index, { title: e.target.value })} sx={{ mt: 2 }} />
          )}
          {(item.type === 'category-shortcuts' || item.type === 'promo-banners') && (
            <TextField fullWidth size="small" label="Subtitle" value={item.subtitle || ''} onChange={(e) => updateHomepageSection(index, { subtitle: e.target.value })} sx={{ mt: 2 }} />
          )}
          {(item.type === 'product-row' || item.type === 'category-shortcuts' || item.type === 'brand-showcase') && (
            <Grid container spacing={2} sx={{ mt: 0 }}>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth size="small" label="Count" type="number" value={item.count ?? 8} onChange={(e) => updateHomepageSection(index, { count: Number(e.target.value) })} sx={{ mt: 2 }} />
              </Grid>
              {item.type === 'product-row' && (
                <>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small" sx={{ mt: 2 }}>
                      <InputLabel>Product Source</InputLabel>
                      <Select label="Product Source" value={item.source || 'newest'} onChange={(e) => updateHomepageSection(index, { source: e.target.value })}>
                        {productSources.map((source) => (
                          <MenuItem key={source.value} value={source.value}>{source.label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small" sx={{ mt: 2 }}>
                      <InputLabel>Layout</InputLabel>
                      <Select label="Layout" value={item.layout || 'grid'} onChange={(e) => updateHomepageSection(index, { layout: e.target.value })}>
                        <MenuItem value="grid">Grid</MenuItem>
                        <MenuItem value="carousel">Carousel</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth size="small" label="View All Label" value={item.viewAllLabel || ''} onChange={(e) => updateHomepageSection(index, { viewAllLabel: e.target.value })} sx={{ mt: 2 }} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth size="small" label="View All Link" value={item.viewAllLink || ''} onChange={(e) => updateHomepageSection(index, { viewAllLink: e.target.value })} sx={{ mt: 2 }} />
                  </Grid>
                </>
              )}
            </Grid>
          )}
        </Paper>
      ))}
      <Button startIcon={<AddIcon />} variant="outlined" size="small" onClick={addHomepageSection} sx={{ mb: 3 }}>
        Add Section
      </Button>

      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Value Props</Typography>
      {homepageValueProps.map((item, index) => (
        <Grid container spacing={1.5} key={item.id} sx={{ mb: 1 }}>
          <Grid item xs={12} sm={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Icon</InputLabel>
              <Select label="Icon" value={item.icon || 'verified'} onChange={(e) => updateValueProp(index, { icon: e.target.value })}>
                {valueIcons.map((icon) => <MenuItem key={icon} value={icon}>{icon}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField fullWidth size="small" label="Title" value={item.title || ''} onChange={(e) => updateValueProp(index, { title: e.target.value })} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth size="small" label="Text" value={item.text || ''} onChange={(e) => updateValueProp(index, { text: e.target.value })} />
          </Grid>
          <Grid item xs={12} sm={1}>
            <IconButton color="error" onClick={() => removeValueProp(index)} aria-label="Remove value prop">
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Grid>
        </Grid>
      ))}
      <Button startIcon={<AddIcon />} variant="outlined" size="small" onClick={addValueProp} sx={{ mb: 3 }}>
        Add Value Prop
      </Button>

      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Promo Banners</Typography>
      {homepagePromos.map((promo, index) => (
        <Paper key={promo.id} variant="outlined" sx={{ p: 2, mb: 1.5, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography variant="body2" fontWeight={700}>Promo {index + 1}</Typography>
            <IconButton size="small" color="error" onClick={() => removeHomepagePromo(index)} aria-label="Remove promo banner">
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Box>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}><TextField fullWidth size="small" label="Kicker" value={promo.kicker || ''} onChange={(e) => updateHomepagePromo(index, { kicker: e.target.value })} sx={{ mb: 2 }} /></Grid>
            <Grid item xs={12} sm={4}><TextField fullWidth size="small" label="Background" type="color" value={promo.color || '#ffffff'} onChange={(e) => updateHomepagePromo(index, { color: e.target.value })} sx={{ mb: 2 }} /></Grid>
            <Grid item xs={12} sm={4}><TextField fullWidth size="small" label="Accent" type="color" value={promo.accentColor || brandPrimary} onChange={(e) => updateHomepagePromo(index, { accentColor: e.target.value })} sx={{ mb: 2 }} /></Grid>
          </Grid>
          <TextField fullWidth size="small" label="Title" value={promo.title || ''} onChange={(e) => updateHomepagePromo(index, { title: e.target.value })} sx={{ mb: 2 }} />
          <TextField fullWidth size="small" label="Subtitle" value={promo.subtitle || ''} onChange={(e) => updateHomepagePromo(index, { subtitle: e.target.value })} sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}><TextField fullWidth size="small" label="CTA Text" value={promo.ctaText || ''} onChange={(e) => updateHomepagePromo(index, { ctaText: e.target.value })} sx={{ mb: 2 }} /></Grid>
            <Grid item xs={12} sm={4}><TextField fullWidth size="small" label="Link" value={promo.link || ''} onChange={(e) => updateHomepagePromo(index, { link: e.target.value })} sx={{ mb: 2 }} /></Grid>
            <Grid item xs={12} sm={4}><TextField fullWidth size="small" label="Image URL" value={promo.image || ''} onChange={(e) => updateHomepagePromo(index, { image: e.target.value })} sx={{ mb: 2 }} /></Grid>
          </Grid>
        </Paper>
      ))}
      <Button startIcon={<AddIcon />} variant="outlined" size="small" onClick={addHomepagePromo}>
        Add Promo Banner
      </Button>
    </>
  );

export default HomepageSettingsEditor;
