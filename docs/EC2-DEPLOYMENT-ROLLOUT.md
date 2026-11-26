# EC2 deployment rollout

Feature PRs to `develop` and promotion PRs to `main` must pass the Backend and
Frontend checks. Each protected-branch push runs those checks for the merged SHA
before the corresponding deployment job starts.

| Environment | Only allowed branch | Admin URL | Frontend root |
| --- | --- | --- | --- |
| Staging | `develop` | `https://eshopadmin.swaragh.org.in` | `/home/ec2-user/e-commerce/client/dist` |
| Production | `main` | `https://ad.orbiseeds.com` | `/var/www/orbis-admin` |

Each GitHub Environment owns its five deployment secrets (`EC2_HOST`,
`EC2_USER`, `EC2_SSH_KEY`, `EC2_HOST_FINGERPRINT`, `APP_DIR`) and six variables
(`SITE_URL`, `VITE_APP_URL`, `VITE_API_URL`, `WEB_ROOT`, `PM2_APP_NAME`,
`DEPLOY_ENABLED`). Use `/api` for `VITE_API_URL`. The preflight reads the
backend's effective `ADMIN_ROUTE_PREFIX` and supplies its final segment to
Vite. Production keeps its environment reviewer gate. Keep the old
`deploy.yml` workflow disabled until its removal reaches `main`.

## Preflight and approval

With `DEPLOY_ENABLED=false`, the job verifies SSH, the EC2 private IP and
branch tip, application PostgreSQL login, PM2, Nginx and the admin login page.
GitHub Actions builds and packages the frontend with Node 22. The job skips
artifact transfer and all release changes.

For a host key mismatch, retrieve the ED25519 fingerprint through a trusted
existing SSH session or the AWS instance console log. Compare that value with
the endpoint's current host key; set `EC2_HOST_FINGERPRINT` to the single
`SHA256:…` field. Keep the SSH deployment key and host pin separate. The runner
must reach TCP 22. A fixed-egress runner is required before limiting ingress
to the runner's address. Security-group changes should preserve authorized
operator access.

Non-interactive SSH needs Node 22, npm, PM2 and non-interactive sudo. If the
host's system Node is shared with other services, install the AL2023
`nodejs22` and `nodejs22-npm` packages side by side and use the dedicated
deployment path.

```bash
mkdir -p "$HOME/.local/ecommerce-node22/bin"
ln -s /usr/bin/node-22 "$HOME/.local/ecommerce-node22/bin/node"
ln -s /usr/bin/npm-22 "$HOME/.local/ecommerce-node22/bin/npm"
```

Check that staging integrations use disabled or sandbox credentials before the
first deployment. After successful preflight and explicit staging approval,
set staging's `DEPLOY_ENABLED=true` and rerun the latest push-based staging
workflow on `develop`. Wait for promotion to `main` to use manual workflow
dispatch, which GitHub requires to be defined on the default branch. Verify the deployment and do staging QA
before promoting to `main`. Enable production separately after explicit
approval. Production runs wait for an allowed environment reviewer.

## Release and retention

The server holds a lock for the whole release. It verifies the frontend
checksum and prepares a static release before stopping the API for the
database backup. Deployments incur downtime while the API is stopped. The job
reads the backup archive end to end, records a SHA-256 digest, fast-forwards the
checkout, installs locked production dependencies and runs migrations. It then
restarts PM2 and waits for database-backed readiness. The admin frontend switches
atomically. The smoke check compares the served login document and JavaScript
asset with the build. On a failed smoke check the job restores the previous
frontend.

The script keeps the five newest completed backups in
`$HOME/deployment-backups` and five frontend release directories under
`WEB_ROOT.releases`, protecting the active and immediately previous releases.
GitHub Actions keeps its build artifact for three days. Download or copy backups
that require longer retention to an approved backup destination. The on-host
copies share the life of the EC2 volume.

## Recover from a failure

First set the affected environment's `DEPLOY_ENABLED=false` to pause later
merges. Use the logged phase, previous Git SHA and verified dump path. Preserve
`.env`, uploads and the live database.

- **Before checkout:** if the API stopped during backup, the job attempts to
  restart the previous process. Verify it with
  `curl -fsS http://127.0.0.1:5000/health`. Inspect PM2 and PostgreSQL before retrying.
- **Checkout or dependency install:** inspect `git status --short` and
  `git log -1`. Confirm the migration step did not start. Restore the previous
  backend using a controlled checkout of the logged SHA and reinstall its locked
  dependencies, or repair the current checkout before running the latest deploy.
  Keep the server deployment branch in a fast-forwardable state.
- **Migration or restart:** inspect the Sequelize migration table and job output
  to determine which migrations committed. Correct and roll forward when
  possible. Before considering a database restore, compare the logged checksum
  with `sha256sum -c <dump-file>.sha256` from the backup directory and rehearse
  the restore into an isolated database. A live restore requires approval and
  accounting for any writes after the backup. The pipeline never runs down
  migrations, seeders or resets.
- **Frontend only:** after confirming compatibility with the running API,
  switch the frontend symlink to a retained release. Substitute the exact
  paths recorded for the environment and keep the old directory for recovery.

```bash
sudo ln -s -- "$PREVIOUS_RELEASE" "$WEB_ROOT.rollback"
sudo mv -Tf -- "$WEB_ROOT.rollback" "$WEB_ROOT"
curl -fsS "$SITE_URL/admin/login" -o /dev/null
```

The rollback commands assume `WEB_ROOT` is a symlink. If the first deploy
restored the original directory, the original frontend is already live.
