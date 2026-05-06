import { submitContactForm } from '@/modules/directory/services/contactApi';
import { directoryApi } from '@/modules/directory/api/directoryApi';
import {
  FooterPageAction,
  FooterPageBulletList,
  FooterPageCard,
  FooterPageSection,
  FooterPageShell,
} from '@/modules/directory/components/FooterPageShell';
import { successStories } from '@/modules/directory/pages/successStoriesData';
import {
  BadgeCheck,
  BookOpen,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  Handshake,
  Headphones,
  Heart,
  Loader,
  Mail,
  Link2,
  MapPin,
  Phone,
  Rocket,
  Search,
  ShieldCheck,
  ShoppingCart,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { getProductDetailPath as buildProductDetailPath } from '@/shared/utils/productRoutes';
import { getVendorProfilePath } from '@/shared/utils/vendorRoutes';

const buildMailtoLink = (email, subject) =>
  `mailto:${email}?subject=${encodeURIComponent(subject || '')}`;

const buildContactPath = ({ subject = '', message = '' } = {}) => {
  const params = new URLSearchParams();
  if (subject) params.set('subject', subject);
  if (message) params.set('message', message);
  const query = params.toString();
  return query ? `/contact?${query}` : '/contact';
};

const CAREER_OPENINGS_PATH = '/career#career-openings';

// ==================== JOIN SALES PAGE ====================
export const JoinSales = () => (
  <FooterPageShell
    eyebrow="Sales Partnerships"
    title="Join Our Sales Team"
    description="Help Indian Trade Mart expand into new markets, onboard quality suppliers, and turn verified demand into long-term business relationships."
    stats={[
      { label: 'Regional opportunities', value: '15+' },
      { label: 'Flexible role tracks', value: '4' },
      { label: 'Structured onboarding', value: '100%' },
      { label: 'Growth reach', value: 'Pan-India' },
    ]}
    aside={(
      <div className="space-y-5">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300">
          <Handshake className="h-6 w-6" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-white">Built for ambitious sales professionals.</h2>
          <p className="text-sm leading-6 text-slate-300">
            Whether you work in field sales, partner enablement, or account growth, we provide a clearer operating structure and faster lead handoff.
          </p>
        </div>
        <FooterPageBulletList
          className="text-slate-200"
          items={[
            'Direct exposure to high-intent B2B buyer demand',
            'Support from a central platform, onboarding, and marketing team',
            'Scope to grow with regional and category expansion plans',
          ]}
        />
      </div>
    )}
  >
    <div className="grid gap-6 lg:grid-cols-2">
      <FooterPageSection
        title="What you will work on"
        description="A practical sales role focused on supplier acquisition, account growth, and long-term retention."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FooterPageCard className="space-y-3">
            <Users className="h-6 w-6 text-emerald-600" />
            <h3 className="text-lg font-semibold text-slate-950">Seller acquisition</h3>
            <p className="text-sm leading-6 text-slate-600">Identify credible businesses, guide onboarding, and improve listing readiness.</p>
          </FooterPageCard>
          <FooterPageCard className="space-y-3">
            <TrendingUp className="h-6 w-6 text-blue-700" />
            <h3 className="text-lg font-semibold text-slate-950">Territory growth</h3>
            <p className="text-sm leading-6 text-slate-600">Build stronger category coverage and increase supply depth in priority regions.</p>
          </FooterPageCard>
          <FooterPageCard className="space-y-3">
            <BadgeCheck className="h-6 w-6 text-slate-900" />
            <h3 className="text-lg font-semibold text-slate-950">Quality onboarding</h3>
            <p className="text-sm leading-6 text-slate-600">Help new partners launch with the right profile data, catalogue quality, and conversion basics.</p>
          </FooterPageCard>
          <FooterPageCard className="space-y-3">
            <Rocket className="h-6 w-6 text-amber-600" />
            <h3 className="text-lg font-semibold text-slate-950">Account expansion</h3>
            <p className="text-sm leading-6 text-slate-600">Work with active sellers to improve response speed, lead conversion, and retention.</p>
          </FooterPageCard>
        </div>
      </FooterPageSection>

      <FooterPageSection
        title="What you get"
        description="A clearer page structure, more visible calls to action, and cleaner spacing across devices."
        action={<FooterPageAction to={CAREER_OPENINGS_PATH}>View current openings</FooterPageAction>}
      >
        <FooterPageBulletList
          items={[
            'Clear role expectations across acquisition, onboarding, and growth',
            'Defined contact path for application and hiring follow-up',
            'A layout consistent with the rest of the marketplace experience',
            'Room for future expansion into region-specific postings',
          ]}
        />
      </FooterPageSection>
    </div>
  </FooterPageShell>
);

// ==================== SUCCESS STORIES PAGE ====================
export const SuccessStories = () => (
  <FooterPageShell
    eyebrow="Market Wins"
    title="Success Stories"
    description="See how suppliers and buyers use Indian Trade Mart to improve visibility, generate qualified enquiries, and build repeat business."
    stats={[
      { label: 'Featured stories', value: `${successStories.length}+` },
      { label: 'Marketplace coverage', value: 'Multi-sector' },
      { label: 'Primary focus', value: 'Growth' },
      { label: 'Content format', value: 'Case-led' },
    ]}
    aside={(
      <div className="space-y-4">
        <Star className="h-8 w-8 text-amber-300" />
        <p className="text-xl font-semibold text-white">Real outcomes, cleaner presentation.</p>
        <p className="text-sm leading-6 text-slate-300">
          Each story now sits inside a structured content card instead of a plain, under-designed list block.
        </p>
      </div>
    )}
  >
    <FooterPageSection
      title="Featured growth stories"
      description="Each story is presented with stronger hierarchy, more breathing room, and a clearer next step."
    >
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {successStories.map((story) => (
          <FooterPageCard key={story.slug} className="flex h-full flex-col gap-4 bg-white">
            <span className="inline-flex w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
              Success Story
            </span>
            <div className="space-y-3">
              <h3 className="text-xl font-semibold tracking-tight text-slate-950">{story.title}</h3>
              <p className="text-sm leading-6 text-slate-600">{story.excerpt}</p>
            </div>
            <div className="mt-auto pt-2">
              <FooterPageAction to={`/success-stories/${story.slug}`} variant="secondary">
                Read full story
              </FooterPageAction>
            </div>
          </FooterPageCard>
        ))}
      </div>
    </FooterPageSection>
  </FooterPageShell>
);

// ==================== HELP PAGE ====================
export const Help = () => {
  const helpTopics = [
    {
      topic: 'Getting Started',
      items: ['Create your account and complete your profile', 'Understand how enquiries and responses work', 'Set up the right category and location information'],
    },
    {
      topic: 'Account Management',
      items: ['Update business details and credentials', 'Review settings, access, and profile quality', 'Keep communication details current'],
    },
    {
      topic: 'Buying',
      items: ['Search suppliers and compare listings', 'Post requirements with complete specifications', 'Shortlist partners with relevant capabilities'],
    },
    {
      topic: 'Selling',
      items: ['Improve listings and product visibility', 'Respond faster to qualified leads', 'Strengthen trust with complete business information'],
    },
    {
      topic: 'Payments',
      items: ['Review billing and subscription status', 'Understand support for payment-related issues', 'Keep records available for quick resolution'],
    },
    {
      topic: 'Shipping',
      items: ['Coordinate dispatch expectations early', 'Align fulfilment details with buyers', 'Reach support for shipping and delivery queries'],
    },
  ];

  return (
    <FooterPageShell
      eyebrow="Help Centre"
      title="Find answers without friction"
      description="The help page now uses a structured knowledge layout with cleaner spacing, stronger section rhythm, and more readable topic cards."
      stats={[
        { label: 'Help topics', value: `${helpTopics.length}` },
        { label: 'Coverage', value: 'Buyer + Seller' },
        { label: 'Support routes', value: '3' },
        { label: 'Response path', value: 'Direct' },
      ]}
      aside={(
        <div className="space-y-4">
          <BookOpen className="h-8 w-8 text-blue-200" />
          <p className="text-xl font-semibold text-white">Start with the right topic.</p>
          <p className="text-sm leading-6 text-slate-300">
            Each topic card has been rebuilt to feel like part of the main site rather than a plain placeholder block.
          </p>
        </div>
      )}
    >
      <FooterPageSection
        title="Browse by topic"
        description="Use the sections below to find the right starting point for onboarding, buying, selling, and support."
      >
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {helpTopics.map((topic) => (
            <FooterPageCard key={topic.topic} className="space-y-4 bg-white">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
                <BookOpen className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-slate-950">{topic.topic}</h3>
              <FooterPageBulletList items={topic.items} />
            </FooterPageCard>
          ))}
        </div>
      </FooterPageSection>

      <FooterPageSection
        title="Need direct assistance?"
        description="If you do not find the answer quickly, route your query through the most relevant support path."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <FooterPageCard className="space-y-3">
            <Headphones className="h-6 w-6 text-emerald-600" />
            <h3 className="text-lg font-semibold text-slate-950">Customer care</h3>
            <p className="text-sm leading-6 text-slate-600">For account, listing, or support issues that need hands-on help.</p>
            <FooterPageAction to="/customer-care" variant="secondary">Visit customer care</FooterPageAction>
          </FooterPageCard>
          <FooterPageCard className="space-y-3">
            <Mail className="h-6 w-6 text-blue-700" />
            <h3 className="text-lg font-semibold text-slate-950">Contact support</h3>
            <p className="text-sm leading-6 text-slate-600">Share the issue context so the team can follow up with the right owner.</p>
            <FooterPageAction
              to={buildContactPath({
                subject: 'Help Centre Support Request',
                message: 'Hi team, I need assistance with an issue not covered in the help centre. Please contact me.',
              })}
              variant="secondary"
            >
              Send a request
            </FooterPageAction>
          </FooterPageCard>
          <FooterPageCard className="space-y-3">
            <ShieldCheck className="h-6 w-6 text-slate-900" />
            <h3 className="text-lg font-semibold text-slate-950">Complaints desk</h3>
            <p className="text-sm leading-6 text-slate-600">Raise escalations separately so they are routed with higher urgency and traceability.</p>
            <FooterPageAction to="/complaints" variant="secondary">Raise a complaint</FooterPageAction>
          </FooterPageCard>
        </div>
      </FooterPageSection>
    </FooterPageShell>
  );
};

// ==================== CUSTOMER CARE PAGE ====================
export const CustomerCare = () => (
  <FooterPageShell
    eyebrow="Customer Care"
    title="Dedicated support for buyers and suppliers"
    description="This page now uses clearer contact cards, more consistent spacing, and a cleaner support flow instead of a loosely stacked layout."
    stats={[
      { label: 'Primary phone line', value: '+91 7290010051' },
      { label: 'Support email', value: 'support@indiantrademart.com' },
      { label: 'Support channels', value: '3' },
      { label: 'Business coverage', value: 'Mon-Sat' },
    ]}
    aside={(
      <div className="space-y-4">
        <Headphones className="h-8 w-8 text-emerald-300" />
        <p className="text-xl font-semibold text-white">Your issue should feel easy to route.</p>
        <p className="text-sm leading-6 text-slate-300">
          Contact details, common questions, and next actions are grouped into distinct sections for faster scanning on desktop and mobile.
        </p>
      </div>
    )}
  >
    <FooterPageSection
      title="Contact information"
      description="Reach out through the support path that fits your issue best."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <FooterPageCard className="space-y-3 bg-white">
          <Phone className="h-6 w-6 text-emerald-600" />
          <h3 className="text-lg font-semibold text-slate-950">Call us</h3>
          <p className="text-sm text-slate-600">Speak with the support team for urgent marketplace issues.</p>
          <a href="tel:+917290010051" className="text-sm font-semibold text-slate-900 hover:text-emerald-700">+91 7290010051</a>
        </FooterPageCard>
        <FooterPageCard className="min-w-0 space-y-3 bg-white">
          <Mail className="h-6 w-6 text-blue-700" />
          <h3 className="text-lg font-semibold text-slate-950">Email us</h3>
          <p className="text-sm text-slate-600">Share the full issue context so the right team can respond accurately.</p>
          <a
            href="mailto:support@indiantrademart.com"
            className="block max-w-full break-all text-sm font-semibold leading-6 text-slate-900 hover:text-blue-700"
          >
            support@indiantrademart.com
          </a>
        </FooterPageCard>
        <FooterPageCard className="space-y-3 bg-white">
          <MapPin className="h-6 w-6 text-slate-900" />
          <h3 className="text-lg font-semibold text-slate-950">Visit us</h3>
          <p className="text-sm leading-6 text-slate-600">672, White House, Behind- MCD School, MG Road, Ghitorni, New Delhi, Delhi 110030</p>
        </FooterPageCard>
      </div>
    </FooterPageSection>

    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <FooterPageSection
        title="Frequently asked questions"
        description="The most common support intents are now presented with consistent spacing and separation."
      >
        <div className="space-y-4">
          {[
            'How do I create an account?',
            'How do I place an order?',
            'What is your return policy?',
            'How long does delivery take?',
          ].map((faq) => (
            <FooterPageCard key={faq} className="bg-white">
              <h3 className="text-lg font-semibold text-slate-950">{faq}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">Find detailed answers to this question in our knowledge base or contact support for account-specific guidance.</p>
            </FooterPageCard>
          ))}
        </div>
      </FooterPageSection>

      <FooterPageSection
        title="Support options"
        description="Take the route that best matches your issue."
      >
        <div className="space-y-4">
          <FooterPageCard className="space-y-3 bg-white">
            <h3 className="text-lg font-semibold text-slate-950">Submit a ticket</h3>
            <p className="text-sm leading-6 text-slate-600">Use the contact form for detailed assistance and traceable follow-up.</p>
            <FooterPageAction
              to={buildContactPath({
                subject: 'Customer Care Support Request',
                message: 'Hi team, I need support with my account / order / listing. Please contact me.',
              })}
            >
              Submit ticket
            </FooterPageAction>
          </FooterPageCard>
          <FooterPageCard className="space-y-3 bg-white">
            <h3 className="text-lg font-semibold text-slate-950">Start an email conversation</h3>
            <p className="text-sm leading-6 text-slate-600">Send the support team your issue directly if you prefer email-first communication.</p>
            <FooterPageAction
              href={buildMailtoLink('support@indiantrademart.com', 'Customer Care Support Request')}
              variant="secondary"
            >
              Email support
            </FooterPageAction>
          </FooterPageCard>
          <FooterPageCard className="space-y-3 bg-white">
            <h3 className="text-lg font-semibold text-slate-950">Share feedback</h3>
            <p className="text-sm leading-6 text-slate-600">Tell us where the product or support experience needs improvement.</p>
            <FooterPageAction
              to={buildContactPath({
                subject: 'Customer Care Feedback',
                message: 'Hi team, I would like to share feedback about my experience with IndianTradeMart.',
              })}
              variant="secondary"
            >
              Share feedback
            </FooterPageAction>
          </FooterPageCard>
        </div>
      </FooterPageSection>
    </div>
  </FooterPageShell>
);

// ==================== COMPLAINTS PAGE ====================
export const Complaints = () => (
  <FooterPageShell
    eyebrow="Escalations"
    title="Complaints & Grievances"
    description="Complaints now have a more deliberate layout with clearer next steps, higher visual trust, and stronger separation from general support content."
    stats={[
      { label: 'Intake path', value: 'Structured' },
      { label: 'Tracking', value: 'Documented' },
      { label: 'Escalation channel', value: 'Direct' },
      { label: 'Response mode', value: 'Follow-up' },
    ]}
    aside={(
      <div className="space-y-4">
        <ShieldCheck className="h-8 w-8 text-emerald-300" />
        <p className="text-xl font-semibold text-white">Escalations should feel accountable.</p>
        <p className="text-sm leading-6 text-slate-300">
          The page now frames grievances with stronger trust cues and a clearer filing path instead of a single isolated block.
        </p>
      </div>
    )}
  >
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <FooterPageSection
        title="How we handle complaints"
        description="Share the issue clearly so it can be reviewed, routed, and resolved with the right level of urgency."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: FileText,
              title: 'Describe the issue',
              text: 'Include dates, affected account or listing details, and the outcome you expect.',
            },
            {
              icon: BadgeCheck,
              title: 'We review the context',
              text: 'The team checks the complaint, validates the details, and routes it to the right owner.',
            },
            {
              icon: ShieldCheck,
              title: 'Follow-up and closure',
              text: 'You receive a response path for clarification, action, or closure based on the case.',
            },
          ].map((item) => (
            <FooterPageCard key={item.title} className="space-y-3 bg-white">
              <item.icon className="h-6 w-6 text-slate-900" />
              <h3 className="text-lg font-semibold text-slate-950">{item.title}</h3>
              <p className="text-sm leading-6 text-slate-600">{item.text}</p>
            </FooterPageCard>
          ))}
        </div>
      </FooterPageSection>

      <FooterPageSection
        title="File a complaint"
        description="Use the dedicated complaint route so your issue is not mixed with standard support traffic."
        action={(
          <FooterPageAction
            to={buildContactPath({
              subject: 'Complaint / Grievance Submission',
              message: 'Hi team, I would like to file a complaint. Please review the issue described below.',
            })}
          >
            File complaint
          </FooterPageAction>
        )}
      >
        <FooterPageBulletList
          items={[
            'Summarise the issue and the timeline clearly',
            'Include listing, order, or account references when relevant',
            'State the resolution or follow-up you expect from the team',
          ]}
        />
      </FooterPageSection>
    </div>
  </FooterPageShell>
);

