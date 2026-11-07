let allPosts = [];
let blogFeedTimeout;

function getPostId(post) {
  return post?.id?.$t?.match(/\.post-(\d+)/)?.[1] || "";
}

function escapeBlogText(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function formatBlogDate(value, options = { day: "numeric", month: "long", year: "numeric" }) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", options);
}

function getBlogPostUrl(postId) {
  const url = new URL("/pages/insights/", window.location.origin);
  url.searchParams.set("post", postId);
  return `${url.pathname}${url.search}`;
}

function showBlogError(message = "Não foi possível carregar os artigos agora. Atualize a página para tentar novamente.") {
  window.clearTimeout(blogFeedTimeout);
  const title = document.querySelector(".post-title");
  const body = document.querySelector(".post-body");
  const meta = document.querySelector(".post-meta");
  const share = document.querySelector(".social-share");

  if (title) title.textContent = "Os artigos estão descansando um instante";
  if (meta) meta.textContent = "";
  if (body) body.innerHTML = `<p class="blog-empty-state">${escapeBlogText(message)}</p>`;
  if (share) share.hidden = true;
}

function fetchBlogData() {
  const script = document.createElement("script");
  const feedUrl = new URL("feeds/posts/default", Config.APIS.Blog);
  feedUrl.searchParams.set("alt", "json-in-script");
  feedUrl.searchParams.set("callback", "showBlog");
  feedUrl.searchParams.set("max-results", "1000");
  script.src = feedUrl.href;
  script.async = true;
  script.dataset.blogFeed = "true";
  script.onerror = () => showBlogError();
  document.body.appendChild(script);

  blogFeedTimeout = window.setTimeout(() => {
    if (!window.blogFeedLoaded) showBlogError();
  }, 15000);
}

function renderPost(post, updateUrl = false) {
  const titleElement = document.querySelector(".post-title");
  const metaElement = document.querySelector(".post-meta");
  const bodyElement = document.querySelector(".post-body");
  const shareElement = document.querySelector(".social-share");

  if (!post) {
    if (titleElement) titleElement.textContent = "Post não encontrado";
    if (metaElement) metaElement.textContent = "";
    if (bodyElement) bodyElement.innerHTML = '<p class="blog-empty-state">O artigo que você está tentando acessar não foi encontrado.</p>';
    if (shareElement) shareElement.hidden = true;
    return;
  }

  const postId = getPostId(post);
  const title = post.title?.$t || "Artigo do Covil do Jabuti";
  const published = post.published?.$t;
  const author = post.author?.[0]?.name?.$t || "Covil do Jabuti";

  titleElement.textContent = title;
  metaElement.replaceChildren();

  const dateMeta = document.createElement("span");
  dateMeta.innerHTML = '<i class="far fa-calendar-alt" aria-hidden="true"></i>';
  dateMeta.append(document.createTextNode(formatBlogDate(published)));

  const authorMeta = document.createElement("span");
  authorMeta.innerHTML = '<i class="far fa-user" aria-hidden="true"></i>';
  authorMeta.append(document.createTextNode(author));
  metaElement.append(dateMeta, authorMeta);
  bodyElement.innerHTML = post.content?.$t || '<p class="blog-empty-state">Este artigo ainda não tem conteúdo.</p>';

  const shareUrl = new URL(getBlogPostUrl(postId), window.location.origin);
  const shareText = encodeURIComponent(`Confira este post: ${title}`);

  document.querySelector(".share-btn.in").onclick = () => {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl.href)}`, "_blank", "noopener,noreferrer");
  };
  document.querySelector(".share-btn.wa").onclick = () => {
    window.open(`https://wa.me/?text=${shareText}%20${encodeURIComponent(shareUrl.href)}`, "_blank", "noopener,noreferrer");
  };
  shareElement.hidden = false;

  if (updateUrl && postId) {
    history.replaceState(null, "", getBlogPostUrl(postId));
  }

  document.title = `${title} | Blog Covil do Jabuti`;
}

