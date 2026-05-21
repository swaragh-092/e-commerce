'use strict';

module.exports = (sequelize, DataTypes) => {
  const BlogPostCategory = sequelize.define('BlogPostCategory', {
    blogPostId: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      field: 'blog_post_id',
    },
    blogCategoryId: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      field: 'blog_category_id',
    },
  }, {
    tableName: 'blog_post_categories',
    timestamps: true,
    underscored: true,
  });

  BlogPostCategory.associate = () => {};

  return BlogPostCategory;
};
