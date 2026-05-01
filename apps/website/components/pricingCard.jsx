import React from "react";
import LinkButton from "./linkButton";

const CheckIcon = () => (
  <svg
    aria-hidden="true"
    className="h-6 w-6 flex-none fill-current stroke-current "
  >
    <path
      d="M9.307 12.248a.75.75 0 1 0-1.114 1.004l1.114-1.004ZM11 15.25l-.557.502a.75.75 0 0 0 1.15-.043L11 15.25Zm4.844-5.041a.75.75 0 0 0-1.188-.918l1.188.918Zm-7.651 3.043 2.25 2.5 1.114-1.004-2.25-2.5-1.114 1.004Zm3.4 2.457 4.25-5.5-1.187-.918-4.25 5.5 1.188.918Z"
      strokeWidth={0}
    />
    <circle
      cx={12}
      cy={12}
      r="8.25"
      fill="none"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PricingCard = ({
  title,
  description,
  price,
  features,
  buttonLabel,
  buttonHref,
  isFeatured = false,
}) => {
  const cardClasses = `flex flex-col rounded-3xl px-6 sm:px-8 lg:py-8 ${
    isFeatured ? "order-first bg-blue-600 py-8 lg:order-none" : ""
  }`;
  const descriptionClasses = `mt-2 text-base ${
    isFeatured ? "text-white" : "text-slate-400"
  }`;
  const featureTextClasses = `ml-4 ${
    isFeatured ? "text-white" : "text-slate-200"
  }`;
  const buttonClasses = `mt-8  ${
    isFeatured
      ? "bg-white !ring-0 text-slate-900 hover:bg-blue-50 active:bg-blue-200 active:text-slate-600 focus-visible:outline-white"
      : "ring-1 ring-slate-700 text-white hover:ring-slate-500 active:ring-slate-700 active:text-slate-400 focus-visible:outline-white"
  }`;

  return (
    <section className={cardClasses}>
      <h3 className="mt-5 font-display text-lg text-white">{title}</h3>
      <p className={descriptionClasses}>{description}</p>
      <p className="order-first font-display text-5xl font-light tracking-tight text-white">
        {price}
      </p>
      <ul
        role="list"
        className="order-last mt-10 flex flex-col gap-y-3 text-sm"
      >
        {features.map((feature, index) => (
          <li
            key={index}
            className={`flex ${isFeatured ? "text-white!" : "text-slate-400"}`}
          >
            <CheckIcon />
            <span className={featureTextClasses}>{feature}</span>
          </li>
        ))}
      </ul>
      <LinkButton
        className={buttonClasses}
        aria-label={`Get started with the ${title} plan for ${price}`}
        href={buttonHref}
      >
        {buttonLabel}
      </LinkButton>
    </section>
  );
};

export default PricingCard;
