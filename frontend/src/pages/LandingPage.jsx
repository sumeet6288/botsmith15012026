import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { MessageSquare, Zap, BarChart3, Globe, Shield, Sparkles, ChevronRight, Menu, X, Star, ArrowRight, Check, Upload, Brain, Palette, Rocket, ShoppingCart, GraduationCap, Heart, Briefcase, Users, TrendingUp, Clock, Award } from 'lucide-react';
import { useScrollAnimation } from '../hooks/useScrollAnimation';
import BotSmithLogo from '../components/BotSmithLogo';
import heroClouds from '../assets/herocloud.png';

const hasValidAuthToken = () => {
  const token = localStorage.getItem('botsmith_token');
  if (!token) return false;

  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && payload.exp * 1000 <= Date.now()) {
      localStorage.removeItem('botsmith_token');
      return false;
    }
  } catch (error) {
    // Keep the session visible for tokens that cannot be decoded client-side.
  }

  return true;
};



const FooterColumnDark = ({ title, links, onLinkClick }) => (
  <div>
    <h3 className="mb-5 text-base font-semibold text-white">
      {title}
    </h3>

    <div className="space-y-3">
      {links.map((link) => (
        <span
          key={link}
          onClick={() => onLinkClick?.(link)}
          className={`block text-sm text-white/45 transition-colors duration-200 hover:text-white/85 ${
            onLinkClick ? 'cursor-pointer' : ''
          }`}
        >
          {link}
        </span>
      ))}
    </div>
  </div>
);

const FooterColumn = ({ title, links }) => (
  <div>
    <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
      {title}
    </h3>

    <div className="space-y-3">
      {links.map((link) => (
        <span
          key={link}
          className="block text-sm text-gray-600 transition-colors duration-200 hover:text-purple-600"
        >
          {link}
        </span>
      ))}
    </div>
  </div>
);