// ==================== JOBS PAGE ====================
export const Jobs = () => {
  const roles = [
    'Software Engineer',
    'Sales Manager',
    'Business Analyst',
    'Marketing Executive',
  ];

  return (
    <FooterPageShell
      eyebrow="Careers"
      title="Jobs & Careers"
      description="Open roles are now displayed in cleaner job cards with better hierarchy, spacing, and a stronger call to action."
      stats={[
        { label: 'Featured openings', value: `${roles.length}` },
        { label: 'Role types', value: 'Product + Growth' },
        { label: 'Locations', value: 'India' },
        { label: 'Application route', value: 'Direct' },
      ]}
      aside={(
        <div className="space-y-4">
          <BriefcaseBusiness className="h-8 w-8 text-blue-200" />
          <p className="text-xl font-semibold text-white">A clearer talent entry point.</p>
          <p className="text-sm leading-6 text-slate-300">
            The new structure presents roles as proper opportunity cards with a consistent CTA pattern instead of a flat list.
          </p>
        </div>
      )}
    >
      <FooterPageSection
        title="Current openings"
        description="Representative roles currently highlighted for hiring conversations."
        action={<FooterPageAction to={CAREER_OPENINGS_PATH}>Apply now</FooterPageAction>}
      >
        <div className="grid gap-4 md:grid-cols-2">
          {roles.map((job) => (
            <FooterPageCard key={job} className="flex flex-col gap-4 bg-white">
              <div className="inline-flex w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">
                Open Role
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-slate-950">{job}</h3>
                <p className="text-sm leading-6 text-slate-600">Location: India. Role details, fit, and next steps are handled through the careers team.</p>
              </div>
              <div className="mt-auto pt-2">
                <FooterPageAction to={CAREER_OPENINGS_PATH} variant="secondary">View details</FooterPageAction>
              </div>
            </FooterPageCard>
          ))}
        </div>
      </FooterPageSection>
    </FooterPageShell>
  );
};

