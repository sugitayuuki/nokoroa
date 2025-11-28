import { secureAuth } from './secureAuth';

export const setToken = (token: string) => {
  secureAuth.setToken(token);
};

export const getToken = (): string | null => {
  return secureAuth.getToken();
};

export const removeToken = () => {
  secureAuth.removeToken();
};
