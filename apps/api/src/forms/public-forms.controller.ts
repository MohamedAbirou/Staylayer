import { Controller, Get, Query } from "@nestjs/common";
import { FormsService } from "./forms.service";
import { PublicFormQueryDto } from "./dto/public-form-query.dto";

@Controller("public/forms")
export class PublicFormsController {
  constructor(private readonly formsService: FormsService) {}

  @Get("resolve")
  async resolve(@Query() query: PublicFormQueryDto) {
    return this.formsService.resolvePublicForm(query.siteId, {
      pageSlug: query.pageSlug,
      locale: query.locale,
      formKey: query.formKey,
    });
  }
}
