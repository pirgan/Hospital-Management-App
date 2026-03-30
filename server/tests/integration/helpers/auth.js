/**
 * Auth helpers for integration tests.
 * Creates a User document (pre-save hook hashes the password) and signs a JWT
 * using the same JWT_SECRET as authController so protect middleware accepts it.
 */
import jwt from 'jsonwebtoken';
import User from '../../../src/models/User.js';

let _counter = 0;

/**
 * Creates a user in the test DB and returns { user, token }.
 * @param {object} overrides — any User schema fields to override the defaults
 */
export const createUser = async (overrides = {}) => {
  _counter += 1;
  const defaults = {
    name: `Test User ${_counter}`,
    email: `testuser_${_counter}_${Date.now()}@medicore.test`,
    password: 'Password123!',
    role: 'admin',
    secondaryRoles: [],
  };
  const data = { ...defaults, ...overrides };
  const user = await User.create(data);
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
  return { user, token };
};
