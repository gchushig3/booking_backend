import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, timingSafeEqual } from "node:crypto";

@Injectable()
export class BookingApiKeyGuard implements CanActivate {
  private readonly expected: Buffer;

  constructor(config: ConfigService) {
    const key = config.getOrThrow<string>("BOOKING_API_KEY");
    if (typeof key !== "string" || key.length < 32)
      throw new Error("BOOKING_API_KEY requires at least 32 characters");
    this.expected = createHash("sha256").update(key).digest();
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, unknown> }>();
    const key = request.headers["x-api-key"];
    if (
      typeof key !== "string" ||
      key.length > 4096 ||
      !timingSafeEqual(this.expected, createHash("sha256").update(key).digest())
    ) {
      throw new UnauthorizedException("Invalid API key");
    }
    return true;
  }
}
