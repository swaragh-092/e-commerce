import AuthPageShell from '../storefront/AuthPageShell';

const PasswordRecoveryLayout = ({ admin, children }) => admin
  ? <AuthPageShell type="admin" fullHeight>{children}</AuthPageShell>
  : children;

export default PasswordRecoveryLayout;
