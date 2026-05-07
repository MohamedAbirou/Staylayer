import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { FormsService } from "./forms.service";
import { CreateSubmissionDto } from "./dto/create-submission.dto";

/**
 * Public inquiry submission endpoint — no auth required.
 * Called by the website (Next.js) when a visitor submits a contact or inquiry form.
 * Rate-limited strictly to protect against spam bursts.
 */
@Controller("public/submissions")
@UseGuards(ThrottlerGuard)
export class PublicSubmissionsController {
  constructor(private readonly formsService: FormsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async submit(@Body() dto: CreateSubmissionDto) {
    const result = await this.formsService.createSubmission(dto);
    // Return minimal response — do not echo payload back to the browser
    return { id: result.id, accepted: true };
  }
}
