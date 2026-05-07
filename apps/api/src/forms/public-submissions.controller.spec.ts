/// <reference types="jest" />

import { FormType } from "@prisma/client";
import { FormsService } from "./forms.service";
import { PublicSubmissionsController } from "./public-submissions.controller";

describe("PublicSubmissionsController", () => {
  let controller: PublicSubmissionsController;
  let formsService: {
    createSubmission: jest.Mock;
  };

  beforeEach(() => {
    formsService = {
      createSubmission: jest.fn(),
    };

    controller = new PublicSubmissionsController(
      formsService as unknown as FormsService,
    );
  });

  it("routes a public hospitality inquiry to FormsService without echoing the payload", async () => {
    formsService.createSubmission.mockResolvedValue({
      id: "submission-1",
      status: "RECEIVED",
    });

    const result = await controller.submit({
      siteId: "site-1",
      formType: FormType.INQUIRY,
      pageSlug: "contact",
      locale: "en",
      name: "Guest Example",
      email: "guest@example.com",
      message: "We would like to book three nights in June.",
      extra: { adults: 2, children: 1 },
    });

    expect(formsService.createSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        siteId: "site-1",
        formType: FormType.INQUIRY,
        pageSlug: "contact",
      }),
    );
    expect(result).toEqual({ id: "submission-1", accepted: true });
  });
});
