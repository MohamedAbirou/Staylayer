"use client";

import { submitContactForm } from "@/lib/FormSubmitHandler";
import React, { useState } from "react";

export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const nameRegex = /^[a-zA-Z\s]+$/;

export default function ContactForm() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    const newErrors = {};

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = "Please enter your name";
    } else if (formData.name.trim().length < 2) {
      newErrors.name = "Name must be at least 2 characters long";
    } else if (!nameRegex.test(formData.name.trim())) {
      newErrors.name = "Name can only contain letters and spaces";
    }

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = "Please enter your email";
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    // Message validation
    if (!formData.message.trim()) {
      newErrors.message = "Please enter your message";
    } else if (formData.message.trim().length < 10) {
      newErrors.message = "Message must be at least 10 characters long";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: String(value || ""),
    }));

    // Clear error when user starts typing
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
      const result = await submitContactForm(formData);
      setFormData({ name: "", email: "", message: "" });
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

      {/* Name */}
      <div>
        <input
          type="text"
          name="name"
          id="name"
          value={formData.name}
          onChange={handleInputChange}
          className={`w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition placeholder:text-gray-400 text-base shadow-sm ${
            errors.name && "border-red-400 ring-red-200"
          }`}
          placeholder="Your Name"
          disabled={isSubmitting}
        />
        {errors.name && (
          <div className="text-red-500 text-xs mt-1">{errors.name}</div>
        )}
      </div>

      {/* Email */}
      <div>
        <input
          type="email"
          name="email"
          id="email"
          value={formData.email}
          onChange={handleInputChange}
          className={`w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition placeholder:text-gray-400 text-base shadow-sm ${
            errors.email && "border-red-400 ring-red-200"
          }`}
          placeholder="Email Address"
          disabled={isSubmitting}
        />
        {errors.email && (
          <div className="text-red-500 text-xs mt-1">{errors.email}</div>
        )}
      </div>

      {/* Message */}
      <div>
        <textarea
          name="message"
          id="message"
          value={formData.message}
          onChange={handleInputChange}
          className={`w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition placeholder:text-gray-400 text-base shadow-sm resize-vertical ${
            errors.message ? "border-red-400 ring-red-200" : ""
          }`}
          placeholder="Your Message"
          rows={5}
          disabled={isSubmitting}
        />
        {errors.message && (
          <div className="text-red-500 text-xs mt-1">{errors.message}</div>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className={`w-full py-3 px-6 rounded-lg bg-linear-to-r from-blue-600 to-blue-500 text-white font-semibold hover:from-blue-700 hover:to-blue-600 transition shadow-md cursor-pointer ${
          isSubmitting && "opacity-60 cursor-not-allowed"
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
        ) : (
          "Send Message"
        )}
      </button>

      {/* Error Message */}
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

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-2 text-sm">
          <strong className="font-medium">Success:</strong> Message sent
          successfully!
        </div>
      )}
    </form>
  );
}
