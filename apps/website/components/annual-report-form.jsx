import React, { useState } from "react";
import Button from "./button";
import { BRAND_NAME } from "@/lib/brand";

export default function AnnualReportForm() {
  const [formErrors, setFormErrors] = useState({});
  const handleSubmit = (event) => {
    event.preventDefault();
    // Handle form submission logic here

    // first name , last name  , email
    const firstName = event.target.firstName.value.trim();
    const lastName = event.target.lastName.value.trim();
    const email = event.target.email.value.trim();

    if (!firstName || !lastName || !email) {
      setFormErrors({
        firstName: !firstName ? "First name is required" : "",
        lastName: !lastName ? "Last name is required" : "",
        email: !email ? "Email is required" : "",
      });
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
      setFormErrors((prevErrors) => ({
        ...prevErrors,
        email: "Please enter a valid email address",
      }));
      return;
    }

    console.log("Form submitted successfully", {
      firstName,
      lastName,
      email,
    });
    setFormErrors({});
  };

  return (
    <>
      <form
        className="max-w-2xl mx-auto p-6 mt-10 bg-white shadow-md rounded-lg"
        onSubmit={handleSubmit}
      >
        <div className="flex gap-6">
          <div className="flex-1">
            <label htmlFor="firstName" className="block mb-2">
              First Name
            </label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              className="w-full p-2 border border-gray-300 rounded"
            />

            {formErrors.firstName && (
              <p className="text-red-500 text-sm mt-1">
                {formErrors.firstName}
              </p>
            )}
          </div>
          <div className="flex-1">
            <label htmlFor="lastName" className="block mb-2">
              Last Name
            </label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              className="w-full p-2 border border-gray-300 rounded"
            />
            {formErrors.lastName && (
              <p className="text-red-500 text-sm mt-1">{formErrors.lastName}</p>
            )}
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="email" className="block mb-2">
            Email Address
          </label>
          <input
            id="email"
            name="email"
            className="w-full p-2 border border-gray-300 rounded"
          />
          {formErrors.email && (
            <p className="text-red-500 text-sm mt-1">{formErrors.email}</p>
          )}
        </div>

        <p className="text-center mx-auto mt-4">
          By downloading, you agree to receive occasional product updates and
          industry insights from {BRAND_NAME}. You can unsubscribe at any time.
        </p>
        <p className="text-center mx-auto mt-6">
          Download the {BRAND_NAME} Annual Report 2025
        </p>

        <div className="flex justify-center mt-6">
          <Button className="text-center">Download</Button>
        </div>
      </form>
    </>
  );
}
