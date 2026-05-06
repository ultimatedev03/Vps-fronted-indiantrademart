import { Helmet } from 'react-helmet';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BarChart3, Building2, TrendingUp } from 'lucide-react';
import { successStoriesBySlug } from '@/modules/directory/pages/successStoriesData';

const SuccessStoryDetail = () => {
  const { storySlug } = useParams();
  const story = successStoriesBySlug[String(storySlug || '').trim()];

  if (!story) {
    return <Navigate to="/success-stories" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Helmet>
        <title>{story.title} | IndianTradeMart Success Stories</title>
        <meta name="description" content={story.excerpt} />
      </Helmet>

      <section className="bg-gradient-to-r from-slate-900 via-blue-900 to-blue-700 py-16 text-white">
        <div className="container mx-auto px-4">
          <Link to="/success-stories" className="inline-flex items-center gap-2 text-sm text-blue-100 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Back to all stories
          </Link>
          <div className="mt-6 max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-200">Success Story</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight">{story.title}</h1>
            <p className="mt-4 text-lg text-blue-100">{story.summary}</p>
          </div>
        </div>
      </section>

      <main className="container mx-auto px-4 py-12">
        <div className="grid gap-8 lg:grid-cols-[1.7fr_0.9fr]">
          <article className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-5">
                <Building2 className="h-5 w-5 text-blue-700" />
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Company</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{story.company}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-5">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Result</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{story.result}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-5">
                <BarChart3 className="h-5 w-5 text-amber-600" />
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Focus</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">Faster B2B growth execution</p>
              </div>
            </div>

            <div className="mt-8 space-y-8">
              <section>
                <h2 className="text-xl font-semibold text-slate-900">Challenge</h2>
                <p className="mt-3 text-slate-600">{story.challenge}</p>
              </section>
              <section>
                <h2 className="text-xl font-semibold text-slate-900">What changed</h2>
                <p className="mt-3 text-slate-600">{story.solution}</p>
              </section>
              <section>
                <h2 className="text-xl font-semibold text-slate-900">Outcome</h2>
                <p className="mt-3 text-slate-600">{story.outcome}</p>
              </section>
            </div>
          </article>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Want similar growth?</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Connect with our team to improve listing quality, lead handling, and quote turnaround for your business.
              </p>
              <div className="mt-6 space-y-3">
                <Link
                  to={`/contact?subject=${encodeURIComponent(`Discuss growth plan for ${story.company}`)}&message=${encodeURIComponent(`Hi team, I want to explore a growth plan like the ${story.company} success story.`)}`}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-700"
                >
                  Talk to our team
                </Link>
                <Link
                  to="/success-stories"
                  className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 px-4 py-3 font-medium text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
                >
                  Explore more stories
                </Link>
              </div>
            </div>

            <div className="rounded-3xl bg-slate-900 p-6 text-white shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-200">Next step</p>
              <h3 className="mt-3 text-2xl font-semibold">List smarter. Respond faster.</h3>
              <p className="mt-3 text-sm leading-6 text-slate-200">
                The biggest improvement across these stories is consistency: clearer listings, faster follow-up, and cleaner buyer qualification.
              </p>
              <Link to="/become-a-vendor" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-blue-200">
                Become a vendor
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default SuccessStoryDetail;
