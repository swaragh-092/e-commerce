import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import {
  Agriculture, BakeryDining, Category, Coffee, Egg, EnergySavingsLeaf,
  Fastfood, Forest, Grass, Home, Inventory2, KebabDining, LocalCafe, LocalDining,
  LocalFlorist, LocalGroceryStore, LocalShipping, Nature, NaturePeople, Park, Pets,
  Restaurant, SetMeal, ShoppingBasket, ShoppingCart, Spa, Star, Store, Storefront,
  Yard,
} from '@mui/icons-material';
import { getMediaUrl } from '../../utils/media';

export const CATEGORY_ICONS = [
  { id: 'eco', label: 'Eco', keywords: 'leaf green nature', Component: EnergySavingsLeaf },
  { id: 'energy-savings-leaf', label: 'Leaf', keywords: 'plant leaf nature', Component: EnergySavingsLeaf },
  { id: 'local-florist', label: 'Flower', keywords: 'flower flowers garden', Component: LocalFlorist },
  { id: 'spa', label: 'Herb', keywords: 'herb plant garden', Component: Spa },
  { id: 'yard', label: 'Garden', keywords: 'garden plant yard', Component: Yard },
  { id: 'grass', label: 'Grass', keywords: 'grass field plant', Component: Grass },
  { id: 'park', label: 'Park', keywords: 'park tree nature', Component: Park },
  { id: 'forest', label: 'Forest', keywords: 'forest tree nature', Component: Forest },
  { id: 'nature', label: 'Nature', keywords: 'nature outdoors', Component: Nature },
  { id: 'nature-people', label: 'Nature', keywords: 'nature outdoors people', Component: NaturePeople },
  { id: 'agriculture', label: 'Agriculture', keywords: 'farm farming crops', Component: Agriculture },
  { id: 'compost', label: 'Compost', keywords: 'compost soil organic', Component: Grass },
  { id: 'category', label: 'Category', keywords: 'category folder', Component: Category },
  { id: 'shopping-basket', label: 'Basket', keywords: 'basket shopping market', Component: ShoppingBasket },
  { id: 'local-grocery-store', label: 'Groceries', keywords: 'grocery groceries market', Component: LocalGroceryStore },
  { id: 'shopping-cart', label: 'Shopping cart', keywords: 'shop shopping cart', Component: ShoppingCart },
  { id: 'storefront', label: 'Storefront', keywords: 'store shop business', Component: Storefront },
  { id: 'store', label: 'Store', keywords: 'store shop business', Component: Store },
  { id: 'local-shipping', label: 'Delivery', keywords: 'shipping delivery truck', Component: LocalShipping },
  { id: 'inventory-2', label: 'Products', keywords: 'products inventory box', Component: Inventory2 },
  { id: 'egg', label: 'Egg', keywords: 'egg poultry food', Component: Egg },
  { id: 'set-meal', label: 'Seafood', keywords: 'fish seafood meal', Component: SetMeal },
  { id: 'restaurant', label: 'Restaurant', keywords: 'restaurant food meal', Component: Restaurant },
  { id: 'local-dining', label: 'Dining', keywords: 'dining food meal', Component: LocalDining },
  { id: 'fastfood', label: 'Prepared food', keywords: 'fast food meal', Component: Fastfood },
  { id: 'kebab-dining', label: 'Produce', keywords: 'produce food vegetables', Component: KebabDining },
  { id: 'bakery-dining', label: 'Bakery', keywords: 'bakery bread food', Component: BakeryDining },
  { id: 'local-cafe', label: 'Cafe', keywords: 'cafe coffee drink', Component: LocalCafe },
  { id: 'coffee', label: 'Coffee', keywords: 'coffee drink', Component: Coffee },
  { id: 'pets', label: 'Pets', keywords: 'pets animals', Component: Pets },
  { id: 'home', label: 'Home', keywords: 'home house', Component: Home },
  { id: 'star', label: 'Featured', keywords: 'featured popular favorite', Component: Star },
];

const iconById = new Map(CATEGORY_ICONS.map((icon) => [icon.id, icon.Component]));
const ICON_PREFIX = 'mui:';

export const getBuiltInCategoryIcon = (value) => {
  if (typeof value !== 'string' || !value.startsWith(ICON_PREFIX)) return null;
  return iconById.get(value.slice(ICON_PREFIX.length)) || null;
};

export default function CategoryIcon({ value, size = 24, color = 'text.secondary' }) {
  const [imageFailed, setImageFailed] = useState(false);
  const Icon = getBuiltInCategoryIcon(value);

  useEffect(() => setImageFailed(false), [value]);

  if (Icon) return <Icon sx={{ fontSize: size, color, display: 'block' }} aria-hidden="true" />;
  if (!value || imageFailed) return null;
  return (
    <Box
      component="img"
      src={getMediaUrl(value)}
      onError={() => setImageFailed(true)}
      alt=""
      sx={{ width: size, height: size, objectFit: 'contain', display: 'block' }}
    />
  );
}
