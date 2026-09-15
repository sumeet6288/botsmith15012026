import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Lock, Eye, Database, UserCheck, FileText, Mail } from 'lucide-react';

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back</span>
          </button>
        </div>
      </div>

      <div className="border-b border-gray-200 bg-white py-12 lg:py-14">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-gray-100 rounded-lg">
              <Shield className="w-7 h-7 text-gray-700" />
            </div>
            <h1 className="text-3xl lg:text-4xl font-semibold tracking-tight text-gray-950">
              Privacy Policy
            </h1>
          </div>
          <p className="text-gray-500 text-sm">Last updated: August 1, 2026</p>
          <p className="text-gray-600 mt-4 max-w-3xl leading-7">
            This Privacy Policy explains how BotSmith collects, uses, stores, and protects
            information when you visit our website or use our services.
          </p>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <article className="max-w-4xl">

          <section className="mb-12">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-950 mb-4">1. Information We Collect</h2>
            <p className="text-gray-600 leading-7 mb-4">
              We collect information that you provide directly to BotSmith, information
              generated when you use our Services, and information that may be collected
              automatically through cookies and similar technologies.
            </p>
            <p className="text-gray-600 leading-7 mb-6">
              The information we collect depends on how you interact with BotSmith and the
              features you use.
            </p>

            <div className="space-y-6">
              <div className="border-b border-gray-200 pb-6">
                <h3 className="font-semibold text-gray-950 mb-2">Account Information</h3>
                <p className="text-gray-600 leading-7">
                  When you create or manage a BotSmith account, we may collect your name,
                  email address, password, profile information, organization information,
                  and other information you choose to provide.
                </p>
                <p className="text-gray-600 leading-7 mt-3">
                  We use this information to create and maintain your account, provide access
                  to the Services, communicate with you, and respond to account requests.
                </p>
              </div>

              <div className="border-b border-gray-200 pb-6">
                <h3 className="font-semibold text-gray-950 mb-2">Chatbot and Workspace Data</h3>
                <p className="text-gray-600 leading-7">
                  If you use BotSmith to create or operate chatbots, we may process chatbot
                  names, configurations, knowledge sources, uploaded content, settings,
                  conversations, leads, and analytics associated with those chatbots.
                </p>
                <p className="text-gray-600 leading-7 mt-3">
                  Content you provide may contain information about your organization,
                  customers, students, visitors, or other individuals. You are responsible
                  for ensuring that information submitted to BotSmith may lawfully be processed.
                </p>
              </div>

              <div className="border-b border-gray-200 pb-6">
                <h3 className="font-semibold text-gray-950 mb-2">Usage and Technical Information</h3>
                <p className="text-gray-600 leading-7">
                  We may collect information about how you access and use BotSmith, including
                  access times, pages viewed, browser type, device information, IP address,
                  operating system, referring pages, and interactions with our Services.
                </p>
                <p className="text-gray-600 leading-7 mt-3">
                  This information helps us operate the Services, troubleshoot problems,
                  maintain security, understand usage, and improve performance.
                </p>
              </div>

              <div className="border-b border-gray-200 pb-6">
                <h3 className="font-semibold text-gray-950 mb-2">Payment and Billing Information</h3>
                <p className="text-gray-600 leading-7">
                  If you subscribe to a paid BotSmith plan, billing and payment information
                  may be processed through payment providers. Depending on the payment method,
                  this can include billing details, transaction information, and payment-related
                  identifiers.
                </p>
                <p className="text-gray-600 leading-7 mt-3">
                  Payment card information may be handled directly by the applicable payment
                  processor rather than stored by BotSmith in full.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-950 mb-2">Support Information</h3>
                <p className="text-gray-600 leading-7">
                  When you contact us for support, we may collect the information you choose
                  to provide, including your name, email address, account details, messages,
                  attachments, and information about the issue you are experiencing.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-950 mb-4">2. Information Collected Automatically</h2>
            <p className="text-gray-600 leading-7 mb-4">
              When you visit our website or use our Services, certain information may be
              collected automatically. This can include technical information about your
              browser and device, network information, pages visited, timestamps, and
              interactions with the Services.
            </p>
            <p className="text-gray-600 leading-7 mb-4">
              We may use cookies, pixels, local storage, logs, and similar technologies to
              collect or store some of this information. These technologies are described in
              more detail in our Cookie Policy.
            </p>
            <p className="text-gray-600 leading-7">
              Automatically collected information can help us understand website performance,
              identify errors, protect the Services, measure usage, and improve BotSmith.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-950 mb-4">3. How We Use Your Information</h2>
            <p className="text-gray-600 leading-7 mb-6">
              BotSmith may use information we collect for the following purposes:
            </p>
            <div className="space-y-6">
              <div className="border-b border-gray-200 pb-5">
                <h3 className="font-semibold text-gray-950 mb-2">Provide and operate the Services</h3>
                <p className="text-gray-600 leading-7">
                  To create accounts, operate chatbots, provide requested features, process
                  conversations, maintain workspaces, and deliver the functionality you request.
                </p>
              </div>
              <div className="border-b border-gray-200 pb-5">
                <h3 className="font-semibold text-gray-950 mb-2">Process transactions</h3>
                <p className="text-gray-600 leading-7">
                  To process subscriptions and payments, maintain billing records, and send
                  transaction-related communications.
                </p>
              </div>
              <div className="border-b border-gray-200 pb-5">
                <h3 className="font-semibold text-gray-950 mb-2">Communicate with you</h3>
                <p className="text-gray-600 leading-7">
                  To send service notifications, technical notices, security alerts, account
                  messages, support responses, and other service-related communications.
                </p>
              </div>
              <div className="border-b border-gray-200 pb-5">
                <h3 className="font-semibold text-gray-950 mb-2">Provide customer support</h3>
                <p className="text-gray-600 leading-7">
                  To respond to questions, investigate problems, troubleshoot issues, and
                  provide assistance with your account or Services.
                </p>
              </div>
              <div className="border-b border-gray-200 pb-5">
                <h3 className="font-semibold text-gray-950 mb-2">Improve BotSmith</h3>
                <p className="text-gray-600 leading-7">
                  To understand usage, identify areas for improvement, develop features, and
                  improve reliability and performance.
                </p>
              </div>
              <div className="border-b border-gray-200 pb-5">
                <h3 className="font-semibold text-gray-950 mb-2">Security and abuse prevention</h3>
                <p className="text-gray-600 leading-7">
                  To detect, prevent, investigate, and respond to security incidents, fraud,
                  abuse, unauthorized access, and other harmful or unlawful activity.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-950 mb-2">Legal and compliance purposes</h3>
                <p className="text-gray-600 leading-7">
                  To comply with applicable laws, regulations, legal processes, and enforceable
                  requests, and to protect our rights and legal interests.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-950 mb-4">4. Information Sharing and Disclosure</h2>
            <p className="text-gray-600 leading-7 mb-6">
              We do not sell your personal information. We may share information only when
              reasonably necessary to provide the Services, operate our business, comply with
              law, or protect our rights.
            </p>
            <div className="space-y-7">
              <div>
                <h3 className="font-semibold text-gray-950 mb-2">Service Providers</h3>
                <p className="text-gray-600 leading-7">
                  We may work with providers for hosting, infrastructure, analytics,
                  authentication, customer support, payment processing, security,
                  communications, and other operational services.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-950 mb-2">With Your Consent or Direction</h3>
                <p className="text-gray-600 leading-7">
                  We may share information when you instruct us to do so, authorize an
                  integration, or provide consent where consent is required.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-950 mb-2">Legal Requirements</h3>
                <p className="text-gray-600 leading-7">
                  We may disclose information when required by applicable law, regulation,
                  legal process, court order, or valid governmental request, or when reasonably
                  necessary to protect BotSmith, our users, or others.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-950 mb-2">Business Transfers</h3>
                <p className="text-gray-600 leading-7">
                  If BotSmith is involved in a merger, acquisition, financing, reorganization,
                  sale of assets, or similar transaction, information may be transferred as
                  part of that transaction, subject to applicable requirements.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-950 mb-4">5. Artificial Intelligence and Service Processing</h2>
            <p className="text-gray-600 leading-7 mb-4">
              BotSmith provides AI-powered chatbot functionality. To provide these features,
              information submitted to or generated through the Services may be processed by
              BotSmith and, where applicable, third-party infrastructure or AI service providers
              used to operate the platform.
            </p>
            <p className="text-gray-600 leading-7 mb-4">
              This may include chatbot configuration, knowledge content, user messages,
              conversation context, and other information necessary to generate responses or
              provide related functionality.
            </p>
            <p className="text-gray-600 leading-7">
              You should avoid submitting sensitive personal information to a chatbot or
              knowledge source unless you have a legitimate reason to do so and have determined
              that the intended processing is appropriate for your use case.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-950 mb-4">6. Data Security</h2>
            <p className="text-gray-600 leading-7 mb-4">
              We take reasonable measures designed to protect information processed through
              BotSmith against unauthorized access, alteration, disclosure, or destruction.
              These measures may include access controls, authentication, encrypted transmission,
              monitoring, and other technical and organizational safeguards.
            </p>
            <p className="text-gray-600 leading-7 mb-4">
              Information transmitted between your browser and our Services may be protected
              using industry-standard transport encryption such as HTTPS/TLS where supported.
            </p>
            <p className="text-gray-600 leading-7">
              No method of transmission or storage is completely secure. We therefore cannot
              guarantee absolute security of information transmitted to or stored by BotSmith.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-950 mb-4">7. Data Retention</h2>
            <p className="text-gray-600 leading-7 mb-4">
              We retain information for as long as reasonably necessary to provide our Services,
              maintain business and transaction records, resolve disputes, enforce agreements,
              comply with legal obligations, and protect our legitimate interests.
            </p>
            <p className="text-gray-600 leading-7">
              Retention periods may vary depending on the type of information, why it was
              collected, whether your account remains active, and applicable legal or operational
              requirements. When information is no longer required, we may delete, anonymize,
              or otherwise dispose of it.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-950 mb-4">8. Your Rights and Choices</h2>
            <p className="text-gray-600 leading-7 mb-6">
              Depending on where you live and applicable law, you may have certain rights
              regarding personal information associated with you.
            </p>
            <div className="space-y-5">
              <div><h3 className="font-semibold text-gray-950 mb-2">Access</h3><p className="text-gray-600 leading-7">Request access to personal information we hold about you.</p></div>
              <div><h3 className="font-semibold text-gray-950 mb-2">Correction</h3><p className="text-gray-600 leading-7">Request that inaccurate or incomplete information be corrected.</p></div>
              <div><h3 className="font-semibold text-gray-950 mb-2">Deletion</h3><p className="text-gray-600 leading-7">Request deletion of personal information, subject to applicable exceptions.</p></div>
              <div><h3 className="font-semibold text-gray-950 mb-2">Portability</h3><p className="text-gray-600 leading-7">Request a copy of certain information in a portable format where applicable.</p></div>
              <div><h3 className="font-semibold text-gray-950 mb-2">Restriction or Objection</h3><p className="text-gray-600 leading-7">Request restriction of, or object to, certain processing where applicable.</p></div>
              <div><h3 className="font-semibold text-gray-950 mb-2">Marketing Preferences</h3><p className="text-gray-600 leading-7">Opt out of promotional communications. Essential service and account messages may still be sent.</p></div>
            </div>
            <p className="text-gray-600 leading-7 mt-6">
              The availability and scope of these rights depends on applicable law. We may
              need to verify your identity before completing certain requests.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-950 mb-4">9. Cookies and Similar Technologies</h2>
            <p className="text-gray-600 leading-7 mb-4">
              BotSmith uses cookies and similar technologies for purposes such as authentication,
              security, preferences, analytics, performance measurement, and website functionality.
            </p>
            <p className="text-gray-600 leading-7">
              For additional information about the types of cookies we use and how you can
              control them, please review our Cookie Policy.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-950 mb-4">10. Third-Party Services and Links</h2>
            <p className="text-gray-600 leading-7 mb-4">
              BotSmith may integrate with or link to third-party websites and services,
              including payment providers, analytics services, infrastructure providers,
              AI providers, communication services, and other integrations.
            </p>
            <p className="text-gray-600 leading-7">
              Third parties may process information according to their own privacy policies
              and terms. BotSmith does not control the privacy practices of independent third
              parties.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-950 mb-4">11. Children's Privacy</h2>
            <p className="text-gray-600 leading-7 mb-4">
              BotSmith is not intended to knowingly collect personal information directly
              from children under 13. We do not knowingly request personal information from
              children under 13 for the purpose of creating accounts or using the Services.
            </p>
            <p className="text-gray-600 leading-7">
              If you believe that a child has provided personal information to BotSmith,
              please contact us so that we can review the situation and take appropriate action.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-950 mb-4">12. International Data Processing</h2>
            <p className="text-gray-600 leading-7 mb-4">
              Depending on where you live and where our service providers operate, information
              processed through BotSmith may be stored or processed in countries other than
              the country in which you live.
            </p>
            <p className="text-gray-600 leading-7">
              Where applicable, we take steps intended to provide appropriate safeguards for
              international transfers and process information in accordance with applicable
              privacy and data protection requirements.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-950 mb-4">13. Business and Organization Users</h2>
            <p className="text-gray-600 leading-7 mb-4">
              If you use BotSmith on behalf of an organization, you may provide information
              relating to employees, customers, students, website visitors, or other users
              of your chatbot.
            </p>
            <p className="text-gray-600 leading-7">
              Your organization may be responsible for determining the purposes and lawful
              basis for processing that information. You should ensure that your use of
              BotSmith complies with applicable privacy and data protection requirements.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-950 mb-4">14. Communications</h2>
            <p className="text-gray-600 leading-7 mb-4">
              We may send communications necessary to operate your account and provide the
              Services, including verification messages, billing notices, security alerts,
              service announcements, and support responses.
            </p>
            <p className="text-gray-600 leading-7">
              Where permitted by law, we may also send optional product or marketing
              communications. You can generally opt out of promotional communications by
              following the unsubscribe instructions in those messages.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-950 mb-4">15. Legal Bases for Processing</h2>
            <p className="text-gray-600 leading-7 mb-4">
              Where applicable law requires a legal basis for processing personal information,
              the basis may depend on the purpose of the processing and the context in which
              information is collected.
            </p>
            <p className="text-gray-600 leading-7 mb-4">
              Potential legal bases may include performing a contract with you, complying
              with legal obligations, pursuing legitimate interests, or obtaining consent
              where consent is required.
            </p>
            <p className="text-gray-600 leading-7">
              The applicable legal basis can vary depending on the jurisdiction and the
              particular processing activity.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-950 mb-4">16. Changes to This Privacy Policy</h2>
            <p className="text-gray-600 leading-7 mb-4">
              We may update this Privacy Policy from time to time to reflect changes to our
              Services, business practices, technology, legal requirements, or privacy practices.
            </p>
            <p className="text-gray-600 leading-7">
              When we make changes, we will update the “Last updated” date at the top of this
              page. We encourage you to review this Privacy Policy periodically.
            </p>
          </section>

          <section className="border-t border-gray-200 pt-10">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-950 mb-4">17. Contact Us</h2>
            <p className="text-gray-600 leading-7 mb-5">
              If you have questions about this Privacy Policy, want to exercise a privacy
              right, or have concerns about how your information is handled, please contact us.
            </p>
            <div className="border border-gray-200 rounded-lg p-6">
              <p className="text-gray-700 text-sm mb-3">
                <strong>Privacy:</strong> privacy@botsmith.pro
              </p>
              <p className="text-gray-700 text-sm">
                <strong>Data Protection:</strong> dpo@botsmith.pro
              </p>
            </div>
          </section>

        </article>
      </main>
    </div>
  );
};

export default PrivacyPolicy;