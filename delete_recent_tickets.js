import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
// Se recomienda usar la Service Role Key para operaciones de administración desde scripts
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Falta configurar VITE_SUPABASE_URL o la clave de Supabase.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const dateThreshold = '2026-08-03T00:00:00-04:00'; // Fecha local de la solicitud
  
  console.log(`Buscando entradas de tipo 'mesa_vip' creadas a partir de: ${dateThreshold}`);
  
  // 1. Consultar entradas a borrar
  const { data: tickets, error: fetchError } = await supabase
    .from('reservations')
    .select('id, code, guest_name, created_at, status, quantity')
    .eq('type', 'mesa_vip')
    .gte('created_at', dateThreshold)
    .order('created_at', { ascending: false });

  if (fetchError) {
    console.error('Error al consultar entradas:', fetchError.message);
    return;
  }

  if (!tickets || tickets.length === 0) {
    console.log('No se encontraron entradas recientes que coincidan.');
    return;
  }

  console.log('\nEntradas encontradas recientemente:');
  tickets.forEach(t => {
    console.log(`- ID: ${t.id} | Código: ${t.code} | Nombre: ${t.guest_name} | Cantidad: ${t.quantity} | Creada: ${t.created_at}`);
  });

  // Si se pasa la opción --execute, se procede a borrarlas
  const execute = process.argv.includes('--execute');

  if (!execute) {
    console.log('\n[VISTA PREVIA] Para confirmar el borrado de estas entradas, vuelve a ejecutar el comando agregando la bandera "--execute" al final.');
    console.log('Ejemplo: node delete_recent_tickets.js --execute');
    return;
  }

  console.log('\nBorrando entradas...');
  const idsToDelete = tickets.map(t => t.id);
  
  const { data: deleted, error: deleteError } = await supabase
    .from('reservations')
    .delete()
    .in('id', idsToDelete)
    .select();

  if (deleteError) {
    console.error('Error al borrar entradas:', deleteError.message);
    console.log('\nNota: Si obtienes un error de RLS, asegúrate de configurar tu SUPABASE_SERVICE_ROLE_KEY en el entorno.');
  } else {
    console.log(`¡Éxito! Se borraron ${deleted?.length || 0} entradas de la base de datos.`);
  }
}

run();
