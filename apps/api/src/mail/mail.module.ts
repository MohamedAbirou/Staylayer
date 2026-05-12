import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TransactionalEmailService } from "./transactional-email.service";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [TransactionalEmailService],
  exports: [TransactionalEmailService],
})
export class MailModule {}
