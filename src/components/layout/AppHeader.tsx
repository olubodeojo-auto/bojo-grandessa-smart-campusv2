import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  GraduationCap,
  Search,
  Bell,
  ChevronDown,
  Settings,
  LogOut,
  Menu,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

interface AppHeaderProps {
  onMenuToggle?: () => void;
  onSearch?: (query: string) => void;
  notificationCount?: number;
}

function getInitials(fullName: string | null | undefined): string {
  if (!fullName || fullName.trim().length === 0) {
    return "?";
  }

  const parts = fullName.trim().split(/\s+/);

  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }

  return (
    parts[0].charAt(0).toUpperCase() +
    parts[parts.length - 1].charAt(0).toUpperCase()
  );
}

function formatToday(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const AppHeader = ({
  onMenuToggle,
  onSearch,
  notificationCount = 0,
}: AppHeaderProps) => {
  const { role, fullName, isAuthenticated, loading, error, signOut } = useAuth();

  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSigningOut, setIsSigningOut] = useState<boolean>(false);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuItemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const todayLabel = formatToday();
  const hasNotifications = notificationCount > 0;
  const initials = getInitials(fullName);

  const displayName = loading
    ? ""
    : isAuthenticated && fullName
      ? fullName
      : "Unknown User";

  const displayRole = loading
    ? ""
    : role?.name
      ? role.name
      : "No Role Assigned";

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent): void => {
      const target = event.target as Node;

      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(target)
      ) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const firstItem = menuItemRefs.current.find((item) => item !== null);
    firstItem?.focus();
  }, [isMenuOpen]);

  useEffect(() => {
    if (!onSearch) {
      return;
    }

    const timer = window.setTimeout(() => {
      onSearch(searchQuery);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [onSearch, searchQuery]);

  const handleSignOut = async (): Promise<void> => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);

    try {
      await signOut();
      setIsMenuOpen(false);
    } catch {
      setIsMenuOpen(false);
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const currentIndex = menuItemRefs.current.findIndex((item) => item === document.activeElement);
      const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % menuItemRefs.current.length;
      const nextItem = menuItemRefs.current[nextIndex];
      nextItem?.focus();
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      const currentIndex = menuItemRefs.current.findIndex((item) => item === document.activeElement);
      const previousIndex = currentIndex <= 0 ? menuItemRefs.current.length - 1 : currentIndex - 1;
      const previousItem = menuItemRefs.current[previousIndex];
      previousItem?.focus();
    }
  };

  return (
    <header className="border-b border-slate-200/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onMenuToggle}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 lg:hidden"
            aria-label="Toggle navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                Grandessa Smart Campus
              </p>
              <p className="truncate text-xs text-slate-500">{todayLabel}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-end gap-2 sm:gap-3">
          <label className="hidden flex-1 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 shadow-sm sm:flex">
            <Search className="h-4 w-4" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search"
              className="w-full border-none bg-transparent outline-none placeholder:text-slate-400"
              aria-label="Search the dashboard"
            />
          </label>

          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            aria-label="View notifications"
          >
            <Bell className="h-5 w-5" />
            {hasNotifications ? (
              <span className="absolute right-1 top-1 flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            ) : null}
          </button>

          <div className="relative" ref={menuRef}>
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setIsMenuOpen((current) => !current)}
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-2 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              aria-label="Open user menu"
              aria-expanded={isMenuOpen}
              aria-haspopup="menu"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
                {loading ? "" : initials}
              </div>
              <div className="hidden min-w-0 text-left sm:block">
                {loading ? (
                  <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
                ) : (
                  <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
                )}
                {loading ? (
                  <div className="mt-1 h-3 w-16 animate-pulse rounded bg-slate-200" />
                ) : (
                  <p className="truncate text-xs text-slate-500">{displayRole}</p>
                )}
              </div>
              <ChevronDown className="h-4 w-4 text-slate-500" />
            </button>

            <AnimatePresence>
              {isMenuOpen ? (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ duration: 0.16 }}
                  className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl"
                  role="menu"
                  aria-label="User account menu"
                  onKeyDown={handleMenuKeyDown}
                >
                  <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-3">
                    <p className="text-sm font-semibold text-slate-900">
                      {loading ? "Loading profile" : displayName}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {loading ? "Please wait" : displayRole}
                    </p>
                  </div>

                  <div className="mt-2 flex flex-col gap-1">
                    <button
                      type="button"
                      ref={(element) => {
                        menuItemRefs.current[0] = element;
                      }}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      role="menuitem"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </button>

                    <button
                      type="button"
                      ref={(element) => {
                        menuItemRefs.current[1] = element;
                      }}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      role="menuitem"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <Settings className="h-4 w-4" />
                      Account
                    </button>

                    <button
                      type="button"
                      ref={(element) => {
                        menuItemRefs.current[2] = element;
                      }}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                      role="menuitem"
                      disabled={isSigningOut}
                      onClick={() => {
                        void handleSignOut();
                      }}
                    >
                      {isSigningOut ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                      ) : (
                        <LogOut className="h-4 w-4" />
                      )}
                      {isSigningOut ? "Signing out..." : "Sign out"}
                    </button>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {error ? (
        <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700 sm:px-6 lg:px-8">
          {error}
        </div>
      ) : null}
    </header>
  );
};

export default AppHeader;
