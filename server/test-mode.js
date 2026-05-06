const { Setting } = require('./src/modules/index');
async function test() {
  const s = await Setting.findOne({ where: { group: 'general', key: 'mode' } });
  console.log(s ? s.value : 'not set');
  process.exit(0);
}
test();
