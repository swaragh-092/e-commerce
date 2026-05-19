'use strict';

module.exports = (sequelize, DataTypes) => {
  const GalleryItem = sequelize.define('GalleryItem', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    galleryId: { type: DataTypes.UUID, allowNull: false, field: 'gallery_id' },
    mediaId: { type: DataTypes.UUID, allowNull: false, field: 'media_id' },
    priority: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  }, {
    tableName: 'gallery_items',
    timestamps: true,
    underscored: true,
  });

  GalleryItem.associate = (models) => {
    GalleryItem.belongsTo(models.Gallery, { foreignKey: 'galleryId', as: 'gallery' });
    GalleryItem.belongsTo(models.Media, { foreignKey: 'mediaId', as: 'media' });
  };

  return GalleryItem;
};
