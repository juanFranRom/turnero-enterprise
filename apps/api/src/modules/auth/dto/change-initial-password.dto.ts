import { IsString, MinLength } from 'class-validator';

export class ChangeInitialPasswordDto {
	@IsString()
	@MinLength(8)
	currentPassword!: string;

	@IsString()
	@MinLength(8)
	newPassword!: string;
}