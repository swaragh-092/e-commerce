module.exports = (sequelize, DataTypes) => {
  const Enquiry = sequelize.define(
    'Enquiry',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 1,
      },
      status: {
        type: DataTypes.ENUM('pending', 'responded', 'closed'),
        allowNull: false,
        defaultValue: 'pending',
      }, 
      productId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'product_id',
      },
      variantId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'variant_id',
      },
      cartItems: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'cart_items',
      },
    },
    {
      tableName: 'enquiries',
      timestamps: true,
      underscored: true,
      paranoid: true,
    }
  );

  Enquiry.associate = (models) => {
    if (models.Product) {
      Enquiry.belongsTo(models.Product, {
        foreignKey: 'product_id',
        as: 'product',
      });
    }
    if (models.ProductVariant) {
      Enquiry.belongsTo(models.ProductVariant, {
        foreignKey: 'variant_id',
        as: 'variant',
      });
    }
  };

  return Enquiry;
};
