/**
 * Integration test DB helpers
 * Uses mongodb-memory-server to spin up an isolated in-process MongoDB instance.
 * Each test file calls connect() in beforeAll and disconnect() in afterAll.
 * clearDB() is called in beforeEach to give every test a clean slate.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongod;

export const connect = async () => {
  // Provide a stable JWT secret so authMiddleware.protect can verify test tokens
  process.env.JWT_SECRET = 'integration-test-jwt-secret';

  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
};

export const disconnect = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await mongod.stop();
};

export const clearDB = async () => {
  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map((c) => c.deleteMany({})));
};
