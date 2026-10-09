import React, { useState, useEffect } from 'react';
import { BookOpen, Clock, ArrowRight, Sparkles, Tag } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { FloatingWhatsApp } from '../components/layout/FloatingWhatsApp';
import { BlogPost } from '../types';
import { initialBlogPosts } from '../data/mockData';

export const BlogPage: React.FC = () => {
  const [posts, setPosts] = useState<BlogPost[]>(initialBlogPosts);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  useEffect(() => {
    fetch('/api/blog')
      .then((res) => {
        if (!res.ok) return null;
        const ct = res.headers.get('content-type');
        return ct && ct.includes('application/json') ? res.json() : null;
      })
      .then((data) => {
        if (data && data.posts && data.posts.length > 0) setPosts(data.posts);
      })
      .catch(() => {});
  }, []);

  const categories = ['All', 'Buying Guides', 'Laptop Reviews', 'Technology News'];

  const filteredPosts = selectedCategory === 'All'
    ? posts
    : posts.filter((p) => p.category === selectedCategory);

  return (
    <div className="min-h-dvh flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-600 selection:text-white">
      <Header currentPath="/blog" />

      {/* Hero Header */}
      <div className="bg-[#070b18] border-b border-slate-800 py-12 px-3 sm:px-4 lg:px-5">
        <div className="max-w-4xl mx-auto text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-800/60 text-cyan-400 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" /> Internext Tech Insights
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Kenya Technology News & Buying Guides
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto">
            Deep-dive technical comparisons, hardware advice for developers, battery endurance tests, and GaN charger guides.
          </p>

          {/* Category Tabs */}
          <div className="flex items-center justify-center gap-2 pt-4 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  selectedCategory === cat
                    ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                    : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-[1520px] mx-auto px-3 sm:px-4 lg:px-5 py-12 flex-1 w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {filteredPosts.map((post) => (
            <article
              key={post.id}
              className="bg-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-3xl overflow-hidden flex flex-col justify-between group transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl shadow-xl"
            >
              <div className="relative h-56 bg-slate-950 overflow-hidden">
                <img
                  src={post.image}
                  alt={post.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <span className="absolute top-3 left-3 px-3 py-1 rounded-lg bg-slate-950/85 backdrop-blur-md text-cyan-300 border border-slate-700 font-bold text-xs">
                  {post.category}
                </span>
              </div>

              <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-slate-400 text-xs font-mono">
                    <span>{post.date}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-cyan-400">
                      <Clock className="w-3.5 h-3.5" /> {post.readTime}
                    </span>
                  </div>

                  <a href={`/blog/${post.slug}`}>
                    <h2 className="text-base sm:text-lg font-black text-white group-hover:text-cyan-300 transition-colors leading-snug">
                      {post.title}
                    </h2>
                  </a>

                  <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
                    {post.excerpt}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-cyan-400">
                  <span className="text-slate-400 text-[11px]">By {post.author}</span>
                  <a
                    href={`/blog/${post.slug}`}
                    className="flex items-center gap-1 hover:translate-x-1 transition-transform"
                  >
                    <span>Read Article</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>

      <Footer />
      <FloatingWhatsApp />
    </div>
  );
};
