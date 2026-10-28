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
    // pending   — double opt-in requested; awaiting confirm link click
    // active    — consent verified; receives campaigns
    // unsubscribed — opted out; never receives campaigns
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'active',
      validate: { isIn: [['active', 'pending', 'unsubscribed']] },
    },
    source: { type: DataTypes.STRING(50), allowNull: true, defaultValue: 'homepage' },
    consentIp: { type: DataTypes.STRING(45), allowNull: true },
    consentUserAgent: { type: DataTypes.STRING(255), allowNull: true },
    subscribedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    unsubscribedAt: { type: DataTypes.DATE, allowNull: true },
    // Records successful queueing, not SMTP delivery or inbox receipt.
    // Keep the existing column name for database compatibility.
    lastConfirmQueuedAt: { type: DataTypes.DATE, allowNull: true, field: 'last_confirm_sent_at' },
    unsubscribeToken: { type: DataTypes.STRING(64), allowNull: true, unique: true },
  }, {
    tableName: 'newsletter_subscribers',
    timestamps: true,
    underscored: true,
    hooks: {
      // Generate the unsubscribe token at insert time so the confirm email
      // can reference it without a follow-up UPDATE. Tokens are never
      // returned in API responses (they only travel inside emails).
      beforeCreate: (subscriber) => {
        if (!subscriber.unsubscribeToken) {
          subscriber.unsubscribeToken = generateUnsubscribeToken();
        }
      },
    },
  });

  // Single source of truth for token generation. The service uses this to
  // rotate the token whenever a new consent session (pending) starts, so
  // confirm/unsubscribe links from previous sessions stop working.
  NewsletterSubscriber.generateToken = generateUnsubscribeToken;

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
