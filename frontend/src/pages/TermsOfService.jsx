import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';

const TermsOfService = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        </div>
      </header>

      {/* Page Header */}
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-7 h-7 text-gray-700" />
            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">
              Terms of Service
            </h1>
          </div>
          <p className="text-sm text-gray-500 mb-5">
            Last updated: February 2026
          </p>
          <p className="max-w-3xl text-base lg:text-lg leading-8 text-gray-600">
            These Terms of Service govern your access to and use of BotSmith.
            Please read them carefully. By accessing or using the Service, you
            agree to be bound by these Terms.
          </p>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10 lg:py-14">
        <article className="max-w-3xl text-gray-700">

          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              1. Acceptance of Terms
            </h2>
            <p className="leading-8 mb-4">
              By accessing and using BotSmith ("Service"), you accept and agree
              to be bound by these Terms of Service and any applicable policies
              referenced in them. If you do not agree to these Terms, you must
              not access or use the Service.
            </p>
            <p className="leading-8">
              These Terms apply to visitors, registered users, customers, and
              other individuals or organizations that access or use BotSmith.
              Additional terms may apply to particular features or services
              where expressly stated.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              2. User Accounts
            </h2>
            <p className="leading-8 mb-4">
              Some features of BotSmith require you to create an account. You
              agree to provide accurate, current, and complete information and
              to keep that information updated when necessary.
            </p>
            <p className="leading-8 mb-4">
              You are responsible for maintaining the confidentiality of your
              account credentials and for activities performed through your
              account. You must notify BotSmith promptly if you believe your
              account has been accessed or used without authorization.
            </p>
            <p className="leading-8">
              You must be at least 13 years old to use BotSmith. If you are
              under 18, you must have the permission of a parent or legal
              guardian where required by applicable law.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              3. Acceptable Use
            </h2>
            <p className="leading-8 mb-4">
              You may use BotSmith only for lawful purposes and in accordance
              with these Terms. You agree not to misuse the Service or use it
              in a way that could harm BotSmith, other users, or third parties.
            </p>
            <p className="leading-8 mb-3">You must not:</p>
            <ul className="list-disc pl-6 space-y-2 leading-7">
              <li>Use the Service for illegal, harmful, fraudulent, or abusive activities.</li>
              <li>Send spam, unsolicited messages, or content intended to harass, threaten, or deceive others.</li>
              <li>Interfere with, disrupt, overload, or attempt to compromise the Service or its infrastructure.</li>
              <li>Attempt to gain unauthorized access to accounts, systems, data, or portions of the Service.</li>
              <li>Use the Service to violate another person's intellectual property, privacy, or other legal rights.</li>
              <li>Attempt to bypass usage limits, security controls, authentication, or other technical restrictions.</li>
              <li>Reverse engineer, decompile, or otherwise attempt to extract source code from the Service except where applicable law permits it.</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              4. Your Content
            </h2>
            <p className="leading-8 mb-4">
              You retain ownership of content that you submit to BotSmith,
              including chatbot configurations, source materials, documents,
              instructions, and other content you provide or create through the
              Service ("Your Content").
            </p>
            <p className="leading-8 mb-4">
              You are responsible for ensuring that you have the rights,
              permissions, and lawful basis necessary to submit and use Your
              Content with BotSmith.
            </p>
            <p className="leading-8">
              You grant BotSmith the rights necessary to host, store, process,
              transmit, and otherwise use Your Content solely as reasonably
              necessary to provide, maintain, secure, and improve the Service,
              subject to applicable law and our Privacy Policy.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              5. BotSmith Intellectual Property
            </h2>
            <p className="leading-8 mb-4">
              The Service and its original software, interface, features,
              documentation, branding, logos, designs, and other materials are
              owned by BotSmith or its licensors and are protected by applicable
              intellectual property laws.
            </p>
            <p className="leading-8">
              Except for the limited rights expressly granted to you under
              these Terms, no ownership rights are transferred to you. You may
              not use BotSmith branding, trademarks, or proprietary materials
              without prior authorization.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              6. Subscriptions and Payments
            </h2>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Billing</h3>
            <p className="leading-8 mb-5">
              Subscription fees are billed according to the plan and billing
              period selected by you. You agree to pay all applicable fees and
              taxes associated with your subscription.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mb-2">Renewal</h3>
            <p className="leading-8 mb-5">
              Where automatic renewal applies to your selected plan, your
              subscription may renew for another billing period unless you
              cancel before the applicable renewal date.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mb-2">Refunds</h3>
            <p className="leading-8 mb-5">
              Refunds are handled according to the applicable refund terms for
              your plan or transaction. If you have a billing concern, contact
              BotSmith support so the matter can be reviewed.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mb-2">Price Changes</h3>
            <p className="leading-8">
              BotSmith may change subscription pricing from time to time. Where
              required, we will provide notice before a material price change
              takes effect. Continued use after the effective date may be
              subject to the updated pricing.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              7. Usage Limits and Service Restrictions
            </h2>
            <p className="leading-8 mb-4">
              Plans may include limits on features, chatbots, messages, source
              materials, storage, or other resources. Your ability to use
              particular features may depend on your subscription plan and
              applicable account limits.
            </p>
            <p className="leading-8">
              BotSmith may restrict or suspend an operation when an applicable
              usage limit has been reached, or when necessary to protect the
              Service from abuse, security threats, or excessive use.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              8. AI-Generated Content
            </h2>
            <p className="leading-8 mb-4">
              BotSmith uses artificial intelligence and related technologies to
              generate responses and assist with chatbot functionality.
              AI-generated output may be incomplete, inaccurate, outdated, or
              inappropriate for a particular situation.
            </p>
            <p className="leading-8">
              You are responsible for reviewing and evaluating AI-generated
              output before relying on it, publishing it, or using it to make
              decisions. BotSmith does not guarantee that AI-generated
              responses will always be accurate or suitable for your intended
              purpose.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              9. Third-Party Services
            </h2>
            <p className="leading-8 mb-4">
              BotSmith may integrate with or rely on third-party services,
              infrastructure providers, payment processors, AI providers, or
              other external services.
            </p>
            <p className="leading-8">
              Third-party services may be governed by their own terms and
              policies. BotSmith is not responsible for third-party services to
              the extent permitted by applicable law.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              10. Privacy and Data
            </h2>
            <p className="leading-8 mb-4">
              Your use of BotSmith is also subject to the BotSmith Privacy
              Policy. The Privacy Policy describes how information may be
              collected, used, stored, and processed.
            </p>
            <p className="leading-8">
              You are responsible for ensuring that content and personal
              information you provide to BotSmith may lawfully be processed in
              connection with your use of the Service.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              11. Security
            </h2>
            <p className="leading-8">
              We take reasonable measures designed to protect the Service and
              information processed through it. However, no internet-based
              service can be guaranteed to be completely secure. You are also
              responsible for maintaining appropriate security for your account,
              credentials, devices, and content.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              12. Suspension and Termination
            </h2>
            <p className="leading-8 mb-4">
              You may stop using the Service at any time and may cancel your
              account or subscription according to the available account
              controls and applicable plan terms.
            </p>
            <p className="leading-8 mb-3">
              BotSmith may suspend or terminate access where reasonably
              necessary, including in connection with:
            </p>
            <ul className="list-disc pl-6 space-y-2 leading-7">
              <li>A material breach of these Terms.</li>
              <li>Non-payment of applicable fees.</li>
              <li>Violation of applicable laws or regulations.</li>
              <li>Fraud, abuse, security threats, or misuse of the Service.</li>
              <li>Other circumstances where suspension or termination is permitted by applicable law.</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              13. Disclaimer of Warranties
            </h2>
            <p className="leading-8 uppercase">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE SERVICE IS PROVIDED
              "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER
              EXPRESS, IMPLIED, OR STATUTORY. BOTSMITH DOES NOT WARRANT THAT THE
              SERVICE WILL BE UNINTERRUPTED, SECURE, ERROR-FREE, OR THAT
              AI-GENERATED OUTPUT WILL ALWAYS BE ACCURATE OR RELIABLE.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              14. Limitation of Liability
            </h2>
            <p className="leading-8 mb-4 uppercase">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, BOTSMITH SHALL NOT BE
              LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
              PUNITIVE DAMAGES, OR FOR LOSS OF PROFITS, REVENUE, DATA, GOODWILL,
              OR BUSINESS OPPORTUNITIES ARISING FROM OR RELATED TO YOUR USE OF
              THE SERVICE.
            </p>
            <p className="leading-8">
              To the extent permitted by applicable law, BotSmith's total
              liability arising from or relating to the Service shall not exceed
              the amount you paid to BotSmith for the Service during the
              twelve-month period preceding the event giving rise to the claim.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              15. Indemnification
            </h2>
            <p className="leading-8">
              To the extent permitted by applicable law, you agree to defend,
              indemnify, and hold harmless BotSmith and its officers, directors,
              employees, and agents from claims, damages, losses, liabilities,
              and expenses arising from your unlawful use of the Service, Your
              Content, or your violation of these Terms or applicable law.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              16. Governing Law
            </h2>
            <p className="leading-8">
              These Terms shall be governed by and construed in accordance with
              the laws applicable to BotSmith and its operation, without regard
              to conflict-of-law principles, except where applicable law
              requires otherwise.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              17. Changes to These Terms
            </h2>
            <p className="leading-8">
              BotSmith may update these Terms from time to time. When changes
              are material, we may provide notice through the Service, by email,
              or by another appropriate method. The updated Terms will become
              effective as stated in the revised Terms. Your continued use of
              the Service after the effective date constitutes acceptance of the
              updated Terms to the extent permitted by law.
            </p>
          </section>

          <section className="border-t border-gray-200 pt-8 mt-14">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              18. Contact Us
            </h2>
            <p className="leading-8 mb-4">
              If you have questions about these Terms of Service, please
              contact BotSmith:
            </p>
            <p className="leading-8">
              <strong>Email:</strong> legal@botsmith.pro
            </p>
          </section>

        </article>
      </main>
    </div>
  );
};

export default TermsOfService;
