import { CreateUserDto } from '../dto/create-user.dto';

type UserResponse = Omit<CreateUserDto, 'password'>;

export interface CreateUserResponse {
  message: string;
  user: UserResponse;
}
