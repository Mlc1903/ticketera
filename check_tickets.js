import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xeztfksdgqgnvchnqiev.supabase.co';
const supabaseKey = 'sb_publishable_9MbUceDskBH4SLuHagIUyg_7z5i0Z6R';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Querying door tickets for ¡90 minutos!...');
  
  // Query reservations with ticket_type details for the specific event
  const { data: res, error } = await supabase
    .from('reservations')
    .select(`
      id,
      code,
      guest_name,
      ticket_type_id,
      rrpp_id,
      type,
      ticket_types (
        id,
        name,
        type,
        price
      )
    `)
    .eq('event_id', '8657f25e-8343-47e2-a6f2-d9e9a4791cd0') // first event ID provided
    .eq('guest_name', 'Venta Puerta');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${res?.length || 0} door tickets for event 8657f25e-8343-47e2-a6f2-d9e9a4791cd0.`);
  if (res && res.length > 0) {
    console.log('Sample ticket:', JSON.stringify(res[0], null, 2));
    // Let's count ticket type names
    const counts = {};
    res.forEach(r => {
      const name = r.ticket_types?.name || 'NULL';
      counts[name] = (counts[name] || 0) + 1;
    });
    console.log('Ticket Type counts:', counts);
  }

  // Check the other event ID just in case
  const { data: res2, error: error2 } = await supabase
    .from('reservations')
    .select(`
      id,
      code,
      guest_name,
      ticket_type_id,
      rrpp_id,
      type,
      ticket_types (
        id,
        name,
        type,
        price
      )
    `)
    .eq('event_id', 'f5ad1b98-cb5e-4de1-b18c-eb40646ba61b') // second event ID
    .eq('guest_name', 'Venta Puerta');

  if (error2) {
    console.error('Error for event 2:', error2);
    return;
  }

  console.log(`Found ${res2?.length || 0} door tickets for event f5ad1b98-cb5e-4de1-b18c-eb40646ba61b.`);
  if (res2 && res2.length > 0) {
    console.log('Sample ticket event 2:', JSON.stringify(res2[0], null, 2));
    const counts2 = {};
    res2.forEach(r => {
      const name = r.ticket_types?.name || 'NULL';
      counts2[name] = (counts2[name] || 0) + 1;
    });
    console.log('Ticket Type counts event 2:', counts2);
  }
}

run();
