'use strict';

module.exports = (sequelize, DataTypes) => {
  const BlogPost = sequelize.define('BlogPost', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: {
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
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    summary: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    featuredImageId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'featured_image_id',
    },
    authorId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'author_id',
    },
    galleryId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'gallery_id',
    },
    status: {
      type: DataTypes.ENUM('draft', 'published'),
      allowNull: false,
      defaultValue: 'draft',
    },
    publishedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'published_at',
    },
    displayDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'display_date',
    },
    metaTitle: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'meta_title',
    },
    metaDescription: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'meta_description',
    },
    metaKeywords: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'meta_keywords',
    },
  }, {
    tableName: 'blog_posts',
    timestamps: true,
    underscored: true,
    paranoid: true,
  });

  BlogPost.associate = (models) => {
    BlogPost.belongsTo(models.User, { foreignKey: 'authorId', as: 'author' });
    BlogPost.belongsTo(models.Media, { foreignKey: 'featuredImageId', as: 'featuredImage' });
    BlogPost.belongsTo(models.Gallery, { foreignKey: 'galleryId', as: 'gallery' });
    BlogPost.belongsToMany(models.BlogCategory, {
      through: models.BlogPostCategory,
      foreignKey: 'blogPostId',
      otherKey: 'blogCategoryId',
      as: 'categories',
    });
  };

  return BlogPost;
};
