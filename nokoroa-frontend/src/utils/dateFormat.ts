import {
  format,
  formatDistanceToNow as dateFnsFormatDistanceToNow,
} from 'date-fns';
import { ja } from 'date-fns/locale';

export const formatDistanceToNow = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateFnsFormatDistanceToNow(dateObj, {
    addSuffix: true,
    locale: ja,
  });
};

export const formatJoinedDate = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'yyyy年MM月', { locale: ja });
};

export const formatPostDate = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'yyyy年MM月dd日', { locale: ja });
};

export const formatDateTime = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'yyyy年MM月dd日 HH:mm', { locale: ja });
};
