# Model Associations Wiring Pattern

This project uses an automatic model association wiring pattern implemented in `server/src/modules/index.js`.

## How it works

1.  **Model Loading**: The `index.js` script recursively searches the `server/src/modules/` directory for files ending in `.model.js`.
2.  **Model Initialization**: Each found model file is a function that takes `sequelize` and `DataTypes` as arguments and returns a Sequelize model.
3.  **Association Registration**: After all models are loaded and stored in the `db` object, the script iterates through all models and checks if they have an `associate` static method.
4.  **Wiring**: If a model has an `associate(models)` method, it is called with the entire `db` object (which contains all loaded models) as its argument.

## Example Usage

In your model file (`server/src/modules/someModule/someModel.model.js`):

```javascript
'use strict';

module.exports = (sequelize, DataTypes) => {
    const SomeModel = sequelize.define('SomeModel', {
        // fields...
    }, {
        tableName: 'some_models',
        underscored: true,
        timestamps: true,
    });

    SomeModel.associate = (models) => {
        // Define associations here using the models object
        SomeModel.belongsTo(models.OtherModel, { foreignKey: 'otherModelId' });
        SomeModel.hasMany(models.AnotherModel, { foreignKey: 'someModelId' });
    };

    return SomeModel;
};
```

This pattern ensures that all models are initialized before any associations are defined, avoiding circular dependency issues and ensuring that all model references are available when associations are set up.
