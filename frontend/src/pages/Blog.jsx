import React, { useMemo, useState } from 'react';
import { Search, ArrowUpRight, ChevronRight, ArrowLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/*
  BotSmith Blog

  Publishing model:
  - Blog.jsx contains the layout and blog UI only.
  - Individual article content lives in /src/blog/*.md
  - Each Markdown file should expose frontmatter like:

    ---
    title: "How AI Is Changing Student Support"
    slug: "how-ai-is-changing-student-support"
    category: "AI for Education"
    date: "2026-09-20"
    excerpt: "A short description..."
    featured: false
    coverImage: "/blog/images/student-support.jpg"
    ---

  Recommended route in App.jsx:

    <Route path="/blog/*" element={<Blog />} />

  Markdown is loaded as raw text by the CRACO Webpack configuration
  and rendered in the browser with react-markdown.
*/

// -----------------------------------------------------------------------------
// Markdown blog content
// -----------------------------------------------------------------------------
// Every .md file inside src/content/blog becomes a blog post automatically.
// Add a new Markdown file and redeploy — Blog.jsx does not need to be edited.
const blogFiles = require.context('../content/blog', false, /\.md$/);

const parseMarkdownPost = (source) => {
  const match = source.match(/^---\\s*([\\s\\S]*?)\\s*---\\s*([\\s\\S]*)$/);

  if (!match) {
    return {
      data: {},
      content: source,
    };
  }

  const frontmatter = {};

  match[1].split('\\n').forEach((line) => {
    const separatorIndex = line.indexOf(':');

    if (separatorIndex === -1) return;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else if (value === 'true') {
      value = true;
    } else if (value === 'false') {
      value = false;
    }

    frontmatter[key] = value;
  });

  return {
    data: frontmatter,
    content: match[2],
  };
};

const blogPosts = blogFiles.keys().map((file) => {
  const source = blogFiles(file);
  const parsed = parseMarkdownPost(source);

  const fallbackSlug = file
    .replace('./', '')
    .replace(/\.md$/, '');

  return {
    id: parsed.data.slug || fallbackSlug,
    title: parsed.data.title || 'Untitled article',
    slug: parsed.data.slug || fallbackSlug,
    category: parsed.data.category || 'Insights',
    date: parsed.data.date || '',
    excerpt: parsed.data.excerpt || '',
    featured: parsed.data.featured === true,
    coverImage: parsed.data.coverImage || '',
    body: parsed.content,
  };
});

const categories = [
  'Latest',
  'AI for Education',
  'Insights',
  'Admissions',
  'Student Support',
  'Product',
  'Use Cases',
  'Company',
];

const accentMap = {
  'AI for Education': 'from-violet-100 via-purple-50 to-white',
  Admissions: 'from-blue-100 via-indigo-50 to-white',
  Product: 'from-purple-100 via-fuchsia-50 to-white',
  'Student Support': 'from-indigo-100 via-slate-50 to-white',
  'Use Cases': 'from-cyan-100 via-sky-50 to-white',
  Insights: 'from-pink-100 via-rose-50 to-white',
  Company: 'from-orange-100 via-amber-50 to-white',
};

const Blog = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeCategory, setActiveCategory] = useState('Latest');
  const [query, setQuery] = useState('');

  /*
    URL structure:
      /blog
      /blog/how-ai-assistants-are-changing-student-support

    This means every article has its own link and can be placed directly
    in sitemap.xml.
  */
  const currentSlug = location.pathname
    .replace(/^\/blog\/?/, '')
    .replace(/\/$/, '');

  const selectedPost = blogPosts.find((post) => post.slug === currentSlug);

  const filteredPosts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return blogPosts.filter((post) => {
      const categoryMatch =
        activeCategory === 'Latest' ||
        post.category.toLowerCase() === activeCategory.toLowerCase();

      const queryMatch =
        !normalizedQuery ||
        `${post.title} ${post.excerpt} ${post.category}`
          .toLowerCase()
          .includes(normalizedQuery);

      return categoryMatch && queryMatch;
    });
  }, [activeCategory, query]);

  const featuredPosts = filteredPosts.filter((post) => post.featured);
  const remainingPosts = filteredPosts.filter(
    (post) => !featuredPosts.includes(post)
  );

  const openPost = (post) => {
    navigate(`/blog/${post.slug}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closePost = () => {
    navigate('/blog');
    setActiveCategory('Latest');
    setQuery('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleArticleKeyDown = (event, post) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPost(post);
    }
  };

  const ArticleVisual = ({ post, featured = false }) => {
    const background =
      accentMap[post.category] || 'from-zinc-100 via-zinc-50 to-white';

    return (
      <div
        className={`relative overflow-hidden bg-gradient-to-br ${background} ${
          featured ? 'aspect-[1.68]' : 'aspect-[1.85]'
        } rounded-xl ring-1 ring-black/[0.05]`}
      >
        {post.coverImage ? (
          <img
            src={post.coverImage}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_90%,rgba(139,92,246,0.30),transparent_42%),radial-gradient(circle_at_90%_20%,rgba(59,130,246,0.15),transparent_35%)]" />
            <div
              className={`absolute left-7 top-7 max-w-[85%] font-semibold leading-[1.05] tracking-[-0.04em] ${
                featured ? 'text-[30px] sm:text-[36px]' : 'text-[24px]'
              }`}
            >
              {post.title}
            </div>
          </>
        )}

        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/[0.08] to-transparent" />

        <div className="absolute bottom-6 left-7 right-7 flex items-center justify-between gap-4 text-xs font-medium uppercase tracking-[0.12em] text-zinc-600">
          <span>{post.category}</span>
          <span>{post.date}</span>
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Full article view
  // ---------------------------------------------------------------------------
  if (selectedPost) {
    return (
      <div className="min-h-screen bg-white text-[#09090b]">
        <div className="mx-auto flex max-w-[1500px]">
          <aside className="sticky top-0 hidden h-screen w-[300px] shrink-0 border-r border-zinc-200 bg-white px-6 pt-10 lg:block">
            <button
              type="button"
              onClick={closePost}
              className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-950"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to blog
            </button>

            <div className="mt-10">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                Article
              </p>
              <p className="mt-3 text-sm leading-6 text-zinc-500">
                {selectedPost.category}
              </p>
            </div>
          </aside>

          <main className="min-w-0 flex-1 lg:h-screen lg:overflow-y-auto lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden">
            <article className="mx-auto max-w-[980px] px-6 pb-24 pt-10 sm:px-10 lg:px-16 lg:pt-16">
              <button
                type="button"
                onClick={closePost}
                className="mb-10 inline-flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-950 lg:hidden"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to blog
              </button>

              <div className="max-w-[850px]">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  {selectedPost.category}
                </p>

                <h1 className="mt-4 text-5xl font-semibold leading-[1.05] tracking-[-0.055em] sm:text-6xl lg:text-[72px]">
                  {selectedPost.title}
                </h1>

                <p className="mt-5 text-sm text-zinc-400">
                  {selectedPost.date}
                </p>
              </div>

              <div className="mt-10">
                <ArticleVisual post={selectedPost} featured />
              </div>

              <div className="mx-auto mt-12 max-w-[760px]">
                <p className="text-xl leading-8 text-zinc-700">
                  {selectedPost.excerpt}
                </p>

                <div className="mt-8 text-[18px] leading-8 text-zinc-600 [&_h1]:mb-6 [&_h1]:mt-10 [&_h1]:text-4xl [&_h1]:font-semibold [&_h1]:leading-tight [&_h2]:mb-4 [&_h2]:mt-10 [&_h2]:text-3xl [&_h2]:font-semibold [&_h2]:leading-tight [&_h3]:mb-3 [&_h3]:mt-8 [&_h3]:text-2xl [&_h3]:font-semibold [&_p]:mb-7 [&_ul]:mb-7 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-7 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-2 [&_blockquote]:my-8 [&_blockquote]:border-l-2 [&_blockquote]:border-zinc-300 [&_blockquote]:pl-5 [&_blockquote]:italic [&_a]:underline [&_a]:underline-offset-4">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {selectedPost.body}
                  </ReactMarkdown>
                </div>
              </div>
            </article>
          </main>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Blog listing
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-white text-[#09090b]">
      <div className="border-t border-zinc-200" />

      <div className="mx-auto flex max-w-[1500px]">
        {/* Desktop fixed sidebar */}
        <aside className="sticky top-0 hidden h-screen w-[300px] shrink-0 border-r border-zinc-200 bg-white px-6 pt-10 lg:block">
          <div className="sticky top-10">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-[21px] w-[21px] -translate-y-1/2 text-zinc-600" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search"
                aria-label="Search blog"
                className="h-14 w-full rounded-xl border border-zinc-200 bg-white pl-12 pr-4 text-[17px] text-zinc-900 outline-none placeholder:text-zinc-500 focus:border-zinc-400"
              />
            </div>

            <div className="mt-8">
              <p className="mb-3 text-[15px] font-medium text-zinc-500">
                Categories
              </p>

              <nav className="space-y-1" aria-label="Blog categories">
                {categories.map((category) => {
                  const active = activeCategory === category;

                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setActiveCategory(category)}
                      className={`block w-full rounded-md py-1 text-left text-[17px] transition-colors ${
                        active
                          ? 'font-semibold text-zinc-950'
                          : 'font-normal text-zinc-500 hover:text-zinc-900'
                      }`}
                    >
                      {category}
                    </button>
                  );
                })}
              </nav>
            </div>

            <button
              type="button"
              onClick={() => navigate('/resources')}
              className="mt-10 inline-flex items-center gap-1 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-950"
            >
              All resources
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </aside>

        {/* Mobile controls */}
        <div className="fixed inset-x-0 top-0 z-30 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search"
                aria-label="Search blog"
                className="h-10 w-full rounded-lg border border-zinc-200 pl-9 pr-3 text-sm outline-none focus:border-zinc-400"
              />
            </div>

            <select
              value={activeCategory}
              onChange={(event) => setActiveCategory(event.target.value)}
              aria-label="Blog category"
              className="h-10 max-w-[145px] rounded-lg border border-zinc-200 bg-white px-2 text-sm outline-none"
            >
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Independently scrollable right side */}
        <main className="min-w-0 flex-1 lg:h-screen lg:overflow-y-auto lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden">
          <div className="mx-auto max-w-[1120px] px-6 pb-24 pt-24 sm:px-10 lg:px-16 lg:pt-16">
            <header className="mb-14">
              <h1 className="text-6xl font-semibold tracking-[-0.055em] sm:text-7xl">
                Blog
              </h1>

              <p className="mt-5 max-w-2xl text-xl leading-8 text-zinc-500">
                Practical ideas, product updates, and insights on using AI to
                improve the student experience.
              </p>
            </header>

            {filteredPosts.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 p-10 text-center">
                <p className="text-lg font-medium">No posts found.</p>

                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setActiveCategory('Latest');
                  }}
                  className="mt-3 text-sm text-zinc-500 underline underline-offset-4"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <>
                {featuredPosts.length > 0 && (
                  <section
                    aria-label="Featured articles"
                    className="grid gap-10 xl:grid-cols-2"
                  >
                    {featuredPosts.map((post) => (
                      <article
                        key={post.id}
                        className="group cursor-pointer"
                        onClick={() => openPost(post)}
                        onKeyDown={(event) =>
                          handleArticleKeyDown(event, post)
                        }
                        role="link"
                        tabIndex={0}
                      >
                        <ArticleVisual post={post} featured />

                        <h2 className="mt-5 text-[25px] font-medium leading-[1.18] tracking-[-0.025em] group-hover:underline group-hover:underline-offset-4">
                          {post.title}
                        </h2>

                        <p className="mt-3 max-w-xl text-[17px] leading-7 text-zinc-500">
                          {post.excerpt}
                        </p>

                        <span className="mt-3 inline-block text-sm font-medium text-zinc-400 transition-colors group-hover:text-zinc-900">
                          Read article →
                        </span>
                      </article>
                    ))}
                  </section>
                )}

                <div className="my-16 border-t border-zinc-200" />

                <section
                  aria-label="All articles"
                  className="grid gap-x-10 gap-y-14 md:grid-cols-2"
                >
                  {remainingPosts.map((post) => (
                    <article
                      key={post.id}
                      className="group cursor-pointer"
                      onClick={() => openPost(post)}
                      onKeyDown={(event) =>
                        handleArticleKeyDown(event, post)
                      }
                      role="link"
                      tabIndex={0}
                    >
                      <ArticleVisual post={post} />

                      <div className="mt-4 flex items-start justify-between gap-4">
                        <h2 className="text-[21px] font-medium leading-[1.22] tracking-[-0.02em] group-hover:underline group-hover:underline-offset-4">
                          {post.title}
                        </h2>

                        <ArrowUpRight className="mt-1 h-5 w-5 shrink-0 text-zinc-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                      </div>

                      <p className="mt-2 text-[15px] leading-6 text-zinc-500">
                        {post.excerpt}
                      </p>

                      <p className="mt-3 text-xs font-medium uppercase tracking-[0.1em] text-zinc-400">
                        {post.date}
                      </p>
                    </article>
                  ))}
                </section>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Blog;
