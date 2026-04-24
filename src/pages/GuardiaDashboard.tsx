import { Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import CheckInScanner from '@/components/CheckInScanner';

export default function GuardiaDashboard() {
  const { activeOrg, userRole } = useAuth();
  
  if (!activeOrg && userRole !== 'super_admin' && userRole !== 'guardia' && userRole !== 'admin') {
    return (
      <div className="text-center py-20 space-y-3">
        <Shield className="h-12 w-12 text-muted-foreground mx-auto" />
        <p className="text-muted-foreground">No tienes acceso a esta sección.</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-4xl mx-auto">
      <div>
        <div className="flex items-center gap-2 text-sm text-primary font-semibold mb-1">
          <Shield className="h-4 w-4" /> Panel de Guardia
        </div>
        <h1 className="text-2xl font-black text-foreground">Escáner de Entradas</h1>
      </div>

      <CheckInScanner />
    </motion.div>
  );
}
