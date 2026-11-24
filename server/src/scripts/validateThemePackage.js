'use strict';

const fs = require('node:fs');
const { validatePackage } = require('../modules/theme/theme.service');

const files = process.argv.slice(2);
if (!files.length) {
    console.error('Usage: node server/src/scripts/validateThemePackage.js <file.theme.json> [...]');
    process.exitCode = 1;
}

for (const file of files) {
    try {
        const contents = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
        validatePackage(JSON.parse(contents));
        console.log(`${file} is valid.`);
    } catch (error) {
        console.error(`${file}: ${error.message}`);
        process.exitCode = 1;
    }
}
