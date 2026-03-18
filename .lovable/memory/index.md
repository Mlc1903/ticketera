NitePass - Multi-tenant ticketing platform for Bolivia nightclubs

### Design Tokens
- Background: #09090b (deep charcoal), Primary: Electric Blue (#3b82f6)
- Success: #22c55e, Warning: #f59e0b, WhatsApp: #25D366
- Font: Inter, Min touch target: 44px, Cards use `glass-card` utility

### Architecture (Multi-Tenant)
- organizations table: each nightclub is an org
- org_members: links users to orgs with org_role (owner, admin, staff)
- events & rrpp_assignments have organization_id FK
- Roles: super_admin (global), admin/rrpp/user (per app_role enum)
- has_org_role() and is_org_member() security definer functions
- Auth context includes userOrgs[] and activeOrg
- Super Admin at /super-admin: create orgs, assign owners
- Admin at /admin: org-scoped events CRUD, RRPP assignment, check-in
- RRPP at /rrpp: see assigned events, add guests
- All text in Spanish (Bolivian context)
