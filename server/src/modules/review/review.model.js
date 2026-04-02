'use strict';

module.exports = (sequelize, DataTypes) => {
    const Review = sequelize.define('Review', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        productId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        userId: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        orderId: {
            type: DataTypes.UUID,
        },
        rating: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                min: 1,
                max: 5,
            },
        },
        title: {
            type: DataTypes.STRING(255),
        },
        body: {
            type: DataTypes.TEXT,
        },
        isVerifiedPurchase: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        status: {
            type: DataTypes.STRING(20),
            defaultValue: 'pending',
            validate: {
                isIn: [['pending', 'approved', 'rejected']],
            },
        },
    }, {
        tableName: 'reviews',
        timestamps: true,
        underscored: true,
        indexes: [
            {
                unique: true,
                fields: ['userId', 'productId'],
            }
        ]
    });

    Review.associate = (models) => {
        Review.belongsTo(models.User, { foreignKey: 'userId', onDelete: 'CASCADE' });
        Review.belongsTo(models.Product, { foreignKey: 'productId', onDelete: 'CASCADE' });
        if (models.Order) {
            Review.belongsTo(models.Order, { foreignKey: 'orderId', onDelete: 'SET NULL' });
        }
    };

    return Review;
};
