const bool = (value, fallback = true) =>
  value === undefined || value === null ? fallback : value !== false && value !== 'false' && value !== '0';

const DEFAULT_HOMEPAGE_SECTIONS = [
  { id: 'hero', type: 'hero-carousel', enabled: true, autoPlay: true, interval: 6500 },
  { id: 'value-props', type: 'value-props', enabled: true },
  { id: 'categories', type: 'category-shortcuts', enabled: true, title: 'Shop by Category', count: 10 },
  { id: 'promo', type: 'promo-banners', enabled: true, title: 'Offers You Shouldn\'t Miss' },
  { id: 'trending', type: 'product-row', enabled: true, title: 'Trending Now', source: 'featured', count: 8, layout: 'carousel', viewAllLabel: 'View All', viewAllLink: '/products?featured=true' },
  { id: 'deals', type: 'product-row', enabled: true, title: 'Deals of the Day', source: 'sale', count: 8, layout: 'grid', viewAllLabel: 'All Deals', viewAllLink: '/products?onSale=true' },
  { id: 'brands', type: 'brand-showcase', enabled: true, title: 'Featured Brands', count: 12 },
  { id: 'new-arrivals', type: 'product-row', enabled: true, title: 'New Arrivals', source: 'newest', count: 8, layout: 'grid', viewAllLabel: 'New In', viewAllLink: '/products?sort=newest' },
];

const DEFAULT_HOMEPAGE_VALUE_PROPS = [
  { id: 'vp-1', icon: 'shipping', title: 'Fast Delivery', text: 'Reliable shipping on every order' },
  { id: 'vp-2', icon: 'offers', title: 'Daily Offers', text: 'Fresh deals across top categories' },
  { id: 'vp-3', icon: 'secure', title: 'Secure Payments', text: 'Protected checkout experience' },
  { id: 'vp-4', icon: 'support', title: 'Easy Support', text: 'Help when shoppers need it' },
];

const DEFAULT_HOMEPAGE_PROMOS = [
  { id: 'pr-1', kicker: 'Limited Time', title: 'Flat 40% Off', subtitle: 'Season-ready looks and daily essentials.', ctaText: 'Grab Offers', link: '/products?onSale=true', color: '#FFF7ED', accentColor: '#F97316' },
  { id: 'pr-2', kicker: 'Curated', title: 'New Brands Live', subtitle: 'Fresh labels and collections added every week.', ctaText: 'Explore Brands', link: '/brands', color: '#ECFEFF', accentColor: '#0891B2' },
  { id: 'pr-3', kicker: 'Smooth Shopping', title: 'Wishlist to Checkout', subtitle: 'Search, save, cart, and buy with fewer steps.', ctaText: 'Start Shopping', link: '/products', color: '#F0FDF4', accentColor: '#16A34A' },
];

