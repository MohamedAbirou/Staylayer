"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Logo, MdiLightChevron } from "../icons";
import { DisplayActive } from "../navbarItems";
import Accordion from "../accordion";
import { PLATFORM_MENU } from "../navItems/platform";
import { RESOURCES_MENU } from "../navItems/resources";
import { CTALink } from "../ctaSection";
import { usePathname } from "next/navigation";
import LanguageSelector from "../LanguageSelector";

export default function Navbar() {
  const [activeTab, setActiveTab] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openAccordionId, setOpenAccordionId] = useState(null);
  const [openChildAccordionId, setOpenChildAccordionId] = useState(null);
  const pathName = usePathname();

  useEffect(() => {
    setActiveTab(null);
    setMobileMenuOpen(false);
    setOpenAccordionId(null);
    setOpenChildAccordionId(null);
  }, [pathName]);

  const liRefs = {
    platform: useRef(null),
    resources: useRef(null),
  };

  const headerRef = useRef(null);
  const getLeftOffset = (tab) => {
    if (liRefs[tab]?.current) {
      return liRefs[tab].current.offsetLeft;
    }
    return 0;
  };

  const handleAccordionToggle = (id) => {
    setOpenAccordionId(openAccordionId === id ? null : id);
  };

  const desktopNavItems = [
    {
      key: "platform",
      label: "Platform",
      ref: liRefs.platform,
      hasAccordion: true,
      accordionItems: PLATFORM_MENU,
    },
    {
      key: "resources",
      label: "Resources",
      ref: liRefs.resources,
      hasAccordion: true,
      accordionItems: RESOURCES_MENU,
    },
  ];

  return (
    <>
      <header
        ref={headerRef}
        onMouseLeave={() => setActiveTab(false)}
        className="w-screen fixed py-3 top-0 inset-x-0 z-[998] bg-white/40 transition-all duration-300 backdrop-blur-md"
      >
        <div className="relative z-50 w-full ">
          <div className="container mx-auto flex items-center justify-between px-4">
            {/* logo */}
            <div className="flex items-center justify-between gap-12">
              <Link href={"/"}>
                <Logo />
              </Link>
              <ul className="nav-items hidden lg:flex items-center gap-6 text-sm">
                {desktopNavItems.map((item) =>
                  item.hasAccordion ? (
                    <li
                      key={item.key}
                      ref={item.ref}
                      className="relative group flex gap-[0.5px] items-center"
                      onMouseEnter={() => setActiveTab(item.key)}
                    >
                      {item.label}
                      <MdiLightChevron
                        className={`transition-all duration-300 ${
                          activeTab === item.key && "rotate-180"
                        }`}
                        width={24}
                        height={24}
                      />
                    </li>
                  ) : (
                    <li key={item.key}>
                      <Link href={item.href || "#"}>{item.label}</Link>
                    </li>
                  ),
                )}
              </ul>
            </div>

            {/* CTA + Language */}
            <div className="flex items-center gap-3 mr-6">
              <LanguageSelector className="hidden sm:block" />
              <CTALink
                href="/pricing"
                className="text-slate-700! !ring-1 hover:bg-slate-700! hover:text-white! transition-colors !my-0 !px-3 !rounded"
                linkText={"Get started today"}
              />

              <div className="block lg:hidden -translate-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen((prev) => !prev);
                  }}
                  className={`text-gray-700 -m-2.5 inline-flex items-center justify-center rounded-md p-2.5 relative w-10 h-10`}
                >
                  <span className="sr-only">
                    {mobileMenuOpen ? "Close menu" : "Open main menu"}
                  </span>
                  <div className="w-6 h-6 relative flex flex-col justify-center items-center">
                    <span
                      className={`block w-[30px] h-[2px] bg-current transition-all duration-300 ${
                        mobileMenuOpen
                          ? "rotate-45 translate-y-[1px]"
                          : "-translate-y-[3px]"
                      }`}
                    />
                    <span
                      className={`block w-[30px] h-[2px] bg-current transition-all duration-300 ${
                        mobileMenuOpen
                          ? "-rotate-45 -translate-y-[1px]"
                          : "translate-y-[3px]"
                      }`}
                    />
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div>
          {/* Desktop Navbar */}
          <div className="hidden lg:block">
            <DisplayActive
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              leftOffset={getLeftOffset(activeTab)}
              headerHeight={
                headerRef.current ? headerRef.current.offsetHeight : 0
              }
            />
          </div>
          {/* Mobile Navbar */}
          <div
            className={`lg:hidden fixed inset-0 z-40 h-screen bg-white transition-transform duration-300 ease-in-out ${
              mobileMenuOpen ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <div className="flex h-full flex-col">
              <div className="pt-[80px]" />
              <div className="flex-1 overflow-y-auto px-0 pt-0 border-t border-gray-200">
                <nav className="space-y-0">
                  {desktopNavItems.map((item) =>
                    item.hasAccordion ? (
                      <Accordion
                        key={item.key}
                        title={item.label}
                        isOpen={openAccordionId === item.key}
                        setOpen={() => handleAccordionToggle(item.key)}
                      >
                        {/* Render links for platform menu */}
                        {item.accordionItems &&
                          item.accordionItems.map((section) => (
                            <div key={section.title}>
                              <p className="uppercase text-xs font-bold text-night-black-700 mb-2 px-2">
                                {section.title}
                              </p>
                              {section.links.map((link) =>
                                link.side ? (
                                  <Accordion
                                    key={link.id}
                                    border={false}
                                    title={
                                      <span className="flex items-center justify-between w-full px-2 py-2">
                                        <span className="flex items-center gap-2">
                                          {link.icon && (
                                            <link.icon
                                              className="w-4 h-4"
                                              aria-hidden="true"
                                            />
                                          )}
                                          {link.label}
                                        </span>
                                      </span>
                                    }
                                    isOpen={openChildAccordionId === link.id}
                                    setOpen={() =>
                                      setOpenChildAccordionId(
                                        openChildAccordionId === link.id
                                          ? null
                                          : link.id,
                                      )
                                    }
                                  >
                                    {/* Render side links */}
                                    {link.side.map((sideSection, idx) => (
                                      <div key={sideSection.title + idx}>
                                        <p className="column-title px-2 p-small font-bold mb-2 text-night-black-700">
                                          {sideSection.title
                                            .charAt(0)
                                            .toUpperCase() +
                                            sideSection.title.slice(1)}
                                        </p>
                                        {sideSection.links.map((sublink) => (
                                          <Link
                                            key={sublink.id}
                                            href={sublink.href}
                                            className="block px-4 py-2 text-sm hover:bg-[#EDF4FE] rounded"
                                          >
                                            <span className="flex items-center gap-2">
                                              {/* <img
                                                src={sublink.icon}
                                                alt={sublink.label}
                                                className="w-4 h-4"
                                              /> */}
                                              {sublink.label}
                                            </span>
                                          </Link>
                                        ))}
                                      </div>
                                    ))}
                                  </Accordion>
                                ) : (
                                  <Link
                                    key={link.id}
                                    href={link.href}
                                    className="block px-2 py-2 text-sm hover:bg-[#EDF4FE] rounded"
                                  >
                                    <span className="flex items-center gap-2">
                                      {link.icon && (
                                        <link.icon
                                          className="w-4 h-4"
                                          aria-hidden="true"
                                        />
                                      )}
                                      {link.label}
                                    </span>
                                  </Link>
                                ),
                              )}
                            </div>
                          ))}
                      </Accordion>
                    ) : (
                      <Link
                        key={item.key}
                        href={item.href || "#"}
                        onClick={() => setMobileMenuOpen(false)}
                        className="font-semibold text-gray-900 block w-full text-left p-6 border-y border-gray-200"
                      >
                        {item.label}
                      </Link>
                    ),
                  )}
                </nav>
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
