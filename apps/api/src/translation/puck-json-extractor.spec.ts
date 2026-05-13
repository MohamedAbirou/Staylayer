/// <reference types="jest" />

import {
  extractTranslatableText,
  injectTranslatedText,
} from "./puck-json-extractor";

describe("puck-json-extractor", () => {
  it("extracts and reinjects text from Puck props while preserving links and ids", () => {
    const puckData = {
      content: [
        {
          type: "HeroSection",
          props: {
            id: "hero-home",
            headline: "Oceanfront villas for relaxed, direct stays",
            subheadline:
              "Explore private villas, then send a direct inquiry for your preferred dates.",
            ctaLabel: "Send inquiry",
            ctaHref: "/contact",
            imageUrl: "/images/azure-bay-hero.jpg",
          },
        },
        {
          type: "ImageTextSection",
          props: {
            id: "coastal-story",
            title: "A quieter seaside stay, planned directly with our team",
            body: "Azure Bay Villas welcomes couples, families, and longer restorative stays.",
            imagePosition: "right",
          },
        },
      ],
      root: {
        props: {
          title: "Home",
        },
      },
    };

    const segments = extractTranslatableText(puckData);

    expect(segments).toEqual([
      {
        path: "content[0].props.headline",
        text: "Oceanfront villas for relaxed, direct stays",
      },
      {
        path: "content[0].props.subheadline",
        text: "Explore private villas, then send a direct inquiry for your preferred dates.",
      },
      {
        path: "content[0].props.ctaLabel",
        text: "Send inquiry",
      },
      {
        path: "content[1].props.title",
        text: "A quieter seaside stay, planned directly with our team",
      },
      {
        path: "content[1].props.body",
        text: "Azure Bay Villas welcomes couples, families, and longer restorative stays.",
      },
      {
        path: "root.props.title",
        text: "Home",
      },
    ]);

    const translated = injectTranslatedText(
      puckData,
      new Map([
        [
          "content[0].props.headline",
          "Villas frente al mar para estancias relajadas y directas",
        ],
        ["content[0].props.ctaLabel", "Enviar consulta"],
        [
          "content[1].props.body",
          "Azure Bay Villas da la bienvenida a parejas, familias y estancias restauradoras más largas.",
        ],
      ]),
    ) as {
      content: Array<{
        props: {
          headline?: string;
          ctaLabel?: string;
          ctaHref?: string;
          body?: string;
          id?: string;
        };
      }>;
    };

    expect(translated.content[0].props.headline).toBe(
      "Villas frente al mar para estancias relajadas y directas",
    );
    expect(translated.content[0].props.ctaLabel).toBe("Enviar consulta");
    expect(translated.content[0].props.ctaHref).toBe("/contact");
    expect(translated.content[0].props.id).toBe("hero-home");
    expect(translated.content[1].props.body).toBe(
      "Azure Bay Villas da la bienvenida a parejas, familias y estancias restauradoras más largas.",
    );
  });

  it("preserves contact form bindings while translating surrounding copy", () => {
    const puckData = {
      content: [
        {
          type: "ContactSection",
          props: {
            formKey: "contact-primary",
            heading: "Let's Connect",
            description:
              "Have a question? Fill out the form and our team will get back to you quickly.",
            emailAddress: "contact@example.com",
            emailLabel: "contact@example.com",
          },
        },
      ],
      root: { props: { title: "Contact" } },
    };

    const segments = extractTranslatableText(puckData);

    expect(segments).toEqual([
      {
        path: "content[0].props.heading",
        text: "Let's Connect",
      },
      {
        path: "content[0].props.description",
        text: "Have a question? Fill out the form and our team will get back to you quickly.",
      },
      {
        path: "content[0].props.emailLabel",
        text: "contact@example.com",
      },
      {
        path: "root.props.title",
        text: "Contact",
      },
    ]);

    const translated = injectTranslatedText(
      puckData,
      new Map([
        ["content[0].props.heading", "Conectemos"],
        [
          "content[0].props.description",
          "¿Tienes alguna pregunta? Completa el formulario y nuestro equipo te respondera pronto.",
        ],
      ]),
    ) as {
      content: Array<{
        props: {
          formKey?: string;
          heading?: string;
          description?: string;
        };
      }>;
    };

    expect(translated.content[0].props.formKey).toBe("contact-primary");
    expect(translated.content[0].props.heading).toBe("Conectemos");
    expect(translated.content[0].props.description).toBe(
      "¿Tienes alguna pregunta? Completa el formulario y nuestro equipo te respondera pronto.",
    );
  });
});