function buildSidebar(posts) {
  const tagsList = document.querySelector(".tags-list");
  const monthList = document.querySelector(".month-list");
  const recentList = document.querySelector(".most-read-list");
  const tagsMap = new Map();
  const monthsMap = new Map();

  posts.forEach(post => {
    const dateValue = post.published?.$t;
    const date = new Date(dateValue);
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
    const monthLabel = formatBlogDate(dateValue, { month: "long", year: "numeric" });

    if (!monthsMap.has(monthKey)) monthsMap.set(monthKey, { name: monthLabel, date, posts: [] });
    monthsMap.get(monthKey).posts.push(post);

    (post.category || []).forEach(category => {
      const label = String(category?.term || "").trim();
      if (!label) return;
      if (!tagsMap.has(label)) tagsMap.set(label, []);
      tagsMap.get(label).push(post);
    });
  });

  const recentPosts = getMostRecentPosts(posts);
  recentList.innerHTML = recentPosts.map(post => `
    <div class="post-item">
      <a href="${escapeBlogText(getBlogPostUrl(getPostId(post)))}" data-post-id="${escapeBlogText(getPostId(post))}">
        ${escapeBlogText(post.title?.$t || "Artigo do blog")}
        <span class="recent-post-date">${escapeBlogText(formatBlogDate(post.published?.$t, { day: "numeric", month: "short", year: "numeric" }))}</span>
      </a>
    </div>
  `).join("") || '<p class="blog-empty-state">Novos artigos aparecerão aqui.</p>';

  tagsList.innerHTML = [...tagsMap.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR")).map(([tag, tagPosts]) => `
    <button class="expandable-item" type="button" aria-expanded="false">
      <span class="expand-icon" aria-hidden="true">▶</span>
      <span class="item-title">${escapeBlogText(tag)}</span>
      <span class="item-count">${tagPosts.length}</span>
    </button>
    <div class="post-list" aria-hidden="true">
      ${tagPosts.map(post => `
        <div class="post-item">
          <a href="${escapeBlogText(getBlogPostUrl(getPostId(post)))}" data-post-id="${escapeBlogText(getPostId(post))}">${escapeBlogText(post.title?.$t || "Artigo do blog")}</a>
        </div>
      `).join("")}
    </div>
  `).join("") || '<p class="blog-empty-state">As categorias serão exibidas quando houver artigos publicados.</p>';

  const sortedMonths = [...monthsMap.values()].sort((a, b) => b.date - a.date);
  monthList.innerHTML = sortedMonths.map(({ name, posts: monthPosts }) => `
    <button class="expandable-item" type="button" aria-expanded="false">
      <span class="expand-icon" aria-hidden="true">▶</span>
      <span class="item-title">${escapeBlogText(name)}</span>
      <span class="item-count">${monthPosts.length}</span>
    </button>
    <div class="post-list" aria-hidden="true">
      ${monthPosts.map(post => `
        <div class="post-item">
          <a href="${escapeBlogText(getBlogPostUrl(getPostId(post)))}" data-post-id="${escapeBlogText(getPostId(post))}">${escapeBlogText(post.title?.$t || "Artigo do blog")}</a>
        </div>
      `).join("")}
    </div>
  `).join("") || '<p class="blog-empty-state">O arquivo será preenchido com as próximas publicações.</p>';
}

function getMostRecentPosts(posts) {
  return [...posts]
    .sort((a, b) => new Date(b.published?.$t || 0) - new Date(a.published?.$t || 0))
    .slice(0, 3);
}

function setupInteractions() {
  document.querySelectorAll(".expandable-item").forEach(button => {
    const list = button.nextElementSibling;
    button.addEventListener("click", () => {
      const isExpanded = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!isExpanded));
      button.classList.toggle("expanded", !isExpanded);
      list.setAttribute("aria-hidden", String(isExpanded));
      list.style.maxHeight = isExpanded ? "0" : `${list.scrollHeight}px`;
    });
  });

  document.querySelectorAll(".post-item a[data-post-id]").forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();
      const postId = link.getAttribute("data-post-id");
      const post = allPosts.find(candidate => getPostId(candidate) === postId);
      if (!post) return;

      renderPost(post, true);
      document.querySelector("#blog-content").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function showBlog(data) {
  window.blogFeedLoaded = true;
  window.clearTimeout(blogFeedTimeout);
  allPosts = data?.feed?.entry || [];

  if (!allPosts.length) {
    showBlogError("Ainda não há artigos disponíveis. Volte em breve para novas histórias e dicas.");
    return;
  }

  buildSidebar(allPosts);
  const postIdFromUrl = new URLSearchParams(window.location.search).get("post");
  const postFromUrl = postIdFromUrl ? allPosts.find(post => getPostId(post) === postIdFromUrl) : null;
  const initialPost = postFromUrl || getMostRecentPosts(allPosts)[0];

  renderPost(initialPost, false);
  setupInteractions();
}

window.showBlog = showBlog;
fetchBlogData();
