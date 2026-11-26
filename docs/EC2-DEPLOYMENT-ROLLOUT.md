# EC2 deployment rollout

- develop → staging (old EC2); main → production (new EC2).
- Configure the environment secrets and variables documented in the existing setup. The SSH fingerprint must be the SHA256:... value of the server's ED25519 key, not the entire ssh-keygen output.
- Leave DEPLOY_ENABLED absent or false initially. Pushes run SSH preflight and build only. Enable it per environment only after a successful preflight and review. Do staging first. Enable production only after staging is verified and the production environment's approvals/branch rules are configured.
- Keep the legacy deploy.yml disabled on main until this PR is promoted; it is removed by this change.
- The runner must reach port 22. Do not open SSH to the entire Internet just to pass preflight; use an approved fixed-egress runner or a separate SSM approach if required.
- Staging must use disabled/sandbox integrations. Neither the preflight nor the workflow can prove DB-stored payment/shipping credentials are sandboxed. Check separately.
- Application tests remain in CI; this deployment workflow builds and checks availability. Review CI gates before enabling auto deployment.
- Backend updates stop the process before database backup and migration. This deliberately entails downtime. Failure after migration needs operator-led recovery; no automatic destructive database rollback. Backups and old static releases are retained on the EC2 and need a retention policy. The first real-directory-to-symlink conversion has a short gap; subsequent frontend switches use atomic rename.
- First rollout: after merging into develop, inspect the staging run, confirm successful preflight/build, then set staging DEPLOY_ENABLED=true for a deployment. Promote the workflow to main only after testing staging; production remains disabled until explicitly enabled.
