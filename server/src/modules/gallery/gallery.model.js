'use strict';

module.exports = (sequelize, DataTypes) => {
  const Gallery = sequelize.define('Gallery', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    title: { type: DataTypes.STRING(255), allowNull: false },
    slug: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
  }, {
    tableName: 'galleries',
    timestamps: true,
    underscored: true,
  });

  Gallery.associate = (models) => {
    Gallery.hasMany(models.GalleryItem, { foreignKey: 'galleryId', as: 'items' });
  };

  return Gallery;
};
