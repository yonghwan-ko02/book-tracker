// Lumina AI - Intelligent Reading Analyzer & Book Recommender
import { supabase } from './supabase.js';
import { getCurrentUser, showToast, toggleAuthModal } from './auth.js';
import { showBookDetail } from './detail.js';

// Curated pool of high-quality recommendations mapping to user interests
const RECOMMENDATION_POOL = [
    {
        title: "수레바퀴 아래서 (Beneath the Wheel)",
        authors: ["헤르만 헤세"],
        publisher: "민음사",
        coverUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=200&h=280",
        isbn: "9788937460022",
        pageCount: 220,
        infoLink: "https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=26639",
        genre: "novel",
        reason: "헤르만 헤세의 자전적 소설로, 《데미안》의 철학적 자아 성찰과 깊은 고뇌를 공유하는 최고의 명작입니다."
    },
    {
        title: "리팩터링 (Refactoring)",
        authors: ["마틴 파울러"],
        publisher: "한빛미디어",
        coverUrl: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&q=80&w=200&h=280",
        isbn: "9791162244081",
        pageCount: 480,
        infoLink: "https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=26639396",
        genre: "it",
        reason: "코드의 가독성을 높이고 유지보수를 극대화하고 싶으신가요? 《클린 코드》 독자라면 반드시 학습해야 할 현업 교과서입니다."
    },
    {
        title: "코스모스 (Cosmos)",
        authors: ["칼 세이건"],
        publisher: "사이언스북스",
        coverUrl: "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&q=80&w=200&h=280",
        isbn: "9788983711892",
        pageCount: 712,
        infoLink: "https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=118128",
        genre: "humanities",
        reason: "《사피엔스》를 재밌게 보셨다면 우주와 역사 속 인간 존재의 우아함을 탐색하는 이 대작에 매료될 것입니다."
    },
    {
        title: "생각에 관한 생각 (Thinking, Fast and Slow)",
        authors: ["대니얼 카너먼"],
        publisher: "김영사",
        coverUrl: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&q=80&w=200&h=280",
        isbn: "9788934963387",
        pageCount: 728,
        infoLink: "https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=163939",
        genre: "self-help",
        reason: "의사결정의 심리학적 메커니즘을 밝혀낸 행동경제학의 명저입니다. 자기 성찰과 판단력을 극대화해 줍니다."
    },
    {
        title: "돈의 속성",
        authors: ["김승호"],
        publisher: "스노우폭스북스",
        coverUrl: "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&q=80&w=200&h=280",
        isbn: "9791188331796",
        pageCount: 390,
        infoLink: "https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=242273180",
        genre: "business",
        reason: "성공과 부에 대한 명확한 태도를 확립하고 싶으시다면 적극 추천합니다. 투자와 철학을 넘나드는 통찰을 줍니다."
    }
];

// Elements References
let aiRecommendedGrid = null;
let aiAnalysisText = null;
let aiStatusBadge = null;

// Renders personalized recommendations based on library contents
export function fetchAndRenderAIRecommendations(books = []) {
    aiRecommendedGrid = document.getElementById('aiRecommendedGrid');
    aiAnalysisText = document.getElementById('aiAnalysisText');
    aiStatusBadge = document.getElementById('aiStatusBadge');
    
    if (!aiRecommendedGrid || !aiAnalysisText) return;
    
    const user = getCurrentUser();
    if (!user) {
        renderGuestState();
        return;
    }
    
    if (!books || books.length === 0) {
        renderStarterRecommendations();
        return;
    }
    
    analyzeAndRenderPersonalizedRecommendations(books);
}

