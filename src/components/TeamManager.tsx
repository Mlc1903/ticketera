import { useState } from 'react';
import { UserPlus, Trash2, Loader2, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  organizationId: string;
}

export default function TeamManager({ organizationId }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rrppEmail, setRrppEmail] = useState('');
  const [assigningRRPP, setAssigningRRPP] = useState(false);

  const { data: team, isLoading } = useQuery({
    queryKey: ['rrpp-team', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rrpp_assignments')
        .select('*, profile:user_id(name, email)')
        .eq('organization_id', organizationId)
        .eq('created_by', user?.id); // Only show RRPPs added by this TL

      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId && !!user?.id,
  });

  const { data: myAssignment } = useQuery({
    queryKey: ['my-rrpp-assignment', organizationId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rrpp_assignments')
        .select('zone_type')
        .eq('organization_id', organizationId)
        .eq('user_id', user?.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId && !!user?.id,
  });

  const handleAssignRRPP = async () => {
    if (!rrppEmail || !organizationId || !user) return;
    setAssigningRRPP(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', rrppEmail.trim())
        .maybeSingle();
      
      if (!profile) {
        toast.error('Usuario no encontrado');
        setAssigningRRPP(false);
        return;
      }

      // Ensure they have rrpp role
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', profile.user_id)
        .eq('role', 'rrpp')
        .maybeSingle();

      if (!existingRole) {
        await supabase.from('user_roles').insert({ user_id: profile.user_id, role: 'rrpp' as any });
      }

      const { data: codeData } = await supabase.rpc('generate_ticket_code', { prefix: 'RRPP' });
      const code = codeData || `RRPP-${Date.now()}`;

      const { error } = await supabase.from('rrpp_assignments').insert({
        user_id: profile.user_id,
        unique_code: code,
        organization_id: organizationId,
        is_team_leader: false, // Team Leaders can only create regular RRPPs
        created_by: user.id,
        zone_type: myAssignment?.zone_type,
      });

      if (error) throw error;
      toast.success('RRPP agregado a tu equipo');
      setRrppEmail('');
      queryClient.invalidateQueries({ queryKey: ['rrpp-team'] });
    } catch (err: any) {
      toast.error(err.message || 'Error al agregar RRPP');
    }
    setAssigningRRPP(false);
  };

  const handleDeleteRRPP = async (id: string) => {
    if (!confirm('¿Remover a este RRPP de tu equipo?')) return;
    try {
      const { error } = await supabase.from('rrpp_assignments').delete().eq('id', id);
      if (error) throw error;
      toast.success('RRPP removido');
      queryClient.invalidateQueries({ queryKey: ['rrpp-team'] });
    } catch (err: any) {
      toast.error('Error al remover');
    }
  };

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-primary" /> Agregar RRPP a mi equipo
        </h3>
        <div className="flex gap-2">
          <input 
            type="email" 
            placeholder="Email del nuevo RRPP" 
            value={rrppEmail} 
            onChange={(e) => setRrppEmail(e.target.value)} 
            className="flex-1 rounded-xl bg-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none ring-1 ring-border focus:ring-primary transition-all" 
          />
          <button 
            onClick={handleAssignRRPP} 
            disabled={assigningRRPP || !rrppEmail} 
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:shadow-glow disabled:opacity-40"
          >
            {assigningRRPP ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Agregar'}
          </button>
        </div>
      </div>

      <div className="glass-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" /> Mi Equipo
        </h3>
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-2">
            {team?.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between rounded-xl bg-secondary p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{a.profile?.name || 'RRPP'}</p>
                  <p className="text-[10px] text-muted-foreground">{a.profile?.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  {a.zone_type && (
                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${a.zone_type === 'vip' ? 'bg-warning/20 text-warning border border-warning/30' : 'bg-primary/20 text-primary border border-primary/30'}`}>
                      {a.zone_type}
                    </span>
                  )}
                  <span className="rounded-lg bg-primary/10 px-2 py-1 text-[10px] font-mono text-primary">{a.unique_code}</span>
                  <button onClick={() => handleDeleteRRPP(a.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            {(!team || team.length === 0) && (
              <p className="text-xs text-muted-foreground text-center py-4">No has agregado a nadie a tu equipo aún.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
