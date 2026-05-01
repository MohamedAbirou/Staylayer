import React from "react";

export function FeatureCardWrapper({ children, className = "" }) {
  return (
    <div
      className={`mt-8 flex items-center gap-3  max-w-max mx-auto text-slate-800 text-base font-semibold ${className}`}
    >
      {children}
    </div>
  );
}

export default function FeatureCard({
  icon1 = false,
  textBg = "bg-blue-100",
  textColor = "text-blue-600",
  icon2 = true,
  title = "",
  paragraphs = [],
  className = "",
}) {
  return (
    <div className={`feature-card ${className}`}>
      {icon1 && (
        <div className={`feature-card-icon-wrapper ${textBg}`}>
          <span
            className={`feature-card-icon ${textColor} w-10 h-10 flex items-center justify-center rounded-full`}
          >
            {React.createElement(icon1, {
              className: "w-10 h-10 text-current fill-current",
            })}
          </span>
        </div>
      )}

      {title && <h3 className="feature-card-title">{title}</h3>}

      <div className="feature-card-list">
        {paragraphs.length > 0 &&
          paragraphs.map((text, index) => (
            <div className="feature-card-list-item" key={index}>
              {icon2 && (
                <span className="feature-card-list-marker">
                  <svg
                    className="h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
              )}
              <span>{text}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
