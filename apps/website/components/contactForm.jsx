"use client";

import {
  hasCmsSubmissionEndpoint,
  resolvePublicContactForm,
  submitContactForm,
} from "@/lib/FormSubmitHandler";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";

export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const nameRegex = /^[a-zA-Z\s]+$/;

const FALLBACK_FIELDS = [
  {
    key: "name",
    label: "Name",
    type: "SINGLE_LINE_TEXT",
    required: true,
    placeholder: "Your Name",
    helpText: "",
    options: [],
    isPlatformManaged: false,
  },
  {
    key: "email",
    label: "Email",
    type: "EMAIL",
    required: true,
    placeholder: "Email Address",
    helpText: "",
    options: [],
    isPlatformManaged: false,
  },
  {
    key: "message",
    label: "Message",
    type: "MULTI_LINE_TEXT",
    required: true,
    placeholder: "Your Message",
    helpText: "",
    options: [],
    isPlatformManaged: false,
  },
];

function resolveSubmissionPageSlug(asPath = "", locale = "en") {
  const [path] = String(asPath).split(/[?#]/);
  const trimmed = path.replace(/^\/+|\/+$/g, "");

  if (!trimmed) {
    return "home";
  }

  const segments = trimmed.split("/");
  if (segments[0]?.toLowerCase() === locale.toLowerCase()) {
    segments.shift();
  }

  return segments.join("/") || "home";
}

function buildInitialFormData(fields) {
  return {
    lastname: "",
    ...fields.reduce((accumulator, field) => {
      if (field.isPlatformManaged) {
        return accumulator;
      }

      if (field.type === "CHECKBOX") {
        accumulator[field.key] =
          field.defaultValue === true || field.defaultValue === "true";
        return accumulator;
      }

      accumulator[field.key] = field.defaultValue ?? "";
      return accumulator;
    }, {}),
  };
}

function getRenderableFields(resolvedForm) {
  const fields = resolvedForm?.fields || FALLBACK_FIELDS;
  return fields.filter((field) => !field.isPlatformManaged);
}

function getOptions(field) {
  if (!Array.isArray(field.options)) {
    return [];
  }

  return field.options
    .map((option) => {
      if (typeof option === "string") {
        return { label: option, value: option };
      }

      if (option && typeof option === "object") {
        return {
          label: option.label || option.value || "Option",
          value: option.value || option.label || "",
        };
      }

      return null;
    })
    .filter(Boolean);
}

function validateField(field, value) {
  if (field.required) {
    if (field.type === "CHECKBOX" && !value) {
      return `${field.label} is required`;
    }

    if (field.type !== "CHECKBOX" && String(value ?? "").trim().length === 0) {
      return `${field.label} is required`;
    }
  }

  if (!value && value !== false) {
    return "";
  }

  if (field.key === "name" && String(value).trim()) {
    if (String(value).trim().length < 2) {
      return "Name must be at least 2 characters long";
    }
    if (!nameRegex.test(String(value).trim())) {
      return "Name can only contain letters and spaces";
    }
  }

  if (field.type === "EMAIL" && !emailRegex.test(String(value).trim())) {
    return "Please enter a valid email address";
  }

  if (field.type === "PHONE") {
    const normalized = String(value).trim();
    if (normalized && !/^[0-9+()\-\s]{7,30}$/.test(normalized)) {
      return "Please enter a valid phone number";
    }
  }

  if (
    field.key === "message" &&
    field.type === "MULTI_LINE_TEXT" &&
    String(value).trim().length < 10
  ) {
    return "Message must be at least 10 characters long";
  }

  if (field.type === "SELECT" || field.type === "RADIO") {
    const optionValues = getOptions(field).map((option) => option.value);
    if (optionValues.length > 0 && !optionValues.includes(String(value))) {
      return `${field.label} contains an unsupported option`;
    }
  }

  return "";
}

function baseInputClass(hasError) {
  return `w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition placeholder:text-gray-400 text-base shadow-sm ${
    hasError ? "border-red-400 ring-red-200" : ""
  }`;
}

export default function ContactForm({ formKey = null }) {
  const router = useRouter();
  const [resolvedForm, setResolvedForm] = useState(null);
  const [isLoadingForm, setIsLoadingForm] = useState(hasCmsSubmissionEndpoint);
  const [formData, setFormData] = useState(
    buildInitialFormData(FALLBACK_FIELDS),
  );
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeFields = getRenderableFields(resolvedForm);

  useEffect(() => {
    let cancelled = false;

    async function loadResolvedForm() {
      if (!hasCmsSubmissionEndpoint || !router.isReady) {
        setResolvedForm(null);
        setIsLoadingForm(false);
        setFormData(buildInitialFormData(FALLBACK_FIELDS));
        return;
      }

      setIsLoadingForm(true);
      try {
        const locale = router.locale || "en";
        const pageSlug = resolveSubmissionPageSlug(router.asPath, locale);
        const form = await resolvePublicContactForm({
          pageSlug,
          locale,
          formKey,
        });

        if (cancelled) {
          return;
        }

        setResolvedForm(form);
        setFormData(buildInitialFormData(getRenderableFields(form)));
      } catch (error) {
        if (!cancelled) {
          setResolvedForm(null);
          setFormData(buildInitialFormData(FALLBACK_FIELDS));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingForm(false);
        }
      }
    }

    loadResolvedForm();

    return () => {
      cancelled = true;
    };
  }, [formKey, router.asPath, router.isReady, router.locale]);

  const validateForm = () => {
    const newErrors = {};

    activeFields.forEach((field) => {
      const error = validateField(field, formData[field.key]);
      if (error) {
        newErrors[field.key] = error;
      }
    });

    if (activeFields.length === 0) {
      newErrors.form = [{ message: "No active form fields are configured." }];
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, type, value, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : String(value || ""),
    }));

    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Reset success and errors
    setSuccess(false);
    setErrors({});

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const pageSlug = resolveSubmissionPageSlug(router.asPath, router.locale);
      const locale = router.locale || "en";
      const structuredFields = Object.fromEntries(
        activeFields.map((field) => [field.key, formData[field.key]]),
      );

      await submitContactForm({
        formType: resolvedForm?.formType || "CONTACT",
        formKey: resolvedForm?.key || formKey || undefined,
        formDefinitionId: resolvedForm?.id || undefined,
        formSchemaVersionId: resolvedForm?.schemaVersion?.id || undefined,
        fields: resolvedForm ? structuredFields : undefined,
        name: formData.name,
        email: formData.email,
        message: formData.message,
        pageSlug,
        locale,
        _trap: formData.lastname,
      });
      setFormData(buildInitialFormData(activeFields));
      setSuccess(true);
    } catch (error) {
      setErrors({
        form: error.errors || [
          {
            message:
              error.message || "Failed to send message. Please try again.",
          },
        ],
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      id="contactForm"
      onSubmit={handleSubmit}
      className="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-6 sm:p-8 flex flex-col gap-6 border border-gray-100"
    >
      <input
        type="text"
        name="lastname"
        id="lastname"
        value={formData.lastname}
        onChange={handleInputChange}
        className="hidden"
        tabIndex="-1"
        autoComplete="off"
      />
      <input
        type="hidden"
        name="g-recaptcha-response"
        id="g-recaptcha-response"
        className="hidden"
      />

      {isLoadingForm && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          Loading the latest form configuration...
        </div>
      )}

      {activeFields.map((field) => {
        const value =
          formData[field.key] ?? (field.type === "CHECKBOX" ? false : "");
        const hasError = Boolean(errors[field.key]);

        if (field.type === "MULTI_LINE_TEXT") {
          return (
            <div key={field.key}>
              <textarea
                name={field.key}
                id={field.key}
                value={value}
                onChange={handleInputChange}
                className={`${baseInputClass(hasError)} resize-vertical`}
                placeholder={field.placeholder || field.label}
                rows={5}
                disabled={isSubmitting || isLoadingForm}
              />
              {field.helpText && (
                <div className="mt-1 text-xs text-slate-500">
                  {field.helpText}
                </div>
              )}
              {errors[field.key] && (
                <div className="text-red-500 text-xs mt-1">
                  {errors[field.key]}
                </div>
              )}
            </div>
          );
        }

        if (field.type === "SELECT") {
          return (
            <div key={field.key}>
              <select
                name={field.key}
                id={field.key}
                value={value}
                onChange={handleInputChange}
                className={baseInputClass(hasError)}
                disabled={isSubmitting || isLoadingForm}
              >
                <option value="">
                  {field.placeholder || `Select ${field.label}`}
                </option>
                {getOptions(field).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {field.helpText && (
                <div className="mt-1 text-xs text-slate-500">
                  {field.helpText}
                </div>
              )}
              {errors[field.key] && (
                <div className="text-red-500 text-xs mt-1">
                  {errors[field.key]}
                </div>
              )}
            </div>
          );
        }

        if (field.type === "RADIO") {
          return (
            <div key={field.key} className="space-y-3">
              <div className="text-sm font-medium text-slate-700">
                {field.label}
              </div>
              {getOptions(field).map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-3 text-sm text-slate-700"
                >
                  <input
                    type="radio"
                    name={field.key}
                    value={option.value}
                    checked={value === option.value}
                    onChange={handleInputChange}
                    disabled={isSubmitting || isLoadingForm}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
              {field.helpText && (
                <div className="mt-1 text-xs text-slate-500">
                  {field.helpText}
                </div>
              )}
              {errors[field.key] && (
                <div className="text-red-500 text-xs mt-1">
                  {errors[field.key]}
                </div>
              )}
            </div>
          );
        }

        if (field.type === "CHECKBOX") {
          return (
            <div key={field.key}>
              <label className="flex items-start gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name={field.key}
                  id={field.key}
                  checked={Boolean(value)}
                  onChange={handleInputChange}
                  disabled={isSubmitting || isLoadingForm}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">{field.label}</span>
                  {field.helpText ? (
                    <span className="block text-xs text-slate-500 mt-1">
                      {field.helpText}
                    </span>
                  ) : null}
                </span>
              </label>
              {errors[field.key] && (
                <div className="text-red-500 text-xs mt-1">
                  {errors[field.key]}
                </div>
              )}
            </div>
          );
        }

        const inputType =
          {
            EMAIL: "email",
            PHONE: "tel",
            NUMBER: "number",
            DATE: "date",
          }[field.type] || "text";

        return (
          <div key={field.key}>
            <input
              type={inputType}
              name={field.key}
              id={field.key}
              value={value}
              onChange={handleInputChange}
              className={baseInputClass(hasError)}
              placeholder={field.placeholder || field.label}
              disabled={isSubmitting || isLoadingForm}
            />
            {field.helpText && (
              <div className="mt-1 text-xs text-slate-500">
                {field.helpText}
              </div>
            )}
            {errors[field.key] && (
              <div className="text-red-500 text-xs mt-1">
                {errors[field.key]}
              </div>
            )}
          </div>
        );
      })}

      <button
        type="submit"
        disabled={isSubmitting || isLoadingForm}
        className={`w-full py-3 px-6 rounded-lg bg-linear-to-r from-blue-600 to-blue-500 text-white font-semibold hover:from-blue-700 hover:to-blue-600 transition shadow-md cursor-pointer ${
          (isSubmitting || isLoadingForm) && "opacity-60 cursor-not-allowed"
        }`}
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <svg
              className="animate-spin h-5 w-5 text-white"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="white"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="white"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
            Sending...
          </span>
        ) : isLoadingForm ? (
          "Loading form..."
        ) : (
          "Send Message"
        )}
      </button>

      {errors.form && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-2 text-sm">
          <strong className="font-medium text-red-700">Error:</strong>
          <div className="mt-1 space-y-1">
            {Array.isArray(errors.form) ? (
              errors.form.map((error, index) => (
                <div key={index} className="flex items-start">
                  <span className="text-red-500 mr-2">•</span>
                  <span>{error.message}</span>
                </div>
              ))
            ) : (
              <div>{errors.form}</div>
            )}
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-2 text-sm">
          <strong className="font-medium">Success:</strong> Message sent
          successfully!
        </div>
      )}
    </form>
  );
}
