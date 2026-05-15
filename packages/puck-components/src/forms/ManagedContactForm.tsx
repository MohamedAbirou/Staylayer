import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import type {
  ContactRuntimeFieldDefinition,
  ContactRuntimeResolvedForm,
} from "./contact-section-runtime";
import { useContactSectionRuntime } from "./contact-section-runtime";
import { cn } from "../lib/cn";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const nameRegex = /^[a-zA-Z\s]+$/;

const FALLBACK_FIELDS: ContactRuntimeFieldDefinition[] = [
  {
    key: "name",
    label: "Name",
    type: "SINGLE_LINE_TEXT",
    required: true,
    placeholder: "Your Name",
    helpText: "",
    options: [],
    sortOrder: 0,
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
    sortOrder: 1,
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
    sortOrder: 2,
    isPlatformManaged: false,
  },
];

type FormState = Record<string, unknown>;
type FormErrors = Record<string, string>;

export interface ManagedContactFormProps {
  formKey?: string;
  submitLabel?: string;
  submittingLabel?: string;
  successText?: string;
  className?: string;
}

function getSubmissionFields(
  resolvedForm: ContactRuntimeResolvedForm | null,
): ContactRuntimeFieldDefinition[] {
  const fields = resolvedForm?.fields ?? FALLBACK_FIELDS;
  return fields.filter((field) => !field.isPlatformManaged);
}

function getRenderableFields(
  resolvedForm: ContactRuntimeResolvedForm | null,
): ContactRuntimeFieldDefinition[] {
  return getSubmissionFields(resolvedForm).filter(
    (field) => field.type !== "HIDDEN",
  );
}

