-- Backfill of existing rrpp_sales:
-- 1) Merge duplicate rows (same event + TL + RRPP name) into the oldest one
-- 2) Fill per ticket type quantities (items) from purchase_requests history

-- 1) Merge duplicates
WITH grouped AS (
  SELECT
    event_id, rrpp_id, lower(trim(coalesce(seller_name, ''))) AS name_key,
    (array_agg(id ORDER BY created_at))[1] AS keep_id,
    SUM(quantity) AS qty,
    SUM(total_amount) AS amount,
    bool_and(delivered) AS delivered,
    COUNT(*) AS n
  FROM public.rrpp_sales
  GROUP BY event_id, rrpp_id, lower(trim(coalesce(seller_name, '')))
  HAVING COUNT(*) > 1
),
upd AS (
  UPDATE public.rrpp_sales s
  SET quantity = g.qty, total_amount = g.amount, delivered = g.delivered, updated_at = now()
  FROM grouped g
  WHERE s.id = g.keep_id
  RETURNING s.id
)
DELETE FROM public.rrpp_sales s
USING grouped g
WHERE s.event_id = g.event_id
  AND s.rrpp_id = g.rrpp_id
  AND lower(trim(coalesce(s.seller_name, ''))) = g.name_key
  AND s.id <> g.keep_id;

-- 2) Fill items from purchase_requests (paid ticket types only)
WITH lines AS (
  SELECT
    pr.event_id, pr.rrpp_id,
    lower(trim(coalesce(pr.seller_name, ''))) AS name_key,
    t->>'ticket_type_id' AS tt_id,
    COALESCE((t->>'quantity')::int, 0) AS qty
  FROM public.purchase_requests pr
  CROSS JOIN LATERAL jsonb_array_elements(pr.ticket_types::jsonb) t
  WHERE pr.rrpp_id IS NOT NULL
    AND coalesce(t->>'type', '') <> 'rrpp_free'
    AND t->>'ticket_type_id' IS NOT NULL
),
per_type AS (
  SELECT event_id, rrpp_id, name_key, tt_id, SUM(qty) AS qty
  FROM lines GROUP BY event_id, rrpp_id, name_key, tt_id
),
agg AS (
  SELECT event_id, rrpp_id, name_key, jsonb_object_agg(tt_id, qty) AS items
  FROM per_type WHERE qty > 0
  GROUP BY event_id, rrpp_id, name_key
)
UPDATE public.rrpp_sales s
SET items = a.items, updated_at = now()
FROM agg a
WHERE s.event_id = a.event_id
  AND s.rrpp_id = a.rrpp_id
  AND lower(trim(coalesce(s.seller_name, ''))) = a.name_key
  AND (s.items IS NULL OR s.items = '{}'::jsonb);
