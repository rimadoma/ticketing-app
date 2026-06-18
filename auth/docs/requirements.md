Requirements for the auth mechanism:
1. Must be able to tell us details about a user (admin, normal user...)
2. Must be able to handle authorization info
3. Must have a built-in, tamper-resistant way to expire or invalidate itself
4. Must be easily understood between different langugages
    - Pretending that the different microservices might have different tech stacks
5. Must not require any kind of backing data store on the server
6. Has to work with a server side rendered Next.js frontend

Decisions: 
- Store JWTs as cookies
  - Authorization headers must be set manually by JavaScript, but with SSR the server renders
    before any client JS runs, so there's no opportunity to attach a token to that initial request.
    Cookies are sent automatically by the browser on every request, giving the Next.js server
    the JWT it needs to render authenticated content server-side.
- Won't encrypt cookie contents
  - Circumvent the problem of using a specific encryption algorithm (not all services might understand it, goes against #4)
  - JWTs are tamper resistent