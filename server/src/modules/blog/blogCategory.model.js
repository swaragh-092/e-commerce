'use strict';

module.exports = (sequelize, DataTypes) => {
  const BlogCategory = sequelize.define('BlogCategory', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    slug: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'blog_categories',
    timestamps: true,
    underscored: true,
    paranoid: true,
  });

  BlogCategory.associate = (models) => {
    BlogCategory.belongsToMany(models.BlogPost, {
      through: models.BlogPostCategory,
      foreignKey: 'blogCategoryId',
      otherKey: 'blogPostId',
      as: 'posts',
    });
  };

  return BlogCategory;
};
