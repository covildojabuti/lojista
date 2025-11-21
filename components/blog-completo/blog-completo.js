const blogUrl = 'https://covildojabuti.blogspot.com/';
let allPosts = [];

function getPostId(post) {
  return post.id.$t.split('.post-')[1];
}

function fetchBlogData(callback) {
  const script = document.createElement('script');
  script.src = `${blogUrl}feeds/posts/default?alt=json-in-script&callback=${callback}&max-results=1000`; // max-results=1000 posts mais recentes
  document.body.appendChild(script);
}

function renderPost(post, updateUrl = true) {
  if (!post) {
    console.error("renderPost: Tentativa de renderizar um post nulo ou indefinido.");
    document.querySelector('.post-title').textContent = "Post não encontrado";
    document.querySelector('.post-meta').innerHTML = "";
    document.querySelector('.post-body').innerHTML = "<p>O post que você está tentando acessar não pôde ser carregado ou não existe.</p>";
    document.querySelector('.social-share').style.display = 'none';
    return;
  }

  const title = post.title.$t;
  const content = post.content.$t;
  const author = post.author?.[0]?.name?.$t || 'Lightus';
  const published = new Date(post.published.$t);
  const formattedDate = published.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

  document.querySelector('.post-title').textContent = title;
  document.querySelector('.post-meta').innerHTML = `
    <i class="far fa-calendar-alt"></i> ${formattedDate} |
    <i class="far fa-user"></i> ${author}
  `;
  document.querySelector('.post-body').innerHTML = content;

  const shareText = encodeURIComponent(`Confira este post: ${title}`);
  const shareUrl = `${window.location.origin}${window.location.pathname}?post=${getPostId(post)}`;

  document.querySelector('.share-btn.in').onclick = () => {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, '_blank');
  };
  document.querySelector('.share-btn.wa').onclick = () => {
    window.open(`https://wa.me/?text=${shareText}%20${encodeURIComponent(shareUrl)}`, '_blank');
  };
  document.querySelector('.social-share').style.display = 'flex';

  if (updateUrl) {
    history.replaceState(null, '', `?post=${getPostId(post)}`);
    console.log("URL ATUALIZADA para:", `?post=${getPostId(post)}`); // DEBUG
  } else {
    console.log("URL NÃO ATUALIZADA (post da URL não encontrado no feed)."); // DEBUG
  }
}

function buildSidebar(posts) {
  const tagsList = document.querySelector('.tags-list');
  const monthList = document.querySelector('.month-list');
  const mostReadList = document.querySelector('.most-read-list');

  const tagsMap = {};
  const monthsMap = {};

  posts.forEach(post => {
    const date = new Date(post.published.$t);
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
    const monthLabel = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    if (!monthsMap[monthKey]) monthsMap[monthKey] = { name: monthLabel, posts: [] };
    monthsMap[monthKey].posts.push(post);

    if (post.category) {
      post.category.forEach(cat => {
        if (!tagsMap[cat.term]) tagsMap[cat.term] = [];
        tagsMap[cat.term].push(post);
      });
    }
  });

  const recentPosts = getMostRecentPosts(posts);
  mostReadList.innerHTML = recentPosts.map(post => `
        <div class="post-item">
          <a href="javascript:void(0);" data-post-id="${getPostId(post)}">
              <i class="far fa-star" style="color: #d3a303; margin-right: 5px;"></i>
              ${post.title.$t}
          </a>
        </div>
    `).join('');

  tagsList.innerHTML = Object.entries(tagsMap).map(([tag, posts]) => `
    <div class="expandable-item">
      <span class="expand-icon">▶</span>
      <span class="item-title">${tag}</span>
      <span class="item-count">${posts.length}</span>
    </div>
    <div class="post-list">
      ${posts.map(p => `
        <div class="post-item">
          <a href="javascript:void(0);" data-post-id="${getPostId(p)}">${p.title.$t}</a>
        </div>
      `).join('')}
    </div>
  `).join('');

  monthList.innerHTML = Object.values(monthsMap).reverse().map(({ name, posts }) => `
    <div class="expandable-item">
      <span class="expand-icon">▶</span>
      <span class="item-title">${name}</span>
      <span class="item-count">${posts.length}</span>
    </div>
    <div class="post-list">
      ${posts.map(p => `
        <div class="post-item">
          <a href="javascript:void(0);" data-post-id="${getPostId(p)}">${p.title.$t}</a>
        </div>
      `).join('')}
    </div>
  `).join('');
}

