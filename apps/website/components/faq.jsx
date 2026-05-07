import React, { useState } from "react";
import Accordion from "./accordion";

export default function FAQ({ content, title }) {
  const [openIndex, setOpenIndex] = useState(null);

  const toggleAccordion = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="mx-auto max-w-2xl lg:max-w-7xl" id="faq">
      <h2 className="p-2 text-2xl! lg:text-2xl!">
        {title ? title : "Frequently asked questions"}
      </h2>
      <div>
        {(content ?? []).map((faq, index) => (
          <Accordion
            key={faq.q ?? index}
            title={faq.q}
            isOpen={openIndex === index}
            setOpen={() => toggleAccordion(index)}
            allowOverFlow={false}
            border={false}
            className="hover:bg-gray-100 px-2 rounded-lg"
          >
            <div className="text-base leading-7 text-gray-600">
              {faq.a?.paragraphs &&
                faq.a.paragraphs.map((paragraph, pIndex) => (
                  <p key={pIndex} className="mb-4">
                    {paragraph}
                  </p>
                ))}
              {faq.a?.points && (
                <ul className="list-disc pl-5 mt-2">
                  {faq.a.points.map((point, pIndex) => (
                    <li key={pIndex}>{point}</li>
                  ))}
                </ul>
              )}
              {faq.a?.links && (
                <p>
                  {faq.a.links.map((link, lIndex) => (
                    <span key={lIndex}>
                      {link.text}
                      {link.href && link.linkText && (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold hover:underline"
                        >
                          {link.linkText}
                        </a>
                      )}
                    </span>
                  ))}
                </p>
              )}
              {faq.a?.link && (
                <p>
                  {faq.a.link.text}
                  <a
                    href={faq.a.link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold hover:underline"
                  >
                    {faq.a.link.linkText}
                  </a>
                </p>
              )}
            </div>
          </Accordion>
        ))}
      </div>
    </div>
  );
}
