
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import {
  BookOpen,
  Video,
  FileText,
  HelpCircle,
  Lightbulb,
  Users2,
  ArrowRight,
  ArrowLeft,
  Rocket,
  BookMarked,
  Wrench,
  ChevronRight,
  ExternalLink
} from 'lucide-react';

const Resources = () => {
  const navigate = useNavigate();
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  const resources = [
    {
      icon: BookOpen,
      title: 'Documentation',
      description: 'Complete guides and API references for developers',
      link: 'https://document.botsmith.pro/introduction',
    },
    {
      icon: Video,
      title: 'Video Tutorials',
      description: 'Step-by-step video guides to get you started quickly',
      link: '#',
    },
    {
      icon: FileText,
      title: 'Blog',
      description: 'Latest news, updates, and best practices',
      link: '#',
    },
    {
      icon: HelpCircle,
      title: 'Help Center',
      description: 'Get answers to common questions instantly',
      link: '/resources/help-center',
    },
    {
      icon: Lightbulb,
      title: 'Use Cases',
      description: 'Real-world examples and implementation guides',
      link: '#',
    },
    {
      icon: Users2,
      title: 'Community',
      description: 'Join our community forum and connect with others',
      link: '/resources/community',
    },
    {
      icon: BookOpen,
      title: 'Changelog',
      description: 'Stay updated with the latest features and fixes',
      link: '#',
    },
  ];

  const categories = [
    {
      title: 'Getting Started',
      count: '4 articles',
      description: 'Learn the basics and create your first chatbot',
      icon: Rocket,
      link: '/resources/getting-started',
    },
    {
      title: 'User Guides',
      count: '7 articles',
      description: 'Master chatbot management and customization',
      icon: BookMarked,
      link: '/resources/user-guides',
    },
    {
      title: 'Best Practices',
      count: '15 articles',
      description: 'Tips and tricks for optimal performance',
      icon: Lightbulb,
      link: '/resources/best-practices',
    },
    {
      title: 'Troubleshooting',
      count: '20 articles',
      description: 'Quick solutions to common issues',
      icon: Wrench,
      link: '/resources/help-center',
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 h-[68px] flex items-center justify-between">

          <div
            className="flex items-center gap-2.5 cursor-pointer"
            onClick={() => navigate('/')}
          >
            <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">B</span>
            </div>
            <span className="text-xl font-semibold tracking-tight text-slate-900">
              BotSmith
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <button
              onClick={() => navigate('/pricing')}
              className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              Pricing
            </button>

            <button
              onClick={() => navigate('/enterprise')}
              className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              Scale Up
            </button>

            <button
              onClick={() => navigate('/resources')}
              className="text-sm font-semibold text-violet-700"
            >
              Learn
            </button>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => navigate('/signin')}
              className="text-slate-600 hover:text-slate-900"
            >
              Sign in
            </Button>

            <Button
              onClick={() => navigate('/signup')}
              className="bg-slate-900 hover:bg-slate-800 text-white rounded-lg px-5 shadow-none"
            >
              Try for Free
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-[68px]">

        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 py-10 sm:py-14">

          {/* Back Navigation */}
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-10"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>

          {/* Hero */}
          <section
            className={`max-w-3xl mb-14 transition-all duration-500 ${
              isLoaded
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-3'
            }`}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-200 bg-violet-50 text-violet-700 text-xs font-semibold mb-5">
              <BookOpen className="w-3.5 h-3.5" />
              LEARN & GROW
            </div>

            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-slate-950 mb-4">
              Learn
            </h1>

            <p className="text-base sm:text-lg text-slate-500 leading-relaxed max-w-2xl">
              Everything you need to build, deploy, and optimize amazing AI agents.
            </p>
          </section>

          {/* Learning Categories */}
          <section className="mb-16">

            <div className="flex items-end justify-between mb-5">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Explore topics
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Find guides and resources by topic.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {categories.map((category, index) => {
                const Icon = category.icon;

                return (
                  <button
                    key={index}
                    onClick={() => navigate(category.link)}
                    className="group text-left bg-white border border-slate-200 rounded-xl p-5 hover:border-violet-300 hover:shadow-md transition-all duration-200"
                  >
                    <div className="w-10 h-10 rounded-lg bg-slate-100 group-hover:bg-violet-50 flex items-center justify-center mb-5 transition-colors">
                      <Icon className="w-5 h-5 text-slate-600 group-hover:text-violet-600 transition-colors" />
                    </div>

                    <h3 className="text-base font-semibold text-slate-900 mb-2">
                      {category.title}
                    </h3>

                    <p className="text-sm text-slate-500 leading-relaxed min-h-[42px]">
                      {category.description}
                    </p>

                    <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100">
                      <span className="text-xs text-slate-400">
                        {category.count}
                      </span>

                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-violet-600 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Resources */}
          <section className="mb-16">

            <div className="mb-5">
              <h2 className="text-xl font-semibold text-slate-900">
                Resources
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Everything you need, all in one place.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {resources.map((resource, index) => {
                const Icon = resource.icon;
                const isComingSoon = resource.link === '#';

                return (
                  <div
                    key={index}
                    onClick={() => {
                      if (isComingSoon) return;

                      if (resource.link.startsWith('http')) {
                        window.open(
                          resource.link,
                          '_blank',
                          'noopener,noreferrer'
                        );
                      } else {
                        navigate(resource.link);
                      }
                    }}
                    className={`group bg-white border border-slate-200 rounded-xl p-5 transition-all duration-200 ${
                      isComingSoon
                        ? 'cursor-default'
                        : 'cursor-pointer hover:border-violet-300 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-5">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 group-hover:bg-violet-50 flex items-center justify-center transition-colors">
                        <Icon className="w-5 h-5 text-slate-600 group-hover:text-violet-600 transition-colors" />
                      </div>

                      {isComingSoon ? (
                        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                          Coming Soon
                        </span>
                      ) : (
                        <ExternalLink className="w-4 h-4 text-slate-300 group-hover:text-violet-600 transition-colors" />
                      )}
                    </div>

                    <h3 className="text-base font-semibold text-slate-900 mb-2">
                      {resource.title}
                    </h3>

                    <p className="text-sm text-slate-500 leading-relaxed min-h-[42px]">
                      {resource.description}
                    </p>

                    <div className="flex items-center gap-2 mt-5 text-sm font-medium text-violet-700">
                      {isComingSoon ? 'Coming soon' : 'Explore'}
                      {!isComingSoon && (
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Support CTA */}
          <section className="bg-white border border-slate-200 rounded-2xl p-7 sm:p-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">

            <div className="max-w-xl">
              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 mb-2">
                Still have questions?
              </h2>

              <p className="text-sm sm:text-base text-slate-500 leading-relaxed">
                Our support team is here to help you succeed. Get in touch with us anytime.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => navigate('/enterprise')}
                className="bg-slate-900 hover:bg-slate-800 text-white rounded-lg px-5 shadow-none"
              >
                Contact Support
              </Button>

              <Button
                variant="outline"
                onClick={() => navigate('/dashboard')}
                className="border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg px-5"
              >
                Start Building
              </Button>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
};

export default Resources;