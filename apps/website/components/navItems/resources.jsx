import Link from "next/link";
import {
  MatrialIconsAgriculture,
  MatrialIconsApartment,
  MatrialIconsAttachMoney,
  MatrialIconsBarChart,
  MatrialIconsContact,
  MatrialIconsGroup,
  MatrialIconsHome,
  MatrialIconsHotel,
  MatrialIconsInfo,
  MatrialIconsLogin,
  MatrialIconsMenuBook,
  MatrialIconsStars,
  MatrialIconsStoreFront,
  MatrialIconsWork,
  MynauiArrowRight,
} from "../icons";
import { publicPages } from "@/lib/publicPages";
import { BRAND_NAME } from "@/lib/brand";

export const RESOURCES_MENU = [
  {
    title: "Explore",
    links: [
      {
        label: "Ambassador",
        href: "/ambassador",
        icon: MatrialIconsGroup,
        id: "ambassador",
      },
      {
        label: "Guest Guide",
        href: "/guest-guide-for-vacation-rentals",
        icon: MatrialIconsMenuBook,
        id: "guest-guide",
      },
      // {
      //   label: "Free Trial",
      //   href: "/free-trial",
      //   icon: MatrialIconsStars,
      //   id: "free-trial",
      // },
      {
        label: "Account Access",
        href: "/account-access",
        icon: MatrialIconsLogin,
        id: "account-access",
      },
      {
        label: "Pricing",
        href: "/pricing",
        icon: MatrialIconsAttachMoney,
        id: "pricing",
      },
      {
        label: `${BRAND_NAME} Annual Report`,
        href: "/annual-report",
        icon: MatrialIconsBarChart,
        id: "annual-report",
      },
      {
        label: "Contact Us",
        href: "/contact-us",
        icon: MatrialIconsContact,
        id: "contact-us",
      },
    ],
  },
  {
    title: "Company",
    links: [
      {
        label: "About",
        href: "/about",
        icon: MatrialIconsInfo,
        id: "about",
      },
      {
        label: "Careers",
        href: "/careers",
        icon: MatrialIconsWork,
        id: "careers",
      },
      {
        label: "Bed & Breakfast",
        href: "/bedbreakfast",
        icon: MatrialIconsHotel,
        id: "bedbreakfast",
      },
      {
        label: "Boutique",
        href: "/boutique",
        icon: MatrialIconsStoreFront,
        id: "boutique",
      },
      {
        label: "Guest House",
        href: "/guest-house",
        icon: MatrialIconsHome,
        id: "guest-house",
      },
      {
        label: "Vacation Apartments",
        href: "/vacation-apartments-and-homes",
        icon: MatrialIconsApartment,
        id: "vacation-apartments",
      },
    ],
  },
];

export function Resources() {
  return (
    <>
      {RESOURCES_MENU.map((column) => (
        <div key={column.title} className="flex flex-col gap-y-2">
          <p className="column-title px-2 font-bold mb-2 text-night-black-700 text-sm">
            {column.title}
          </p>
          {column.links.map((link) => (
            <Link
              key={link.id}
              className="main-nav__button items-center flex px-2 py-2 gap-x-2 pointer-events-none group-[.active]/item:pointer-events-auto group rounded-lg hover:bg-[#EDF4FE] nav-track"
              href={link.href}
              id={link.id}
            >
              {link.icon && (
                <link.icon className="w-5 h-5 text-night-black-700" />
              )}
              <p className="text-sm text-night-black font-bold mb-0 relative w-full flex items-center gap-2">
                {link.label}
              </p>
            </Link>
          ))}
        </div>
      ))}
    </>
  );
}
