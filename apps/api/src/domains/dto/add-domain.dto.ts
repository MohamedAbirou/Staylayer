import { IsString, Matches, MaxLength } from "class-validator";

const FQDN_REGEX =
  /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

export class AddDomainDto {
  @IsString()
  @MaxLength(253)
  @Matches(FQDN_REGEX, {
    message:
      "hostname must be a valid fully-qualified domain name (e.g. yourdomain.com)",
  })
  hostname: string;
}
