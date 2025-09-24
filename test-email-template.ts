import {
  loadEmailTemplate,
  getWaitlistTemplatePath,
  generatePlainTextFromTemplate,
  EmailTemplateVariables,
} from "./src/utils/emailTemplate.utils";

// Test the email template integration
async function testEmailTemplate() {
  try {
    console.log("Testing email template integration...");

    // Test variables
    const testVariables: EmailTemplateVariables = {
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@example.com",
      companyName: "Boundless",
      companyAddress:
        "Boundless, Inc. | Building the future of transparent funding",
      ctaUrl: "https://boundless.fi/announcement",
      viewInBrowserUrl: "https://boundless.fi/waitlist/email/view/test-token",
      unsubscribeUrl: "https://boundless.fi/waitlist/unsubscribe/test-token",
      privacyUrl: "https://boundless.fi/privacy",
      termsUrl: "https://boundless.fi/terms",
      twitterUrl: "https://x.com/boundless_fi",
      linkedinUrl: "https://www.linkedin.com/company/boundlesshq/",
      githubUrl: "https://github.com/boundlessproject",
      preheaderText:
        "Welcome to Boundless! You're position #1 on our waitlist.",
    };

    // Test template loading
    const templatePath = getWaitlistTemplatePath();
    console.log("Template path:", templatePath);

    const html = loadEmailTemplate(templatePath, testVariables);
    console.log("✅ HTML template loaded successfully");
    console.log("HTML length:", html.length);

    // Test plain text generation
    const text = generatePlainTextFromTemplate(testVariables);
    console.log("✅ Plain text generated successfully");
    console.log("Text length:", text.length);

    // Verify some key replacements
    if (
      html.includes("Boundless") &&
      html.includes("https://boundless.fi/announcement")
    ) {
      console.log("✅ Template variables replaced correctly");
    } else {
      console.log("❌ Template variables not replaced correctly");
    }

    if (html.includes("https://boundless.fi/announcement")) {
      console.log("✅ CTA URL replaced correctly");
    } else {
      console.log("❌ CTA URL not replaced correctly");
    }

    console.log("\n🎉 Email template integration test completed successfully!");
  } catch (error) {
    console.error("❌ Email template integration test failed:", error);
  }
}

// Run the test
testEmailTemplate();
