/**
 * Database configuration
 * Establishes a single Mongoose connection to MongoDB Atlas.
 * Called once at server startup — Mongoose internally pools connections,
 * so this single call is reused across all requests.
 */
import mongoose from 'mongoose';

/**
 * Connects to MongoDB using the URI from the environment.
 * Throws if the connection fails so the caller can handle it (e.g. exit process).
 */
const connectDB = async () => {
  const conn = await mongoose.connect(process.env.MONGODB_URI);
  console.log(`MongoDB connected: ${conn.connection.host}`);
};

export default connectDB;
