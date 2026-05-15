import type { ComponentConfig } from "@puckeditor/core";
import { cn } from "../../lib/cn";
import { logoImageField, textColorField } from "../../lib/fields";
import { parseMarkup } from "../../lib/parse-markup";

interface LogoItem {
  url: string;
  alt: string;
  link: string;
}

export interface LogoCloudProps {
  title: string;
  logos: LogoItem[];
  columns: string;
  grayscale: boolean;
  logoHeight: string;
  titleColor: string;
  titleFontSize: number;
}

const columnsMap: Record<string, string> = {
  "3": "[grid-template-columns:repeat(3,minmax(80px,160px))]",
  "4": "[grid-template-columns:repeat(4,minmax(80px,160px))]",
  "5": "[grid-template-columns:repeat(5,minmax(80px,160px))]",
  "6": "[grid-template-columns:repeat(6,minmax(80px,160px))]",
};

const heightMap: Record<string, string> = {
  sm: "h-6",
  md: "h-8",
  lg: "h-10",
  xl: "h-12",
};

export const LogoCloud = ({
  title = "Trusted by leading companies",
  logos = [],
  columns = "5",
  grayscale = true,
  logoHeight = "md",
  titleColor = "",
  titleFontSize = 0,
}: LogoCloudProps) => {
  return (
    <div className="w-full py-8 md:py-12">
      {title && (
        <p
          style={{
            color: titleColor || undefined,
            ...(titleFontSize > 0 ? { fontSize: `${titleFontSize}px` } : {}),
          }}
          className={`mb-8 text-center font-medium uppercase tracking-wider text-gray-500 ${titleFontSize === 0 ? " text-sm" : ""}`}
        >
          {parseMarkup(title)}
        </p>
      )}
      <div
        className={cn(
          "mx-auto grid max-w-screen-xl items-center justify-center justify-items-center gap-8 px-4",
          columnsMap[columns] ?? columnsMap["5"],
        )}
      >
        {logos.map((logo, i) => {
          const img = (
            <img
              key={i}
              src={logo.url}
              alt={logo.alt || `Logo ${i + 1}`}
              className={cn(
                "max-w-full object-contain transition-all duration-200",
                heightMap[logoHeight],
                grayscale &&
                  "opacity-60 grayscale hover:opacity-100 hover:grayscale-0",
              )}
              loading="lazy"
            />
          );

          if (logo.link) {
            return (
              <a
                key={i}
                href={logo.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex"
              >
                {img}
              </a>
            );
          }
          return img;
        })}
      </div>
    </div>
  );
};

export const logoCloudConfig: ComponentConfig<LogoCloudProps> = {
  label: "Logo Cloud",
  fields: {
    title: {
      type: "text",
      label: "Title",
      contentEditable: true,
    },
    logos: {
      type: "array",
      label: "Logos",
      arrayFields: {
        url: { ...logoImageField, label: "Logo Image" },
        alt: { type: "text", label: "Alt Text" },
        link: { type: "text", label: "Link (optional)" },
      },
      defaultItemProps: {
        url: "https://placehold.co/200x60/e2e8f0/64748b?text=Logo",
        alt: "Company logo",
        link: "",
      },
    },
    columns: {
      type: "radio",
      label: "Columns",
      options: [
        { label: "3", value: "3" },
        { label: "4", value: "4" },
        { label: "5", value: "5" },
        { label: "6", value: "6" },
      ],
    },
    grayscale: {
      type: "radio",
      label: "Grayscale Effect",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    logoHeight: {
      type: "radio",
      label: "Logo Size",
      options: [
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
        { label: "Extra Large", value: "xl" },
      ],
    },
    titleColor: { ...textColorField, label: "Title Color" },
    titleFontSize: {
      type: "number",
      label: "Title Font Size (px, 0 = auto)",
      min: 0,
      max: 60,
    },
  },
  defaultProps: {
    title: "Trusted by leading companies",
    logos: [
      {
        url: "/images/otas/agoda.svg",
        alt: "Agoda",
        link: "",
      },
      {
        url: "/images/otas/airbnb.svg",
        alt: "Airbnb",
        link: "",
      },
      {
        url: "/images/otas/booking.svg",
        alt: "Booking",
        link: "",
      },
      {
        url: "/images/otas/despegar.svg",
        alt: "Despegar",
        link: "",
      },
      {
        url: "/images/otas/didatravel.png",
        alt: "Didatravel",
        link: "",
      },
      {
        url: "/images/otas/expedia.svg",
        alt: "Expedia",
        link: "",
      },
      {
        url: "/images/otas/hipcamp.svg",
        alt: "Hipcamp",
        link: "",
      },
      {
        url: "/images/otas/hopper.svg",
        alt: "Hopper",
        link: "",
      },
      {
        url: "/images/otas/hotelbeds.svg",
        alt: "Hotelbeds",
        link: "",
      },
      {
        url: "/images/otas/hoterip.png",
        alt: "Hoterip",
        link: "",
      },
      {
        url: "/images/otas/hrs.svg",
        alt: "HRS",
        link: "",
      },
      {
        url: "/images/otas/inntopia.svg",
        alt: "Inntopia",
        link: "",
      },
      {
        url: "/images/otas/makemytrip.svg",
        alt: "MakeMyTrip",
        link: "",
      },
      {
        url: "/images/otas/moverii.avif",
        alt: "Moverii",
        link: "",
      },
      {
        url: "/images/otas/pitchup.png",
        alt: "Pitchup",
        link: "",
      },
      {
        url: "/images/otas/pricetravel.svg",
        alt: "PriceTravel",
        link: "",
      },
      {
        url: "/images/otas/ratedock.svg",
        alt: "RateDock",
        link: "",
      },
      {
        url: "/images/otas/roombeast.png",
        alt: "Roombeast",
        link: "",
      },
      {
        url: "/images/otas/spot2nite.png",
        alt: "Spot2nite",
        link: "",
      },
      {
        url: "/images/otas/szallas.svg",
        alt: "Szallas",
        link: "",
      },
      {
        url: "/images/otas/tablethotels.svg",
        alt: "TabletHotels",
        link: "",
      },
      {
        url: "/images/otas/traveloka.svg",
        alt: "Traveloka",
        link: "",
      },
      {
        url: "/images/otas/trip.svg",
        alt: "Trip",
        link: "",
      },
      {
        url: "/images/otas/tripadvisor.svg",
        alt: "TripAdvisor",
        link: "",
      },
      {
        url: "/images/otas/vrbo.svg",
        alt: "Vrbo",
        link: "",
      },
    ],
    columns: "5",
    grayscale: true,
    logoHeight: "md",
    titleColor: "",
    titleFontSize: 0,
  },
  render: LogoCloud,
};
