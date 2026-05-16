import { IsIn } from "class-validator";
import { BILLING_PLANS } from "../billing-plans";

const BILLING_PLAN_KEYS = Object.keys(BILLING_PLANS);

export class UpdateSubscriptionPlanDto {
  @IsIn(BILLING_PLAN_KEYS)
  planKey!: string;
}
