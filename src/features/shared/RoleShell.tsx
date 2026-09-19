/**
 * Role chrome. D2 decides which destinations exist and which width each is
 * designed for; D7 decides how a tab or sidebar looks (ADR-0008). Destinations
 * stay labelled at every breakpoint — no 768 icon rail (ADR-0010).
 *
 * Client and technician: labelled tabs at 375, labelled sidebar from 768.
 * HQ: no phone tab bar; two-level sidebar from 768.
 *
 * @requirement FR-04 FR-34
 */
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  Building2,
  CircleUser,
  ClipboardList,
  FileBarChart,
  Home,
  LayoutDashboard,
  LineChart,
  LogOut,
  Map as MapIcon,
  Network,
  Search,
  Sparkles,
  User,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { Icon } from '../../components/Icon.tsx';
import { LanguageSwitch } from './LanguageSwitch.tsx';
import { useSession } from '../auth/session.ts';
import {
  ADMIN_NAV,
  CLIENT_NAV,
  TECH_NAV,
  type NavItem,
  type NavSection,
} from '../../routes/navigation.ts';
import styles from './RoleShell.module.css';

const CLIENT_ICONS: Record<string, LucideIcon> = {
  home: Home,
  spaces: Building2,
  alerts: Bell,
  insights: LineChart,
  account: CircleUser,
};

const TECH_ICONS: Record<string, LucideIcon> = {
  work: ClipboardList,
  map: MapIcon,
  me: User,
};

const ADMIN_ICONS: Record<string, LucideIcon> = {
  overview: LayoutDashboard,
  fleet: Network,
  service: Wrench,
  accounts: Wallet,
  reporting: FileBarChart,
};

function profilePath(role: string): string {
  if (role === 'client') return '/account/profile';
  if (role === 'admin') return '/profile';
  return '/me';
}

function RailBrand() {
  return (
    // i18n-exempt — proper noun, identical in every locale
    <p className={styles.railBrand}>ARUSIQ</p>
  );
}

function SignOutButton() {
  const { t } = useTranslation();
  const { signOut } = useSession();
  const navigate = useNavigate();

  return (
    <button
      type="button"
      className={styles.signOut}
      onClick={() => {
        signOut('this');
        void navigate('/sign-in');
      }}
    >
      <Icon icon={LogOut} size={20} />
      <span>{t('shell.signOut')}</span>
    </button>
  );
}

function DestLink({
  item,
  icons,
}: {
  item: NavItem;
  icons: Record<string, LucideIcon>;
}) {
  const { t } = useTranslation();
  const glyph = icons[item.id];

  return (
    <NavLink
      to={item.path}
      end={!item.prefix}
      className={({ isActive }) =>
        isActive ? `${styles.link} ${styles.active}` : styles.link
      }
    >
      {glyph ? <Icon icon={glyph} size={20} /> : null}
      <span>{t(item.labelKey)}</span>
    </NavLink>
  );
}

function FlatNav({
  items,
  icons,
  className,
  labelKey,
  chrome,
}: {
  items: readonly NavItem[];
  icons: Record<string, LucideIcon>;
  className: string;
  labelKey: string;
  chrome?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <nav className={className} aria-label={t(labelKey)}>
      {chrome ? <RailBrand /> : null}
      <div className={styles.dests}>
        {items.map((item) => (
          <DestLink key={item.id} item={item} icons={icons} />
        ))}
      </div>
      {chrome ? <SignOutButton /> : null}
    </nav>
  );
}

function AdminNav({ className }: { className: string }) {
  const { t } = useTranslation();

  return (
    <nav className={className} aria-label={t('shell.primaryNav')}>
      <RailBrand />
      <div className={styles.dests}>
        {ADMIN_NAV.map((section: NavSection) => (
          <div key={section.id} className={styles.section}>
            <p className={styles.sectionLabel}>
              {ADMIN_ICONS[section.id] ? (
                <Icon icon={ADMIN_ICONS[section.id]} size={20} />
              ) : null}
              {t(section.labelKey)}
            </p>
            {section.items.map((item) => (
              <DestLink key={item.id} item={item} icons={{}} />
            ))}
          </div>
        ))}
      </div>
      <SignOutButton />
    </nav>
  );
}

export function RoleShell() {
  const { t } = useTranslation();
  const { session } = useSession();
  const { pathname } = useLocation();

  if (!session) return null;

  const role = session.role;
  const isAdmin = role === 'admin';
  const isClient = role === 'client';
  const tabItems = isClient ? CLIENT_NAV : TECH_NAV;
  const tabIcons = isClient ? CLIENT_ICONS : TECH_ICONS;
  const frameClass = isAdmin ? `${styles.frame} ${styles.admin}` : styles.frame;
  const showDesktopHint = isAdmin && !pathname.startsWith('/overview');

  return (
    <div className={frameClass}>
      <a className="sr-only" href="#main">
        {t('shell.skip')}
      </a>
      <header className={styles.header}>
        {/* i18n-exempt — proper noun, identical in every locale */}
        <p className={styles.headerBrand}>ARUSIQ</p>
        <div className={styles.tools}>
          <NavLink to="/search" className={styles.iconButton}>
            <Icon icon={Search} size={24} labelKey="shell.search" />
          </NavLink>
          <NavLink to="/assistant" className={styles.iconButton}>
            <Icon icon={Sparkles} size={24} labelKey="shell.assistant" />
          </NavLink>
          <LanguageSwitch />
          <NavLink to={profilePath(role)} className={styles.iconButton}>
            <Icon icon={CircleUser} size={24} labelKey="shell.profile" />
          </NavLink>
        </div>
      </header>
      {isAdmin ? (
        <AdminNav className={styles.sideNav} />
      ) : (
        <FlatNav
          items={tabItems}
          icons={tabIcons}
          className={styles.sideNav}
          labelKey="shell.primaryNav"
          chrome
        />
      )}
      <div className={styles.body}>
        {showDesktopHint ? (
          <p className={styles.desktopHint} role="status">
            {t('shell.continueOnDesktop')}
          </p>
        ) : null}
        <main id="main" className={styles.main}>
          <Outlet />
        </main>
      </div>
      {isAdmin ? null : (
        <FlatNav
          items={tabItems}
          icons={tabIcons}
          className={styles.tabNav}
          labelKey="shell.primaryNav"
        />
      )}
    </div>
  );
}
