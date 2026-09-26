import { describe, expect, it } from 'vitest';
import { buildOrganizationJsonLd } from '../../utils/seo/buildOrganizationJsonLd';

describe('organization structured data builder', () => {
  it('uses only configured store identity, contact, address, and social fields', () => {
    const schema = buildOrganizationJsonLd({
      canonicalBaseUrl: 'https://shop.example',
      settings: {
        general: {
          storeName: 'North Peak Outfitters',
          contactEmail: 'hello@shop.example',
        },
        logo: { main: '/uploads/logo.png' },
        footer: {
          phone: '+1 555 0100',
          address: { line1: '1 Trail Road', city: 'Denver', state: 'CO', zip: '80202' },
          facebook: 'https://facebook.com/northpeak',
        },
      },
    });

    expect(schema).toMatchObject({
      '@type': 'OnlineStore',
      name: 'North Peak Outfitters',
      url: 'https://shop.example/',
      logo: { url: 'https://shop.example/uploads/logo.png' },
      address: {
        '@type': 'PostalAddress',
        streetAddress: '1 Trail Road',
        addressLocality: 'Denver',
        addressRegion: 'CO',
        postalCode: '80202',
      },
      contactPoint: {
        email: 'hello@shop.example',
        telephone: '+1 555 0100',
      },
    });
    expect(schema.sameAs).toEqual(['https://facebook.com/northpeak']);
  });
});
