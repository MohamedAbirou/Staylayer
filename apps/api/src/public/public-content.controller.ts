import { Controller, Get } from "@nestjs/common";
import { PublicContentService } from "./public-content.service";

@Controller("public/marketing")
export class PublicContentController {
  constructor(private readonly publicContentService: PublicContentService) {}

  @Get("content")
  async getContent() {
    return this.publicContentService.getContent();
  }
}
