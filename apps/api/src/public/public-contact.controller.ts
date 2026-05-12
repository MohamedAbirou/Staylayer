import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { CreatePublicContactInquiryDto } from "./dto/create-public-contact-inquiry.dto";
import { PublicContactService } from "./public-contact.service";

@Controller("public/marketing")
@UseGuards(ThrottlerGuard)
export class PublicContactController {
  constructor(private readonly publicContactService: PublicContactService) {}

  @Post("contact")
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async submit(@Body() dto: CreatePublicContactInquiryDto) {
    return this.publicContactService.submitInquiry(dto);
  }
}
