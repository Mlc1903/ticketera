import { useState } from 'react';
import { Building2, Plus, Users, Loader2, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export default function SuperAdminDashboard() {
  const { userRole } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '' });
  const [saving, setSaving] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [addingOwner, setAddingOwner] = useState(false);

  const { data: orgs, isLoading } = useQuery({
    queryKey: ['all-organizations'],
    queryFn: async () => {
      const { data, error } = await supabase.from('organizations').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  if (userRole !== 'super_admin') {
    return (
      <div className="text-center py-20 space-y-3">
        <Building2 className="h-12 w-12 text-muted-foreground mx-auto" />
        <p className="text-muted-foreground">Acceso restringido a Super Administradores</p>
      </div>
    );
  }

  const handleCreate = async () => {
    if (!form.name || !form.slug) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('organizations').insert({
        name: form.name,
        slug: form.slug.toLowerCase().replace(/\s/g, '-'),
      });
      if (error) throw error;
      toast.success('Organización creada');
      setForm({ name: '', slug: '' });
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['all-organizations'] });
    } catch (err: any) {
      toast.error(err.message);
    }
    setSaving(false);
  };

  const handleAddOwner = async () => {
    if (!ownerEmail || !selectedOrgId) return;
    setAddingOwner(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', ownerEmail.trim())
        .maybeSingle();
      if (!profile) { toast.error('Usuario no encontrado'); setAddingOwner(false); return; }

      // Update their app role to admin
      const { data: existing } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', profile.user_id)
        .eq('role', 'admin')
        .maybeSingle();
      if (!existing) {
        await supabase.from('user_roles').upsert({ user_id: profile.user_id, role: 'admin' as any });
      }

      const { error } = await supabase.from('org_members').insert({
        organization_id: selectedOrgId,
        user_id: profile.user_id,
        role: 'owner' as any,
      });
      if (error) throw error;
      toast.success('Owner asignado a la organización');
      setOwnerEmail('');
      setSelectedOrgId(null);
    } catch (err: any) {
      toast.error(err.message);
    }
    setAddingOwner(false);
  };

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-3xl mx-auto">
      <div>
        <div className="flex items-center gap-2 text-sm text-primary font-semibold mb-1"><Building2 className="h-4 w-4" />Super Admin</div>
        <h1 className="text-2xl font-black text-foreground">Organizaciones</h1>
      </div>

      <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:shadow-glow active:scale-[0.98]">
        <Plus className="h-4 w-4" /> Nueva Discoteca
      </button>

      {showForm && (
        <div className="glass-card p-4 space-y-3">
          <input placeholder="Nombre de la discoteca" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl bg-secondary px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none ring-1 ring-border focus:ring-primary" />
          <input placeholder="Slug (ej: forum-club)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="w-full rounded-xl bg-secondary px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none ring-1 ring-border focus:ring-primary" />
          <button onClick={handleCreate} disabled={saving || !form.name || !form.slug} className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40">
            {saving ? 'Creando...' : 'Crear Organización'}
          </button>
        </div>
      )}

      {/* Assign owner to org */}
      <div className="glass-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Asignar Owner a Discoteca</h3>
        <input type="email" placeholder="Email del owner" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} className="w-full rounded-xl bg-secondary px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none ring-1 ring-border focus:ring-primary" />
        <select value={selectedOrgId || ''} onChange={(e) => setSelectedOrgId(e.target.value || null)} className="w-full rounded-xl bg-secondary px-4 py-3 text-sm text-foreground ring-1 ring-border">
          <option value="">Seleccionar discoteca</option>
          {orgs?.map((org: any) => (
            <option key={org.id} value={org.id}>{org.name}</option>
          ))}
        </select>
        <button onClick={handleAddOwner} disabled={addingOwner || !ownerEmail || !selectedOrgId} className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40">
          {addingOwner ? 'Asignando...' : 'Asignar Owner'}
        </button>
      </div>

      {/* Org list */}
      <div className="space-y-3">
        {orgs?.map((org: any) => (
          <div key={org.id} className="glass-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-foreground">{org.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{org.slug}</p>
              </div>
              <span className="text-xs text-muted-foreground">{new Date(org.created_at).toLocaleDateString('es-BO')}</span>
            </div>
          </div>
        ))}
        {(!orgs || orgs.length === 0) && (
          <div className="glass-card p-6 text-center text-muted-foreground text-sm">
            No hay organizaciones creadas
          </div>
        )}
      </div>
    </motion.div>
  );
}
