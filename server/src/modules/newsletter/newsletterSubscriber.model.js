'use strict';

const crypto = require('crypto');

const generateUnsubscribeToken = () => crypto.randomBytes(24).toString('hex');

module.exports = (sequelize, DataTypes) => {
  const NewsletterSubscriber = sequelize.define('NewsletterSubscriber', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    // Note: the unique: true here generates a plain case-sensitive unique
    // index. The migration 20260529140000-create-newsletter-subscribers.js
    // drops the implicit unique and replaces it with a functional unique
    // index on LOWER(email). Service code must still lowercase before query.
    email: { type: DataTypes.STRING(255), allowNull: false, unique: true, validate: { isEmail: true } },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'active' },
    source: { type: DataTypes.STRING(50), allowNull: true, defaultValue: 'homepage' },
    subscribedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    unsubscribedAt: { type: DataTypes.DATE, allowNull: true },
    unsubscribeToken: { type: DataTypes.STRING(64), allowNull: true, unique: true },
  }, {
    tableName: 'newsletter_subscribers',
    timestamps: true,
    underscored: true,
    hooks: {
      // Generate the unsubscribe token at insert time so the subscribe
      // response can return it without a follow-up UPDATE. The previous
      // design had the admin list endpoint mutating rows to backfill
      // tokens, which is wrong on a GET.
      beforeCreate: (subscriber) => {
        if (!subscriber.unsubscribeToken) {
          subscriber.unsubscribeToken = generateUnsubscribeToken();
        }
      },
    },
  });

  // Kept for any callers that explicitly want to (re)generate — but the
  // service code no longer relies on this. New rows are guaranteed a
  // token via the hook above.
  NewsletterSubscriber.prototype.ensureUnsubscribeToken = async function ensureUnsubscribeToken() {
    if (!this.unsubscribeToken) {
      this.unsubscribeToken = generateUnsubscribeToken();
      await this.save({ fields: ['unsubscribeToken'] });
    }
    return this.unsubscribeToken;
  };

  return NewsletterSubscriber;
};
