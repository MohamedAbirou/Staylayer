import Link from "next/link";
import { useState } from "react";
import {
  MatrialIconsBarChart,
  MatrialIconsCalenderMonth,
  MatrialIconsContact,
  MatrialIconsEvenetAvailable,
  MatrialIconsHome,
  MatrialIconsSyncAlt,
  MatrialIconsTrendingUp,
  MatrialIconsWeb,
  MynauiArrowRight,
} from "../icons";
import { publicPages } from "@/lib/publicPages";

export const PLATFORM_MENU = [
  {
    title: "Features",
    links: [
      {
        label: "Website Builder",
        href: "/website-builder-vacation-rentals",
        icon: MatrialIconsWeb,
        id: "website-builder",
      },
      {
        label: "Channel Manager (Airbnb)",
        href: "/channel-manager-airbnb",
        icon: MatrialIconsSyncAlt,
        id: "channel-manager-airbnb",
      },
      {
        label: "Channel Manager (Booking.com)",
        href: "/channel-manager-booking-com",
        icon: MatrialIconsSyncAlt,
        id: "channel-manager-booking-com",
      },
      {
        label: "Channel Manager (Vacation Rental)",
        href: "/channel-manager-vacation-rental",
        icon: MatrialIconsHome,
        id: "channel-manager-vacation-rental",
      },
      {
        label: "Guest Communications",
        href: "/automatic-guest-communications-vacation-rentals",
        icon: MatrialIconsContact,
        id: "guest-communications",
      },
      {
        label: "Booking Engine",
        href: "/booking-system-engine-vacation-rental",
        icon: MatrialIconsCalenderMonth,
        id: "booking-engine",
      },
      {
        label: "Reservation System",
        href: "/reservation-system-pms-vacation-rental",
        icon: MatrialIconsEvenetAvailable,
        id: "reservation-system",
      },
      {
        label: "Dynamic Pricing",
        href: "/dynamic-pricing",
        icon: MatrialIconsTrendingUp,
        id: "dynamic-pricing",
      },
      {
        label: "Statistics & KPIs",
        href: "/statistics-kpis-vacation-rentals",
        icon: MatrialIconsBarChart,
        id: "statistics-kpis",
      },
    ],
  },
];

export default function PlatformNavItems() {
  const [subActiveTab, setSubActiveTab] = useState("property-management-(pms)");

  // Find the active item by id
  const activeItem = PLATFORM_MENU.flatMap((section) => section.links).find(
    (item) => item.id === subActiveTab
  );

  return (
    <>
      <div>
        {PLATFORM_MENU.map((section) => (
          <div key={section.title} className="mb-4">
            <p className="uppercase text-xs font-bold text-night-black-700 mb-2 px-2">
              {section.title}
            </p>
            {section.links.map((item) => (
              <span
                key={item.id}
                className="flex tab-title items-center py-2 px-2 gap-x-2 group cursor-default rounded-lg hover:bg-[#EDF4FE] [&.sub-item-hovered]:bg-night-black-400 group_element"
                data-title={item.id}
                aria-expanded="false"
                onMouseEnter={() => setSubActiveTab(item.id)}
              >
                <Link
                  className="main-nav__button items-center flex gap-x-2"
                  href={item.href}
                >
                  <item.icon className="w-5 h-5" />
                  <p className="tab-title-text p-small text-night-black font-bold mb-0">
                    {item.label}
                  </p>
                </Link>
              </span>
            ))}
          </div>
        ))}
      </div>

      {/* Render the side panel for the active tab */}
      {activeItem && activeItem.side && (
        <div className="tab-items max-w-[530px] grow-0">
          {activeItem.side.map((sideSection, idx) => {
            // Only show the active tab with animation
            const isActive = true; // Only one tab is active at a time
            return (
              <div
                key={sideSection.title + idx}
                className={`flex flex-col tab-wrap h-fit xl:gap-[3px] will-change-transform col-start-1 col-end-1 row-start-1 row-end-1
            ${isActive
                    ? "opacity-100 pointer-events-auto translate-y-0 transition-all duration-300"
                    : "opacity-0 pointer-events-none -translate-y-8"
                  }
          `}
                data-tab={activeItem.id}
                data-direction={isActive ? "current" : ""}
              >
                <p
                  className={`column-title p-small font-bold mb-2 text-night-black-700 px-2 ${idx > 0 ? "mt-6" : ""
                    }`}
                >
                  {sideSection.title.charAt(0).toUpperCase() +
                    sideSection.title.slice(1)}
                </p>
                {sideSection.links &&
                  sideSection.links.length > 0 &&
                  (sideSection.title.toLowerCase() === "overview" ? (
                    sideSection.links.map((link) => (
                      <Link
                        key={link.id}
                        className="main-nav__button tab-item px-2 py-2 w-full flex flex-col gap-1 hover:bg-[#EDF4FE] rounded-lg group"
                        href={link.href}
                        id={link.id}
                      >
                        <p className="p-small text-night-black font-bold mb-0 relative w-full items-center flex">
                          {link.icon && (
                            <link.icon className="tab-item__icon w-[16px] h-[16px] mr-2 duration-200 transition-opacity" />
                          )}
                          {link.label}
                          <span>
                            <MynauiArrowRight width={16} height={16} />
                          </span>
                        </p>
                        {link.overviewDescription && (
                          <p className="link-description p-small mb-0 text-night-black-700 max-w-[410px]">
                            {link.overviewDescription}
                          </p>
                        )}
                      </Link>
                    ))
                  ) : (
                    <div className="flex flex-wrap">
                      {sideSection.links.map((link) => (
                        <Link
                          key={link.id}
                          className="main-nav__button tab-item px-2 py-2 w-6/12 hover:bg-[#EDF4FE] rounded-lg group"
                          href={link.href}
                          id={link.id}
                        >
                          <p className="p-small text-night-black font-bold mb-0 relative w-full items-center flex">
                            {link.icon && (
                              <link.icon className="tab-item__icon w-[16px] h-[16px] mr-2 duration-200 transition-opacity" />
                            )}
                            {link.label}
                            <span>
                              <MynauiArrowRight width={16} height={16} />
                            </span>
                          </p>
                        </Link>
                      ))}
                    </div>
                  ))}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
