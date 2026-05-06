
import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Search, MapPin, Briefcase, Zap, Users } from 'lucide-react';

const CareerHome = () => {
  const location = useLocation();
  const [jobSearch, setJobSearch] = useState('');
  const openings = [
    { title: "Senior Frontend Engineer", dept: "Engineering", loc: "Remote / Bangalore" },
    { title: "Product Manager - Supply Chain", dept: "Product", loc: "Mumbai" },
    { title: "Enterprise Sales Manager", dept: "Sales", loc: "Delhi NCR" },
    { title: "Customer Success Executive", dept: "Support", loc: "Bangalore" },
  ];

  const filteredOpenings = useMemo(() => {
    const query = String(jobSearch || '').trim().toLowerCase();
    if (!query) return openings;
    return openings.filter((job) =>
      [job.title, job.dept, job.loc].join(' ').toLowerCase().includes(query)
    );
  }, [jobSearch]);

  const scrollToOpenings = () => {
    document.getElementById('career-openings')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const applyForRole = (jobTitle) => {
    window.location.href = `mailto:hr@indiantrademart.com?subject=${encodeURIComponent(`Application for ${jobTitle}`)}`;
  };

  useEffect(() => {
    if (location.hash !== '#career-openings') return;

    const frameId = window.requestAnimationFrame(scrollToOpenings);
    const timeoutId = window.setTimeout(scrollToOpenings, 180);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [location.hash]);

  return (
    <>
      <Helmet>
        <title>Careers at IndianTradeMart - Join Our Team</title>
      </Helmet>

      {/* Hero */}
      <section className="relative overflow-hidden bg-slate-900 py-16 text-white sm:py-20 xl:py-28">
         <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-10" />
         <div className="container mx-auto px-4 relative z-10 text-center">
            <span className="inline-block py-1 px-3 rounded-full bg-rose-500/20 text-rose-300 text-sm font-medium mb-6 border border-rose-500/30">
               We are hiring!
            </span>
            <h1 className="mx-auto mb-6 max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl xl:text-6xl">
               Build the Future of B2B Trade
            </h1>
            <p className="mx-auto mb-10 max-w-2xl text-lg text-slate-300 sm:text-xl">
               Join a team of passionate innovators revolutionizing how India does business. We're looking for thinkers, doers, and dreamers.
            </p>
            <div className="mx-auto flex max-w-xl flex-col justify-center gap-4 sm:flex-row">
               <div className="relative flex-1">
                  <Search className="absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search roles (e.g. Engineer)" 
                    value={jobSearch}
                    onChange={(event) => setJobSearch(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && scrollToOpenings()}
                    className="w-full h-12 pl-10 pr-4 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
               </div>
               <Button className="h-12 bg-rose-600 hover:bg-rose-700 font-bold px-8" onClick={scrollToOpenings}>
                  Find Jobs
               </Button>
            </div>
         </div>
      </section>

      {/* Stats */}
      <section className="border-b border-slate-200 bg-white py-10 sm:py-12">
         <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 gap-6 text-center sm:gap-8 md:grid-cols-4">
               <div>
                  <div className="text-3xl font-bold text-slate-900 mb-1">500+</div>
                  <div className="text-sm text-slate-500">Employees</div>
               </div>
               <div>
                  <div className="text-3xl font-bold text-slate-900 mb-1">3</div>
                  <div className="text-sm text-slate-500">Offices</div>
               </div>
               <div>
                  <div className="text-3xl font-bold text-slate-900 mb-1">4.8</div>
                  <div className="text-sm text-slate-500">Glassdoor Rating</div>
               </div>
               <div>
                  <div className="text-3xl font-bold text-slate-900 mb-1">50%</div>
                  <div className="text-sm text-slate-500">Female Workforce</div>
               </div>
            </div>
         </div>
      </section>

      {/* Open Roles */}
      <section id="career-openings" className="bg-slate-50 py-16 sm:py-20">
         <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-slate-900 mb-10 text-center">Current Openings</h2>
            
            <div className="grid gap-4 max-w-3xl mx-auto">
               {filteredOpenings.map((job, idx) => (
                  <div key={idx} className="group flex cursor-pointer flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 transition-all hover:border-rose-300 hover:shadow-md sm:flex-row sm:items-center sm:justify-between">
                     <div className="min-w-0">
                        <h3 className="font-bold text-lg text-slate-900 group-hover:text-rose-600 transition-colors">{job.title}</h3>
                        <div className="mt-2 flex flex-col gap-2 text-sm text-slate-500 sm:flex-row sm:items-center sm:gap-4">
                           <span className="flex items-center gap-1"><Briefcase className="w-4 h-4" /> {job.dept}</span>
                           <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {job.loc}</span>
                        </div>
                     </div>
                     <Button
                       variant="outline"
                       className="w-full shrink-0 border-rose-200 text-rose-600 hover:bg-rose-50 sm:w-auto"
                       onClick={() => applyForRole(job.title)}
                     >
                       Apply
                     </Button>
                  </div>
               ))}
            </div>

            {filteredOpenings.length === 0 ? (
               <p className="mt-6 text-center text-slate-500">
                  No roles matched "{jobSearch}". Try a broader keyword.
               </p>
            ) : null}
            
            <div className="text-center mt-10">
               <Button
                 variant="link"
                 className="text-rose-600 font-semibold"
                 onClick={() => {
                   setJobSearch('');
                   scrollToOpenings();
                 }}
               >
                 View All Openings &rarr;
               </Button>
            </div>
         </div>
      </section>
      
      {/* Culture */}
      <section className="bg-white py-16 sm:py-20">
         <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 gap-12 items-center lg:grid-cols-2">
               <div>
                  <h2 className="text-3xl font-bold text-slate-900 mb-6">Life at IndianTradeMart</h2>
                  <div className="space-y-6">
                     <div className="flex gap-4">
                        <div className="w-12 h-12 bg-rose-100 rounded-lg flex items-center justify-center text-rose-600 flex-shrink-0">
                           <Zap className="w-6 h-6" />
                        </div>
                        <div>
                           <h3 className="font-bold text-lg mb-2">Impact at Scale</h3>
                           <p className="text-slate-600">Your work will directly affect millions of small businesses across India.</p>
                        </div>
                     </div>
                     <div className="flex gap-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 flex-shrink-0">
                           <Users className="w-6 h-6" />
                        </div>
                        <div>
                           <h3 className="font-bold text-lg mb-2">Inclusive Culture</h3>
                           <p className="text-slate-600">We celebrate diversity and foster an environment where everyone belongs.</p>
                        </div>
                     </div>
                  </div>
               </div>
               <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <img src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80" alt="Office" className="rounded-2xl mt-8 shadow-lg" />
                  <img src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&q=80" alt="Team" className="rounded-2xl shadow-lg" />
               </div>
            </div>
         </div>
      </section>
    </>
  );
};

export default CareerHome;
