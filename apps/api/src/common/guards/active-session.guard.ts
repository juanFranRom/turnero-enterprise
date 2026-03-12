import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { SessionsService } from '../../modules/sessions/sessions.service';

@Injectable()
export class ActiveSessionGuard implements CanActivate {
	constructor(private readonly sessionsService: SessionsService) {}

	async canActivate(ctx: ExecutionContext): Promise<boolean> {
		const req = ctx.switchToHttp().getRequest<any>();
		const user = req.auth ?? req.user;

		const sid = user?.sid as string | undefined;

		await this.sessionsService.assertActiveOrThrow('global', sid);

		return true;
	}
}