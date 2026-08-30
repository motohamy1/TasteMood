import { userRepository } from './repository.js';
import { AppError } from '../../common/errors/app-error.js';

export class UserService {
  async getProfile(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw AppError.notFound('User not found');
    return user;
  }

  async updateProfile(userId: string, data: { displayName?: string; avatarUrl?: string }) {
    await this.getProfile(userId);
    return userRepository.update(userId, data);
  }

  async getAllUsers(page: number = 1, limit: number = 20) {
    return userRepository.findMany(page, limit);
  }
}

export const userService = new UserService();
