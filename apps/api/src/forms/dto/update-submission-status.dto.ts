import { IsEnum } from "class-validator";
import { FormSubmissionStatus } from "@prisma/client";

export class UpdateSubmissionStatusDto {
  @IsEnum(FormSubmissionStatus)
  status: FormSubmissionStatus;
}
