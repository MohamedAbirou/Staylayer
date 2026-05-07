import { IsIn, IsUrl } from "class-validator";
import { BILLING_PLANS } from "../billing-plans";

const BILLING_PLAN_KEYS = Object.keys(BILLING_PLANS);

export class CreateCheckoutSessionDto {
  @IsIn(BILLING_PLAN_KEYS)
  planKey!: string;

  @IsUrl({ require_tld: false })
  successUrl!: string;

  @IsUrl({ require_tld: false })
  cancelUrl!: string;
}
