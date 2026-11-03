'use strict';

// Retained for migration-history compatibility. Demo identities with shared
// credentials must never be created by db:seed:all, in any environment.
module.exports = {
  up: async () => {},
  // Never delete users here: addresses may now belong to real accounts.
  // Existing demo identities require an operator-reviewed suspension.
  down: async () => {},
};
