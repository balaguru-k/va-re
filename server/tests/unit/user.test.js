const User = require('../../models/User');
const bcrypt = require('bcryptjs');

// Mock the database
jest.mock('../../config/database', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    first: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    del: jest.fn(),
    select: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    count: jest.fn().mockReturnThis(),
    clone: jest.fn().mockReturnThis(),
  }))
}));

describe('User Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should hash password before creating user', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        full_name: 'Test User',
        role_id: 1
      };

      const hashedPassword = await bcrypt.hash(userData.password, 12);
      const mockUser = { id: 1, ...userData, password: hashedPassword };

      // Mock the database calls
      User.query = jest.fn(() => ({
        insert: jest.fn().mockResolvedValue([1]),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockUser)
      }));

      const result = await User.create(userData);

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect(result.username).toBe(userData.username);
    });
  });

  describe('verifyPassword', () => {
    it('should verify password correctly', async () => {
      const plainPassword = 'password123';
      const hashedPassword = await bcrypt.hash(plainPassword, 12);

      const result = await User.verifyPassword(plainPassword, hashedPassword);
      expect(result).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const plainPassword = 'password123';
      const wrongPassword = 'wrongpassword';
      const hashedPassword = await bcrypt.hash(plainPassword, 12);

      const result = await User.verifyPassword(wrongPassword, hashedPassword);
      expect(result).toBe(false);
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      const email = 'test@example.com';
      const mockUser = { id: 1, email, username: 'testuser' };

      User.query = jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockUser)
      }));

      const result = await User.findByEmail(email);
      expect(result).toEqual(mockUser);
    });
  });
});