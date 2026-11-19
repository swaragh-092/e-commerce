# Security Learning Guide: Accounts and Login

For the latest implementation results and infrastructure gaps, read the [2026-11-03 security update](ACCOUNT-LOGIN-SECURITY-2026-11-03.md). Evidence dated 2026-11-02 below is historical.

This guide teaches the ideas behind the current accounts and login work, then gives a roadmap for learning web, application, and infrastructure security. It is written for learning and safe local practice. It is not a security certification or proof that the live store is secure.

## How to use this guide

Learn one protection at a time. For each one, ask three questions:

1. What can go wrong?
2. What control makes that harder?
3. What evidence would show the control works?

Keep local practice data fake. Never paste passwords, one-time codes, recovery codes, access tokens, cookies, private keys, database URLs, or `.env` contents into notes, screenshots, tickets, or chat. Do not experiment against the live store or real customer accounts.

## Four words used throughout

- **Authentication:** Checking who is signing in, for example by checking a password and MFA code.
- **Authorization:** Checking what that signed-in person is allowed to do, such as whether they may view admin orders or issue a refund. A successful login alone must not grant admin access.
- **Session:** The time-limited proof the application uses to recognize a person across requests after sign-in. Browsers commonly carry session credentials in cookies.
- **MFA:** Multi-factor authentication. It asks for proofs from more than one category, such as something the person knows (password) and something they have (authenticator app).

## A plain login flow

1. The browser sends the email and password to the store over HTTPS.
2. The server finds the account, checks its password hash, and applies account status and login-abuse rules. It should avoid revealing whether an unknown email is registered.
3. If policy requires MFA, the server asks for and verifies the second factor. It should record MFA completion only after the check succeeds.
4. The server creates a session and sends appropriately protected cookies. Later, the server checks the session and the user's permissions for each protected action.
5. When the access token expires, the browser may use a refresh token. Rotation replaces it; logout or other revocation should make the server reject the old session.

Password reset and Google login are alternate ways to establish identity, so they must reach the same account/session policy safely. Reset links and OTPs must expire and be single-use. Google callbacks must be validated and tied to the browser that started the flow.

## A security learning roadmap

### 1. Foundations

- **Assets and attackers:** Identify what needs protection (accounts, orders, addresses, payment-related records, source code) and who might target it. An attacker can be an outsider, a compromised customer account, a malicious insider, or automated software.
- **Threat modeling:** For each feature, list what it accepts, what it trusts, what it changes, and what could be abused. Example: a password-reset endpoint accepts an email and token and can change a customer's password.
- **Least privilege:** Give each person, process, and service only the access it needs. A store's web process should not connect to PostgreSQL as a database superuser.
- **Defense in depth:** Use several independent protections. A strong password does not replace MFA, rate limits, secure sessions, backups, or monitoring.
- **Confidentiality, integrity, availability:** Keep private data private, prevent unauthorized changes, and keep the store usable.

### 2. Web security

- **HTTP, TLS, origins, and browser boundaries:** Learn requests, responses, headers, HTTPS certificates, same-origin rules, CORS, and how browsers send cookies.
- **Browser attacks:** Study cross-site scripting (XSS), cross-site request forgery (CSRF), clickjacking, and unsafe redirects. Learn output encoding, safe content policies, CSRF protections, and secure redirect allowlists.
- **Input and output handling:** Validate data on the server, use parameterized database queries, encode output for its context, and treat uploaded files and third-party data as untrusted.
- **Security headers and cookies:** Understand `HttpOnly`, `Secure`, `SameSite`, content security policy, and frame restrictions. These controls reduce specific risks; none makes an unsafe application safe by itself.
- **Practice:** Use a deliberately vulnerable local training application or a disposable local copy. Do not probe public sites without clear authorization.

### 3. Application and account security

- **Identity and authorization:** Authentication asks “who are you?” Authorization asks “may you perform this action on this object?” Check permissions on the server for every sensitive operation, including orders and admin actions.
- **Passwords and MFA:** Learn password hashing, password reset, MFA enrollment/recovery, login throttling, and account enumeration.
- **Sessions and tokens:** Learn session cookies, access-token expiry, refresh-token rotation, revocation, logout, and CSRF considerations.
- **Data and APIs:** Classify personal data, minimize collection, protect secrets, validate API inputs, limit resource use, and avoid leaking internals in errors.
- **Dependencies and software supply chain:** Track packages, lockfiles, updates, build permissions, secret exposure, and dependency advisories.
- **Practice:** Use local test accounts and a local/test database with fake records. Read logs with secrets redacted.

### 4. Infrastructure and operations security

