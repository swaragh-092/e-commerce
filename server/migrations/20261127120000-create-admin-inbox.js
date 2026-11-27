'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        CREATE TABLE admin_alert_policy (
          singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
          email_paused boolean NOT NULL DEFAULT false
        );
        INSERT INTO admin_alert_policy DEFAULT VALUES;
        CREATE TABLE admin_alert_events (
          id uuid PRIMARY KEY, event text NOT NULL, data jsonb NOT NULL, occurrence text UNIQUE,
          created_at timestamptz NOT NULL DEFAULT now(), rule_versions jsonb
        );
        CREATE INDEX admin_alert_events_pending ON admin_alert_events (created_at) WHERE rule_versions IS NULL;
        CREATE TABLE admin_alert_rules (
          id uuid PRIMARY KEY, event text NOT NULL, version integer NOT NULL, config jsonb NOT NULL
        );
        CREATE TABLE admin_alert_rule_versions (
          rule_id uuid NOT NULL REFERENCES admin_alert_rules(id), version integer NOT NULL,
          editor_id uuid REFERENCES users(id) ON DELETE SET NULL, config jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (rule_id, version)
        );
        CREATE TABLE admin_alert_delegations (
          rule_id uuid NOT NULL REFERENCES admin_alert_rules(id), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          fields jsonb NOT NULL, audience jsonb NOT NULL, PRIMARY KEY (rule_id, user_id)
        );
        CREATE TABLE admin_alert_preferences (
          user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, preferences jsonb NOT NULL
        );
        CREATE TABLE admin_alert_inbox (
          id uuid PRIMARY KEY, event_id uuid NOT NULL REFERENCES admin_alert_events(id),
          rule_id uuid NOT NULL, version integer NOT NULL, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          message jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), read_at timestamptz,
          UNIQUE (event_id, rule_id, user_id)
        );
        CREATE INDEX admin_alert_inbox_user ON admin_alert_inbox (user_id, created_at DESC);
        CREATE TABLE admin_alert_email (
          id uuid PRIMARY KEY, event_id uuid NOT NULL REFERENCES admin_alert_events(id),
          rule_id uuid NOT NULL, version integer NOT NULL, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          message jsonb NOT NULL, status text NOT NULL DEFAULT 'queued', attempts integer NOT NULL DEFAULT 0,
          due_at timestamptz NOT NULL DEFAULT now(), error text, UNIQUE (event_id, rule_id, user_id)
        );
        CREATE INDEX admin_alert_email_due ON admin_alert_email (due_at) WHERE status IN ('queued', 'sending');
      `, { transaction });
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE admin_alert_email, admin_alert_inbox, admin_alert_preferences,
        admin_alert_delegations, admin_alert_rule_versions, admin_alert_rules, admin_alert_events, admin_alert_policy;
    `);
  },
};
