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

// Collect all model files from module subdirectories
const modulesDir = path.join(__dirname);
const modelFiles = [];

fs.readdirSync(modulesDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .forEach((dirent) => {
        const moduleDir = path.join(modulesDir, dirent.name);
        fs.readdirSync(moduleDir)
            .filter((file) => file.endsWith('.model.js'))
            .forEach((file) => {
                modelFiles.push(path.join(moduleDir, file));
            });
    });

// Load all models
modelFiles.forEach((filePath) => {
    const model = require(filePath)(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
});

// Run associations
Object.keys(db).forEach((modelName) => {
    if (db[modelName].associate) {
        db[modelName].associate(db);
    }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
