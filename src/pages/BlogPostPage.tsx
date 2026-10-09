import React, { useState, useEffect } from 'react';
import { Clock, ArrowLeft, Share2, Tag, BookOpen, ArrowRight, User } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { FloatingWhatsApp } from '../components/layout/FloatingWhatsApp';
import { useToast } from '../context/ToastContext';
import { BlogPost } from '../types';
import { initialBlogPosts } from '../data/mockData';

export const BlogPostPage: React.FC = () => {
  const { showToast } = useToast();
  const pathParts = window.location.pathname.split('/');
  const slug = pathParts[pathParts.length - 1] || 'iphone-16-pro-max-vs-samsung-galaxy-s24-ultra-kenya';

  const defaultPost = initialBlogPosts.find((p) => p.slug === slug) || initialBlogPosts[0];
  const [post, setPost] = useState<BlogPost | null>(defaultPost || null);
  const [related, setRelated] = useState<BlogPost[]>(
    initialBlogPosts.filter((p) => p.slug !== slug).slice(0, 2)
  );
  const [loading, setLoading] = useState(!defaultPost);

  useEffect(() => {
    fetch(`/api/blog/${slug}`)
      .then((res) => {
        if (!res.ok) return null;
        const ct = res.headers.get('content-type');
        return ct && ct.includes('application/json') ? res.json() : null;
      })
      .then((data) => {
        if (data && data.success && data.post) {
          setPost(data.post);
          if (data.relatedPosts) setRelated(data.relatedPosts);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: post?.title, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      showToast('Article link copied to clipboard!', 'success');
    }
  };

  if (loading) {
    return (
      <div className="min-h-dvh flex flex-col bg-slate-950 text-slate-100">
        <Header currentPath="/blog" />
        <div className="flex-1 flex items-center justify-center p-20">
          <div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-dvh flex flex-col bg-slate-950 text-slate-100">
        <Header currentPath="/blog" />
        <div className="flex-1 flex items-center justify-center p-20 text-center">
          <div>
            <h2 className="text-xl font-bold text-white mb-2">Article Not Found</h2>
            <a href="/blog" className="text-cyan-400 text-xs font-bold hover:underline">
              Return to Tech News
            </a>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-600 selection:text-white">
      <Header currentPath="/blog" />

      {/* Breadcrumb Header */}
      <div className="bg-[#070b18] border-b border-slate-800 py-4 px-3 sm:px-4 lg:px-5">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-xs text-slate-400">
          <a href="/blog" className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 font-bold">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Guides</span>
          </a>

          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-1.5 hover:text-white font-semibold"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share</span>
          </button>
        </div>
      </div>

      {/* Main Article */}
      <main className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-5 py-10 flex-1 w-full space-y-8">
        <div className="space-y-4">
          <span className="px-3 py-1 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-400 text-xs font-bold uppercase tracking-wider">
            {post.category}
          </span>

          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-snug">
            {post.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 font-mono pb-4 border-b border-slate-800">
            <span className="flex items-center gap-1 text-white font-bold">
              <User className="w-3.5 h-3.5 text-cyan-400" /> {post.author}
            </span>
            <span>•</span>
            <span>Published {post.date}</span>
            <span>•</span>
            <span className="flex items-center gap-1 text-cyan-400">
              <Clock className="w-3.5 h-3.5" /> {post.readTime}
            </span>
          </div>
        </div>

        {/* Featured Image */}
        <div className="rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 h-72 sm:h-96 shadow-2xl">
          <img src={post.image} alt={post.title} className="w-full h-full object-cover" />
        </div>

        {/* Body Content */}
        <div className="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed space-y-4">
          <p className="text-base font-semibold text-white leading-relaxed">{post.excerpt}</p>
          <p>{post.content}</p>
        </div>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="pt-6 border-t border-slate-800 space-y-2">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Related Tags:</div>
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag, i) => (
                <span key={i} className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs text-cyan-300">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </main>

      <Footer />
      <FloatingWhatsApp />
    </div>
  );
};
