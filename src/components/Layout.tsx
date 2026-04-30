import { Link, useLocation } from 'react-router-dom';
import { Calendar, Shield, Users, Ticket, Menu, X, LogIn, LogOut, Building2 } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, userRole, userOrgs, activeOrg, setActiveOrg, signOut } = useAuth();

  const isOrgAdmin = activeOrg && (activeOrg.role === 'owner' || activeOrg.role === 'admin');

  const navItems = [
    { path: '/', label: 'Eventos', icon: Calendar, show: true },
    { path: '/mis-tickets', label: 'Mis Tickets', icon: Ticket, show: !!user },
    { path: '/rrpp', label: 'RRPP', icon: Users, show: userRole === 'rrpp' || userRole === 'admin' || userRole === 'super_admin' || isOrgAdmin },
    { path: '/admin', label: 'Admin', icon: Shield, show: userRole === 'admin' || userRole === 'super_admin' || isOrgAdmin },
    { path: '/super-admin', label: 'Super Admin', icon: Building2, show: userRole === 'super_admin' },
    { path: '/guardia', label: 'Check-in (Guardia)', icon: Shield, show: userRole === 'guardia' || userRole === 'admin' || userRole === 'super_admin' || isOrgAdmin },
    { path: '/puerta', label: 'Venta Puerta', icon: Ticket, show: userRole === 'puerta' || userRole === 'admin' || userRole === 'super_admin' || isOrgAdmin },
  ].filter((item) => item.show);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container flex h-14 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img 
              src="https://res.cloudinary.com/dv8t8ym36/image/upload/f_auto,q_auto/NIGHTPASS_lkz1lb" 
              alt="NightPass Logo" 
              className="h-8 w-8 object-contain"
            />
            <span className="text-lg font-bold text-foreground">NightPass</span>
          </Link>

          {/* Org selector */}
          {userOrgs.length > 0 && (
            <div className="hidden md:flex items-center">
              <select
                value={activeOrg?.id || ''}
                onChange={(e) => {
                  const org = userOrgs.find((o) => o.id === e.target.value);
                  setActiveOrg(org || null);
                }}
                className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-foreground border border-border"
              >
                {userOrgs.map((org) => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>
          )}

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors touch-target ${active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
            {user ? (
              <button
                onClick={signOut}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Salir
              </button>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors"
              >
                <LogIn className="h-4 w-4" />
                Entrar
              </Link>
            )}
          </nav>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden touch-target flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:text-foreground"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden border-t border-border overflow-hidden"
            >
              <div className="container py-2 space-y-1">
                {userOrgs.length > 0 && (
                  <select
                    value={activeOrg?.id || ''}
                    onChange={(e) => {
                      const org = userOrgs.find((o) => o.id === e.target.value);
                      setActiveOrg(org || null);
                    }}
                    className="w-full rounded-lg bg-secondary px-3 py-2.5 text-sm font-medium text-foreground border border-border mb-2"
                  >
                    {userOrgs.map((org) => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                  </select>
                )}
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors touch-target ${active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                        }`}
                    >
                      <Icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  );
                })}
                {user ? (
                  <button
                    onClick={() => { signOut(); setMobileMenuOpen(false); }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-muted-foreground hover:text-foreground"
                  >
                    <LogOut className="h-5 w-5" />
                    Cerrar Sesión
                  </button>
                ) : (
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-primary"
                  >
                    <LogIn className="h-5 w-5" />
                    Iniciar Sesión
                  </Link>
                )}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      <main className="container py-6">{children}</main>
    </div>
  );
}