const LandingPage = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(() => hasValidAuthToken());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cookieConsent, setCookieConsent] = useState(null);

  // Scroll animation hooks for different sections - removed for performance
  const featuresRef = React.useRef(null);
  const howItWorksRef = React.useRef(null);
  const useCasesRef = React.useRef(null);
  const testimonialsRef = React.useRef(null);
  
  // Set all to visible for instant load
  const featuresVisible = true;
  const howItWorksVisible = true;
  const useCasesVisible = true;
  const testimonialsVisible = true;

  // Scroll to top on mount to fix reload issue
  useEffect(() => {
    const syncAuthState = () => setIsAuthenticated(hasValidAuthToken());

    syncAuthState();
    window.addEventListener('storage', syncAuthState);

    return () => window.removeEventListener('storage', syncAuthState);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);

    const consent = document.cookie
      .split('; ')
      .find((row) => row.startsWith('botsmith_cookie_consent='))
      ?.split('=')[1];

    if (consent === 'accepted' || consent === 'declined') {
      setCookieConsent(consent);
    }
  }, []);

  const handleCookieConsent = (choice) => {
    document.cookie = `botsmith_cookie_consent=${choice}; max-age=${60 * 60 * 24 * 365}; path=/; SameSite=Lax`;
    setCookieConsent(choice);
  };

  // Reference-style feature card motion using scroll position.
  // This intentionally uses the same scale/rotation/origin model as the shared reference,
  // but calculates the view progress in JS so it works even when CSS view timelines are unavailable.
  useEffect(() => {
    const cards = Array.from(document.querySelectorAll(".feature-card-animation"));
    if (!cards.length) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    let frame = 0;

    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

    const updateCards = () => {
      frame = 0;
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      cards.forEach((card, index) => {
        const rect = card.getBoundingClientRect();
        let side = 1;
        let amp = 1;
        let origin = "0 100%";

        if (viewportWidth >= 1024) {
          const column = index % 3;
          if (column === 0) {
            side = -1;
            amp = 2;
            origin = "50vw 100%";
          } else if (column === 1) {
            side = 1;
            amp = 1;
            origin = "0 100%";
          } else {
            side = 1;
            amp = 2;
            origin = "-50vw 100%";
          }
        } else if (viewportWidth >= 640) {
          const column = index % 2;
          if (column === 0) {
            side = -1;
            amp = 1;
            origin = "25vw 100%";
          } else {
            side = 1;
            amp = 1;
            origin = "-25vw 100%";
          }
        }

        // Same visual idea as: animation-range: cover 0% contain 15%.
        const range = Math.max(rect.height * 0.15, 1);
        const progress = clamp((viewportHeight - rect.bottom) / range, 0, 1);
        const angle = side * (5 * amp) * (1 - progress);
        const scale = 0.85 + (0.15 * progress);

        card.style.transformOrigin = origin;
        card.style.transform = `scale(${scale}) rotate(${angle}deg)`;
      });
    };

    const requestUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateCards);
    };

    updateCards();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  // Modular card motion: each card enters as its own visual module.
  // The animation is applied to wrappers so existing hover transforms remain untouched.
  useEffect(() => {
    const modules = Array.from(document.querySelectorAll('[data-modular-card]'));
    if (!modules.length) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      modules.forEach((module) => module.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        } else {
          entry.target.classList.remove('is-visible');
        }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });

    modules.forEach((module) => observer.observe(module));
    return () => observer.disconnect();
  }, []);

  const features = [
    {
      icon: <MessageSquare className="w-6 h-6" />,
      title: 'Custom AI Agents',
      description: 'Train agents on your own content and data sources',
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: 'AI Actions',
      description: 'Execute real-world actions like bookings and payments',
      gradient: 'from-yellow-500 to-orange-500'
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: 'Smart Analytics',
      description: 'Monitor performance with actionable insights',
      gradient: 'from-purple-500 to-pink-500'
    },
    {
      icon: <Globe className="w-6 h-6" />,
      title: 'Multi-Channel',
      description: 'Deploy on website, Slack, WhatsApp, and more',
      gradient: 'from-green-500 to-emerald-500'
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: 'Enterprise Security',
      description: 'Built with robust encryption and compliance',
      gradient: 'from-red-500 to-rose-500'
    },
    {
      icon: <Sparkles className="w-6 h-6" />,
      title: 'No-Code Setup',
      description: 'Build and deploy without technical expertise',
      gradient: 'from-indigo-500 to-purple-500'
    }
  ];

  const howItWorksSteps = [
    {
      step: '01',
      icon: <Upload className="w-8 h-8" />,
      title: 'Connect Your Data',
      description: 'Upload documents, add websites, or paste text content. Support for PDF, DOCX, TXT, and more.',
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      step: '02',
      icon: <Brain className="w-8 h-8" />,
      title: 'Train Your AI',
      description: 'Our intelligent system automatically processes and learns from your content using advanced RAG technology.',
      gradient: 'from-purple-500 to-pink-500'
    },
    {
      step: '03',
      icon: <Palette className="w-8 h-8" />,
      title: 'Customize & Brand',
      description: 'Choose colors, upload your logo, set personality, and configure widget appearance to match your brand.',
      gradient: 'from-orange-500 to-rose-500'
    },
    {
      step: '04',
      icon: <Rocket className="w-8 h-8" />,
      title: 'Deploy Anywhere',
      description: 'Get embed code for your website or share a public chat link. Go live in minutes, not weeks.',
      gradient: 'from-green-500 to-emerald-500'
    }
  ];

  const useCases = [
    {
      icon: <ShoppingCart className="w-8 h-8" />,
      title: '𝐴𝑑𝑚𝑖𝑠𝑠𝑖𝑜𝑛𝑠 𝑆𝑢𝑝𝑝𝑜𝑟𝑡',
      description: '𝐴𝑛𝑠𝑤𝑒𝑟 𝑝𝑟𝑜𝑠𝑝𝑒𝑐𝑡 𝑞𝑢𝑒𝑟𝑖𝑒𝑠, 𝑠ℎ𝑎𝑟𝑒 𝑝𝑟𝑜𝑔𝑟𝑎𝑚 𝑑𝑒𝑡𝑎𝑖𝑙𝑠, 𝑒𝑙𝑖𝑔𝑖𝑏𝑖𝑙𝑖𝑡𝑦, 𝑓𝑒𝑒𝑠, 𝑎𝑛𝑑 𝑔𝑢𝑖𝑑𝑒 𝑠𝑡𝑢𝑑𝑒𝑛𝑡𝑠 𝑡ℎ𝑟𝑜𝑢𝑔ℎ 𝑡ℎ𝑒 𝑎𝑑𝑚𝑖𝑠𝑠𝑖𝑜𝑛 𝑝𝑟𝑜𝑐𝑒𝑠𝑠.',
      stats: '3x faster resolution',
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      icon: <Briefcase className="w-8 h-8" />,
      title: '𝑆𝑡𝑢𝑑𝑒𝑛𝑡 𝐻𝑒𝑙𝑝𝑑𝑒𝑠𝑘',
      description: '𝑃𝑟𝑜𝑣𝑖𝑑𝑒 24/7 𝑠𝑢𝑝𝑝𝑜𝑟𝑡 𝑓𝑜𝑟 𝑎𝑐𝑎𝑑𝑒𝑚𝑖𝑐 𝑞𝑢𝑒𝑟𝑖𝑒𝑠, 𝑒𝑥𝑎𝑚 𝑠𝑐ℎ𝑒𝑑𝑢𝑙𝑒𝑠, 𝑟𝑒𝑠𝑢𝑙𝑡𝑠, 𝑑𝑜𝑐𝑢𝑚𝑒𝑛𝑡𝑠, 𝑎𝑛𝑑 𝑐𝑎𝑚𝑝𝑢𝑠 𝑠𝑒𝑟𝑣𝑖𝑐𝑒𝑠.',
      stats: '60% less support tickets',
      gradient: 'from-purple-500 to-pink-500'
    },
    {
      icon: <Heart className="w-8 h-8" />,
      title: '𝐶𝑎𝑚𝑝𝑢𝑠 𝐼𝑛𝑓𝑜𝑟𝑚𝑎𝑡𝑖𝑜𝑛',
      description: 'A𝐼𝑛𝑠𝑡𝑎𝑛𝑡𝑙𝑦 𝑠ℎ𝑎𝑟𝑒 𝑖𝑛𝑓𝑜𝑟𝑚𝑎𝑡𝑖𝑜𝑛 𝑎𝑏𝑜𝑢𝑡 𝑒𝑣𝑒𝑛𝑡𝑠, 𝑓𝑎𝑐𝑖𝑙𝑖𝑡𝑖𝑒𝑠, 𝑑𝑒𝑝𝑎𝑟𝑡𝑚𝑒𝑛𝑡𝑠, 𝑝𝑙𝑎𝑐𝑒𝑚𝑒𝑛𝑡𝑠, ℎ𝑜𝑠𝑡𝑒𝑙𝑠, 𝑎𝑛𝑑 𝑚𝑜𝑟𝑒.',
      stats: '85% satisfaction rate',
      gradient: 'from-rose-500 to-red-500'
    },
    {
      icon: <GraduationCap className="w-8 h-8" />,
      title: '𝐸𝑑𝑢𝑐𝑎𝑡𝑖𝑜𝑛 𝐴𝑠𝑠𝑖𝑠𝑡𝑎𝑛𝑡',
      description: '𝐻𝑒𝑙𝑝 𝑠𝑡𝑢𝑑𝑒𝑛𝑡𝑠 𝑤𝑖𝑡ℎ 𝑐𝑜𝑢𝑟𝑠𝑒 𝑚𝑎𝑡𝑒𝑟𝑖𝑎𝑙𝑠, 𝑎𝑠𝑠𝑖𝑔𝑛𝑚𝑒𝑛𝑡𝑠, 𝑎𝑛𝑑 𝑠𝑐ℎ𝑒𝑑𝑢𝑙𝑒𝑠',
      stats: '24/7 availability',
      gradient: 'from-green-500 to-emerald-500'
    }
  ];

  const testimonials = [
    {
      name: 'Sarah Chen',
      role: 'CEO, TechFlow',
      avatar: '👩‍💼',
      rating: 5,
      text: 'BotSmith reduced our support tickets by 60% in the first month. The AI understands our products perfectly!',
      company: 'SaaS Company'
    },
    {
      name: 'Michael Rodriguez',
      role: 'Customer Success Manager',
      avatar: '👨‍💻',
      rating: 5,
      text: 'The multi-provider AI support is game-changing. We can switch between GPT-4 and Claude based on our needs.',
      company: 'E-commerce Platform'
    },
    {
      name: 'Emily Watson',
      role: 'Operations Director',
      avatar: '👩‍🔬',
      rating: 5,
      text: 'Setup took 15 minutes. Our patients love the instant responses. This is the future of healthcare communication.',
      company: 'Healthcare Provider'
    }
  ];

  return (
    <div className="min-h-screen bg-white overflow-hidden relative">
      {/* Navigation with Glassmorphism - Highest z-index */}
      <nav className="fixed top-0 left-0 right-0 glass-strong backdrop-blur-xl border-b border-white/30 z-[100] shadow-lg shadow-purple-500/10">
        <div className="max-w-[95%] mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => navigate('/')}>
            {/* Premium "B" Logo */}
            <BotSmithLogo size="md" showGlow={false} animate={false} />
            
            {/* Premium Brand Typography */}
            <div className="flex flex-col -space-y-0.5">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-purple-700 via-fuchsia-600 to-pink-600 bg-clip-text text-transparent group-hover:from-purple-800 group-hover:via-fuchsia-700 group-hover:to-pink-700 transition-all duration-300 drop-shadow-sm">
                  𝐵𝑜𝑡𝑆𝑚𝑖𝑡ℎ
                </span>
                <span className="text-[9px] font-bold text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded-md">AI</span>
              </div>
              <span className="text-[10px] font-semibold text-gray-400 tracking-wider uppercase">
                Powered by Jyosha Solutions
              </span>
            </div>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <button onClick={() => navigate('/pricing')} className="text-gray-700 hover:text-purple-600 transition-colors font-medium">Pricing</button>
            <button onClick={() => navigate('/enterprise')} className="text-gray-700 hover:text-purple-600 transition-colors font-medium">Scale Up</button>
            <button onClick={() => navigate('/resources')} className="text-gray-700 hover:text-purple-600 transition-colors font-medium">Learn</button>
          </div>
          
          {/* Desktop Action Buttons */}
          <div className="hidden sm:flex items-center gap-2 sm:gap-4">
            {isAuthenticated ? (
              <Button
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg shadow-lg shadow-purple-500/30 transform hover:scale-105 transition-all duration-300 text-sm sm:text-base px-3 sm:px-4"
                onClick={() => navigate('/dashboard')}
              >
                Dashboard
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => navigate('/signin')} className="hover:bg-purple-50 transition-colors text-sm sm:text-base px-2 sm:px-4">Sign in</Button>
                <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg shadow-lg shadow-purple-500/30 transform hover:scale-105 transition-all duration-300 text-sm sm:text-base px-3 sm:px-4" onClick={() => navigate('/signup')}>
                  Try for Free
                </Button>
              </>
            )}
          </div>
          
          {/* Mobile Menu Button */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="sm:hidden p-2 text-gray-700 hover:text-purple-600 transition-colors"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
        
        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="sm:hidden bg-white border-t border-gray-200 shadow-lg">
            <div className="px-4 py-4 space-y-3">
              <button onClick={() => { navigate('/pricing'); setMobileMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-purple-50 hover:text-purple-600 rounded-lg transition-colors font-medium">
                Pricing
              </button>
              <button onClick={() => { navigate('/enterprise'); setMobileMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-purple-50 hover:text-purple-600 rounded-lg transition-colors font-medium">
                Scale Up
              </button>
              <button onClick={() => { navigate('/resources'); setMobileMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-purple-50 hover:text-purple-600 rounded-lg transition-colors font-medium">
                Learn
              </button>
              <div className="pt-3 border-t border-gray-200 space-y-2">
                {isAuthenticated ? (
                  <Button
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg shadow-lg shadow-purple-500/30"
                    onClick={() => { navigate('/dashboard'); setMobileMenuOpen(false); }}
                  >
                    Dashboard
                  </Button>
                ) : (
                  <>
                    <Button variant="ghost" onClick={() => { navigate('/signin'); setMobileMenuOpen(false); }} className="w-full hover:bg-purple-50 transition-colors">
                      Sign in
                    </Button>
                    <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg shadow-lg shadow-purple-500/30" onClick={() => { navigate('/signup'); setMobileMenuOpen(false); }}>
                      Try for Free
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section - Pink/Lavender Cloud Background */}
      <section
        className="relative z-10 min-h-[760px] pt-32 sm:pt-40 pb-16 sm:pb-24 px-4 sm:px-8 overflow-hidden"
      >
        <img
          src={heroClouds}
          alt=""
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover object-center -z-10 animate-hero-cloud-fade"
        />
        <div className="absolute inset-0 bg-white/10 pointer-events-none"></div>
        <div className="relative max-w-[95%] mx-auto grid md:grid-cols-2 gap-8 sm:gap-16 items-center">
          <div className="space-y-6 sm:space-y-8">
            <div className="inline-block">
              <span className="px-3 sm:px-4 py-2 rounded-full bg-purple-100 text-purple-700 text-xs sm:text-sm font-medium inline-flex items-center gap-2">
                <Sparkles className="w-3 h-3 sm:w-4 sm:h-4" />
               𝐴𝐼-𝑃𝑜𝑤𝑒𝑟𝑒𝑑 𝑆𝑡𝑢𝑑𝑒𝑛𝑡 𝑆𝑢𝑝𝑝𝑜𝑟𝑡 𝑃𝑙𝑎𝑡𝑓𝑜𝑟𝑚 𝐹𝑜𝑟 𝑈𝑛𝑖𝑣𝑒𝑟𝑠𝑖𝑡𝑖𝑒𝑠 𝑎𝑛𝑑 𝐶𝑜𝑙𝑙𝑒𝑔𝑒𝑠
              </span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-tight animate-slide-in-left font-instrument-serif font-normal text-gray-900">
              AI that guides,<br />supports, and empowers<br />every student
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-gray-600 leading-relaxed">
              𝐵𝑜𝑡𝑆𝑚𝑖𝑡ℎ ℎ𝑒𝑙𝑝𝑠 𝑢𝑛𝑖𝑣𝑒𝑟𝑠𝑖𝑡𝑖𝑒𝑠 𝑑𝑒𝑝𝑙𝑜𝑦 𝐴𝐼 𝑎𝑠𝑠𝑖𝑠𝑡𝑎𝑛𝑡𝑠 𝑡ℎ𝑎𝑡 𝑎𝑢𝑡𝑜𝑚𝑎𝑡𝑒 𝑎𝑑𝑚𝑖𝑠𝑠𝑖𝑜𝑛𝑠, 𝑎𝑛𝑠𝑤𝑒𝑟 𝑠𝑡𝑢𝑑𝑒𝑛𝑡 𝑞𝑢𝑒𝑠𝑡𝑖𝑜𝑛𝑠, 𝑎𝑛𝑑 𝑝𝑟𝑜𝑣𝑖𝑑𝑒 24/7 𝑐𝑎𝑚𝑝𝑢𝑠 𝑠𝑢𝑝𝑝𝑜𝑟𝑡.
            </p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <Button 
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-6 text-lg rounded-xl shadow-xl transition-colors duration-300 group"
                onClick={() => navigate('/signup')}
              >
                𝐵𝑢𝑖𝑙𝑑 𝑦𝑜𝑢𝑟 𝑎𝑔𝑒𝑛𝑡
                <ChevronRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <span className="text-gray-500 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                No credit card required
              </span>
            </div>
          </div>
          <div className="relative animate-fade-in-right">
            {/* Animated glow effect for the card */}
            <div className="absolute -inset-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-3xl blur-2xl opacity-20 animate-pulse-slow"></div>
            
            {/* Card preview with animations */}
            <div 
              onClick={() => navigate('/signup')}
              className="relative w-full h-[500px] rounded-3xl bg-white/20 backdrop-blur-sm border border-white/40 p-8 flex items-center justify-center transform hover:scale-105 transition-transform duration-500 shadow-2xl cursor-pointer animate-float"
            >
              {/* Shine effect overlay */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-white/20 via-transparent to-transparent opacity-40 pointer-events-none"></div>
              <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent"></div>
              </div>
              
              {/* Floating decorative elements */}
              <div className="absolute top-8 right-8 w-4 h-4 bg-white/30 rounded-full animate-ping pointer-events-none"></div>
              <div className="absolute bottom-12 left-12 w-3 h-3 bg-yellow-300/40 rounded-full animate-ping animation-delay-1000 pointer-events-none"></div>
              
              <div className="relative bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-2xl w-full max-w-lg transition-shadow duration-300 border border-white/50 pointer-events-none">
                <div className="relative">
                  {/* Premium Modular Chat Preview */}
                  <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-10 rounded-[14px] bg-gradient-to-br from-purple-600 via-fuchsia-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                        <Sparkles className="w-[18px] h-[18px] text-white" />
                        <span className="absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white"></span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-[16px] font-semibold tracking-tight text-gray-950">BotSmith AI</h3>
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600">Live</span>
                        </div>
                        <p className="mt-0.5 text-[13px] text-gray-400">Student support assistant</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button className="w-8 h-8 rounded-lg border border-gray-100 bg-white text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors">
                        <span className="text-base leading-none">•••</span>
                      </button>
                      <button className="w-8 h-8 rounded-lg border border-gray-100 bg-white text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors">
                        <X className="w-4 h-4 mx-auto" />
                      </button>
                    </div>
                  </div>

                  {/* Conversation */}
                  <div className="space-y-4 mb-5 max-h-[285px] overflow-hidden">
                    {/* AI Welcome Module */}
                    <div className="flex items-start gap-2.5 animate-slide-in-left">
                      <div className="w-7 h-7 rounded-[9px] bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <Sparkles className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <div className="bg-[#f7f7fa] border border-gray-100 rounded-2xl rounded-tl-md px-4 py-3 shadow-[0_4px_16px_rgba(25,20,35,0.035)]">
                          <p className="text-[15px] leading-6 text-gray-800">
                            Hi! I’m your campus AI assistant. What can I help you find?
                          </p>
                        </div>
                        <span className="block mt-1.5 ml-1 text-[10px] font-medium text-gray-400">Just now</span>
                      </div>
                    </div>

                    {/* Quick Action Modules */}
                    <div className="ml-9 flex flex-wrap gap-2 animate-slide-in-left animation-delay-300">
                      <span className="inline-flex items-center rounded-full border border-purple-100 bg-purple-50/70 px-3.5 py-1.5 text-[13px] font-medium text-purple-700">
                        Admissions
                      </span>
                      <span className="inline-flex items-center rounded-full border border-gray-100 bg-white px-3.5 py-1.5 text-[13px] font-medium text-gray-600 shadow-sm">
                        Courses
                      </span>
                      <span className="inline-flex items-center rounded-full border border-gray-100 bg-white px-3.5 py-1.5 text-[13px] font-medium text-gray-600 shadow-sm">
                        Campus
                      </span>
                    </div>

                    {/* User Message Module */}
                    <div className="flex items-start justify-end animate-slide-in-right animation-delay-300">
                      <div className="max-w-[78%]">
                        <div className="rounded-2xl rounded-tr-md bg-gradient-to-br from-purple-600 to-fuchsia-600 px-4 py-3 shadow-[0_8px_20px_rgba(124,58,237,0.18)]">
                          <p className="text-[15px] leading-6 text-white">What services do you offer?</p>
                        </div>
                        <div className="mt-1.5 text-right text-[10px] font-medium text-gray-400">10:24 AM · Sent</div>
                      </div>
                    </div>

                    {/* AI Response Module */}
                    <div className="flex items-start gap-2.5 animate-slide-in-left animation-delay-600">
                      <div className="w-7 h-7 rounded-[9px] bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <Sparkles className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <div className="bg-[#f7f7fa] border border-gray-100 rounded-2xl rounded-tl-md px-4 py-3 shadow-[0_4px_16px_rgba(25,20,35,0.035)]">
                          <p className="text-[15px] leading-6 text-gray-800">
                            Admissions, programs, fees, campus information, and student support — instantly.
                          </p>
                        </div>
                        <div className="mt-2 flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                          <span className="text-[10px] font-medium text-gray-400">AI response</span>
                        </div>
                      </div>
                    </div>

                    {/* Typing Module */}
                    <div className="flex items-center gap-2.5 animate-slide-in-left animation-delay-900">
                      <div className="w-7 h-7 rounded-[9px] bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <Sparkles className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="rounded-2xl bg-gray-50 border border-gray-100 px-3.5 py-2.5">
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce"></span>
                          <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce animation-delay-100"></span>
                          <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce animation-delay-200"></span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Premium Input Module */}
                  <div className="rounded-2xl border border-gray-200 bg-white p-1.5 shadow-[0_8px_24px_rgba(25,20,35,0.06)]">
                    <div className="flex items-center gap-2 rounded-[13px] bg-gray-50/80 px-2">
                      <div className="flex-1 px-2 py-3 text-[14px] text-gray-400">
                        Ask about admissions, courses...
                      </div>
                      <button className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-pink-500 text-white shadow-md shadow-purple-500/20 transition-transform duration-200 hover:scale-105">
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif&display=swap');

        html {
          scroll-behavior: smooth;
        }

        .font-instrument-serif {
          font-family: "Instrument Serif", serif;
          font-weight: 400;
        }

        @keyframes hero-cloud-fade {
          from {
            opacity: 0.05;
          }
          to {
            opacity: 1;
          }
        }

        .animate-hero-cloud-fade {
          animation: hero-cloud-fade 4.5s ease-out forwards;
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-hero-cloud-fade {
            animation: none;
            opacity: 1;
          }
        }
      

        /* =========================================================
           MODULAR CARD MOTION
           Each card is treated as an independent module.
           No shared generic slide/fade animation.
           ========================================================= */

        @keyframes modular-assemble {
          0% { opacity: 0; transform: translate3d(-18px, 28px, 0) scale(0.94); clip-path: inset(12% 0 0 0); }
          55% { opacity: 1; transform: translate3d(3px, -3px, 0) scale(1.01); clip-path: inset(0); }
          100% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); clip-path: inset(0); }
        }

        @keyframes modular-fold {
          0% { opacity: 0; transform: perspective(900px) rotateX(-9deg) translateY(30px); transform-origin: 50% 100%; }
          65% { opacity: 1; transform: perspective(900px) rotateX(2deg) translateY(-2px); }
          100% { opacity: 1; transform: perspective(900px) rotateX(0) translateY(0); }
        }

        @keyframes modular-stack {
          0% { opacity: 0; transform: translate3d(26px, 18px, 0) scale(0.92); }
          45% { opacity: 1; transform: translate3d(-4px, -3px, 0) scale(1.015); }
          100% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
        }

        @keyframes modular-slot {
          0% { opacity: 0; transform: translate3d(-34px, 0, 0) scaleX(0.96); clip-path: inset(0 12% 0 0); }
          60% { opacity: 1; transform: translate3d(3px, 0, 0) scaleX(1.01); clip-path: inset(0); }
          100% { opacity: 1; transform: translate3d(0, 0, 0) scaleX(1); clip-path: inset(0); }
        }

        @keyframes modular-orbit {
          0% { opacity: 0; transform: translate3d(18px, 24px, 0) rotate(2.5deg) scale(0.94); transform-origin: 85% 85%; }
          55% { opacity: 1; transform: translate3d(-2px, -2px, 0) rotate(-0.6deg) scale(1.01); }
          100% { opacity: 1; transform: translate3d(0, 0, 0) rotate(0) scale(1); }
        }

        [data-modular-card] {
          opacity: 0;
          will-change: transform, opacity, clip-path;
        }

        [data-modular-card].is-visible {
          opacity: 1;
        }

        [data-modular-card].modular-assemble.is-visible {
          animation: modular-assemble 760ms cubic-bezier(.22,.8,.25,1) both;
        }

        [data-modular-card].modular-fold.is-visible {
          animation: modular-fold 820ms cubic-bezier(.2,.78,.25,1) both;
        }

        [data-modular-card].modular-stack.is-visible {
          animation: modular-stack 720ms cubic-bezier(.22,.82,.25,1) both;
        }

        [data-modular-card].modular-slot.is-visible {
          animation: modular-slot 760ms cubic-bezier(.2,.8,.25,1) both;
        }

        [data-modular-card].modular-orbit.is-visible {
          animation: modular-orbit 840ms cubic-bezier(.2,.78,.25,1) both;
        }

        @media (max-width: 639px) {
          [data-modular-card].is-visible {
            animation-duration: 620ms;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          [data-modular-card],
          [data-modular-card].is-visible {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
            clip-path: none !important;
          }
        }

            `}
</style>

      {/* Agency Value Proposition */}
      <section className="py-12 border-y border-gray-200 bg-white/50 backdrop-blur-sm relative z-10">
        <div className="max-w-5xl mx-auto px-8">
          <p className="text-center text-xl sm:text-2xl font-semibold text-gray-800 leading-relaxed">
            𝑂𝑛𝑒 𝐴𝐼 𝑝𝑙𝑎𝑡𝑓𝑜𝑟𝑚 𝑓𝑜𝑟 𝑦𝑜𝑢𝑟 𝑒𝑛𝑡𝑖𝑟𝑒 𝑢𝑛𝑖𝑣𝑒𝑟𝑠𝑖𝑡𝑦 — <span className="text-transparent bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text">𝑎𝑢𝑡𝑜𝑚𝑎𝑡𝑒 𝑎𝑑𝑚𝑖𝑠𝑠𝑖𝑜𝑛𝑠, 𝑎𝑛𝑠𝑤𝑒𝑟 𝑠𝑡𝑢𝑑𝑒𝑛𝑡 𝑞𝑢𝑒𝑠𝑡𝑖𝑜𝑛𝑠</span> 𝑐𝑢𝑠𝑡𝑜𝑚 𝐴𝐼 𝑎𝑔𝑒𝑛𝑡𝑠 𝑎𝑛𝑑 𝑎𝑢𝑡𝑜𝑚𝑎𝑡𝑖𝑜𝑛𝑠 𝑓𝑜𝑟 𝑒𝑣𝑒𝑟𝑦 𝑑𝑒𝑝𝑎𝑟𝑡𝑚𝑒𝑛𝑡 𝑖𝑛 𝑚𝑖𝑛𝑢𝑡𝑒𝑠.
          </p>
        </div>
      </section>

      {/* Why BotSmith — editorial value proposition */}
      <section className="relative z-10 bg-white px-6 py-20 sm:px-10 sm:py-24 lg:px-[90px] lg:py-28">
        <div className="w-full">
          <div className="mb-7 text-[12px] font-semibold uppercase tracking-[0.22em] text-purple-600">
            WHY BOTSMITH?
          </div>

          <p className="w-full font-sans text-[36px] font-normal leading-[1.18] tracking-[-0.025em] text-gray-950 sm:text-[42px] lg:text-[48px]">
            <strong className="font-medium">
              BotSmith is the all-in-one AI platform for educational businesses that want to attract, engage, and convert more students.
            </strong>{' '}
            Capture leads, answer admissions questions, qualify prospective students, share course information, automate follow-ups, and engage visitors 24/7 — all from one intelligent AI platform.{' '}
            <strong className="font-medium">
              We help educational businesses turn more website visitors into students.
            </strong>
          </p>
        </div>
      </section>

      {/* Features Section - Streamlined Premium */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 xl:px-12 relative z-10" ref={featuresRef}>
        <div className="max-w-[1600px] mx-auto relative z-10 w-full">
          {/* Header */}
          <div className={`text-center mb-12 `}>
            <h2 className="text-4xl sm:text-5xl font-bold mb-4 bg-gradient-to-r from-gray-900 via-purple-900 to-gray-900 bg-clip-text text-transparent">
              𝐵𝑢𝑖𝑙𝑑 𝑆𝑚𝑎𝑟𝑡𝑒𝑟, 𝑆𝑢𝑝𝑝𝑜𝑟𝑡 𝐵𝑒𝑡𝑡𝑒𝑟, 𝐺𝑟𝑜𝑤 𝐹𝑎𝑠𝑡𝑒𝑟
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              𝐴 𝑐𝑜𝑚𝑝𝑙𝑒𝑡𝑒 𝑝𝑙𝑎𝑡𝑓𝑜𝑟𝑚 𝑡𝑜 𝑐𝑟𝑎𝑓𝑡, 𝑑𝑒𝑝𝑙𝑜𝑦 𝑎𝑛𝑑 𝑟𝑒𝑓𝑖𝑛𝑒 𝑦𝑜𝑢𝑟 𝐴𝐼-𝑃𝑜𝑤𝑒𝑟𝑒𝑑 𝑎𝑔𝑒𝑛𝑡 𝑒𝑐𝑜𝑠𝑦𝑠𝑡𝑒𝑚.
            </p>
          </div>

          {/* Feature Cards - Premium Editorial */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div 
                key={index} 
                className="feature-card-animation group relative"
              >
                {/* Ambient glow */}
                <div className={`absolute -inset-1 bg-gradient-to-br ${feature.gradient} rounded-[26px] opacity-0 blur-xl group-hover:opacity-20 transition-opacity duration-500`}></div>

                {/* Premium Card */}
                <div className="relative h-full min-h-[210px] overflow-hidden rounded-[24px] border border-white/80 bg-white/75 backdrop-blur-xl p-7 shadow-[0_12px_35px_rgba(31,38,135,0.10)] transition-all duration-500 group-hover:-translate-y-2 group-hover:shadow-[0_22px_50px_rgba(31,38,135,0.16)]">

                  {/* Soft gradient wash */}
                  <div className={`absolute -top-20 -right-20 h-44 w-44 rounded-full bg-gradient-to-br ${feature.gradient} opacity-[0.07] blur-2xl transition-all duration-500 group-hover:opacity-[0.14] group-hover:scale-125`}></div>

                  {/* Decorative corner line */}
                  <div className={`absolute top-0 left-8 right-8 h-px bg-gradient-to-r ${feature.gradient} opacity-30 group-hover:opacity-70 transition-opacity duration-500`}></div>

                  {/* Icon */}
                  <div className={`relative z-10 mb-7 w-14 h-14 bg-gradient-to-br ${feature.gradient} rounded-[17px] flex items-center justify-center text-white shadow-lg shadow-purple-500/10 transition-all duration-500 group-hover:scale-110 group-hover:-rotate-2`}>
                    <div className="absolute inset-[1px] rounded-[16px] bg-gradient-to-br from-white/35 via-transparent to-black/10"></div>
                    <div className="absolute inset-0 rounded-[17px] ring-1 ring-white/40"></div>
                    <div className="relative z-10">{feature.icon}</div>
                  </div>

                  {/* Title */}
                  <h3 className="relative z-10 mb-2 font-instrument-serif font-normal text-[28px] leading-none tracking-[-0.02em] text-gray-900 transition-transform duration-500 group-hover:translate-x-0.5">
                    {feature.title}
                  </h3>

                  {/* Description */}
                  <p className="relative z-10 max-w-[320px] text-[15px] leading-6 text-gray-500">
                    {feature.description}
                  </p>

                  {/* Hover indicator */}
                  <div className="absolute bottom-6 right-6 flex h-9 w-9 items-center justify-center rounded-full border border-purple-100 bg-white/80 text-purple-600 opacity-60 shadow-sm transition-all duration-500 group-hover:translate-x-1 group-hover:opacity-100 group-hover:scale-110">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Trust Badge */}
          <div className="mt-12 text-center">
            <div className="flex justify-center items-center gap-2">
              {[1, 2, 3, 4, 5].map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
              ))}
              <span className="ml-2 text-gray-700 font-medium">4.9/5 from 150+ customers</span>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 xl:px-12 bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 relative overflow-hidden" ref={howItWorksRef}>
        {/* Subtle background accents — static for a calmer premium feel */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-purple-300/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-72 h-72 bg-pink-300/20 rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-[1600px] mx-auto relative z-10 w-full">
          {/* Header */}
          <div className="text-center mb-14">
            <span className="px-4 py-2 rounded-full bg-white/70 border border-purple-100 text-purple-700 text-sm font-medium inline-flex items-center gap-2 mb-5 shadow-sm">
              <Clock className="w-4 h-4" />
              Launch in Minutes
            </span>

            <h2 className="font-instrument-serif text-5xl sm:text-6xl md:text-7xl font-normal leading-none tracking-tight mb-5 text-gray-900">
              How It Works
            </h2>

            <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
              Four simple steps to transform your customer support with AI
            </p>
          </div>

          {/* Steps — restrained animation, premium styling */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
            {howItWorksSteps.map((step, index) => (
              <div 
                key={index}
                data-modular-card
                className={`relative ${['modular-assemble', 'modular-fold', 'modular-stack', 'modular-slot'][index]}`}
              >
                {/* Simple connector */}
                {index < howItWorksSteps.length - 1 && (
                  <div className="hidden lg:flex absolute top-[72px] -right-5 z-20 items-center pointer-events-none">
                    <div className="w-8 h-px bg-purple-200"></div>
                    <ArrowRight className="w-4 h-4 -ml-1 text-purple-400" />
                  </div>
                )}

                {/* Premium card */}
                <div className="relative h-full min-h-[205px] rounded-[24px] border border-white/90 bg-white/75 backdrop-blur-xl p-6 sm:p-7 shadow-[0_10px_30px_rgba(58,39,88,0.08)] transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_16px_36px_rgba(58,39,88,0.12)] overflow-hidden">

                  {/* Quiet accent */}
                  <div className={`absolute -top-16 -right-16 w-36 h-36 rounded-full bg-gradient-to-br ${step.gradient} opacity-[0.06] blur-2xl pointer-events-none`}></div>

                  {/* Step number */}
                  <div className="absolute -top-3 -left-3 w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white text-sm font-semibold shadow-md border-4 border-white">
                    {step.step}
                  </div>

                  {/* Icon */}
                  <div className={`relative w-14 h-14 bg-gradient-to-br ${step.gradient} rounded-[16px] flex items-center justify-center text-white mb-6 mt-1 shadow-md`}>
                    <div className="absolute inset-[1px] rounded-[15px] bg-gradient-to-br from-white/30 to-transparent"></div>
                    <div className="relative z-10">{step.icon}</div>
                  </div>

                  {/* Content */}
                  <h3 className="relative z-10 font-instrument-serif font-normal text-[26px] leading-none tracking-[-0.01em] mb-3 text-gray-900">
                    {step.title}
                  </h3>

                  <p className="relative z-10 text-[13px] leading-[1.65] text-gray-500 max-w-[290px]">
                    {step.description}
                  </p>

                  {/* Minimal bottom accent */}
                  <div className="absolute bottom-5 left-6 w-8 h-px bg-gradient-to-r from-purple-300 to-pink-300 opacity-60"></div>
                </div>
              </div>
            ))}
          </div>

          {/* CTA — no entrance animation */}
          <div className="text-center mt-12">
            <Button 
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-6 text-lg rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-[transform,box-shadow,background] duration-200"
              onClick={() => navigate('/signup')}
            >
              Start Building Now
              <Rocket className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Use Cases Section — Premium Modular */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 xl:px-12 relative z-10 bg-white" ref={useCasesRef}>
        <div className="max-w-[1320px] mx-auto w-full">
          <div className="mb-12 sm:mb-14">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
              <div className="max-w-3xl">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                  <Award className="w-3.5 h-3.5" />
                  Build for Education
                </span>
                <h2 className="mt-5 font-instrument-serif font-normal text-5xl sm:text-6xl md:text-7xl leading-[0.92] tracking-[-0.035em] text-gray-950">
                  Built for Every Department
                </h2>
                <p className="mt-5 max-w-2xl text-base sm:text-lg leading-7 text-gray-500">
                  Empowering institutions to automate support, engage students, and improve every campus experience.
                </p>
              </div>
              <div className="hidden lg:block pb-1 text-right">
                <div className="font-instrument-serif text-4xl leading-none text-gray-200">04</div>
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">Departments</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {useCases.map((useCase, index) => (
              <div
                key={index}
                data-modular-card
                className={`h-full ${['modular-slot', 'modular-assemble', 'modular-orbit', 'modular-fold'][index]}`}
              >
              <article
                className="group relative min-h-[330px] overflow-hidden rounded-[22px] border border-gray-200/80 bg-[#fbfbfa] p-6 sm:p-7 shadow-[0_8px_24px_rgba(20,18,28,0.045)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-gray-300 hover:shadow-[0_16px_36px_rgba(20,18,28,0.09)]"
              >
                <div className="pointer-events-none absolute right-0 top-0 h-20 w-20 border-l border-b border-gray-200/70 rounded-bl-[22px]"></div>
                <div className="pointer-events-none absolute right-5 top-5 h-1.5 w-1.5 rounded-full bg-purple-300/70"></div>

                <div className="relative flex h-full flex-col">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-medium tracking-[0.16em] text-gray-400">0{index + 1}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">Department</span>
                  </div>

                  <div className={`mt-8 mb-7 flex h-12 w-12 items-center justify-center rounded-[14px] bg-gradient-to-br ${useCase.gradient} text-white shadow-[0_8px_18px_rgba(80,60,120,0.12)] transition-transform duration-200 group-hover:-translate-y-0.5`}>
                    {useCase.icon}
                  </div>

                  <h3 className="font-instrument-serif font-normal text-[29px] leading-[0.98] tracking-[-0.02em] text-gray-950">
                    {useCase.title}
                  </h3>

                  <p className="mt-3 text-[13px] leading-[1.7] text-gray-500">
                    {useCase.description}
                  </p>

                  <div className="mt-auto pt-6">
                    <div className="border-t border-gray-200 pt-4 flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-purple-600">
                        <TrendingUp className="h-3.5 w-3.5" />
                        {useCase.stats}
                      </span>
                      <ChevronRight className="h-4 w-4 text-gray-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-gray-500" />
                    </div>
                  </div>
                </div>
              </article>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 xl:px-12 bg-[#f5f5f3] relative z-10" ref={testimonialsRef}>
        <div className="max-w-[1320px] mx-auto w-full rounded-[32px] bg-white border border-gray-200/80 px-6 py-12 sm:px-10 sm:py-14 lg:px-16 shadow-[0_18px_60px_rgba(25,20,35,0.07)]">

          {/* Editorial header */}
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-12">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-gray-600 mb-5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-yellow-50 border border-yellow-100">
                  <Star className="w-3.5 h-3.5 fill-yellow-500 text-yellow-500" />
                </span>
                Loved by Teams Worldwide
              </span>

              <h2 className="font-instrument-serif text-5xl sm:text-6xl md:text-7xl font-normal leading-[0.95] tracking-tight text-gray-950 mb-5">
                What Our Customers Say
              </h2>

              <p className="text-base sm:text-lg text-gray-500 leading-7 max-w-xl">
                Join thousands of happy customers who transformed their support with BotSmith
              </p>
            </div>

            {/* Visual-only review affordance — no new behavior added */}
            <button
              type="button"
              className="self-start lg:self-end shrink-0 px-5 py-2.5 rounded-full border border-gray-200 bg-white text-sm font-medium text-gray-800 shadow-sm transition-[box-shadow,border-color] duration-200 hover:border-gray-300 hover:shadow-md"
            >
              Leave a review
            </button>
          </div>

          {/* Modular testimonial cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {testimonials.map((testimonial, index) => {
              const featured = index === 1;

              return (
                <div
                  data-modular-card
                  className={`h-full ${['modular-assemble', 'modular-orbit', 'modular-fold'][index]}`}
                >
                <article
                  key={index}
                  className={`group relative min-h-[320px] rounded-[22px] border p-6 sm:p-7 flex flex-col justify-between overflow-hidden transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 ${
                    featured
                      ? 'bg-[#171717] border-[#171717] text-white shadow-[0_16px_36px_rgba(0,0,0,0.16)] hover:shadow-[0_20px_42px_rgba(0,0,0,0.20)]'
                      : 'bg-[#fafafa] border-gray-100 text-gray-900 shadow-[0_8px_24px_rgba(25,20,35,0.04)] hover:border-gray-200 hover:shadow-[0_14px_32px_rgba(25,20,35,0.08)]'
                  }`}
                >
                  <div>
                    {/* Author */}
                    <div className="flex items-center gap-3 mb-10">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-sm flex-shrink-0 ${
                        featured
                          ? 'bg-white/10 border border-white/10'
                          : 'bg-white border border-gray-200'
                      }`}>
                        <span>{testimonial.avatar}</span>
                      </div>

                      <div className="min-w-0">
                        <h4 className={`text-sm font-semibold ${featured ? 'text-white' : 'text-gray-900'}`}>
                          {testimonial.name}
                        </h4>
                        <p className={`text-xs mt-0.5 truncate ${featured ? 'text-white/55' : 'text-gray-500'}`}>
                          {testimonial.role}
                        </p>
                      </div>
                    </div>

                    {/* Rating */}
                    <div className="flex gap-1 mb-6">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star
                          key={i}
                          className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400"
                        />
                      ))}
                    </div>

                    {/* Quote */}
                    <h3 className={`font-instrument-serif text-[28px] sm:text-[30px] font-normal leading-[1.05] tracking-tight mb-5 ${
                      featured ? 'text-white' : 'text-gray-950'
                    }`}>
                      {index === 0
                        ? 'Finally know where money goes!'
                        : index === 1
                          ? 'Replaced three tools at once.'
                          : 'Spending habits changed instantly.'}
                    </h3>

                    <p className={`text-sm leading-6 max-w-[320px] ${
                      featured ? 'text-white/60' : 'text-gray-500'
                    }`}>
                      {testimonial.text}
                    </p>
                  </div>

                  {/* Company */}
                  <div className={`pt-5 mt-8 border-t flex items-center justify-between ${
                    featured ? 'border-white/10' : 'border-gray-200'
                  }`}>
                    <span className={`text-[11px] font-medium ${
                      featured ? 'text-white/45' : 'text-gray-400'
                    }`}>
                      {testimonial.company}
                    </span>
                    <span className={`font-instrument-serif text-2xl leading-none ${
                      featured ? 'text-white/20' : 'text-gray-200'
                    }`}>
                      “
                    </span>
                  </div>
                </article>
                </div>
              );
            })}
          </div>

          {/* Modular proof rail */}
          <div className="mt-12 border-y border-gray-100 grid grid-cols-2 md:grid-cols-4">
            <div className="py-7 px-4 text-center md:border-r border-gray-100">
              <div className="font-instrument-serif text-4xl sm:text-5xl text-gray-950 leading-none mb-2">150+</div>
              <div className="text-xs sm:text-sm text-gray-500">Happy Customers</div>
            </div>
            <div className="py-7 px-4 text-center border-l md:border-l-0 md:border-r border-gray-100">
              <div className="font-instrument-serif text-4xl sm:text-5xl text-gray-950 leading-none mb-2">500K+</div>
              <div className="text-xs sm:text-sm text-gray-500">Conversations/Day</div>
            </div>
            <div className="py-7 px-4 text-center md:border-r border-gray-100">
              <div className="font-instrument-serif text-4xl sm:text-5xl text-gray-950 leading-none mb-2">98%</div>
              <div className="text-xs sm:text-sm text-gray-500">Uptime</div>
            </div>
            <div className="py-7 px-4 text-center border-l md:border-l-0 border-gray-100">
              <div className="font-instrument-serif text-4xl sm:text-5xl text-gray-950 leading-none mb-2">4.9/5</div>
              <div className="text-xs sm:text-sm text-gray-500">Customer Rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 sm:px-8 bg-gradient-to-br from-gray-900 via-purple-900 to-pink-900 text-white relative overflow-hidden">
        {/* Static ambient light — no continuous animation */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 left-[18%] w-96 h-96 bg-purple-500/15 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-40 right-[15%] w-96 h-96 bg-pink-500/15 rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-[1180px] mx-auto relative z-10">
          {/* Modular CTA panel */}
          <div className="relative rounded-[28px] border border-white/15 bg-white/[0.06] backdrop-blur-sm px-7 py-9 sm:px-10 sm:py-11 lg:px-12 lg:py-12 shadow-[0_24px_70px_rgba(0,0,0,0.16)]">
            {/* Fine editorial accent */}
            <div className="absolute top-0 left-12 right-12 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>

            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-9 lg:gap-14">
              {/* CTA copy */}
              <div className="max-w-3xl">
                <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-purple-100 mb-5">
                  Ready when you are
                </div>

                <h2 className="font-instrument-serif font-normal text-5xl sm:text-6xl lg:text-7xl leading-[0.95] tracking-tight text-white">
                  Automate admissions, enquiries, and student support.
                </h2>

                <p className="mt-5 text-base sm:text-lg text-purple-200/90 leading-relaxed max-w-2xl">
                  Let AI agents create seamless experiences that keep clients coming back
                </p>
              </div>

              {/* CTA action module */}
              <div className="shrink-0 lg:w-[245px]">
                <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
                  <Button 
                    className="w-full bg-white hover:bg-gray-100 text-purple-900 px-8 py-6 text-lg rounded-xl shadow-xl transition-[transform,box-shadow,background] duration-200 group"
                    onClick={() => navigate('/signup')}
                  >
                    Get Started Free
                    <ChevronRight className="ml-2 w-5 h-5 group-hover:translate-x-0.5 transition-transform duration-200" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Premium Modular Footer */}
      <section className="relative overflow-hidden bg-[#242326] px-3 py-3 sm:px-5 sm:py-5">
        <footer className="relative mx-auto max-w-[1380px] overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#151517] text-white">

          {/* Subtle modular grid */}
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              backgroundImage: `
                linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)
              `,
              backgroundSize: '120px 120px'
            }}
          ></div>

          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(147,51,234,0.12),transparent_38%)]"></div>

          {/* CTA module */}
          <div className="relative border-b border-white/[0.08] px-6 py-16 text-center sm:px-10 sm:py-20 lg:py-24">
            <div className="mx-auto mb-7 inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.05] px-3 py-1.5 text-[11px] font-medium text-white/75">
              <Zap className="h-3.5 w-3.5" />
              Unlock the power of AI
            </div>

            <h2 className="mx-auto max-w-4xl font-instrument-serif text-5xl font-normal leading-[0.94] tracking-[-0.035em] text-white sm:text-6xl md:text-7xl lg:text-[78px]">
              Ready to turn complexity
              <br />
              into <span className="bg-gradient-to-r from-fuchsia-400 via-purple-400 to-orange-300 bg-clip-text text-transparent">clarity?</span>
            </h2>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                className="h-11 rounded-xl bg-white px-7 text-sm font-semibold text-gray-950 shadow-[0_8px_30px_rgba(255,255,255,0.12)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_35px_rgba(255,255,255,0.18)]"
                onClick={() => navigate('/signup')}
              >
                Start Now
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                className="h-11 rounded-xl border-white/30 bg-transparent px-7 text-sm font-medium text-white hover:bg-white/[0.06] hover:text-white"
                onClick={() => navigate('/enterprise')}
              >
                Book a Demo
              </Button>
            </div>
          </div>

          {/* Main footer modules */}
          <div className="relative grid grid-cols-1 gap-12 px-6 py-12 sm:px-10 md:grid-cols-2 lg:grid-cols-[1.65fr_1fr_1fr_1fr] lg:px-14 lg:py-14">

            {/* Brand / contact module */}
            <div className="lg:pr-14">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-white p-1.5">
                  <BotSmithLogo size="sm" showGlow={false} animate={false} />
                </div>
                <span className="font-instrument-serif text-[34px] leading-none tracking-[-0.035em] text-white">
                  BotSmith
                </span>
              </div>

              <p className="mt-5 max-w-[330px] text-base leading-6 text-white/50">
                AI assistants that help colleges and universities guide,
                support, and engage every student.
              </p>

              <div className="mt-7 space-y-2 text-sm text-white/45">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-white/40"></span>
                  Built for modern education
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-white/40"></span>
                  Deploy in minutes, not weeks
                </div>
              </div>

              <div className="mt-9 flex gap-2">
                {['in', '𝕏', '◎', '▶'].map((item) => (
                  <span
                    key={item}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-white/[0.1] bg-white/[0.03] text-xs text-white/45 transition-colors duration-200 hover:border-white/20 hover:text-white"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <FooterColumnDark
              title="Product"
              links={['AI Agents', 'AI Actions', 'Analytics', 'Integrations', 'Security']}
            />

            <FooterColumnDark
              title="Resources"
              links={['Customers', 'Blog', 'Pricing', 'Documentation', 'Contact']}
              onLinkClick={(link) => {
                if (link === 'Pricing') {
                  navigate('/pricing');
                } else if (link === 'Blog') {
                  navigate('/blog');
                } else if (link === 'Documentation') {
                  window.open('https://document.botsmith.pro/introduction', '_blank', 'noopener,noreferrer');
                }
              }}
            />

            <FooterColumnDark
              title="Company"
              links={['About', 'Careers']}
            />
          </div>

          {/* Bottom rail */}
          <div className="relative flex flex-col gap-3 border-t border-white/[0.08] px-6 py-5 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between sm:px-10 lg:px-14">
            <span>© 2026 BotSmith. All rights reserved.</span>

            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <button
                type="button"
                onClick={() => navigate('/terms-of-service')}
                className="transition-colors duration-200 hover:text-white/70"
              >
                Terms of Service
              </button>
              <button
                type="button"
                onClick={() => navigate('/privacy-policy')}
                className="transition-colors duration-200 hover:text-white/70"
              >
                Privacy Policy
              </button>
              <button
                type="button"
                onClick={() => navigate('/cookie-policy')}
                className="transition-colors duration-200 hover:text-white/70"
              >
                Cookie Policy
              </button>
            </div>
          </div>

          {/* Oversized editorial wordmark */}
          <div className="pointer-events-none relative overflow-hidden px-5 pt-5 sm:px-10">
            <div className="font-instrument-serif text-[22vw] font-normal leading-[0.7] tracking-[-0.07em] text-white/[0.035] select-none sm:text-[19vw] lg:text-[17vw]">
              BOTSMITH
            </div>
          </div>
        </footer>
      </section>

      {/* Cookie Consent Banner */}
      {cookieConsent === null && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-6 sm:right-6 lg:left-6 lg:right-auto lg:max-w-[520px] z-[200]">
          <div className="rounded-2xl border border-gray-200 bg-white/95 backdrop-blur-xl p-5 shadow-[0_18px_50px_rgba(20,18,28,0.16)]">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-xl">🍪</div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-gray-900">
                  We use cookies
                </h3>
                <p className="mt-1.5 text-xs sm:text-sm leading-5 text-gray-500">
                  We use cookies to improve your experience and understand how visitors use BotSmith.
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => handleCookieConsent('declined')}
                    variant="outline"
                    className="h-9 rounded-lg border-gray-200 px-4 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Decline
                  </Button>

                  <Button
                    type="button"
                    onClick={() => handleCookieConsent('accepted')}
                    className="h-9 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-4 text-xs font-medium text-white shadow-md shadow-purple-500/20 hover:from-purple-700 hover:to-pink-700"
                  >
                    Accept
                  </Button>

                  <button
                    type="button"
                    onClick={() => navigate('/cookie-policy')}
                    className="ml-1 text-xs font-medium text-purple-600 hover:text-purple-700"
                  >
                    Cookie Policy
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;