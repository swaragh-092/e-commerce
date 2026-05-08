const { Product } = require('./server/src/models');
const { Op, Sequelize } = require('sequelize');

async function testCounts() {
  try {
    const statusCounts = await Product.findAll({
      attributes: [
        [Sequelize.col('Product.status'), 'status'],
        [Sequelize.fn('COUNT', Sequelize.fn('DISTINCT', Sequelize.col('Product.id'))), 'count']
      ],
      group: [Sequelize.col('Product.status')],
      raw: true
    });
    console.log('Status Counts:', JSON.stringify(statusCounts, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit();
  }
}

testCounts();