const createId = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 11)}`;

const useHomepageSettings = ({ form, set, brandPrimary }) => {
  const getHomepageSections = () => {
    if (Array.isArray(form['homepage.sections']) && form['homepage.sections'].length) {
      return form['homepage.sections'];
    }

    return DEFAULT_HOMEPAGE_SECTIONS.map((section) => {
      if (section.id === 'categories') {
        return {
          ...section,
          enabled: bool(form['homepage.showCategories'], section.enabled),
          title: form['homepage.categoriesTitle'] || section.title,
          count: Number(form['homepage.categoriesCount'] ?? section.count),
        };
      }
      if (section.id === 'new-arrivals') {
        return {
          ...section,
          enabled: bool(form['homepage.showNewArrivals'], section.enabled),
          title: form['homepage.newArrivalsTitle'] || section.title,
          count: Number(form['homepage.newArrivalsCount'] ?? section.count),
          layout: form['homepage.newArrivalsLayout'] || section.layout,
          viewAllLink: form['homepage.newArrivalsLink'] || section.viewAllLink,
        };
      }
      if (section.id === 'trending') {
        return {
          ...section,
          enabled: bool(form['homepage.showFeatured'], section.enabled),
          title: form['homepage.featuredTitle'] || section.title,
          count: Number(form['homepage.featuredCount'] ?? section.count),
          layout: form['homepage.featuredLayout'] || section.layout,
          viewAllLink: form['homepage.featuredLink'] || section.viewAllLink,
        };
      }
      if (section.id === 'deals') {
        return {
          ...section,
          enabled: bool(form['homepage.showOnSale'], section.enabled),
          title: form['homepage.onSaleTitle'] || section.title,
          count: Number(form['homepage.onSaleCount'] ?? section.count),
          layout: form['homepage.onSaleLayout'] || section.layout,
          viewAllLink: form['homepage.onSaleLink'] || section.viewAllLink,
        };
      }
      if (section.id === 'brands') {
        return {
          ...section,
          enabled: bool(form['homepage.showBrands'], section.enabled),
          title: form['homepage.brandsTitle'] || section.title,
          count: Number(form['homepage.brandsCount'] ?? section.count),
        };
      }
      return section;
    });
  };

  const setHomepageSections = (sections) => set('homepage.sections', sections);
  const homepageSections = getHomepageSections();
  const updateHomepageSection = (index, patch) => {
    const current = getHomepageSections();
    setHomepageSections(current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };
  const removeHomepageSection = (index) => {
    const current = getHomepageSections();
    setHomepageSections(current.filter((_, itemIndex) => itemIndex !== index));
  };
  const moveHomepageSection = (index, direction) => {
    const current = getHomepageSections();
    const nextSections = [...current];
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= nextSections.length) return;
    const [moved] = nextSections.splice(index, 1);
    nextSections.splice(nextIndex, 0, moved);
    setHomepageSections(nextSections);
  };
  const addHomepageSection = () => {
    const current = getHomepageSections();
    const nextIndex = current.length + 1;
    setHomepageSections([
      ...current,
      { id: `custom-${Date.now()}`, type: 'product-row', enabled: true, title: `Product Section ${nextIndex}`, source: 'newest', count: 8, layout: 'grid', viewAllLink: '/products' },
    ]);
  };

  const getHeroSlides = () => Array.isArray(form['homepage.heroSlides']) && form['homepage.heroSlides'].length
    ? form['homepage.heroSlides']
    : [{
        eyebrow: form['homepage.eyebrow'] || 'Mega Style Weekend',
        title: form['hero.title'] || 'Shop the Latest',
        subtitle: form['hero.subtitle'] || 'Discover thousands of products at great prices.',
        buttonText: form['hero.buttonText'] || 'Shop Now',
        buttonLink: form['hero.buttonLink'] || '/products',
        secondaryButtonText: '',
        secondaryButtonLink: '',
        image: form['hero.backgroundImage'] || '',
        position: 'center',
        color: form['hero.color'] || '#ffffff',
      }];
  const heroSlides = getHeroSlides();
  const setHeroSlides = (slides) => set('homepage.heroSlides', slides);
  const updateHeroSlide = (index, patch) => {
    const current = getHeroSlides();
    setHeroSlides(current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };
  const addHeroSlide = () => {
    const current = getHeroSlides();
    setHeroSlides([
      ...current,
      { eyebrow: 'New Collection', title: 'Your next hero banner', subtitle: 'Promote a launch, sale, or category.', buttonText: 'Shop Now', buttonLink: '/products', secondaryButtonText: '', secondaryButtonLink: '', image: '', position: 'center', color: '#ffffff' },
    ]);
  };
  const removeHeroSlide = (index) => {
    const current = getHeroSlides();
    setHeroSlides(current.filter((_, itemIndex) => itemIndex !== index));
  };

  const getHomepagePromos = () => (Array.isArray(form['homepage.promoBanners']) && form['homepage.promoBanners'].length
    ? form['homepage.promoBanners']
    : DEFAULT_HOMEPAGE_PROMOS
  ).map((promo) => ({ ...promo, id: promo.id || createId('promo') }));
  const homepagePromos = getHomepagePromos();
  const setHomepagePromos = (promos) => set('homepage.promoBanners', promos);
  const updateHomepagePromo = (index, patch) => {
    const current = getHomepagePromos();
    setHomepagePromos(current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };
  const addHomepagePromo = () => {
    const current = getHomepagePromos();
    setHomepagePromos([
      ...current,
      { id: createId('promo'), kicker: 'Offer', title: 'New Promo', subtitle: 'Add a short promotion message.', ctaText: 'Shop Now', link: '/products', color: '#F8FAFC', accentColor: brandPrimary },
    ]);
  };
  const removeHomepagePromo = (index) => {
    const current = getHomepagePromos();
    setHomepagePromos(current.filter((_, itemIndex) => itemIndex !== index));
  };

  const getHomepageValueProps = () => (Array.isArray(form['homepage.valueProps']) && form['homepage.valueProps'].length
    ? form['homepage.valueProps']
    : DEFAULT_HOMEPAGE_VALUE_PROPS
  ).map((valueProp) => ({ ...valueProp, id: valueProp.id || createId('vp') }));
  const homepageValueProps = getHomepageValueProps();
  const setValueProps = (items) => set('homepage.valueProps', items);
  const updateValueProp = (index, patch) => {
    const current = getHomepageValueProps();
    setValueProps(current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  };
  const addValueProp = () => {
    const current = getHomepageValueProps();
    setValueProps([...current, { id: createId('vp'), icon: 'verified', title: 'New Benefit', text: 'Describe the shopper benefit.' }]);
  };
  const removeValueProp = (index) => {
    const current = getHomepageValueProps();
    setValueProps(current.filter((_, itemIndex) => itemIndex !== index));
  };

  return {
    homepageSections,
    heroSlides,
    homepagePromos,
    homepageValueProps,
    updateHomepageSection,
    moveHomepageSection,
    removeHomepageSection,
    addHomepageSection,
    updateHeroSlide,
    removeHeroSlide,
    addHeroSlide,
    updateHomepagePromo,
    removeHomepagePromo,
    addHomepagePromo,
    updateValueProp,
    removeValueProp,
    addValueProp,
  };
};

export default useHomepageSettings;
