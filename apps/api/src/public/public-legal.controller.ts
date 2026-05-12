import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import {
  getPublicLegalDocument,
  listPublicLegalDocuments,
} from "./legal-documents.registry";

@Controller("public/legal")
export class PublicLegalController {
  @Get("documents")
  listDocuments() {
    return {
      generatedAt: new Date().toISOString(),
      documents: listPublicLegalDocuments(),
    };
  }

  @Get("documents/:slug")
  getDocument(@Param("slug") slug: string) {
    const document = getPublicLegalDocument(slug);

    if (!document) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Legal document not found",
      });
    }

    return document;
  }
}