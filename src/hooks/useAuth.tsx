import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

export type AppRole = 'admin' | 'rrpp' | 'user' | 'super_admin' | 'guardia' | 'puerta';
interface OrgInfo {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userRole: AppRole | null;
  userOrgs: OrgInfo[];
  activeOrg: OrgInfo | null;
  setActiveOrg: (org: OrgInfo | null) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  userRole: null,
  userOrgs: [],
  activeOrg: null,
  setActiveOrg: () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [userOrgs, setUserOrgs] = useState<OrgInfo[]>([]);
  const [activeOrg, setActiveOrg] = useState<OrgInfo | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => {
          fetchUserRole(session.user.id);
          fetchUserOrgs(session.user.id);
        }, 0);
      } else {
        setUserRole(null);
        setUserOrgs([]);
        setActiveOrg(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRole(session.user.id);
        fetchUserOrgs(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    
    if (error || !data || data.length === 0) {
      setUserRole('user');
      return;
    }

    const roles = data.map(r => r.role as AppRole);
    
    // Jerarquía de roles
    if (roles.includes('super_admin')) {
      setUserRole('super_admin');
    } else if (roles.includes('admin')) {
      setUserRole('admin');
    } else if (roles.includes('rrpp')) {
      setUserRole('rrpp');
    } else if (roles.includes('guardia')) {
      setUserRole('guardia');
    } else if (roles.includes('puerta')) {
      setUserRole('puerta');
    } else {
      setUserRole('user');
    }
  };

  const fetchUserOrgs = async (userId: string) => {
    const { data } = await supabase
      .from('org_members')
      .select('organization_id, role, organizations:organization_id(id, name, slug)')
      .eq('user_id', userId);
    
    const orgs: OrgInfo[] = (data || []).map((m: any) => ({
      id: m.organizations.id,
      name: m.organizations.name,
      slug: m.organizations.slug,
      role: m.role,
    }));
    setUserOrgs(orgs);
    if (orgs.length > 0 && !activeOrg) {
      setActiveOrg(orgs[0]);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, userRole, userOrgs, activeOrg, setActiveOrg, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
