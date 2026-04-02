'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const config = require('../config/database');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];
const db = {};

const sequelize = new Sequelize(
    dbConfig.database,
    dbConfig.username,
    dbConfig.password,
    dbConfig
);

const modulesDir = path.join(__dirname, '../modules');

/**
 * Auto-discover all *.model.js files in modules/ subdirectories.
 * Each model file exports a function: (sequelize, DataTypes) => Model
 */
const loadModels = (dir) => {
    fs.readdirSync(dir).forEach((item) => {
        const itemPath = path.join(dir, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
            loadModels(itemPath);
        } else if (item.endsWith('.model.js')) {
            const model = require(itemPath)(sequelize, Sequelize.DataTypes);
            db[model.name] = model;
        }
    });
};

loadModels(modulesDir);

// Run associate() for each model that defines it
Object.keys(db).forEach((modelName) => {
    if (db[modelName].associate) {
        db[modelName].associate(db);
    }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
