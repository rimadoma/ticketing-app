Requirements:
* In-memory copy of MongoDB
* Run the Fastify app under test
* Make fake requests to the Fastify app
* Run assertions to verify request behaved as expected

Decisions:
* Vitest for test runner (because we have modules)
* supertest for HTTP assertions
* mongodb-memory-server for In-memory MongoDBBut 