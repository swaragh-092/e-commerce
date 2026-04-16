'use strict';
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up (queryInterface, Sequelize) {
    const products = [];
    const mediaRows = [];
    const imagesRows = [];
    const tagsRows = [];
    const prodTagsRows = [];
    const variantsRows = [];
    const prodCatsRows = [];
    
    const categories = await queryInterface.sequelize.query('SELECT id FROM categories;', { type: Sequelize.QueryTypes.SELECT });
    const tagId = uuidv4();
    tagsRows.push({ id: tagId, name: 'Premium', slug: 'premium', created_at: new Date() });

    for (let i = 1; i <= 20; i++) {
      const prodId = uuidv4();
      const mediaId = uuidv4();
      
      products.push({
        id: prodId,
        name: `Demo Product ${i}`,
        slug: `demo-product-${i}`,
        description: `<p>This is the description for demo product ${i}.</p>`,
        short_description: `Short description ${i}`,
        sku: `DEMO-SKU-${i}`,
        price: 10 + (i * 5),
        sale_price: i % 3 === 0 ? (10 + (i * 5)) * 0.8 : null,
        quantity: 100,
        reserved_qty: 0,
        weight: 500,
        status: 'published',
        is_featured: i <= 5,
        created_at: new Date(),
        updated_at: new Date()
      });
      
      mediaRows.push({
        id: mediaId,
        url: `/uploads/demo-${i}.jpg`,
        filename: `demo-${i}.jpg`,
        mime_type: 'image/jpeg',
        size: 1024,
        provider: 'local',
        created_at: new Date(),
        updated_at: new Date()
      });
      
      imagesRows.push({
        id: uuidv4(),
        product_id: prodId,
        url: `/uploads/demo-${i}.jpg`,
        media_id: mediaId,
        alt: `Demo ${i}`,
        sort_order: 1,
        is_primary: true,
        created_at: new Date()
      });
      
      if (categories.length > 0) {
        prodCatsRows.push({
          product_id: prodId,
          category_id: categories[i % categories.length].id
        });
      }
      
      prodTagsRows.push({
        product_id: prodId,
        tag_id: tagId
      });
      
      variantsRows.push({
        id: uuidv4(),
        product_id: prodId,
        price: 10 + (i * 5),
        stock_qty: 50,
        is_active: true,
        sort_order: 0,
        sku: `DEMO-SKU-${i}-L`,
        created_at: new Date(),
        updated_at: new Date()
      });
    }

    try { await queryInterface.bulkInsert('media', mediaRows, {}); } catch(e){}
    try { await queryInterface.bulkInsert('products', products, {}); } catch(e){}
    try { await queryInterface.bulkInsert('product_images', imagesRows, {}); } catch(e){}
    try {
        await queryInterface.bulkInsert('tags', tagsRows, {});
        await queryInterface.bulkInsert('product_tags', prodTagsRows, {});
    } catch(e) {}
    
    if (prodCatsRows.length) {
      try { await queryInterface.bulkInsert('product_categories', prodCatsRows, {}); } catch(e){}
    }
    try { await queryInterface.bulkInsert('product_variants', variantsRows, {}); } catch(e){}
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('product_variants', null, {});
    await queryInterface.bulkDelete('product_categories', null, {});
    await queryInterface.bulkDelete('product_tags', null, {});
    await queryInterface.bulkDelete('tags', null, {});
    await queryInterface.bulkDelete('product_images', null, {});
    await queryInterface.bulkDelete('products', null, {});
    await queryInterface.bulkDelete('media', null, {});
  }
};
