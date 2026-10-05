import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';

import {
  AUTH_COOKIE_NAME,
  clearAuthCookie,
  setAuthCookie,
} from './auth-cookie';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { GoogleUser } from './strategies/google.strategy';
import { AuthenticatedRequest } from '../common/authenticated-request';

interface GoogleAuthRequest extends Request {
  user: GoogleUser;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  // 総当たり・クレデンシャルスタッフィング対策
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({
    summary: 'ログイン',
    description:
      'メールアドレスとパスワードでログインし、JWT を httpOnly クッキーで発行します',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 201, description: 'ログイン成功' })
  @ApiResponse({ status: 401, description: '認証失敗' })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(
      loginDto.email,
      loginDto.password,
    );
    // Set-Cookie と本文のトークンを中間キャッシュに残さない
    res.setHeader('Cache-Control', 'no-store');
    setAuthCookie(res, result.access_token);
    // access_token はレスポンス本文にも残している。ブラウザはこれを保存せず
    // クッキーだけで認証するが、Swagger の Authorize と既存の E2E が
    // Authorization ヘッダ経由で叩くために必要。
    return result;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'ログイン中のユーザー取得',
    description:
      'クッキー(または Authorization ヘッダ)の JWT から、ログイン中のユーザーを返します',
  })
  @ApiResponse({ status: 200, description: '取得成功' })
  @ApiResponse({ status: 401, description: '未認証' })
  async me(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    // 本人のメールアドレスを含むため、共有プロキシや戻る/進むのキャッシュに
    // 残すと「ログアウト後に前の利用者の情報が出る」ことになる
    res.setHeader('Cache-Control', 'no-store');
    return this.authService.getSessionUser(req.user.userId);
  }

  @Post('logout')
  // 認証を要求しない。クッキーが既に無効でも「消す」は成功すべきで、
  // 401 を返すとフロントがログアウトできない状態に陥る。
  @HttpCode(200)
  @ApiOperation({
    summary: 'ログアウト',
    description: '認証クッキーを削除します',
  })
  @ApiResponse({ status: 200, description: 'ログアウト成功' })
  logout(@Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    clearAuthCookie(res);
    return { message: 'ログアウトしました' };
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({
    summary: 'Google認証開始',
    description: 'Googleの認証ページにリダイレクトします',
  })
  @ApiResponse({ status: 302, description: 'Googleの認証ページにリダイレクト' })
  googleAuth(): void {
    // Guard redirects to Google
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({
    summary: 'Google認証コールバック',
    description: 'Google認証後のコールバック処理',
  })
  @ApiResponse({ status: 302, description: 'フロントエンドにリダイレクト' })
  async googleAuthRedirect(
    @Req() req: GoogleAuthRequest,
    @Res() res: Response,
  ) {
    const result = await this.authService.googleLogin(req.user);
    setAuthCookie(res, result.access_token);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    // トークンとユーザー情報はクエリに載せない。URL に載せると
    // ブラウザ履歴・アクセスログ・Referer にトークンが残るため、
    // フロントは着地後に GET /auth/me で本人を取得する。
    res.redirect(`${frontendUrl}/auth/callback`);
  }
}