- **AWS and EC2:** Learn account/root protection, MFA, IAM roles and policies, instance roles, security groups, patching, backups, SSH access, logging, and incident response. Console MFA does not by itself protect SSH or application login paths.
- **GitHub:** Learn repository and organization permissions, human MFA, branch protection, protected deployment environments, workflow permissions, secret storage, and deploy key rotation. Human MFA does not protect unattended deployment credentials.
- **PostgreSQL:** Learn network boundaries, TLS, SCRAM password authentication, least-privilege roles, backups, updates, audit logs, and recovery tests. Database password authentication does not provide human MFA.
- **Operations:** Learn asset inventory, vulnerability response, monitoring, alert handling, backup restoration, incident containment, and evidence preservation.
- **Practice:** Use a personal sandbox account or local containers. Do not change production IAM, firewall, database, or deployment settings as a learning exercise.

### 5. A practical progression

1. Draw the login, reset, MFA, refresh, and Google sign-in flows.
2. For each flow, mark where user input enters, where a secret is checked, what database rows change, and what a browser stores.
3. Read the relevant server code and tests; connect each test to the risk it covers.
4. Reproduce cases only with fake accounts in a local environment.
5. Learn to verify logs, database state, browser cookie flags, and failure behavior without revealing secrets.
6. Move from application controls to AWS, GitHub, and PostgreSQL access paths.
7. Keep a written evidence log that labels each control as locally implemented, live verified, or still pending.

## Lesson 1: Protecting account access

An account is a key to personal information and store actions. A safe login system assumes that passwords can be guessed or stolen, requests can arrive concurrently, browsers can be compromised, and users can make mistakes. Each control below addresses a different failure.

### Password hashing

**What it is:** A website should never store a readable password. It stores a one-way password hash made by a password-specific hashing algorithm such as bcrypt. When a user signs in, the server checks the entered password against the stored hash. A salt makes equal passwords produce different stored hashes; a work factor makes each guess more expensive.

**What it protects against:** If a database copy is stolen, hashing makes it harder to turn stored values back into passwords. It does not protect a password typed into a phishing site, a compromised device, an exposed application secret, or a weak password that can still be guessed offline. Hashes are not encryption and cannot be “decrypted” to recover the original password.

**E-commerce example:** A customer database leak should not immediately reveal the passwords customers may have reused elsewhere. The store should use a modern password-hashing configuration and should never log submitted passwords.

**Safe local practice:** Use a fake account and a local database. Inspect the account row and confirm that it contains a hash rather than the test password. Never print real hashes or credentials into shared logs. Avoid changing hash settings without understanding how existing accounts will continue to sign in.

**How to verify:** Review the password model and creation/reset/change paths. Confirm they use the password-hashing library consistently and test that the stored value differs from the input while successful and failed login behave correctly. A code test proves local behavior, not live configuration or resistance to every attack.

### MFA (multi-factor authentication)

**What it is:** MFA asks for another proof in addition to a password, commonly a time-based one-time code from an authenticator app. The second proof should be checked by the server. Enrollment and successful MFA login are separate events: turning MFA on must not silently make an old password-only session an MFA-approved session.

**What it protects against:** It can stop many attackers who have only stolen or guessed the password. It does not stop every phishing attack, stolen active session, compromised device, or social-engineering attack. Recovery codes and support-assisted recovery are sensitive alternate ways into an account and need protection too.

**E-commerce example:** An administrator who has a password exposed through another service should still need their authenticator code before changing products, viewing admin data, or issuing refunds.

**Safe local practice:** Enroll a fake local administrator using the documented local enrollment process. Keep the provisioning URI and recovery codes private; use disposable values and destroy them after practice. Test password-only denial and a successful MFA flow locally. Do not enroll or reset a live administrator as an exercise.

**How to verify:** Check that protected admin actions require server-verified MFA evidence, that MFA cannot be bypassed by alternate login or refresh paths, that old sessions do not gain MFA status merely because enrollment occurred, and that recovery codes are one-time. Live enrollment and infrastructure MFA require separate authorized verification.

### Sessions, cookies, and logout

**What they are:** After login, the server gives the browser a session credential (for example, an access token and a refresh token). A cookie can carry that credential. `HttpOnly` prevents page JavaScript from reading a cookie; `Secure` tells the browser to send it only over HTTPS; `SameSite` limits when the browser sends it with cross-site requests. These are browser protections, not proof that the token itself is safe.

**What they protect against:** Cookie flags reduce exposure through some script and cross-site request attacks. Expiry limits how long a stolen credential remains useful. Server-side revocation can end sessions after logout, password reset, suspension, or suspected theft. Logout should invalidate the server-side refresh session and clear browser cookies; clearing the browser alone may leave a copied token usable.

**E-commerce example:** If a customer logs out on a shared computer, a revoked refresh session should not let someone silently obtain a fresh access token later.

