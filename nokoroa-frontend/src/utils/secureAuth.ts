// より安全なトークン管理システム
// セキュリティ上の理由により、localStorageの代わりにhttpOnlyクッキーの使用を推奨

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

export interface SecureAuthConfig {
  useHttpOnlyCookies: boolean;
  tokenRefreshInterval: number; // minutes
  autoLogoutTimeout: number; // minutes
}

const DEFAULT_CONFIG: SecureAuthConfig = {
  useHttpOnlyCookies: false, // デフォルトは既存の方式を維持
  tokenRefreshInterval: 15, // 15分ごとにトークンを更新
  autoLogoutTimeout: 60, // 60分で自動ログアウト
};

class SecureAuthManager {
  private config: SecureAuthConfig;
  private tokenRefreshTimer?: NodeJS.Timeout;
  private autoLogoutTimer?: NodeJS.Timeout;

  constructor(config: Partial<SecureAuthConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // トークンの保存
  setToken(token: string): void {
    if (this.config.useHttpOnlyCookies) {
      // httpOnlyクッキーを使用する場合（サーバー側でクッキーを設定）
      // この場合、フロントエンドではトークンを直接扱わない
      console.warn(
        'httpOnlyクッキー使用時はサーバー側でトークンを管理してください',
      );
    } else {
      // 従来のlocalStorage方式（セキュリティリスクあり）
      localStorage.setItem('jwt', token);
      this.startTokenRefreshTimer();
      this.startAutoLogoutTimer();
    }
  }

  // トークンの取得
  getToken(): string | null {
    if (this.config.useHttpOnlyCookies) {
      // httpOnlyクッキーの場合、JavaScriptからはアクセスできない
      return null;
    } else {
      return localStorage.getItem('jwt');
    }
  }

  // トークンの削除
  removeToken(): void {
    if (this.config.useHttpOnlyCookies) {
      // サーバー側でクッキーを削除する必要がある
      this.clearTimers();
    } else {
      localStorage.removeItem('jwt');
      this.clearTimers();
    }
  }

  // トークンの有効性チェック
  isTokenValid(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      return payload.exp > currentTime;
    } catch {
      return false;
    }
  }

  // トークンリフレッシュタイマーの開始
  private startTokenRefreshTimer(): void {
    this.clearTokenRefreshTimer();
    this.tokenRefreshTimer = setInterval(
      () => {
        // トークンリフレッシュのロジック
        // 実装はバックエンドAPIの仕様に依存
        this.refreshTokenIfNeeded();
      },
      this.config.tokenRefreshInterval * 60 * 1000,
    );
  }

  // 自動ログアウトタイマーの開始
  private startAutoLogoutTimer(): void {
    this.clearAutoLogoutTimer();
    this.autoLogoutTimer = setTimeout(
      () => {
        this.removeToken();
        // 自動ログアウト通知
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:auto-logout'));
        }
      },
      this.config.autoLogoutTimeout * 60 * 1000,
    );
  }

  // タイマーのクリア
  private clearTimers(): void {
    this.clearTokenRefreshTimer();
    this.clearAutoLogoutTimer();
  }

  private clearTokenRefreshTimer(): void {
    if (this.tokenRefreshTimer) {
      clearInterval(this.tokenRefreshTimer);
      this.tokenRefreshTimer = undefined;
    }
  }

  private clearAutoLogoutTimer(): void {
    if (this.autoLogoutTimer) {
      clearTimeout(this.autoLogoutTimer);
      this.autoLogoutTimer = undefined;
    }
  }

  // トークンリフレッシュ（実装はバックエンドAPIに依存）
  private async refreshTokenIfNeeded(): Promise<void> {
    const token = this.getToken();
    if (!token) return;

    if (!this.isTokenValid(token)) {
      // トークンが無効な場合は削除
      this.removeToken();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:token-expired'));
      }
    }
  }

  // セキュリティ監査ログ
  logSecurityEvent(event: string, details?: Record<string, unknown>): void {
    console.warn(`[Security] ${event}`, details);
    // 本番環境では適切なログシステムに送信
  }
}

// シングルトンインスタンス
export const secureAuth = new SecureAuthManager();

// 既存のコードとの互換性を保つためのレガシー関数
export const getToken = (): string | null => {
  return secureAuth.getToken();
};

export const setToken = (token: string): void => {
  secureAuth.setToken(token);
};

export const removeToken = (): void => {
  secureAuth.removeToken();
};

// セキュリティベストプラクティスの説明
/*
JWTセキュリティ改善のための推奨事項:

1. httpOnlyクッキーの使用:
   - XSS攻撃からトークンを保護
   - JavaScriptからアクセス不可
   - バックエンドでクッキーを設定

2. トークンの短い有効期限:
   - アクセストークン: 15-30分
   - リフレッシュトークン: 7日

3. CSRF対策:
   - CSRFトークンの実装
   - SameSite=Strict属性

4. セキュアな通信:
   - HTTPS必須
   - Secure属性付きクッキー

5. トークンローテーション:
   - 定期的なトークン更新
   - 使用済みリフレッシュトークンの無効化

6. セッション管理:
   - 非アクティブセッションの自動終了
   - 同時ログインセッション数の制限

7. 監査ログ:
   - ログイン/ログアウトの記録
   - 異常なアクセスパターンの検出
*/
