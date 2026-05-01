/**
 * Contact form API service
 * Handles form submissions to Formspree
 */

const FORMSPREE_ENDPOINT = "https://formspree.io/f/mblypnzk";

export const submitContactForm = async (formData) => {
  const response = await fetch(FORMSPREE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: formData.name,
      email: formData.email,
      message: formData.message,
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    // Create an error with the full errors array
    const error = new Error("Form submission failed");
    error.errors = result.errors || [
      { message: result.error || "Failed to send message" },
    ];

    throw error;
  }
  return result;
};