**Safe local practice:** Use browser developer tools only on a local test account to inspect cookie names and flags, without copying cookie values. Log out, then check the local app's behavior using the same test session. Never paste a cookie into a command or report.

**How to verify:** Inspect cookie attributes over HTTPS in the intended live browser only when an authorized live check is planned. Separately verify server-side logout/revocation and that a protected page redirects or denies access after logout. Consider CSRF defenses for cookie-authenticated state-changing requests.

### Refresh-token rotation and reuse detection

**What it is:** A short-lived access token handles ordinary requests. A longer-lived refresh token can obtain a new access token. With rotation, each successful refresh invalidates the old refresh token and issues a new one. If an already-used token appears again, the server may treat it as replay and revoke the token family/session.

**What it protects against:** Rotation limits how long a copied refresh token can be reused without detection. Reuse detection can reveal token theft and terminate a session. It does not stop theft before the first use, and browser tabs that refresh simultaneously can accidentally look like an attacker unless the client coordinates refreshes or the server policy accounts for races.

**E-commerce example:** A stolen customer refresh token should not remain reusable indefinitely after the legitimate browser rotates it. A concurrent refresh from two tabs must be handled deliberately so legitimate users are not confused with replaying attackers.

**Safe local practice:** Use the project's local auth tests or fake accounts. Test one normal refresh, then a reuse attempt with the old token, and inspect only redacted session state. Do not copy live refresh tokens or simulate replay against the live site.

**How to verify:** Check that rotation and revocation are atomic in the database, that replay revocation commits even when the request is rejected, and that a legitimate concurrent refresh has a documented outcome. Mocked unit tests help, but a real PostgreSQL concurrency test is needed to validate database locking behavior.

### One-time OTP and password-reset tokens

**What they are:** An OTP is a short-lived code used to prove possession of a factor. A password-reset token authorizes changing a password. “One-time” means the server must prevent two concurrent requests from consuming the same value successfully, not merely delete it after an ordinary read.

**What they protect against:** Short expiry limits the window for guessing or theft. Attempt limits slow guessing. Single-use consumption prevents a captured or raced token from being replayed after use. Reset links must be unpredictable, stored safely (commonly as hashes), and invalidated after successful use or reissue according to the policy.

**E-commerce example:** A person who receives a reset email for a customer account should be able to use its link once within a short window. A second request racing the first should not also change the password.

**Safe local practice:** Use a local mail catcher and fake address. Test expired, invalid, repeated, and simultaneous submissions. Ensure logs show no complete code or reset link. Never forward or screenshot a real reset email.

**How to verify:** Check expiry, attempt counting, and database transaction/locking behavior. Test boundary times and concurrent requests against a real local PostgreSQL instance; mocked tests alone cannot prove real lock behavior. Confirm error responses do not accidentally reveal whether another account exists.

### Account enumeration

**What it is:** Enumeration happens when an attacker can discover which email addresses have accounts by comparing responses, timing, or side effects. A generic message such as “If an account exists, instructions will be sent” can reduce this signal on reset requests.

**What it protects against:** Reducing enumeration makes it harder to build a list of store customers or administrators for phishing and password attacks. It does not make weak passwords safe, and login still needs useful security monitoring and throttling.

**E-commerce example:** A reset form should not tell a stranger whether a shopper has placed an order with the store.

**Safe local practice:** Submit known and unknown fake addresses and compare status, body, and approximate response time over multiple trials. Avoid real customer addresses. Ensure the system does not send email or create side effects for unknown accounts that disclose identity in another way.

**How to verify:** Compare response behavior for known and unknown accounts, measure timing across repeated local trials, and inspect rate limits. Perfectly identical timing is difficult; look for large, consistent clues and avoid claiming the feature is complete based only on matching text.

### Google login and automatic account matching

**What it is:** Google login is an identity-provider flow. The store redirects the browser to Google, receives a callback, validates the result and its browser-bound state, and maps the Google sign-in to a store account. The chosen product policy here is automatic matching by the same **verified email**. Respecting that choice, the implementation checks for a verified-email claim before account lookup; that check alone does not establish that Google is currently authoritative for every address. Google documents that it is authoritative for Gmail addresses and verified Google Workspace addresses with a hosted-domain (`hd`) claim. For accounts using an external email address without that claim, Google says the address may have been verified when the Google Account was created while ownership may since have changed; it recommends an additional password or challenge. This is an important residual risk to understand when choosing email-based auto-matching. This guide does not claim the app rejects external addresses or binds accounts by Google's stable `sub` identifier.

**What it protects against:** Correct state checking helps prevent forged or mismatched login callbacks. Requiring a verified-email claim reduces the chance of matching on an address explicitly marked unverified, but it does not remove the external-address ownership caveat above. These checks do not prove every OAuth setting is correct, and automatic matching can still have account recovery and identity-change implications that need careful handling.

