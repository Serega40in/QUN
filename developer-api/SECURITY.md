# Security checklist before public launch

- [ ] Configure Supabase URL and publishable/anon key in Cloudflare Worker settings; never use a service-role key.
- [ ] Verify invalid, expired, and missing access tokens return 401.
- [ ] Verify the identity endpoint can only read the authenticated user's own profile under current RLS policies.
- [ ] Add Cloudflare rate limiting and request-size limits.
- [ ] Review CORS for the intended browser origins; CORS is not an authorization mechanism.
- [ ] Add request IDs and redact Authorization headers from logs.
- [ ] Test MCP Streamable HTTP behavior with the MCP Inspector and target clients.
- [ ] Implement OAuth authorization for clients that cannot attach a Supabase bearer token.
- [ ] Implement scoped developer keys only after defining secure hashing, one-time display, expiry, rotation, revocation, and scope enforcement.
- [ ] Publish endpoint URLs only after a live deployment and successful smoke tests.
- [ ] Review all newly exposed database objects for explicit grants and RLS policies.
