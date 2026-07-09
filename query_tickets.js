import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xeztfksdgqgnvchnqiev.supabase.co';
const supabaseKey = 'sb_publishable_9MbUceDskBH4SLuHagIUyg_7z5i0Z6R';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Querying database profiles...');
  const { data: profiles, error: pError } = await supabase
    .from('profiles')
    .select('*');
  
  if (pError) {
    console.error('Error fetching profiles:', pError);
    return;
  }

  console.log(`Found ${profiles?.length || 0} profiles.`);
  const targetProfiles = profiles.filter(p => 
    p.name?.toLowerCase().includes('lazcano') || 
    p.email?.toLowerCase().includes('lazcano')
  );

  console.log('Lazcano profiles found:', targetProfiles);

  console.log('Querying reservations...');
  // We can query all reservations or filter by guest_name or user_id/rrpp_id
  const { data: reservations, error: rError } = await supabase
    .from('reservations')
    .select(`
      id,
      code,
      guest_name,
      user_id,
      rrpp_id,
      created_at,
      status,
      event:event_id(title)
    `);

  if (rError) {
    console.error('Error fetching reservations:', rError);
    return;
  }

  console.log(`Found ${reservations?.length || 0} total reservations.`);

  // 1. Check reservations where guest_name matches
  const matchGuestName = reservations.filter(r => 
    r.guest_name?.toLowerCase().includes('lazcano')
  );
  console.log('\n--- Reservations matching guest_name "lazcano": ---');
  console.log(JSON.stringify(matchGuestName.map(r => ({
    id: r.id,
    code: r.code,
    guest_name: r.guest_name,
    event: r.event?.title,
    created_at: r.created_at,
    status: r.status
  })), null, 2));

  // 2. Check reservations where RRPP matches target profiles
  const targetProfileIds = targetProfiles.map(p => p.id);
  const matchRRPP = reservations.filter(r => 
    targetProfileIds.includes(r.rrpp_id)
  );
  console.log('\n--- Reservations created by RRPPs matching "lazcano" profiles: ---');
  console.log(JSON.stringify(matchRRPP.map(r => {
    const p = targetProfiles.find(prof => prof.id === r.rrpp_id);
    return {
      id: r.id,
      code: r.code,
      guest_name: r.guest_name,
      rrpp_name: p ? p.name : r.rrpp_id,
      event: r.event?.title,
      created_at: r.created_at,
      status: r.status
    };
  }), null, 2));

  // 3. Check reservations where buyer (user_id) matches target profiles
  const matchBuyer = reservations.filter(r => 
    targetProfileIds.includes(r.user_id)
  );
  console.log('\n--- Reservations bought by Users matching "lazcano" profiles: ---');
  console.log(JSON.stringify(matchBuyer.map(r => {
    const p = targetProfiles.find(prof => prof.id === r.user_id);
    return {
      id: r.id,
      code: r.code,
      guest_name: r.guest_name,
      buyer_name: p ? p.name : r.user_id,
      event: r.event?.title,
      created_at: r.created_at,
      status: r.status
    };
  }), null, 2));
}

run();