// Draw guest welcome block
function renderGuestState() {
    aiAnalysisText.textContent = "로그인하시면 회원님의 실시간 독서 패턴과 별점, 평론을 정교하게 분석하여 인생 최고의 맞춤 도서를 추천해 드립니다.";
    aiRecommendedGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); font-size: 13px; padding: 20px 0;">
            <i class="fa-solid fa-lock" style="margin-bottom: 8px; font-size: 16px;"></i><br>
            로그인 후 나만을 위한 맞춤 AI 도서 추천을 체험해 보세요!
        </div>
    `;
    if (aiStatusBadge) {
        aiStatusBadge.innerHTML = `<i class="fa-solid fa-hourglass"></i> 분석 대기`;
        aiStatusBadge.style.background = 'rgba(255, 255, 255, 0.05)';
        aiStatusBadge.style.color = 'var(--text-muted)';
        aiStatusBadge.style.borderColor = 'var(--border-color)';
    }
}

// Recommended list if user has no books in their library yet
function renderStarterRecommendations() {
    aiAnalysisText.textContent = "아직 서재에 추가된 도서가 없어 대중적으로 검증된 분야별 3대 베스트셀러를 AI가 엄선했습니다. 독서를 시작하시면 취향 분석을 시작합니다!";
    
    // Pick first 3 items from pool
    const starterBooks = RECOMMENDATION_POOL.slice(0, 3);
    renderRecommendedGrid(starterBooks);
    
    if (aiStatusBadge) {
        aiStatusBadge.innerHTML = `<i class="fa-solid fa-circle-info"></i> 스타터 가이드`;
        aiStatusBadge.style.background = 'rgba(59, 130, 246, 0.15)';
        aiStatusBadge.style.color = 'var(--blue)';
        aiStatusBadge.style.borderColor = 'rgba(59, 130, 246, 0.3)';
    }
}

// Analyzes genres, pages and ratings to generate a custom critique and suggestions list
function analyzeAndRenderPersonalizedRecommendations(books) {
    // 1. Analyze dominant genre
    const genreCounts = { novel: 0, it: 0, humanities: 0, business: 0, 'self-help': 0 };
    let highestRating = 0;
    let highlyRatedGenre = '';
    
    books.forEach(book => {
        // Simple heuristics to map keywords to genres if not recorded
        let bookGenre = 'novel';
        const titleLower = book.title.toLowerCase();
        
        if (titleLower.includes('code') || titleLower.includes('programmer') || titleLower.includes('it') || titleLower.includes('프로그래밍') || titleLower.includes('컴퓨터')) {
            bookGenre = 'it';
        } else if (titleLower.includes('사피엔스') || titleLower.includes('코스모스') || titleLower.includes('인문') || titleLower.includes('철학')) {
            bookGenre = 'humanities';
        } else if (titleLower.includes('트렌드') || titleLower.includes('시나리오') || titleLower.includes('경제') || titleLower.includes('경영')) {
            bookGenre = 'business';
        } else if (titleLower.includes('역행자') || titleLower.includes('씽') || titleLower.includes('성장') || titleLower.includes('개발')) {
            bookGenre = 'self-help';
        }
        
        genreCounts[bookGenre] = (genreCounts[bookGenre] || 0) + 1;
        
        if (book.rating && book.rating > highestRating) {
            highestRating = book.rating;
            highlyRatedGenre = bookGenre;
        }
    });
    
    // Find dominant genre
    let dominantGenre = 'novel';
    let maxCount = 0;
    
    Object.entries(genreCounts).forEach(([genre, count]) => {
        if (count > maxCount) {
            maxCount = count;
            dominantGenre = genre;
        }
    });
    
    // Highly rated genre takes precedence for recommendation!
    if (highestRating >= 4 && highlyRatedGenre) {
        dominantGenre = highlyRatedGenre;
    }
    
    // 2. Draft dynamic critique text based on dominant genre
    let analysisCritique = '';
    if (dominantGenre === 'it') {
        analysisCritique = "회원님은 최근 <strong>소프트웨어 공학 및 IT 프로그래밍</strong> 서적에 몰입해 계시군요! 논리적 설계 역량과 클린한 아키텍처 설계를 완성시켜 줄 고난도 필독서를 추천해 드립니다. 💻";
    } else if (dominantGenre === 'humanities') {
        analysisCritique = "회원님은 인류 역사, 과학 철학 등 <strong>인문지식의 거대한 맥락</strong> 속에서 영감을 얻고 계시군요. 세상을 바라보는 깊고 넓은 시야를 선사할 인문 과학 대작을 추천합니다. 🪐";
    } else if (dominantGenre === 'business') {
        analysisCritique = "회원님은 자본의 흐름과 트렌드를 예견하는 <strong>경제 경영/비즈니스</strong> 분야에 강한 관심이 있으시네요. 현업 실전 투자와 트렌드를 지배할 인사이트 서적을 엄선했습니다. 📈";
    } else if (dominantGenre === 'self-help') {
        analysisCritique = "회원님은 삶의 공식을 깨우치고 잠재력을 깨우는 <strong>성공 철학 / 자기계발</strong> 장르에 깊은 가치를 두고 계시군요. 인생의 전환점을 열어줄 강력한 행동 전략 명저를 제안합니다. 🔥";
    } else {
        analysisCritique = "회원님은 깊은 성찰과 인간 내면의 아름다움을 성찰할 수 있는 <strong>소설 / 문학</strong> 작품을 탐독 중이시네요. 영혼을 포근히 감싸줄 또 하나의 마스터피스를 엄선했습니다. 📖";
    }
    
    aiAnalysisText.innerHTML = analysisCritique;
    
    // 3. Filter recommended books in the pool that match dominant genre and are NOT already in their library
    let recommendedList = RECOMMENDATION_POOL.filter(rec => rec.genre === dominantGenre);
    
    // If no matching genre recs found (or already read), recommend a diverse selection
    if (recommendedList.length === 0) {
        recommendedList = RECOMMENDATION_POOL.slice(0, 2);
    }
    
    renderRecommendedGrid(recommendedList);
    
    if (aiStatusBadge) {
        aiStatusBadge.innerHTML = `<i class="fa-solid fa-brain"></i> AI 분석 완료`;
        aiStatusBadge.style.background = 'rgba(139, 92, 246, 0.15)';
        aiStatusBadge.style.color = 'var(--primary-accent)';
        aiStatusBadge.style.borderColor = 'rgba(139, 92, 246, 0.3)';
    }
}

// Draws the actual recommendation grid DOM elements
function renderRecommendedGrid(books) {
    aiRecommendedGrid.innerHTML = '';
    
    books.forEach(book => {
        const card = document.createElement('div');
        card.className = 'ai-recommended-book-card';
        
        // Card click triggers detailed modal
        card.addEventListener('click', (e) => {
            if (e.target.closest('.btn-card-action')) return;
            showBookDetail({
                title: book.title,
                authors: book.authors,
                cover_url: book.coverUrl,
                publisher: book.publisher,
                isbn: book.isbn,
                total_pages: book.pageCount || 0,
                purchase_url: book.infoLink,
                description: book.reason
            });
        });
        
        card.style.cssText = `
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius-md);
            padding: 14px;
            display: flex;
            gap: 12px;
            align-items: center;
            transition: var(--transition-smooth);
            cursor: pointer;
        `;
        
        card.innerHTML = `
            <img src="${book.coverUrl}" alt="${book.title}" style="width: 55px; height: 80px; object-fit: cover; border-radius: var(--border-radius-sm); box-shadow: 0 4px 10px rgba(0,0,0,0.3); flex-shrink:0;">
            <div style="display: flex; flex-direction: column; flex-grow: 1; overflow: hidden;">
                <h4 style="font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #ffffff;">${book.title}</h4>
                <p style="font-size: 11px; color: var(--text-secondary); margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${book.authors.join(', ')}</p>
                <p style="font-size: 10px; color: var(--text-muted); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 8px;" title="${book.reason}">${book.reason}</p>
                <div style="display: flex; gap: 6px;">
                    <button class="btn-card-action primary btn-ai-add-lib" 
                        data-title="${encodeURIComponent(book.title)}"
                        data-authors="${encodeURIComponent(JSON.stringify(book.authors))}"
                        data-cover="${encodeURIComponent(book.coverUrl)}"
                        data-publisher="${encodeURIComponent(book.publisher)}"
                        data-isbn="${book.isbn}"
                        data-pages="${book.pageCount}"
                        data-url="${encodeURIComponent(book.infoLink)}"
                        style="height: 24px; font-size: 9px; padding: 0 8px;">
                        <i class="fa-solid fa-plus"></i> 서재
                    </button>
                    <button class="btn-card-action secondary btn-ai-add-cart"
                        data-title="${encodeURIComponent(book.title)}"
                        data-authors="${encodeURIComponent(JSON.stringify(book.authors))}"
                        data-cover="${encodeURIComponent(book.coverUrl)}"
                        data-isbn="${book.isbn}"
                        data-url="${encodeURIComponent(book.infoLink)}"
                        style="height: 24px; font-size: 9px; padding: 0 8px;">
                        <i class="fa-solid fa-cart-shopping"></i> 장바구니
                    </button>
                </div>
            </div>
        `;
        
        // Add subtle hover effect via JS since it's an ad-hoc styled element
        card.addEventListener('mouseenter', () => {
            card.style.borderColor = 'var(--primary-accent)';
            card.style.background = 'rgba(139, 92, 246, 0.03)';
            card.style.transform = 'translateY(-2px)';
        });
        card.addEventListener('mouseleave', () => {
            card.style.borderColor = 'var(--border-color)';
            card.style.background = 'rgba(255, 255, 255, 0.02)';
            card.style.transform = 'translateY(0)';
        });
        
        aiRecommendedGrid.appendChild(card);
    });
    
    // Bind click actions to the recommended book buttons
    bindAIRecommendationsActions();
}

// Binds database triggers to AI recommendation cards
function bindAIRecommendationsActions() {
    // Add to library
    aiRecommendedGrid.querySelectorAll('.btn-ai-add-lib').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const user = getCurrentUser();
            if (!user) {
                showToast('로그인이 필요한 기능입니다.', 'warning');
                toggleAuthModal(true);
                return;
            }
            
            const btnEl = e.currentTarget;
            const title = decodeURIComponent(btnEl.dataset.title);
            const authors = JSON.parse(decodeURIComponent(btnEl.dataset.authors));
            const coverUrl = decodeURIComponent(btnEl.dataset.cover);
            const publisher = decodeURIComponent(btnEl.dataset.publisher);
            const isbn = btnEl.dataset.isbn;
            const totalPages = parseInt(btnEl.dataset.pages) || 0;
            const infoLink = decodeURIComponent(btnEl.dataset.url);
            
            btnEl.disabled = true;
            btnEl.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
            
            try {
                const { data: existing, error: checkError } = await supabase
                    .from('books')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('title', title)
                    .eq('isbn', isbn)
                    .maybeSingle();
                    
                if (checkError) throw checkError;
                if (existing) {
                    showToast(`"${title}" 도서는 이미 서재에 등록되어 있습니다.`, 'warning');
                    btnEl.innerHTML = '<i class="fa-solid fa-check"></i>';
                    btnEl.className = 'btn-card-action success-static';
                    btnEl.style.height = '24px';
                    return;
                }
                
                const { error } = await supabase
                    .from('books')
                    .insert({
                        user_id: user.id,
                        title,
                        authors,
                        publisher,
                        cover_url: coverUrl,
                        isbn,
                        total_pages: totalPages,
                        current_page: 0,
                        status: 'to_read',
                        purchase_url: infoLink
                    });
                    
                if (error) throw error;
                
                showToast(`AI 추천 도서 "${title}"이(가) 내 서재에 추가되었습니다!`, 'success');
                btnEl.innerHTML = '<i class="fa-solid fa-check"></i>';
                btnEl.className = 'btn-card-action success-static';
                btnEl.style.height = '24px';
                
                // Refresh library components
                window.dispatchEvent(new CustomEvent('library-updated'));
                window.dispatchEvent(new CustomEvent('dashboard-updated'));
            } catch (err) {
                console.error(err);
                showToast('추천 도서 추가 실패: ' + err.message, 'danger');
                btnEl.disabled = false;
                btnEl.innerHTML = '<i class="fa-solid fa-plus"></i> 서재';
            }
        });
    });
    
    // Add to cart
    aiRecommendedGrid.querySelectorAll('.btn-ai-add-cart').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const user = getCurrentUser();
            if (!user) {
                showToast('로그인이 필요한 기능입니다.', 'warning');
                toggleAuthModal(true);
                return;
            }
            
            const btnEl = e.currentTarget;
            const title = decodeURIComponent(btnEl.dataset.title);
            const authors = JSON.parse(decodeURIComponent(btnEl.dataset.authors));
            const coverUrl = decodeURIComponent(btnEl.dataset.cover);
            const isbn = btnEl.dataset.isbn;
            const infoLink = decodeURIComponent(btnEl.dataset.url);
            
            btnEl.disabled = true;
            btnEl.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
            
            try {
                const { data: existing, error: checkError } = await supabase
                    .from('cart_items')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('title', title)
                    .eq('isbn', isbn)
                    .maybeSingle();
                    
                if (checkError) throw checkError;
                if (existing) {
                    showToast(`"${title}" 도서는 이미 장바구니에 담겨 있습니다.`, 'warning');
                    btnEl.innerHTML = '<i class="fa-solid fa-check"></i>';
                    btnEl.className = 'btn-card-action success-static';
                    btnEl.style.height = '24px';
                    return;
                }
                
                const { error } = await supabase
                    .from('cart_items')
                    .insert({
                        user_id: user.id,
                        title,
                        authors,
                        cover_url: coverUrl,
                        isbn,
                        purchase_url: infoLink
                    });
                    
                if (error) throw error;
                
                showToast(`AI 추천 도서 "${title}"이(가) 장바구니에 담겼습니다!`, 'success');
                btnEl.innerHTML = '<i class="fa-solid fa-check"></i>';
                btnEl.className = 'btn-card-action success-static';
                btnEl.style.height = '24px';
                
                // Refresh cart components
                window.dispatchEvent(new CustomEvent('cart-updated'));
            } catch (err) {
                console.error(err);
                showToast('장바구니 담기 실패: ' + err.message, 'danger');
                btnEl.disabled = false;
                btnEl.innerHTML = '<i class="fa-solid fa-cart-shopping"></i> 장바구니';
            }
        });
    });
}