**E-commerce example:** A shopper who previously registered with a verified email can use Google with that same verified email and reach the same store account, order history, and saved address. If the email is not verified or does not match, the application must follow an explicit safe flow rather than silently attach the identity.

**Safe local practice:** Use a development OAuth client with localhost callback URLs and test accounts. Use provider test accounts, inspect redacted callback outcomes, and verify rejected state and unverified-email cases. Never use the live Google client or attach a real account as a learning experiment.

**How to verify:** Confirm state is unpredictable, expires, and is bound to the initiating browser; validate issuer/audience/signature/nonce as required by the chosen library and flow; require verified email before matching; allow only configured callback and redirect URLs; and test existing-account, new-account, unverified-email, and mismatch cases locally. Live provider configuration and callback allowlists remain separate evidence.

## Current project evidence (as of 2026-11-02)

These labels are intentionally separate. “Specific local changes and regression tests” describes repository changes and selected tests. “Verified live” describes only the specific browser/API observations below. It does not mean the entire feature or infrastructure is verified.

### Existing code observed and specific local tests

- **Existing code observed:** The checklist documents existing password hashing, cookie/session, reset/OTP, refresh, and OAuth paths, along with known limitations. Code being present is not evidence every flow is correct or complete.
- **Specific local changes and regression tests:** The current change set includes password byte-limit validation, admin MFA policy and signed MFA evidence, MFA checks across auth paths, OAuth state and verified-email checks, transaction/locking fixes for OTP consumption and refresh-token reuse revocation, and demo-seeder safety. Focused server auth tests passed: **68 tests**; focused client auth/recovery tests passed: **6 tests**. These suites cover selected regressions, not every existing login/recovery limit, reset path, or session-revocation scenario. Tests use mocks and do not establish real PostgreSQL concurrency correctness.
- **Observed local account state:** A local database has two administrator accounts with MFA disabled. Both the initial supplied password and the later corrected live password returned “Invalid email or password” for the local admin account. The corrected password was therefore tested locally and did not authenticate. Local and live databases have independent credentials; a password that works on live is not evidence that the same password is configured locally. Because local login did not succeed, no browser-based MFA-denial check was made. Unit tests cover the MFA policy. No live account was changed.

### Verified live, limited to observed behavior

- On the live admin page, the corrected supplied credentials successfully opened the dashboard without an MFA challenge.
- The observed authentication access and refresh cookies had `HttpOnly=true`, `Secure=true`, and `SameSite=Lax`.
- The logout API returned HTTP 200, and revisiting `/admin` redirected to `/admin/login`.
- These observations do **not** establish that live admins are enrolled in MFA, that all auth flows meet policy, that Google login works securely, or that AWS, GitHub, or PostgreSQL controls are configured correctly. No live account changes or deployment were made.

### Pending or not established

- Local authentication with the supplied passwords (neither authenticated), live MFA enrollment and enforcement, Google provider configuration and live flow, real PostgreSQL concurrency/locking checks, timing and notification side-channel checks, browser expiry and multi-tab behavior, and full session revocation across workers/restarts.
- Also pending from the project checklist: confirming whether process-local login/reset throttles and account-failure tracking are sufficient for the deployment's worker count and proxy/IP behavior; measuring timing and notification-failure differences; checking exact expiry boundaries, concurrent OTP sends, reset/reissue races and delivery failures; coordinating refresh across tabs; and verifying durable access-token/session invalidation after restart or across workers and role/permission changes.
- AWS/EC2 human MFA and administrative access paths, GitHub owner/admin MFA and deployment credentials, and PostgreSQL network/TLS/authentication/role configuration have not been verified. PostgreSQL is confirmed to be on the same AWS EC2 host.
- This work is accounts/login security work, not a complete security audit or certification. Continue to use the project checklist for outstanding implementation and operator tasks: [`ACCOUNT-LOGIN-SECURITY.md`](ACCOUNT-LOGIN-SECURITY.md).
- The Google policy remains same verified email. The live provider flow is unverified, and Google's external-email ownership caveat remains relevant to that policy.

## Primary references

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP Multifactor Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html)
- [Google OpenID Connect documentation](https://developers.google.com/identity/openid-connect/openid-connect)
- [Google: Authenticate with a backend server](https://developers.google.com/identity/sign-in/web/backend-auth) — explains when Google is authoritative for an email address and the caveat for external addresses.
- [AWS IAM security best practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [GitHub organization two-factor authentication policy](https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-two-factor-authentication-for-your-organization/requiring-two-factor-authentication-in-your-organization)
- [PostgreSQL password authentication](https://www.postgresql.org/docs/17/auth-password.html)
