'use strict';

module.exports = (sequelize, DataTypes) => {
  const Gallery = sequelize.define('Gallery', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    title: { type: DataTypes.STRING(255), allowNull: false },
    slug: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    coverMediaId: { type: DataTypes.UUID, allowNull: true, field: 'cover_media_id' },
    description: { type: DataTypes.TEXT, allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' },
    isShowcase: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_showcase' },
  }, {
    tableName: 'galleries',
    timestamps: true,
    underscored: true,
  });

  Gallery.associate = (models) => {
    Gallery.belongsTo(models.Media, { foreignKey: 'coverMediaId', as: 'coverImage', onDelete: 'SET NULL' });
    Gallery.hasMany(models.GalleryItem, { foreignKey: 'galleryId', as: 'items' });
    Gallery.hasMany(models.BlogPost, { foreignKey: 'galleryId', as: 'blogPosts' });
  };

  return Gallery;
};
