import { IsString, IsNotEmpty } from 'class-validator';

/**
 * DTO for Withdrawing Funds from Lightning Node
 *
 * Withdraws funds from the Lightning Node (app session) back to the unified balance.
 * The unified balance can then be withdrawn on-chain if needed.
 */
export class WithdrawFundsDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  appSessionId: string; // Lightning Node session ID to withdraw from

  @IsString()
  @IsNotEmpty()
  amount: string; // Human-readable amount (e.g., "100.0")

  @IsString()
  @IsNotEmpty()
  asset: string; // USDC, USDT, etc.

  @IsString()
  @IsNotEmpty()
  participantAddress: string; // Withdrawer's address
}
