import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Cookie, Settings, BarChart3, Shield, Check, Info, Clock } from 'lucide-react';

const CookiePolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header */}
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

      {/* Page Header */}
      <div className="border-b border-gray-200 bg-white py-12 lg:py-14">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-gray-100 rounded-lg">
              <Cookie className="w-7 h-7 text-gray-700" />
            </div>
            <h1 className="text-3xl lg:text-4xl font-semibold tracking-tight text-gray-950">
              Cookie Policy
            </h1>
          </div>
          <p className="text-gray-500 text-sm">Last updated: August 1, 2026</p>
          <p className="text-gray-600 mt-4 max-w-3xl leading-7">
            This Cookie Policy explains how BotSmith uses cookies and similar technologies
            when you visit our website or use our services.
          </p>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <article className="max-w-4xl">

          <section className="mb-12">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-950 mb-4">
              1. What is a cookie?
            </h2>
            <p className="text-gray-600 leading-7 mb-4">
              Cookies may also allow a website to distinguish one browser session from
              another. They are commonly used to maintain state when a user moves between
              pages or returns to a service after a period of time.
            </p>
            <p className="text-gray-600 leading-7 mb-4">
              Cookies are small text files that are placed on your computer, phone, tablet,
              or other device when you visit a website. They allow a website to recognize
              your browser and remember certain information between visits.
            </p>
            <p className="text-gray-600 leading-7">
              Some cookies are temporary and are deleted when you close your browser.
              Others remain on your device for a defined period or until you delete them.
              BotSmith may also use similar technologies, such as pixels, tags, or local
              storage, for purposes similar to cookies.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-950 mb-4">
              2. Does BotSmith use cookies?
            </h2>
            <p className="text-gray-600 leading-7 mb-4">
              The particular cookies present may vary depending on the BotSmith product,
              page, browser, device, account state, and third-party services active at the
              time of your visit. We may also change the technologies we use as our platform
              develops.
            </p>
            <p className="text-gray-600 leading-7 mb-4">
              Yes. BotSmith may use cookies and similar technologies on its website,
              dashboard, documentation, and services. These technologies can help us keep
              users signed in, protect our services, remember preferences, understand
              website usage, and improve the BotSmith experience.
            </p>
            <p className="text-gray-600 leading-7">
              Cookies may be set directly by BotSmith or by third-party services that
              provide functionality such as analytics, authentication, payments, security,
              or other services used by our platform.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-950 mb-4">
              3. How does BotSmith use cookies?
            </h2>
            <p className="text-gray-600 leading-7 mb-4">
              Cookies do not all perform the same function. Some are necessary to provide
              a service you have requested, while others provide information that helps us
              understand and improve the website. Where a cookie is optional, you may have
              choices about whether it is enabled.
            </p>
            <p className="text-gray-600 leading-7 mb-6">
              Depending on how you interact with BotSmith, cookies may be used for the
              following purposes:
            </p>

            <div className="space-y-6">
              <div className="border-b border-gray-200 pb-6">
                <h3 className="font-semibold text-gray-950 mb-2">Authentication</h3>
                <p className="text-gray-600 leading-7">
                  Cookies can help keep you signed in and allow BotSmith to associate your
                  browser with the appropriate account, workspace, or session.
                </p>
              </div>

              <div className="border-b border-gray-200 pb-6">
                <h3 className="font-semibold text-gray-950 mb-2">Security</h3>
                <p className="text-gray-600 leading-7">
                  Cookies and related technologies may be used to support security controls,
                  protect accounts and sessions, and help detect suspicious or malicious
                  activity.
                </p>
              </div>

              <div className="border-b border-gray-200 pb-6">
                <h3 className="font-semibold text-gray-950 mb-2">Preferences and functionality</h3>
                <p className="text-gray-600 leading-7">
                  Cookies can remember settings and preferences so that you do not have to
                  provide the same information every time you use BotSmith.
                </p>
              </div>

              <div className="border-b border-gray-200 pb-6">
                <h3 className="font-semibold text-gray-950 mb-2">Performance and analytics</h3>
                <p className="text-gray-600 leading-7">
                  Analytics technologies may help us understand which pages and features
                  are used, how visitors navigate the website, and how well our services
                  perform. This information can be used to improve our products and services.
                </p>
              </div>

              <div className="pb-2">
                <h3 className="font-semibold text-gray-950 mb-2">Marketing</h3>
                <p className="text-gray-600 leading-7">
                  Where applicable, cookies or similar technologies may be used to measure
                  the effectiveness of marketing campaigns and understand interactions with
                  our website. Any third-party technology used for these purposes remains
                  subject to the provider's own policies.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-950 mb-4">
              4. Types of cookies
            </h2>
            <p className="text-gray-600 leading-7 mb-6">
              The categories below are intended to explain the purposes for which cookies
              may be used rather than provide an exhaustive list of every individual cookie.
              Cookie names and providers can change as our technology stack changes.
            </p>
            <p className="text-gray-600 leading-7 mb-6">
              Cookies can generally be grouped into the following categories:
            </p>

            <div className="space-y-5">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                <div className="flex items-center gap-3 mb-2">
                  <Shield className="w-5 h-5 text-gray-600" />
                  <h3 className="font-semibold text-gray-950">Strictly Necessary Cookies</h3>
                  <span className="ml-auto text-xs font-medium text-gray-500 border border-gray-300 rounded-full px-2.5 py-1">
                    Required
                  </span>
                </div>
                <p className="text-gray-600 text-sm leading-6">
                  These cookies support core functions such as authentication, session
                  management, security, and other features required for the website or
                  service to operate.
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                <div className="flex items-center gap-3 mb-2">
                  <Settings className="w-5 h-5 text-gray-600" />
                  <h3 className="font-semibold text-gray-950">Functional Cookies</h3>
                  <span className="ml-auto text-xs font-medium text-gray-500 border border-gray-300 rounded-full px-2.5 py-1">
                    Optional
                  </span>
                </div>
                <p className="text-gray-600 text-sm leading-6">
                  These cookies support preferences and enhanced functionality, such as
                  remembering settings or choices you make while using BotSmith.
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                <div className="flex items-center gap-3 mb-2">
                  <BarChart3 className="w-5 h-5 text-gray-600" />
                  <h3 className="font-semibold text-gray-950">Analytics Cookies</h3>
                  <span className="ml-auto text-xs font-medium text-gray-500 border border-gray-300 rounded-full px-2.5 py-1">
                    Optional
                  </span>
                </div>
                <p className="text-gray-600 text-sm leading-6">
                  These cookies help us measure visits, traffic, feature usage, and
                  performance so we can understand and improve our website and services.
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                <div className="flex items-center gap-3 mb-2">
                  <Info className="w-5 h-5 text-gray-600" />
                  <h3 className="font-semibold text-gray-950">Marketing Cookies</h3>
                  <span className="ml-auto text-xs font-medium text-gray-500 border border-gray-300 rounded-full px-2.5 py-1">
                    Optional
                  </span>
                </div>
                <p className="text-gray-600 text-sm leading-6">
                  Where used, these technologies may help measure marketing campaigns,
                  understand website interactions, and provide more relevant communications.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-950 mb-4">
              5. Third-party cookies
            </h2>
            <p className="text-gray-600 leading-7 mb-4">
              For example, a third-party service may place a cookie to maintain a secure
              session, process a payment, measure traffic, or provide an embedded feature.
              The presence of a third-party cookie does not necessarily mean that BotSmith
              receives all information collected by that provider.
            </p>
            <p className="text-gray-600 leading-7 mb-4">
              Some functionality on BotSmith may be provided by third-party services.
              Those providers may use cookies or similar technologies to provide their
              services, measure performance, process payments, maintain security, or
              provide other functionality.
            </p>
            <p className="text-gray-600 leading-7">
              Third-party cookies are controlled by the relevant third party and may be
              subject to that provider's privacy and cookie policies. BotSmith does not
              control cookies placed by websites or services that are outside BotSmith's
              own systems.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-950 mb-4">
              6. How can you control cookies?
            </h2>
            <p className="text-gray-600 leading-7 mb-6">
              You can control or delete cookies through your browser settings. Most
              browsers allow you to:
            </p>
            <div className="space-y-3 mb-6">
              {[
                "Delete cookies that have already been stored on your device.",
                "Block cookies from being set in the future.",
                "Allow cookies only from websites you trust.",
                "Configure your browser to delete cookies when you close it."
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-gray-600 mt-1 flex-shrink-0" />
                  <span className="text-gray-600 text-sm leading-6">{item}</span>
                </div>
              ))}
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
              <h3 className="font-semibold text-gray-950 mb-2">Important</h3>
              <p className="text-gray-600 text-sm leading-6">
                Disabling strictly necessary cookies may prevent some parts of BotSmith
                from working correctly. Optional cookies can generally be disabled without
                affecting core functionality.
              </p>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-950 mb-4">
              7. Cookie duration
            </h2>
            <div className="grid md:grid-cols-2 gap-5">
              <div className="border border-gray-200 rounded-lg p-5">
                <div className="flex items-center gap-3 mb-3">
                  <Clock className="w-5 h-5 text-gray-600" />
                  <h3 className="font-semibold text-gray-950">Session Cookies</h3>
                </div>
                <p className="text-gray-600 text-sm leading-6">
                  These cookies are temporary and normally expire when you close your browser
                  or when the relevant session ends.
                </p>
              </div>
              <div className="border border-gray-200 rounded-lg p-5">
                <div className="flex items-center gap-3 mb-3">
                  <Clock className="w-5 h-5 text-gray-600" />
                  <h3 className="font-semibold text-gray-950">Persistent Cookies</h3>
                </div>
                <p className="text-gray-600 text-sm leading-6">
                  These cookies remain on your device for a defined period or until they
                  are deleted or expire.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-950 mb-4">
              8. Do Not Track signals
            </h2>
            <p className="text-gray-600 leading-7">
              Web browsers may provide a “Do Not Track” setting. Because there is currently
              no universally accepted standard for interpreting these signals, BotSmith may
              not respond to all browser-based Do Not Track signals. Your available cookie
              choices and browser controls remain available for managing cookies.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-950 mb-4">
              9. Third-party websites
            </h2>
            <p className="text-gray-600 leading-7">
              BotSmith may link to or integrate with third-party websites and services.
              Those websites may place their own cookies and have their own privacy and
              cookie practices. We recommend reviewing the policies of those third parties
              before providing information or using their services.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-950 mb-4">
              10. Changes to this Cookie Policy
            </h2>
            <p className="text-gray-600 leading-7">
              We may update this Cookie Policy from time to time to reflect changes to our
              services, technologies, legal requirements, or privacy practices. When we
              make changes, we will update the “Last updated” date at the top of this page.
            </p>
          </section>


          <section className="mb-12">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-950 mb-4">
              Cookie reference
            </h2>
            <p className="text-gray-600 leading-7 mb-5">
              The table below provides a high-level description of common cookie purposes.
              It is intended as a practical reference and not as a guarantee that every
              cookie listed will be active on every BotSmith page at all times.
            </p>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-gray-900">Purpose</th>
                    <th className="px-4 py-3 font-semibold text-gray-900">Typical use</th>
                    <th className="px-4 py-3 font-semibold text-gray-900">Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="px-4 py-4 text-gray-900 font-medium">Authentication</td>
                    <td className="px-4 py-4 text-gray-600">Maintaining secure login and account sessions.</td>
                    <td className="px-4 py-4 text-gray-600">Necessary</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-4 text-gray-900 font-medium">Security</td>
                    <td className="px-4 py-4 text-gray-600">Supporting fraud prevention and protection against abuse.</td>
                    <td className="px-4 py-4 text-gray-600">Necessary</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-4 text-gray-900 font-medium">Preferences</td>
                    <td className="px-4 py-4 text-gray-600">Remembering selected settings and preferences.</td>
                    <td className="px-4 py-4 text-gray-600">Functional</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-4 text-gray-900 font-medium">Analytics</td>
                    <td className="px-4 py-4 text-gray-600">Understanding traffic, usage, and product performance.</td>
                    <td className="px-4 py-4 text-gray-600">Optional</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-4 text-gray-900 font-medium">Marketing</td>
                    <td className="px-4 py-4 text-gray-600">Measuring campaign interactions where applicable.</td>
                    <td className="px-4 py-4 text-gray-600">Optional</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="border-t border-gray-200 pt-10">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-950 mb-4">
              11. Contact us
            </h2>
            <p className="text-gray-600 leading-7 mb-5">
              If you have questions about this Cookie Policy or how BotSmith uses cookies,
              you can contact us:
            </p>
            <div className="space-y-2 text-sm">
              <p className="text-gray-700">
                <strong>Email:</strong> privacy@botsmith.pro
              </p>
              <p className="text-gray-700">
                <strong>Support:</strong> support@botsmith.pro
              </p>
            </div>
          </section>

        </article>
      </main>
    </div>
  )
};

export default CookiePolicy;