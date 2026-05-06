import { Facebook, Instagram, Linkedin, Mail, Twitter, Youtube } from 'lucide-react';
import { Suspense, useState, lazy } from 'react';
import { Link } from 'react-router-dom';
const PostRequirementModal = lazy(() => import('./modals/PostRequirementModal'));
const SupportModal = lazy(() => import('./modals/SupportModal'));

const Footer = () => {
  const [showPostRequirement, setShowPostRequirement] = useState(false);
  const [showSupport, setShowSupport] = useState(false);

  return (
    <>
      {showPostRequirement && (
        <Suspense fallback={null}>
          <PostRequirementModal
            isOpen={showPostRequirement}
            onClose={() => setShowPostRequirement(false)}
          />
        </Suspense>
      )}
      {showSupport && (
        <Suspense fallback={null}>
          <SupportModal
            isOpen={showSupport}
            onClose={() => setShowSupport(false)}
          />
        </Suspense>
      )}

      <footer className="bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-gray-100">
        <div className="container mx-auto px-4">
          {/* Main Footer Content */}
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 border-b border-gray-700 py-8 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[minmax(250px,1.1fr)_repeat(4,minmax(0,1fr))]">
            {/* Brand Column */}
            <div className="space-y-3.5">
              {/* ✅ Logo + Brand name side-by-side + ONE LINE heading */}
              <Link to="/" className="inline-flex max-w-full items-center gap-2.5" aria-label="Indian Trade Mart">
                <img
                  src="/itm-logo.png"
                  alt="IndianTradeMART Logo"
                  width="64"
                  height="64"
                  className="h-10 w-10 object-contain flex-shrink-0"
                  loading="lazy"
                  decoding="async"
                />

                {/* min-w-0 is important so text can shrink and not force wrap */}
                <div className="leading-tight min-w-0">
                  <h3
                    className="
                      text-white font-bold tracking-tight
                      whitespace-nowrap
                      text-[clamp(17px,1.5vw,23px)]
                    "
                  >
                    IndianTradeMart
                  </h3>
                  
                  <p className="mt-0.5 text-[11px] font-semibold tracking-wider text-gray-400">
                    B2B MARKETPLACE
                  </p>
                </div>
              </Link>

              <p className="max-w-xs text-sm leading-6 text-gray-300">
                Connecting businesses with trusted technology providers across India.
              </p>

              <div className="flex flex-wrap gap-2 pt-0.5">
                <a
                  href="https://www.facebook.com/IndianTradeMart/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-700 text-gray-300 transition-all duration-300 hover:bg-blue-600 hover:text-white"
                >
                  <Facebook className="h-4 w-4" />
                </a>

                <a
                  href="https://x.com/IndianTradeMart/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Twitter / X"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-700 text-gray-300 transition-all duration-300 hover:bg-blue-500 hover:text-white"
                >
                  <Twitter className="h-4 w-4" />
                </a>

                <a
                  href="https://www.linkedin.com/company/indian-trade-mart-itm/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-700 text-gray-300 transition-all duration-300 hover:bg-blue-700 hover:text-white"
                >
                  <Linkedin className="h-4 w-4" />
                </a>

                <a
                  href="https://www.instagram.com/indiantrademart/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-700 text-gray-300 transition-all duration-300 hover:bg-pink-600 hover:text-white"
                >
                  <Instagram className="h-4 w-4" />
                </a>

                <a
                  href="https://www.youtube.com/@itm-Indian-Trade-Mart"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="YouTube"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-700 text-gray-300 transition-all duration-300 hover:bg-red-600 hover:text-white"
                >
                  <Youtube className="h-4 w-4" />
                </a>
              </div>
            </div>

            {/* Information */}
            <div>
              <h4 className="mb-3 text-base font-bold text-white">Information</h4>
              <ul className="space-y-1.5 text-sm">
                <li>
                  <Link to="/about-us" className="text-gray-300 hover:text-blue-400 transition-colors">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link to="/press" className="text-gray-300 hover:text-blue-400 transition-colors">
                    Press Section
                  </Link>
                </li>
                <li>
                  <Link to="/investor" className="text-gray-300 hover:text-blue-400 transition-colors">
                    Investor Section
                  </Link>
                </li>
                <li>
                  <Link to="/join-sales" className="text-gray-300 hover:text-blue-400 transition-colors">
                    Join Sales
                  </Link>
                </li>
                <li>
                  <Link to="/success-stories" className="text-gray-300 hover:text-blue-400 transition-colors">
                    Success Stories
                  </Link>
                </li>
                <li>
                  <a href="https://blog.indiantrademart.com" className="text-gray-300 hover:text-blue-400 transition-colors">
                    Blog & Insights
                  </a>
                </li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="mb-3 text-base font-bold text-white">Support</h4>
              <ul className="space-y-1.5 text-sm">
                <li>
                  <Link to="/help" className="text-gray-300 hover:text-blue-400 transition-colors">
                    Help
                  </Link>
                </li>
                <li>
                  <Link to="/customer-care" className="text-gray-300 hover:text-blue-400 transition-colors">
                    Customer Care
                  </Link>
                </li>
                <li>
                  <Link to="/complaints" className="text-gray-300 hover:text-blue-400 transition-colors">
                    Complaints
                  </Link>
                </li>
                <li>
                  <Link to="/jobs" className="text-gray-300 hover:text-blue-400 transition-colors">
                    Jobs & Careers
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="text-gray-300 hover:text-blue-400 transition-colors">
                    Contact Us
                  </Link>
                </li>
              </ul>
            </div>

            {/* Suppliers Tool Kit */}
            <div>
              <h4 className="mb-3 text-base font-bold text-white">Suppliers Tool Kit</h4>
              <ul className="space-y-1.5 text-sm">
                <li>
                  <Link to="/vendor/register" className="text-gray-300 hover:text-blue-400 transition-colors">
                    Sell on Trade Mart
                  </Link>
                </li>
                <li>
                  <Link to="/buyleads" className="text-gray-300 hover:text-blue-400 transition-colors">
                    Latest BuyLead
                  </Link>
                </li>
                <li>
                  <Link to="/learning-centre" className="text-gray-300 hover:text-blue-400 transition-colors">
                    Learning Centre
                  </Link>
                </li>
                <li>
                  <Link to="/logistics" className="text-gray-300 hover:text-blue-400 transition-colors">
                    Ship With Trade Mart
                  </Link>
                </li>
              </ul>
            </div>

            {/* Buyers Tool Kit */}
            <div>
              <h4 className="mb-3 text-base font-bold text-white">Buyers Tool Kit</h4>
              <ul className="space-y-1.5 text-sm">
                <li>
                  <button
                    onClick={() => setShowPostRequirement(true)}
                    className="text-gray-300 hover:text-blue-400 transition-colors text-left"
                  >
                    Post Requirement
                  </button>
                </li>
                <li>
                  <Link to="/products" className="text-gray-300 hover:text-blue-400 transition-colors">
                    Products You Buy
                  </Link>
                </li>
                <li>
                  <Link to="/directory" className="text-gray-300 hover:text-blue-400 transition-colors">
                    Search Suppliers
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Contact Information */}
          <div className="border-b border-gray-700 py-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="flex items-start gap-2.5">
                <Mail className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-400" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-400 font-semibold">Customer Care</p>
                  <a
                    href="mailto:customercare@indiantrademart.com"
                    className="block break-all text-xs leading-5 text-gray-300 transition-colors hover:text-blue-400"
                  >
                    customercare@indiantrademart.com
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Mail className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-400" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-400 font-semibold">Support</p>
                  <a
                    href="mailto:support@indiantrademart.com"
                    className="block break-all text-xs leading-5 text-gray-300 transition-colors hover:text-blue-400"
                  >
                    support@indiantrademart.com
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Mail className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-400" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-400 font-semibold">Business</p>
                  <a
                    href="mailto:business@indiantrademart.com"
                    className="block break-all text-xs leading-5 text-gray-300 transition-colors hover:text-blue-400"
                  >
                    business@indiantrademart.com
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Bar */}
          <div className="flex flex-col items-center gap-2 py-4 text-center text-xs text-gray-400 md:flex-row md:items-center md:justify-between md:text-left">
            <p>&copy; {new Date().getFullYear()} Indian Trade Mart. All rights reserved.</p>
            <div className="flex flex-wrap items-center justify-center gap-4 md:justify-end">
              <Link to="/terms" className="hover:text-gray-200 transition-colors">
                Terms of Use
              </Link>
              <Link to="/privacy" className="hover:text-gray-200 transition-colors">
                Privacy Policy
              </Link>
              <Link to="/link-to-us" className="hover:text-gray-200 transition-colors">
                Link to Us
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
};

export default Footer;