function buildInitialFormData(
  fields: ContactRuntimeFieldDefinition[],
): FormState {
  return {
    lastname: "",
    ...fields.reduce<FormState>((accumulator, field) => {
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

function getOptions(field: ContactRuntimeFieldDefinition) {
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
    .filter(
      (
        option,
      ): option is {
        label: string;
        value: string;
      } => option !== null,
    );
}

function normalizeString(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function validateField(field: ContactRuntimeFieldDefinition, value: unknown) {
  if (field.required) {
    if (field.type === "CHECKBOX" && !value) {
      return `${field.label} is required`;
    }

    if (
      field.type !== "CHECKBOX" &&
      normalizeString(value).trim().length === 0
    ) {
      return `${field.label} is required`;
    }
  }

  if (!value && value !== false) {
    return "";
  }

  if (field.key === "name" && normalizeString(value).trim()) {
    if (normalizeString(value).trim().length < 2) {
      return "Name must be at least 2 characters long";
    }

    if (!nameRegex.test(normalizeString(value).trim())) {
      return "Name can only contain letters and spaces";
    }
  }

  if (
    field.type === "EMAIL" &&
    !emailRegex.test(normalizeString(value).trim())
  ) {
    return "Please enter a valid email address";
  }

  if (field.type === "PHONE") {
    const normalized = normalizeString(value).trim();
    if (normalized && !/^[0-9+()\-\s]{7,30}$/.test(normalized)) {
      return "Please enter a valid phone number";
    }
  }

  if (
    field.key === "message" &&
    field.type === "MULTI_LINE_TEXT" &&
    normalizeString(value).trim().length < 10
  ) {
    return "Message must be at least 10 characters long";
  }

  if (field.type === "SELECT" || field.type === "RADIO") {
    const optionValues = getOptions(field).map((option) => option.value);
    if (
      optionValues.length > 0 &&
      !optionValues.includes(normalizeString(value))
    ) {
      return `${field.label} contains an unsupported option`;
    }
  }

  return "";
}

function baseInputClass(hasError: boolean) {
  return `w-full rounded-lg border bg-gray-50 px-4 py-3 text-base text-slate-900 shadow-sm transition placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
    hasError ? "border-red-400 ring-red-200" : "border-gray-200"
  }`;
}

function toInputType(field: ContactRuntimeFieldDefinition) {
  switch (field.type) {
    case "EMAIL":
      return "email";
    case "PHONE":
      return "tel";
    case "DATE":
      return "date";
    case "NUMBER":
      return "number";
    default:
      return "text";
  }
}

function extractErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const responseData = (error as { response?: { data?: unknown } }).response
      ?.data;

    if (typeof responseData === "string" && responseData.trim()) {
      return responseData;
    }

    if (responseData && typeof responseData === "object") {
      const message = (responseData as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) {
        return message;
      }
      if (Array.isArray(message)) {
        const joined = message
          .filter((item): item is string => typeof item === "string")
          .join(", ");
        if (joined) {
          return joined;
        }
      }
    }
  }

  return fallback;
}

export function ManagedContactForm({
  formKey = "",
  submitLabel = "Send Message",
  submittingLabel = "Sending...",
  successText = "Thanks. We received your message and will follow up soon.",
  className = "mx-auto max-w-md",
}: ManagedContactFormProps) {
  const runtime = useContactSectionRuntime();
  const pageSlug = runtime?.pageSlug ?? null;
  const locale = runtime?.locale ?? "en";
  const normalizedFormKey = formKey.trim() || undefined;

  const [resolvedForm, setResolvedForm] =
    useState<ContactRuntimeResolvedForm | null>(null);
  const [isLoadingForm, setIsLoadingForm] = useState(
    Boolean(runtime?.resolveForm),
  );
  const [resolutionError, setResolutionError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormState>(() =>
    buildInitialFormData(FALLBACK_FIELDS),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submissionFields = getSubmissionFields(resolvedForm);
  const renderableFields = getRenderableFields(resolvedForm);
  const canSubmit = Boolean(
    runtime?.submitForm && resolvedForm && !isLoadingForm,
  );

  useEffect(() => {
    let cancelled = false;

    async function loadResolvedForm() {
      if (!runtime?.resolveForm) {
        setResolvedForm(null);
        setResolutionError(null);
        setIsLoadingForm(false);
        setFormData(buildInitialFormData(FALLBACK_FIELDS));
        return;
      }

      setIsLoadingForm(true);
      setResolutionError(null);

      try {
        const form = await runtime.resolveForm({
          formKey: normalizedFormKey,
          pageSlug,
          locale,
        });

        if (cancelled) {
          return;
        }

        if (!form) {
          setResolvedForm(null);
          setFormData(buildInitialFormData(FALLBACK_FIELDS));
          setResolutionError("This form is not available yet.");
          return;
        }

        setResolvedForm(form);
        setFormData(buildInitialFormData(getSubmissionFields(form)));
      } catch (error) {
        if (!cancelled) {
          setResolvedForm(null);
          setFormData(buildInitialFormData(FALLBACK_FIELDS));
          setResolutionError(
            extractErrorMessage(error, "Failed to load the inquiry form."),
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingForm(false);
        }
      }
    }

    void loadResolvedForm();

    return () => {
      cancelled = true;
    };
  }, [locale, normalizedFormKey, pageSlug, runtime?.resolveForm]);

  const validateForm = () => {
    const nextErrors: FormErrors = {};

    renderableFields.forEach((field) => {
      const error = validateField(field, formData[field.key]);
      if (error) {
        nextErrors[field.key] = error;
      }
    });

    if (!resolvedForm) {
      nextErrors.form =
        resolutionError ||
        "Choose a published form before submitting an inquiry.";
    }

    if (renderableFields.length === 0) {
      nextErrors.form = "No active form fields are configured for this form.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleInputChange = (
    event: ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const target = event.target;
    const isCheckbox =
      target instanceof HTMLInputElement && target.type === "checkbox";
    setSuccessMessage(null);
    setFormData((previous) => ({
      ...previous,
      [target.name]: isCheckbox ? target.checked : String(target.value || ""),
    }));

    if (errors[target.name] || errors.form) {
      setErrors((previous) => ({
        ...previous,
        [target.name]: "",
        form: "",
      }));
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuccessMessage(null);
    setErrors({});

    if (!validateForm() || !runtime?.submitForm || !resolvedForm) {
      return;
    }

    setIsSubmitting(true);

    try {
      const structuredFields = Object.fromEntries(
        submissionFields.map((field) => [field.key, formData[field.key]]),
      );

      await runtime.submitForm({
        formType: resolvedForm.formType || "CONTACT",
        formKey: resolvedForm.key || normalizedFormKey,
        formDefinitionId: resolvedForm.id,
        formSchemaVersionId: resolvedForm.schemaVersion?.id,
        fields: structuredFields,
        name: normalizeString(formData.name),
        email: normalizeString(formData.email),
        message: normalizeString(formData.message),
        pageSlug,
        locale,
        _trap: normalizeString(formData.lastname),
      });

      const nextMessage = successText;
      setFormData(buildInitialFormData(submissionFields));
      setSuccessMessage(nextMessage);
      runtime.notify?.({ type: "success", message: nextMessage });
    } catch (error) {
      const message = extractErrorMessage(
        error,
        "Failed to submit the inquiry. Please try again.",
      );
      setErrors({ form: message });
      runtime.notify?.({ type: "error", message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      id="contact-form"
      onSubmit={handleSubmit}
      className={cn(
        "flex w-full flex-col gap-5 rounded-2xl border border-gray-100 bg-white p-6 shadow-xl sm:p-8",
        className,
      )}
    >
      <input
        type="text"
        name="lastname"
        value={normalizeString(formData.lastname)}
        onChange={handleInputChange}
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
      />

      {isLoadingForm && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          Loading the inquiry form...
        </div>
      )}

      {resolutionError && !isLoadingForm && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {resolutionError}
        </div>
      )}

      {successMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      )}

      {renderableFields.length === 0 && !isLoadingForm ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
          This form is not available yet.
        </div>
      ) : null}

      {renderableFields.map((field) => {
        const error = errors[field.key];
        const value = formData[field.key];

        if (field.type === "CHECKBOX") {
          return (
            <label
              key={field.key}
              className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-slate-700"
            >
              <input
                type="checkbox"
                name={field.key}
                checked={Boolean(value)}
                onChange={handleInputChange}
                disabled={!canSubmit || isSubmitting}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="flex-1">
                <span className="font-medium text-slate-900">
                  {field.label}
                </span>
                {field.helpText ? (
                  <span className="mt-1 block text-xs text-slate-500">
                    {field.helpText}
                  </span>
                ) : null}
                {error ? (
                  <span className="mt-1 block text-xs text-red-600">
                    {error}
                  </span>
                ) : null}
              </span>
            </label>
          );
        }

        if (field.type === "RADIO") {
          const options = getOptions(field);
          return (
            <fieldset key={field.key} className="space-y-2">
              <legend className="text-sm font-medium text-slate-900">
                {field.label}
              </legend>
              <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                {options.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-3 text-sm text-slate-700"
                  >
                    <input
                      type="radio"
                      name={field.key}
                      value={option.value}
                      checked={normalizeString(value) === option.value}
                      onChange={handleInputChange}
                      disabled={!canSubmit || isSubmitting}
                      className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
              {field.helpText ? (
                <p className="text-xs text-slate-500">{field.helpText}</p>
              ) : null}
              {error ? <p className="text-xs text-red-600">{error}</p> : null}
            </fieldset>
          );
        }

        if (field.type === "SELECT") {
          const options = getOptions(field);
          return (
            <label key={field.key} className="block space-y-2">
              <span className="text-sm font-medium text-slate-900">
                {field.label}
              </span>
              <select
                name={field.key}
                value={normalizeString(value)}
                onChange={handleInputChange}
                disabled={!canSubmit || isSubmitting}
                className={baseInputClass(Boolean(error))}
              >
                {!field.required && <option value="">Select an option</option>}
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {field.helpText ? (
                <p className="text-xs text-slate-500">{field.helpText}</p>
              ) : null}
              {error ? <p className="text-xs text-red-600">{error}</p> : null}
            </label>
          );
        }

        if (field.type === "MULTI_LINE_TEXT") {
          return (
            <label key={field.key} className="block space-y-2">
              <span className="text-sm font-medium text-slate-900">
                {field.label}
              </span>
              <textarea
                name={field.key}
                rows={6}
                value={normalizeString(value)}
                onChange={handleInputChange}
                disabled={!canSubmit || isSubmitting}
                placeholder={field.placeholder || field.label}
                className={`${baseInputClass(Boolean(error))} min-h-32 resize-y`}
              />
              {field.helpText ? (
                <p className="text-xs text-slate-500">{field.helpText}</p>
              ) : null}
              {error ? <p className="text-xs text-red-600">{error}</p> : null}
            </label>
          );
        }

        return (
          <label key={field.key} className="block space-y-2">
            <span className="text-sm font-medium text-slate-900">
              {field.label}
            </span>
            <input
              type={toInputType(field)}
              name={field.key}
              value={normalizeString(value)}
              onChange={handleInputChange}
              disabled={!canSubmit || isSubmitting}
              placeholder={field.placeholder || field.label}
              className={baseInputClass(Boolean(error))}
            />
            {field.helpText ? (
              <p className="text-xs text-slate-500">{field.helpText}</p>
            ) : null}
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
          </label>
        );
      })}

      {errors.form ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errors.form}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={!canSubmit || isSubmitting}
        className="flex h-11 items-center justify-center rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? submittingLabel : submitLabel}
      </button>
    </form>
  );
}