// ==================== CONTACT PAGE ====================
export const ContactPage = () => {
  const [searchParams] = useSearchParams();
  const normalizePhone = (value) =>
    String(value || '')
      .replace(/\D/g, '')
      .slice(0, 10);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    subject: searchParams.get('subject') || '',
    message: searchParams.get('message') || ''
  });
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      subject: searchParams.get('subject') || '',
      message: searchParams.get('message') || '',
    }));
  }, [searchParams]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const normalizedValue = name === 'phone' ? normalizePhone(value) : value;
    setFormData(prev => ({
      ...prev,
      [name]: normalizedValue
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (!formData.firstName || !formData.email || !formData.message) {
        throw new Error('Please fill in all required fields (First Name, Email, Message)');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        throw new Error('Please enter a valid email address');
      }
      if (formData.phone && !/^\d{10}$/.test(formData.phone)) {
        throw new Error('Please enter a valid 10-digit contact number');
      }

      const fullName = `${formData.firstName} ${formData.lastName}`.trim();

      await submitContactForm({
        name: fullName,
        email: formData.email,
        phone: formData.phone,
        message: `Subject: ${formData.subject || 'No Subject'}\n\n${formData.message}`
      });

      setSuccessMessage('Thank you! Your message has been sent successfully. We will get back to you soon.');
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        subject: '',
        message: ''
      });

      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error) {
      setErrorMessage(error.message || 'Failed to send message. Please try again.');
      console.error('Contact form error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FooterPageShell
      eyebrow="Contact"
      title="Get in touch with our team"
      description="The contact page now follows the same visual system as the rest of the public site, with clearer information blocks and a more polished enquiry form."
      stats={[
        { label: 'Primary email', value: 'support@indiantrademart.com' },
        { label: 'Primary phone', value: '+91 7290010051' },
        { label: 'Office city', value: 'New Delhi' },
        { label: 'Business hours', value: 'Mon-Sat' },
      ]}
      aside={(
        <div className="space-y-4">
          <Clock className="h-8 w-8 text-emerald-300" />
          <p className="text-xl font-semibold text-white">Fast routing starts with the right context.</p>
          <p className="text-sm leading-6 text-slate-300">
            Share your subject and message clearly, and the team can direct the enquiry to support, business development, or operations more efficiently.
          </p>
        </div>
      )}
    >
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <FooterPageSection
          title="Contact information"
          description="Reach out through email, phone, or the contact form depending on the type of help you need."
        >
          <div className="space-y-4">
            <FooterPageCard className="space-y-3 bg-white">
              <Mail className="h-6 w-6 text-blue-700" />
              <h3 className="text-lg font-semibold text-slate-950">Email support</h3>
              <a href="mailto:support@indiantrademart.com" className="text-sm font-semibold text-slate-900 hover:text-blue-700">
                support@indiantrademart.com
              </a>
            </FooterPageCard>
            <FooterPageCard className="space-y-3 bg-white">
              <Phone className="h-6 w-6 text-emerald-600" />
              <h3 className="text-lg font-semibold text-slate-950">Phone support</h3>
              <a href="tel:+917290010051" className="text-sm font-semibold text-slate-900 hover:text-emerald-700">
                +91 7290010051
              </a>
            </FooterPageCard>
            <FooterPageCard className="space-y-3 bg-white">
              <MapPin className="h-6 w-6 text-slate-900" />
              <h3 className="text-lg font-semibold text-slate-950">Office address</h3>
              <p className="text-sm leading-6 text-slate-600">
                Indian Trade Mart Pvt. Ltd.
                <br />
                672, White House, Behind- MCD School, MG Road
                <br />
                Ghitorni, New Delhi, Delhi 110030
              </p>
            </FooterPageCard>
            <FooterPageCard className="space-y-3 bg-white">
              <Clock className="h-6 w-6 text-amber-600" />
              <h3 className="text-lg font-semibold text-slate-950">Business hours</h3>
              <p className="text-sm leading-6 text-slate-600">
                Monday - Friday: 9:00 AM - 6:00 PM
                <br />
                Saturday: 10:00 AM - 4:00 PM
                <br />
                Sunday: Closed
              </p>
            </FooterPageCard>
            <FooterPageCard className="bg-slate-50">
              <h3 className="text-lg font-semibold text-slate-950">Department contacts</h3>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex flex-col gap-1 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-slate-600">General Information</span>
                  <span className="font-medium text-slate-900">info@indiantrademart.com</span>
                </div>
                <div className="flex flex-col gap-1 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-slate-600">Customer Care</span>
                  <span className="font-medium text-slate-900">customercare@indiantrademart.com</span>
                </div>
                <div className="flex flex-col gap-1 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-slate-600">Business Development</span>
                  <span className="font-medium text-slate-900">bd@indiantrademart.com</span>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-slate-600">HR Department</span>
                  <span className="font-medium text-slate-900">hr@indiantrademart.com</span>
                </div>
              </div>
            </FooterPageCard>
          </div>
        </FooterPageSection>

        <FooterPageSection
          title="Send us a message"
          description="Provide the basic details below and the team will follow up through the right department."
        >
          {successMessage && (
            <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-sm font-medium text-emerald-800">{successMessage}</p>
            </div>
          )}

          {errorMessage && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm font-medium text-red-800">{errorMessage}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">First Name *</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Your first name"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Your last name"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Email Address *</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="your.email@example.com"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Phone Number</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                inputMode="numeric"
                pattern="[0-9]{10}"
                maxLength={10}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="10-digit mobile number"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Subject</label>
              <input
                type="text"
                name="subject"
                value={formData.subject}
                onChange={handleInputChange}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="Subject of your message"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Message *</label>
              <textarea
                name="message"
                value={formData.message}
                onChange={handleInputChange}
                rows={6}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="Please describe your inquiry in detail..."
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-6 py-3.5 font-semibold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {loading ? (
                <>
                  <Loader className="h-5 w-5 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Message'
              )}
            </button>
          </form>
        </FooterPageSection>
      </div>
    </FooterPageShell>
  );
};

// ==================== LINK TO US PAGE ====================
export const LinkToUs = () => (
  <FooterPageShell
    eyebrow="Partnership Links"
    title="Link to Indian Trade Mart"
    description="Use these linking guidelines if you want to reference Indian Trade Mart from your website, blog, partner portal, or supplier resource page."
    stats={[
      { label: 'Preferred target', value: 'Homepage' },
      { label: 'Suggested text', value: 'Indian Trade Mart' },
      { label: 'Use case', value: 'SEO + referrals' },
      { label: 'Link type', value: 'Direct' },
    ]}
    aside={(
      <div className="space-y-4">
        <Link2 className="h-8 w-8 text-blue-200" />
        <p className="text-xl font-semibold text-white">Give visitors a clear route to the marketplace.</p>
        <p className="text-sm leading-6 text-slate-300">
          Link to the homepage or a relevant category page when you want buyers and suppliers to discover Indian Trade Mart through your content.
        </p>
      </div>
    )}
  >
    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <FooterPageSection
        title="Recommended linking options"
        description="Use simple, descriptive anchor text and route visitors to the most relevant public page."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <FooterPageCard className="space-y-3 bg-white">
            <h3 className="text-lg font-semibold text-slate-950">Homepage link</h3>
            <p className="text-sm leading-6 text-slate-600">Best for general references, directory roundups, and marketplace mentions.</p>
            <code className="block rounded-xl bg-slate-950 px-4 py-3 text-xs text-slate-100">https://indiantrademart.com/</code>
          </FooterPageCard>
          <FooterPageCard className="space-y-3 bg-white">
            <h3 className="text-lg font-semibold text-slate-950">Supplier discovery link</h3>
            <p className="text-sm leading-6 text-slate-600">Use this when your audience specifically wants to browse sellers and compare suppliers.</p>
            <code className="block rounded-xl bg-slate-950 px-4 py-3 text-xs text-slate-100">https://indiantrademart.com/directory/vendor</code>
          </FooterPageCard>
        </div>
      </FooterPageSection>

      <FooterPageSection
        title="Suggested anchor text"
        description="Keep anchor text natural, relevant, and easy to understand."
      >
        <FooterPageBulletList
          items={[
            'Indian Trade Mart',
            'Find suppliers on Indian Trade Mart',
            'Explore B2B products and vendors',
            'Browse Indian Trade Mart marketplace listings',
          ]}
        />
        <div className="mt-6">
          <FooterPageAction to="/contact" variant="secondary">Request partnership support</FooterPageAction>
        </div>
      </FooterPageSection>
    </div>
  </FooterPageShell>
);

// ==================== BUY LEADS PAGE ====================
export const BuyLeads = () => (
  <FooterPageShell
    eyebrow="Buyer Demand"
    title="Latest Buy Leads"
    description="Buy leads now sit inside a clearer presentation with stronger spacing, better card balance, and a more intentional call to action."
    stats={[
      { label: 'Lead quality', value: 'Verified' },
      { label: 'Coverage', value: 'Pan-India' },
      { label: 'Audience', value: 'Suppliers' },
      { label: 'Next step', value: 'Register' },
    ]}
    aside={(
      <div className="space-y-4">
        <ShoppingCart className="h-8 w-8 text-emerald-300" />
        <p className="text-xl font-semibold text-white">Qualified demand matters more than noise.</p>
        <p className="text-sm leading-6 text-slate-300">
          This page now frames buy leads as a supplier growth tool, instead of a single low-information card.
        </p>
      </div>
    )}
  >
    <FooterPageSection
      title="Why browse buy leads"
      description="Review fresh demand from verified buyers and move faster on relevant opportunities."
      action={<FooterPageAction to="/vendor/register">Browse buy leads</FooterPageAction>}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <FooterPageCard className="space-y-3 bg-white">
          <ShoppingCart className="h-6 w-6 text-emerald-600" />
          <h3 className="text-lg font-semibold text-slate-950">Real buying intent</h3>
          <p className="text-sm leading-6 text-slate-600">Focus on active buyer requirements instead of broad, unqualified traffic.</p>
        </FooterPageCard>
        <FooterPageCard className="space-y-3 bg-white">
          <Eye className="h-6 w-6 text-blue-700" />
          <h3 className="text-lg font-semibold text-slate-950">Faster visibility</h3>
          <p className="text-sm leading-6 text-slate-600">Match your offering to relevant enquiries and improve response speed.</p>
        </FooterPageCard>
        <FooterPageCard className="space-y-3 bg-white">
          <TrendingUp className="h-6 w-6 text-slate-900" />
          <h3 className="text-lg font-semibold text-slate-950">Stronger pipeline</h3>
          <p className="text-sm leading-6 text-slate-600">Use buy leads to create a more predictable top-of-funnel for your sales team.</p>
        </FooterPageCard>
      </div>
    </FooterPageSection>
  </FooterPageShell>
);

// ==================== LEARNING CENTRE PAGE ====================
export const LearningCentre = () => (
  <FooterPageShell
    eyebrow="Learning Centre"
    title="Master the skills to grow on the marketplace"
    description="The learning section now feels like a proper public page, with stronger card hierarchy and better spacing around each training module."
    stats={[
      { label: 'Starter modules', value: '3' },
      { label: 'Audience', value: 'Suppliers' },
      { label: 'Focus', value: 'Growth' },
      { label: 'Format', value: 'Guided' },
    ]}
    aside={(
      <div className="space-y-4">
        <BookOpen className="h-8 w-8 text-blue-200" />
        <p className="text-xl font-semibold text-white">Training should feel worth exploring.</p>
        <p className="text-sm leading-6 text-slate-300">
          Each module now appears as a polished card with clearer purpose and stronger action styling.
        </p>
      </div>
    )}
  >
    <FooterPageSection
      title="Featured learning modules"
      description="Practical tracks for onboarding, visibility, and supplier-side growth."
    >
      <div className="grid gap-5 md:grid-cols-3">
        {['Getting Started', 'Sales Strategies', 'Digital Marketing'].map((course) => (
          <FooterPageCard key={course} className="flex flex-col gap-4 bg-white">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-slate-950">{course}</h3>
              <p className="text-sm leading-6 text-slate-600">Learn from industry experts and platform practitioners with a more structured learning path.</p>
            </div>
            <div className="mt-auto pt-2">
              <FooterPageAction
                to={buildContactPath({
                  subject: `Learning Centre Enrollment - ${course}`,
                  message: `Hi team, I want to know more about the "${course}" learning module.`,
                })}
                variant="secondary"
              >
                Enroll now
              </FooterPageAction>
            </div>
          </FooterPageCard>
        ))}
      </div>
    </FooterPageSection>
  </FooterPageShell>
);

const FilterSelect = ({
  id,
  label,
  value,
  options,
  onChange,
  disabled,
  openKey,
  setOpenKey,
  menuPlacement = 'bottom',
}) => {
  const rootRef = useRef(null);
  const [menuMaxHeight, setMenuMaxHeight] = useState(256);
  const selectedOption = options.find((option) => option.value === value) || options[0];
  const isOpen = openKey === id;
  const menuPositionClass = menuPlacement === 'top' ? 'bottom-full mb-1' : 'top-full mt-1';

  useEffect(() => {
    if (!isOpen) return undefined;

    const updateMenuHeight = () => {
      const root = rootRef.current;
      if (!root || typeof window === 'undefined') return;

      const rect = root.getBoundingClientRect();
      const viewportPadding = 16;
      const preferredHeight = 220;
      const minHeight = 112;
      const available =
        menuPlacement === 'top'
          ? rect.top - viewportPadding
          : window.innerHeight - rect.bottom - viewportPadding;

      setMenuMaxHeight(Math.max(minHeight, Math.min(preferredHeight, available)));
    };

    updateMenuHeight();
    window.addEventListener('resize', updateMenuHeight);
    window.addEventListener('scroll', updateMenuHeight, true);

    return () => {
      window.removeEventListener('resize', updateMenuHeight);
      window.removeEventListener('scroll', updateMenuHeight, true);
    };
  }, [isOpen, menuPlacement]);

  return (
    <div ref={rootRef} className="relative" data-filter-select-root>
      <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">{label}</span>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setOpenKey(isOpen ? '' : id)}
        className="flex h-10 w-full items-center justify-between gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-left text-[13px] font-semibold text-slate-800 outline-none transition hover:bg-white focus:border-[#003D82]/40 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="min-w-0 truncate">{selectedOption?.label || value}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className={`absolute left-0 right-0 z-50 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl ${menuPositionClass}`}>
          <div
            role="listbox"
            aria-label={label}
            className="overflow-y-auto py-1"
            style={{ maxHeight: `${menuMaxHeight}px` }}
          >
            {options.map((option) => {
              const selected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(option.value);
                    setOpenKey('');
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition ${
                    selected
                      ? 'bg-blue-50 font-bold text-[#003D82]'
                      : 'font-medium text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {selected && <Check size={16} className="shrink-0 text-[#00796B]" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const normalizeLocationKey = (value = '') =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const INDIAN_LOCATION_COORDS = {
  agra: { lat: 27.1767, lng: 78.0081 },
  ahmedabad: { lat: 23.0225, lng: 72.5714 },
  amravati: { lat: 20.9374, lng: 77.7796 },
  anand: { lat: 22.5645, lng: 72.9289 },
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  bangalore: { lat: 12.9716, lng: 77.5946 },
  bharuch: { lat: 21.7051, lng: 72.9959 },
  chennai: { lat: 13.0827, lng: 80.2707 },
  delhi: { lat: 28.6139, lng: 77.209 },
  ghaziabad: { lat: 28.6692, lng: 77.4538 },
  gondal: { lat: 21.9607, lng: 70.8022 },
  gorakhpur: { lat: 26.7606, lng: 83.3732 },
  'greater noida': { lat: 28.4744, lng: 77.504 },
  gurugram: { lat: 28.4595, lng: 77.0266 },
  hyderabad: { lat: 17.385, lng: 78.4867 },
  indore: { lat: 22.7196, lng: 75.8577 },
  jaipur: { lat: 26.9124, lng: 75.7873 },
  jalandhar: { lat: 31.326, lng: 75.5762 },
  jetpur: { lat: 21.7548, lng: 70.6235 },
  jhansi: { lat: 25.4484, lng: 78.5685 },
  junagadh: { lat: 21.5222, lng: 70.4579 },
  kanpur: { lat: 26.4499, lng: 80.3319 },
  kolkata: { lat: 22.5726, lng: 88.3639 },
  lucknow: { lat: 26.8467, lng: 80.9462 },
  mumbai: { lat: 19.076, lng: 72.8777 },
  noida: { lat: 28.5355, lng: 77.391 },
  pune: { lat: 18.5204, lng: 73.8567 },
  rajkot: { lat: 22.3039, lng: 70.8022 },
  'ranga reddy': { lat: 17.3891, lng: 78.4799 },
  surat: { lat: 21.1702, lng: 72.8311 },
  vadodara: { lat: 22.3072, lng: 73.1812 },
  chandigarh: { lat: 30.7333, lng: 76.7794 },
  gujarat: { lat: 22.2587, lng: 71.1924 },
  maharashtra: { lat: 19.7515, lng: 75.7139 },
  telangana: { lat: 18.1124, lng: 79.0193 },
  'uttar pradesh': { lat: 26.8467, lng: 80.9462 },
  'west bengal': { lat: 22.9868, lng: 87.855 },
  rajasthan: { lat: 27.0238, lng: 74.2179 },
  punjab: { lat: 31.1471, lng: 75.3412 },
  'madhya pradesh': { lat: 22.9734, lng: 78.6569 },
};

const getApproxCoordsForLocation = (location = '') => {
  const parts = String(location || '')
    .split(',')
    .map((part) => normalizeLocationKey(part))
    .filter(Boolean);

  for (const part of parts) {
    if (INDIAN_LOCATION_COORDS[part]) return INDIAN_LOCATION_COORDS[part];
  }

  return INDIAN_LOCATION_COORDS[normalizeLocationKey(location)] || null;
};

const distanceKmBetween = (a, b) => {
  if (!a || !b) return null;
  const toRad = (value) => (Number(value) * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const formatDistanceKm = (distance) => {
  if (!Number.isFinite(distance)) return '';
  if (distance < 10) return `${distance.toFixed(1)} km`;
  return `${Math.round(distance)} km`;
};

// ==================== PRODUCTS YOU BUY PAGE ====================
export const ProductsPage = () => {
  const PRODUCTS_PER_PAGE = 24;
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedHeadCategory, setSelectedHeadCategory] = useState('All Categories');
  const [selectedSubCategory, setSelectedSubCategory] = useState('All Subcategories');
  const [selectedLocation, setSelectedLocation] = useState('All Locations');
  const [selectedAvailability, setSelectedAvailability] = useState('all');
  const [locationMode, setLocationMode] = useState('all');
  const [userCoords, setUserCoords] = useState(null);
  const [geoStatus, setGeoStatus] = useState('idle');
  const [openFilter, setOpenFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const pickFirstImageUrl = (images) => {
    const imgs = images;
    if (Array.isArray(imgs) && imgs.length > 0) {
      const first = imgs[0];
      if (typeof first === 'string' && first.trim()) return first.trim();
      if (first && typeof first === 'object') {
        const url = first.url || first.image_url || first.src;
        if (typeof url === 'string' && url.trim()) return url.trim();
      }
    }
    return '';
  };

  const normalizeFeatures = (specs) => {
    let data = specs;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        data = null;
      }
    }
    if (!Array.isArray(data)) return [];

    const out = [];
    for (const item of data) {
      if (!item) continue;
      if (typeof item === 'string') out.push(item);
      if (item && typeof item === 'object') {
        const label = item.label || item.name || item.key;
        const value = item.value || item.val;
        if (label && value) out.push(`${label}: ${value}`);
        else if (label) out.push(label);
      }
      if (out.length >= 6) break;
    }
    return out;
  };

  const formatPrice = (price, unit) => {
    const num = Number(price);
    if (!Number.isFinite(num) || num <= 0) return 'Price on request';
    const formatted = new Intl.NumberFormat('en-IN').format(num);
    return `₹${formatted}${unit ? ` / ${unit}` : ''}`;
  };

  const formatMinOrder = (qty, unit) => {
    const num = Number(qty);
    if (!Number.isFinite(num) || num <= 0) return '—';
    return `${num}${unit ? ` ${unit}` : ''}`;
  };

  const pickText = (...values) =>
    values.map((value) => String(value || '').trim()).find(Boolean) || '';

  const buildCategoryTrail = (product) => {
    const pathParts = String(product?.category_path || '')
      .split('>')
      .map((part) => part.trim())
      .filter(Boolean);
    const micro = product?.micro_categories || {};
    const sub = micro?.sub_categories || product?.sub_categories || {};
    const head = sub?.head_categories || product?.head_categories || {};
    const direct = pickText(product?.category, product?.category_other);

    const fallbackHead = pickText(pathParts.length >= 2 ? pathParts[0] : '', direct, pathParts[0], 'General');
    const fallbackSub = pickText(
      pathParts.length >= 2 ? pathParts[1] : '',
      direct,
      pathParts[0],
      fallbackHead,
      'General'
    );
    const fallbackMicro = pickText(
      pathParts.length >= 3 ? pathParts[pathParts.length - 1] : '',
      direct,
      pathParts[pathParts.length - 1],
      fallbackSub,
      'General'
    );

    const headCategory = pickText(product?.head_category_name, head?.name, fallbackHead);
    const subCategory = pickText(product?.sub_category_name, sub?.name, fallbackSub);
    const microCategory = pickText(product?.micro_category_name, micro?.name, fallbackMicro);
    const categoryTrail = [headCategory, subCategory, microCategory].filter((value, index, list) => {
      const normalized = value.toLowerCase();
      return normalized && list.findIndex((item) => item.toLowerCase() === normalized) === index;
    });

    return {
      headCategory: headCategory || 'General',
      subCategory: subCategory || headCategory || 'General',
      microCategory: microCategory || subCategory || headCategory || 'General',
      categoryTrail,
    };
  };

  const normalizeDedupText = (value) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');

  const buildProductDedupKey = (product) => {
    const vendorKey = normalizeDedupText(product?.vendorId || product?.supplier);
    const nameKey = normalizeDedupText(product?.name);

    if (vendorKey && nameKey) {
      return `${vendorKey}|${nameKey}`;
    }

    return normalizeDedupText(
      product?.slug ||
      product?.id ||
      `${product?.name}|${product?.supplier}|${product?.location}`
    );
  };

  const scoreProductForListing = (product) => {
    let score = 0;
    if (product?.inStock) score += 16;
    if (product?.verified) score += 8;
    if (product?.image) score += 4;
    if (product?.slug) score += 2;
    if (product?.priceValue > 0) score += 1.5;
    if (product?.supplier) score += 1;
    score += Math.min(Number(product?.reviews) || 0, 50);
    score += Math.min(String(product?.description || '').trim().length, 120) / 100;
    return score;
  };

  const getProductDetailPath = (product) =>
    buildProductDetailPath(product) || getVendorProfilePath({ slug: product?.vendorSlug, id: product?.vendorId }) || '/contact';

  const getSupplierPath = (product) =>
    getVendorProfilePath({ slug: product?.vendorSlug, id: product?.vendorId }) || '/contact';

  const requestUserLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoStatus('unavailable');
      return;
    }

    setGeoStatus('loading');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUserCoords({ lat: coords.latitude, lng: coords.longitude });
        setGeoStatus('ready');
        setLocationMode('nearby');
      },
      () => {
        setGeoStatus('blocked');
        setLocationMode('all');
      },
      {
        enableHighAccuracy: false,
        maximumAge: 10 * 60 * 1000,
        timeout: 8000,
      }
    );
  };

  useEffect(() => {
    requestUserLocation();
  }, []);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const { data } = await directoryApi.searchProducts({ q: '', page: 1, limit: 200 });
        const list = (Array.isArray(data) ? data : []).map((p) => {
          const vendor = p?.vendors || {};
          const location = [vendor?.city || p?.city, vendor?.state || p?.state].filter(Boolean).join(', ');
          const safeLocation = location || 'India';
          const rating = Number(vendor?.seller_rating);
          const views = Number(p?.views);
          const trail = buildCategoryTrail(p);

          return {
            id: p?.id,
            slug: p?.slug || '',
            name: p?.name || 'Unnamed Product',
            category: trail.microCategory,
            headCategory: trail.headCategory,
            subCategory: trail.subCategory,
            microCategory: trail.microCategory,
            categoryTrail: trail.categoryTrail,
            description: p?.description || '',
            price: formatPrice(p?.price, p?.price_unit),
            priceValue: Number(p?.price) || 0,
            minOrder: formatMinOrder(p?.min_order_qty ?? p?.moq, p?.qty_unit),
            supplier: vendor?.company_name || '',
            vendorId: vendor?.id || '',
            vendorSlug: vendor?.slug || '',
            location: safeLocation,
            locationCoords: getApproxCoordsForLocation(safeLocation),
            rating: Number.isFinite(rating) ? rating : 0,
            reviews: Number.isFinite(views) ? views : 0,
            verified: !!(
              vendor?.verification_badge ||
              vendor?.is_verified ||
              String(vendor?.kyc_status || '').toUpperCase() === 'APPROVED'
            ),
            features: normalizeFeatures(p?.specifications),
            inStock: true,
            image: pickFirstImageUrl(p?.images),
            createdAt: p?.created_at || '',
          };
        });

        const uniqueMap = new Map();
        for (const item of list) {
          const key = buildProductDedupKey(item);
          const existing = uniqueMap.get(key);
          if (!existing || scoreProductForListing(item) > scoreProductForListing(existing)) {
            uniqueMap.set(key, item);
          }
        }
        const uniqueList = Array.from(uniqueMap.values());

        if (!alive) return;
        setProducts(uniqueList);
      } catch (error) {
        console.error('Failed to load products:', error);
        if (!alive) return;
        setProducts([]);
        setLoadError('Failed to load products. Please try again.');
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!openFilter) return undefined;

    const closeOnOutsideInteraction = (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-filter-select-root]')) return;
      setOpenFilter('');
    };

    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpenFilter('');
    };

    document.addEventListener('pointerdown', closeOnOutsideInteraction);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideInteraction);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [openFilter]);

  const headCategoryCounts = useMemo(() => {
    const counts = new Map();
    (products || []).forEach((product) => {
      const value = String(product?.headCategory || 'General').trim();
      if (value) counts.set(value, (counts.get(value) || 0) + 1);
    });
    return counts;
  }, [products]);

  const subCategoryCounts = useMemo(() => {
    const counts = new Map();
    (products || []).forEach((product) => {
      if (selectedHeadCategory !== 'All Categories' && product.headCategory !== selectedHeadCategory) return;
      const value = String(product?.subCategory || 'General').trim();
      if (value) counts.set(value, (counts.get(value) || 0) + 1);
    });
    return counts;
  }, [products, selectedHeadCategory]);

  const locationCounts = useMemo(() => {
    const counts = new Map();
    (products || []).forEach((p) => {
      if (selectedHeadCategory !== 'All Categories' && p.headCategory !== selectedHeadCategory) return;
      if (selectedSubCategory !== 'All Subcategories' && p.subCategory !== selectedSubCategory) return;
      const value = String(p?.location || '').trim();
      if (value) counts.set(value, (counts.get(value) || 0) + 1);
    });
    return counts;
  }, [products, selectedHeadCategory, selectedSubCategory]);

  const headCategories = useMemo(
    () => ['All Categories', ...Array.from(headCategoryCounts.keys()).sort((a, b) => a.localeCompare(b))],
    [headCategoryCounts]
  );

  const subCategories = useMemo(() => {
    return ['All Subcategories', ...Array.from(subCategoryCounts.keys()).sort((a, b) => a.localeCompare(b))];
  }, [subCategoryCounts]);

  const locations = useMemo(
    () => ['All Locations', ...Array.from(locationCounts.keys()).sort((a, b) => a.localeCompare(b))],
    [locationCounts]
  );

  const headCategoryOptions = useMemo(
    () => headCategories.map((cat) => ({
      value: cat,
      label: cat === 'All Categories' ? cat : `${cat} (${headCategoryCounts.get(cat) || 0})`,
    })),
    [headCategories, headCategoryCounts]
  );

  const subCategoryOptions = useMemo(
    () => subCategories.map((cat) => ({
      value: cat,
      label: cat === 'All Subcategories' ? cat : `${cat} (${subCategoryCounts.get(cat) || 0})`,
    })),
    [subCategories, subCategoryCounts]
  );

  const locationOptions = useMemo(
    () => locations.map((loc) => ({
      value: loc,
      label: loc === 'All Locations' ? loc : `${loc} (${locationCounts.get(loc) || 0})`,
    })),
    [locations, locationCounts]
  );

  const availabilityCounts = useMemo(() => {
    const counts = { all: 0, in_stock: 0 };

    (products || []).forEach((product) => {
      if (selectedHeadCategory !== 'All Categories' && product.headCategory !== selectedHeadCategory) return;
      if (selectedSubCategory !== 'All Subcategories' && product.subCategory !== selectedSubCategory) return;
      if (selectedLocation !== 'All Locations' && product.location !== selectedLocation) return;

      counts.all += 1;
      if (product.inStock) counts.in_stock += 1;
    });

    return counts;
  }, [products, selectedHeadCategory, selectedSubCategory, selectedLocation]);

  const availabilityOptions = useMemo(
    () => [
      { value: 'all', label: `All products (${availabilityCounts.all})` },
      { value: 'in_stock', label: `Available now (${availabilityCounts.in_stock})` },
    ],
    [availabilityCounts]
  );

  const getProductDistanceKm = (product) => {
    if (!userCoords) return null;
    return distanceKmBetween(userCoords, product?.locationCoords || getApproxCoordsForLocation(product?.location));
  };

  const recommendedLocations = useMemo(() => {
    const rows = Array.from(locationCounts.entries()).map(([name, count]) => {
      const coords = getApproxCoordsForLocation(name);
      return {
        name,
        count,
        distanceKm: userCoords && coords ? distanceKmBetween(userCoords, coords) : null,
      };
    });

    return rows
      .sort((a, b) => {
        const aHasDistance = Number.isFinite(a.distanceKm);
        const bHasDistance = Number.isFinite(b.distanceKm);
        if (aHasDistance && bHasDistance) return a.distanceKm - b.distanceKm || b.count - a.count;
        if (aHasDistance) return -1;
        if (bHasDistance) return 1;
        return b.count - a.count || a.name.localeCompare(b.name);
      })
      .slice(0, 7);
  }, [locationCounts, userCoords]);

  useEffect(() => {
    if (selectedHeadCategory !== 'All Categories' && !headCategories.includes(selectedHeadCategory)) {
      setSelectedHeadCategory('All Categories');
    }
  }, [headCategories, selectedHeadCategory]);

  useEffect(() => {
    if (selectedSubCategory !== 'All Subcategories' && !subCategories.includes(selectedSubCategory)) {
      setSelectedSubCategory('All Subcategories');
    }
  }, [selectedSubCategory, subCategories]);

  useEffect(() => {
    if (selectedLocation !== 'All Locations' && !locations.includes(selectedLocation)) {
      setSelectedLocation('All Locations');
    }
  }, [locations, selectedLocation]);

  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return (products || []).filter((product) => {
      if (query) {
        const hay = [
          product.name,
          product.description,
          product.category,
          product.headCategory,
          product.subCategory,
          product.microCategory,
          ...(product.categoryTrail || []),
          product.location,
          product.supplier,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(query)) return false;
      }
      if (selectedHeadCategory !== 'All Categories' && product.headCategory !== selectedHeadCategory) return false;
      if (selectedSubCategory !== 'All Subcategories' && product.subCategory !== selectedSubCategory) return false;
      if (selectedLocation !== 'All Locations' && product.location !== selectedLocation) return false;
      if (selectedAvailability === 'in_stock' && !product.inStock) return false;
      return true;
    });
  }, [products, searchTerm, selectedHeadCategory, selectedSubCategory, selectedLocation, selectedAvailability]);

  const visibleProducts = useMemo(() => {
    const list = [...filteredProducts];
    return list.sort((a, b) => {
      if (locationMode === 'nearby' && userCoords && selectedLocation === 'All Locations') {
        const aDistance = distanceKmBetween(userCoords, a.locationCoords);
        const bDistance = distanceKmBetween(userCoords, b.locationCoords);
        const aHasDistance = Number.isFinite(aDistance);
        const bHasDistance = Number.isFinite(bDistance);

        if (aHasDistance && bHasDistance) {
          const distanceDelta = aDistance - bDistance;
          if (Math.abs(distanceDelta) > 25) return distanceDelta;
        } else if (aHasDistance) {
          return -1;
        } else if (bHasDistance) {
          return 1;
        }
      }

      return scoreProductForListing(b) - scoreProductForListing(a);
    });
  }, [filteredProducts, locationMode, selectedLocation, userCoords]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(visibleProducts.length / PRODUCTS_PER_PAGE)),
    [visibleProducts.length]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedHeadCategory, selectedSubCategory, selectedLocation, selectedAvailability, locationMode]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(Math.max(page, 1), totalPages));
  }, [totalPages]);

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * PRODUCTS_PER_PAGE;
    return visibleProducts.slice(start, start + PRODUCTS_PER_PAGE);
  }, [currentPage, visibleProducts]);

  const paginationPages = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const pages = [1];
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    if (start > 2) pages.push('start-ellipsis');
    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }
    if (end < totalPages - 1) pages.push('end-ellipsis');
    pages.push(totalPages);

    return pages;
  }, [currentPage, totalPages]);

  const defaultLocationMode = geoStatus === 'ready' ? 'nearby' : 'all';

  const hasActiveFilters =
    !!searchTerm.trim() ||
    selectedHeadCategory !== 'All Categories' ||
    selectedSubCategory !== 'All Subcategories' ||
    selectedLocation !== 'All Locations' ||
    selectedAvailability !== 'all' ||
    locationMode !== defaultLocationMode;

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedHeadCategory('All Categories');
    setSelectedSubCategory('All Subcategories');
    setSelectedLocation('All Locations');
    setSelectedAvailability('all');
    setLocationMode(defaultLocationMode);
    setCurrentPage(1);
    setOpenFilter('');
  };

  const goToPage = (page) => {
    const nextPage = Math.min(Math.max(page, 1), totalPages);
    setCurrentPage(nextPage);

    window.requestAnimationFrame(() => {
      document.getElementById('products-results')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  const renderPaginationControls = () => {
    if (totalPages <= 1) return null;

    return (
      <nav
        aria-label="Products pagination"
        className="mt-8 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="text-sm font-semibold text-slate-500">
          Page {currentPage} of {totalPages}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white"
          >
            <ChevronLeft size={16} />
            Prev
          </button>

          {paginationPages.map((page) => {
            if (typeof page !== 'number') {
              return (
                <span key={page} className="inline-flex h-9 min-w-9 items-center justify-center px-1 text-sm font-bold text-slate-400">
                  ...
                </span>
              );
            }

            const isCurrent = page === currentPage;
            return (
              <button
                key={page}
                type="button"
                onClick={() => goToPage(page)}
                aria-current={isCurrent ? 'page' : undefined}
                className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-3 text-sm font-bold transition ${
                  isCurrent
                    ? 'border-[#003D82] bg-[#003D82] text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-blue-50'
                }`}
              >
                {page}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white"
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      </nav>
    );
  };

  const renderProductCard = (product) => {
    const productPath = getProductDetailPath(product);
    const supplierPath = getSupplierPath(product);
    const distanceText = formatDistanceKm(getProductDistanceKm(product));

    return (
      <article key={buildProductDedupKey(product)} className="group flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-[#00A699]/50 hover:shadow-[0_14px_32px_rgba(15,23,42,0.09)]">
        <div className="relative border-b border-slate-100 p-1.5">
          <Link
            to={productPath}
            className="flex aspect-[11/5] min-h-[92px] items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-[#003D82] via-sky-600 to-[#00A699]"
            aria-label={`View ${product.name}`}
          >
            {product.image ? (
              <img
                src={product.image}
                alt={product.name}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="px-4 text-center text-white">
                <ShoppingCart size={24} className="mx-auto mb-1.5" />
                <div className="text-xs font-semibold">{product.microCategory || product.category}</div>
              </div>
            )}
          </Link>
          <div className="absolute right-3 top-3 flex gap-1">
            <Link
              to={supplierPath}
              className="relative z-10 inline-flex rounded-full bg-white/95 p-1.5 shadow-md transition hover:bg-blue-50"
              aria-label="Contact supplier"
              title="Contact supplier"
            >
              <Mail size={13} className="text-[#003D82]" />
            </Link>
            <Link
              to={productPath}
              className="relative z-10 inline-flex rounded-full bg-white/95 p-1.5 shadow-md transition hover:bg-blue-50"
              aria-label="View product"
              title="View product"
            >
              <Eye size={13} className="text-[#003D82]" />
            </Link>
          </div>
        </div>

        <div className="flex flex-1 flex-col p-3">
          <div className="mb-1.5 flex items-start justify-between gap-2">
            <span className="min-w-0 flex-1 truncate text-[11px] font-bold uppercase text-[#003D82]">
              {product.microCategory || product.category}
            </span>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
              product.verified
                ? 'border-emerald-100 bg-emerald-50 text-[#00796B]'
                : 'border-blue-100 bg-blue-50 text-[#003D82]'
            }`}>
              {product.verified ? 'ITM Verified' : 'ITM Listed'}
            </span>
          </div>

          <Link
            to={productPath}
            className="min-h-[38px] overflow-hidden text-sm font-extrabold leading-5 text-slate-950 transition hover:text-[#003D82]"
            style={{
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
            }}
          >
            {product.name}
          </Link>
          <p
            className="mt-1.5 h-[17px] overflow-hidden text-xs leading-[17px] text-slate-600"
            style={{
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 1,
            }}
          >
            {product.description || 'Share your requirement to get supplier quotations and product details.'}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-slate-600">
            {product.rating > 0 && (
              <div className="flex items-center">
                <Star className="mr-1 text-yellow-500" size={13} />
                <span className="font-semibold text-slate-800">{product.rating.toFixed(1)}</span>
                {product.reviews > 0 && (
                  <span className="ml-1 text-slate-500">({product.reviews})</span>
                )}
              </div>
            )}

            <div className="flex min-w-0 items-center">
              <MapPin className="mr-1 shrink-0 text-[#00796B]" size={13} />
              <span className="truncate">{product.location}</span>
            </div>
            {distanceText && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-[#00796B]">
                {distanceText}
              </span>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5">
              <span className="block text-[10px] font-bold uppercase text-slate-400">Price</span>
              <span className="mt-0.5 block truncate font-extrabold text-[#00796B]">{product.price}</span>
            </div>
            <div className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5">
              <span className="block text-[10px] font-bold uppercase text-slate-400">MOQ</span>
              <span className="mt-0.5 block truncate font-bold text-slate-800">{product.minOrder}</span>
            </div>
          </div>

          <div className="mt-auto flex gap-2 pt-3">
            <Link
              to={productPath}
              className="relative z-10 inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-[#003D82] px-2.5 py-2 text-center text-xs font-bold text-white transition-colors hover:bg-[#002B5C]"
            >
              <Eye size={13} />
              Details
            </Link>
            <Link
              to={supplierPath}
              className="relative z-10 inline-flex items-center justify-center gap-1.5 rounded-md border border-[#00A699]/25 px-2.5 py-2 text-xs font-bold text-[#00796B] transition hover:bg-emerald-50"
            >
              <Mail size={13} />
              Quote
            </Link>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Helmet>
        <title>Products Marketplace | Source B2B Products from Verified Suppliers in India</title>
        <meta
          name="description"
          content="Browse IndianTradeMart products from verified manufacturers, suppliers, exporters and service providers. Filter by category and location, compare prices, and send enquiries to trusted sellers."
        />
        <meta
          name="keywords"
          content="B2B products India, verified suppliers India, manufacturers marketplace, wholesale products, industrial products, supplier directory, product sourcing India, IndianTradeMart products"
        />
        <link rel="canonical" href="https://indiantrademart.com/products" />
      </Helmet>

      <main className="mx-auto max-w-7xl px-4 py-6 md:py-8">
        {loadError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {loadError}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[210px_minmax(0,1fr)] xl:grid-cols-[210px_minmax(0,1fr)_240px]">
          <aside className="self-start rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm lg:sticky lg:top-24">
            <div className="mb-3 flex items-center justify-between gap-2.5">
              <div>
                <h2 className="text-sm font-extrabold text-slate-950">Filters</h2>
                <p className="mt-0.5 text-[11px] text-slate-500">Browse faster.</p>
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-[#003D82] transition hover:bg-blue-50"
                >
                  Reset
                </button>
              )}
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Search</span>
                <span className="relative block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder="Product, supplier, category"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    disabled={loading}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-[13px] font-medium text-slate-900 outline-none transition focus:border-[#003D82]/40 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </span>
              </label>

              <FilterSelect
                id="category"
                label="Category"
                value={selectedHeadCategory}
                options={headCategoryOptions}
                disabled={loading}
                openKey={openFilter}
                setOpenKey={setOpenFilter}
                onChange={(nextValue) => {
                  setSelectedHeadCategory(nextValue);
                  setSelectedSubCategory('All Subcategories');
                }}
              />

              <FilterSelect
                id="subcategory"
                label="Subcategory"
                value={selectedSubCategory}
                options={subCategoryOptions}
                disabled={loading}
                openKey={openFilter}
                setOpenKey={setOpenFilter}
                onChange={setSelectedSubCategory}
              />

              <FilterSelect
                id="location"
                label="Location"
                value={selectedLocation}
                options={locationOptions}
                disabled={loading}
                openKey={openFilter}
                setOpenKey={setOpenFilter}
                onChange={setSelectedLocation}
              />

              <FilterSelect
                id="availability"
                label="Availability"
                value={selectedAvailability}
                options={availabilityOptions}
                disabled={loading}
                openKey={openFilter}
                setOpenKey={setOpenFilter}
                onChange={setSelectedAvailability}
              />
            </div>

          </aside>

          <section id="products-results" className="min-w-0 scroll-mt-24">
            {loading ? (
              <div className="flex items-center justify-center rounded-lg border border-slate-200 bg-white py-16 text-gray-600">
                <Loader className="mr-2 h-5 w-5 animate-spin" />
                Loading products...
              </div>
            ) : visibleProducts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white py-12 text-center">
                <p className="text-lg font-semibold text-slate-800">No products found matching your criteria.</p>
                <p className="mt-2 text-sm text-slate-500">Try a broader product keyword, category, or location.</p>
              </div>
            ) : (
              <>
                <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {paginatedProducts.map(renderProductCard)}
                </div>
                {renderPaginationControls()}
              </>
            )}
          </section>

          {!loading && (
            <aside className="self-start rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm lg:col-start-2 xl:col-start-auto xl:sticky xl:top-24">
              <div className="mb-3">
                <p className="text-[11px] font-bold uppercase text-[#00796B]">Location filter</p>
                <h2 className="mt-0.5 text-sm font-extrabold text-slate-950">Recommended near you</h2>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLocationMode('nearby');
                    setSelectedLocation('All Locations');
                    if (!userCoords) requestUserLocation();
                  }}
                  className={`min-h-10 rounded-lg border px-2.5 py-2 text-[11px] font-extrabold transition ${
                    locationMode === 'nearby' && selectedLocation === 'All Locations'
                      ? 'border-[#003D82] bg-[#003D82] text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-blue-50'
                  }`}
                >
                  Nearby first
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLocationMode('all');
                    setSelectedLocation('All Locations');
                  }}
                  className={`min-h-10 rounded-lg border px-2.5 py-2 text-[11px] font-extrabold transition ${
                    locationMode === 'all' && selectedLocation === 'All Locations'
                      ? 'border-[#003D82] bg-[#003D82] text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-blue-50'
                  }`}
                >
                  All India
                </button>
              </div>

              <button
                type="button"
                onClick={requestUserLocation}
                disabled={geoStatus === 'loading'}
                className="mt-2.5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#00A699]/25 bg-emerald-50 px-3 py-2 text-[11px] font-extrabold text-[#00796B] transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {geoStatus === 'loading' ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
                {geoStatus === 'ready' ? 'Update my location' : 'Use my location'}
              </button>

              <p className="mt-2 text-[11px] leading-4 text-slate-500">
                {geoStatus === 'ready'
                  ? 'Nearest suppliers are prioritized first.'
                  : geoStatus === 'blocked'
                    ? 'Location access is off. All India results are shown.'
                    : 'Choose nearby or browse all India locations.'}
              </p>

              <div className="mt-3 border-t border-slate-100 pt-2.5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold uppercase text-slate-500">Recommended locations</p>
                  <span className="text-[11px] font-bold text-slate-400">{recommendedLocations.length}</span>
                </div>

                <div className="max-h-[280px] space-y-1 overflow-y-auto pr-1">
                  {recommendedLocations.map((item) => {
                    const selected = selectedLocation === item.name;
                    const distanceLabel = formatDistanceKm(item.distanceKm);
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => {
                          setSelectedLocation(selected ? 'All Locations' : item.name);
                          setLocationMode(selected ? (userCoords ? 'nearby' : 'all') : 'all');
                        }}
                        className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-bold transition ${
                          selected
                            ? 'bg-[#003D82] text-white'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate">{item.name}</span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${
                          selected ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {distanceLabel || item.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedLocation !== 'All Locations' && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLocation('All Locations');
                    setLocationMode('all');
                  }}
                  className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-extrabold text-[#003D82] transition hover:bg-blue-50"
                >
                  Show distant locations
                </button>
              )}
            </aside>
          )}
        </div>

      </main>
    </div>
  );
};
