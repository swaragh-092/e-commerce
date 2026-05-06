const { Setting } = require('./src/modules/index');

async function test() {
  const mode = await Setting.findOne({ where: { group: 'general', key: 'mode' } });
  console.log('Current mode in DB:', mode ? mode.value : 'undefined');
  
  // Set it to catalog to see if our script is modifying it
  // Actually, we don't need to change it here, we want to know if the UI works.
  
  process.exit(0);
}

test().catch(console.error);