function getMostRecentPosts(posts) {
    return [...posts]
        .sort((a, b) => new Date(b.published.$t) - new Date(a.published.$t))
        .slice(0, 3);
}

function setupInteractions() {
  document.querySelectorAll('.expandable-item').forEach(item => {
    item.addEventListener('click', function () {
      const isExpanded = this.classList.toggle('expanded');
      const list = this.nextElementSibling;
      list.style.maxHeight = isExpanded ? list.scrollHeight + 'px' : '0';
    });
  });

  document.querySelectorAll('.post-item a').forEach(link => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const postId = link.getAttribute('data-post-id');
      const post = allPosts.find(p => getPostId(p) === postId);
      if (post) {
        renderPost(post, true); // Passa 'true' porque cliques internos DEVEM atualizar a URL
        document.querySelector('#blog-content').scrollIntoView({ behavior: 'smooth' });
      } else {
        console.warn(`Clique interno: Post com ID '${postId}' não encontrado na lista de posts.`);
      }
    });
  });
}

function showBlog(data) {
  allPosts = data.feed.entry || [];
  buildSidebar(allPosts);

  const urlParams = new URLSearchParams(window.location.search);
  const postIdFromUrl = urlParams.get('post');

  console.log("--- INÍCIO DEBUG showBlog ---");
  console.log("1. ID do post na URL (postIdFromUrl):", postIdFromUrl);

  let initialPost = null;
  let postFoundFromUrl = false;

  if (postIdFromUrl) {
    initialPost = allPosts.find(p => {
      const postActualId = getPostId(p);
      // DEBUG: MUITO IMPORTANTE! Verifique esta saída no console.
      console.log(`2. Comparando IDs: Feed:'${postActualId}' vs URL:'${postIdFromUrl}'`);
      return postActualId === postIdFromUrl;
    });

    if (initialPost) {
      postFoundFromUrl = true;
      console.log("3. Post da URL ENCONTRADO no feed:", initialPost.title.$t);
    } else {
      console.warn(`4. Post da URL '${postIdFromUrl}' NÃO ENCONTRADO no feed. (Pode ser muito antigo ou ID incorreto)`);
    }
  } else {
    console.log("5. Nenhum 'post' ID na URL. Exibindo o último post.");
  }

  // Se o post NÃO foi encontrado via URL OU se a URL não tinha ID, renderiza o último post
  if (!initialPost && allPosts.length > 0) {
    initialPost = allPosts[0]; // Isso sempre será o último post se o 'find' acima falhou.
    console.log("6. Fallback: Renderizando o ÚLTIMO post do feed:", initialPost.title.$t);
    postFoundFromUrl = false; // Garante que a URL não será atualizada para o último post
  } else if (!initialPost && allPosts.length === 0) {
      console.warn("7. Nenhum post disponível no feed para renderizar. O feed pode estar vazio ou com problemas.");
      document.querySelector('.post-title').textContent = "Nenhum post disponível";
      document.querySelector('.post-meta').innerHTML = "";
      document.querySelector('.post-body').innerHTML = "<p>Não foi possível carregar nenhum post do blog.</p>";
      document.querySelector('.social-share').style.display = 'none';
      return;
  }
  // Se initialPost foi encontrado da URL, ele permanece inalterado aqui.

  console.log("8. Post FINAL selecionado para renderização:", initialPost ? initialPost.title.$t : "NULO");
  console.log("--- FIM DEBUG showBlog ---");

  // A função renderPost é chamada com a flag 'postFoundFromUrl'
  renderPost(initialPost, postFoundFromUrl);
  setupInteractions();
}

fetchBlogData('showBlog');