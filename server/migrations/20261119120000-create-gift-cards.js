'use strict';

module.exports = {
    async up(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.sequelize.query(`
                CREATE TABLE gift_card_policy (
                    id integer PRIMARY KEY CHECK (id = 1),
                    enabled boolean NOT NULL DEFAULT false,
                    minimum integer NOT NULL DEFAULT 500 CHECK (minimum > 0),
                    maximum integer NOT NULL DEFAULT 5000 CHECK (maximum >= minimum),
                    validity_days integer CHECK (validity_days > 0)
                );
                INSERT INTO gift_card_policy (id) VALUES (1);
                CREATE TABLE gift_card_purchases (
                    id uuid PRIMARY KEY,
                    token_digest text NOT NULL,
                    buyer_email text NOT NULL,
                    recipient_email text NOT NULL,
                    sender_name text NOT NULL,
                    message text NOT NULL,
                    due_at timestamptz,
                    validity_days integer,
                    amount integer NOT NULL CHECK (amount > 0),
                    provider_order text UNIQUE,
                    provider_payment text UNIQUE,
                    created_at timestamptz NOT NULL DEFAULT now(),
                    failed_at timestamptz,
                    refund_requested_at timestamptz,
                    refund_status text,
                    provider_refund text,
                    captured_at timestamptz
                );
                CREATE TABLE gift_cards (
                    id uuid PRIMARY KEY,
                    purchase_id uuid NOT NULL REFERENCES gift_card_purchases(id),
                    digest text NOT NULL UNIQUE,
                    code_cipher jsonb NOT NULL,
                    suffix text NOT NULL,
                    balance integer NOT NULL CHECK (balance >= 0),
                    held integer NOT NULL DEFAULT 0 CHECK (held >= 0 AND held <= balance),
                    expires_at timestamptz,
                    suspended boolean NOT NULL DEFAULT false,
                    revoked boolean NOT NULL DEFAULT false
                );
                CREATE UNIQUE INDEX gift_card_active_purchase ON gift_cards(purchase_id) WHERE NOT revoked;
                CREATE TABLE gift_card_ledger (
                    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                    card_id uuid NOT NULL REFERENCES gift_cards(id),
                    kind text NOT NULL,
                    reference text NOT NULL,
                    balance_delta integer NOT NULL DEFAULT 0,
                    hold_delta integer NOT NULL DEFAULT 0,
                    actor_id uuid,
                    reason text,
                    created_at timestamptz NOT NULL DEFAULT now(),
                    UNIQUE (card_id, kind, reference)
                );
                CREATE TABLE gift_card_deliveries (
                    purchase_id uuid NOT NULL REFERENCES gift_card_purchases(id),
                    kind text NOT NULL,
                    due_at timestamptz NOT NULL,
                    status text NOT NULL DEFAULT 'pending',
                    attempts integer NOT NULL DEFAULT 0,
                    sent_at timestamptz,
                    PRIMARY KEY (purchase_id, kind)
                );
                CREATE INDEX gift_card_delivery_ready ON gift_card_deliveries(due_at) WHERE status = 'pending';
                ALTER TABLE orders ADD COLUMN gift_card_amount_paise integer;
                CREATE TABLE gift_card_tenders (
                    order_id uuid PRIMARY KEY REFERENCES orders(id),
                    card_id uuid NOT NULL REFERENCES gift_cards(id),
                    amount integer NOT NULL CHECK (amount > 0),
                    state text NOT NULL CHECK (state IN ('held', 'captured', 'released')),
                    restored integer NOT NULL DEFAULT 0 CHECK (restored >= 0 AND restored <= amount)
                );
            `, { transaction });
        });
    },

    async down(queryInterface) {
        await queryInterface.sequelize.query(`
            ALTER TABLE orders DROP COLUMN gift_card_amount_paise;
            DROP TABLE gift_card_tenders, gift_card_deliveries, gift_card_ledger,
                gift_cards, gift_card_purchases, gift_card_policy;
        `);
    },
};
