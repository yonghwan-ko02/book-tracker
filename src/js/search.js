// Search Module - Querying Google Books API and Adding to Library/Cart
import { supabase } from './supabase.js';
import { getCurrentUser, toggleAuthModal, showToast } from './auth.js';

// Local Mock Database Fallback (for API Rate Limiting / 429 Errors)
const MOCK_BOOKS = [
    {
        title: "데미안 (Demian)",
        authors: ["헤르만 헤세"],
        publisher: "민음사",
        coverUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=200&h=280",
        isbn: "9788937460449",
        pageCount: 244,
        infoLink: "https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=11894",
        genre: "novel"
    },
    {
        title: "해리 포터와 마법사의 돌 1",
        authors: ["J.K. 롤링"],
        publisher: "문학수첩",
        coverUrl: "https://images.unsplash.com/photo-1626618012641-bfbca5a31f39?auto=format&fit=crop&q=80&w=200&h=280",
        isbn: "9788983927620",
        pageCount: 320,
        infoLink: "https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=213568778",
        genre: "novel"
    },
    {
        title: "나미야 잡화점의 기적",
        authors: ["히가시노 게이고"],
        publisher: "현대문학",
        coverUrl: "https://images.unsplash.com/photo-1476275466078-4007374efbbe?auto=format&fit=crop&q=80&w=200&h=280",
        isbn: "9788972756194",
        pageCount: 456,
        infoLink: "https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=21639396",
        genre: "novel"
    },
    {
        title: "어린 왕자 (The Little Prince)",
        authors: ["앙투안 드 생텍쥐페리"],
        publisher: "더스토리",
        coverUrl: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=200&h=280",
        isbn: "9791159039690",
        pageCount: 150,
        infoLink: "https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=71813134",
        genre: "humanities"
    },
    {
        title: "사피엔스 (Sapiens)",
        authors: ["유발 하라리"],
        publisher: "김영사",
        coverUrl: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&q=80&w=200&h=280",
        isbn: "9788934972464",
        pageCount: 636,
        infoLink: "https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=68832049",
        genre: "humanities"
    },
    {
        title: "Clean Code (클린 코드)",
        authors: ["로버트 C. 마틴"],
        publisher: "인사이트",
        coverUrl: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&q=80&w=200&h=280",
        isbn: "9788966260959",
        pageCount: 584,
        infoLink: "https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=34015668",
        genre: "it"
    },
    {
        title: "실용주의 프로그래머 (The Pragmatic Programmer)",
        authors: ["데이비드 토머스", "앤드류 헌트"],
        publisher: "인사이트",
        coverUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&q=80&w=200&h=280",
        isbn: "9788966263264",
        pageCount: 600,
        infoLink: "https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=28374920",
        genre: "it"
    },
    {
        title: "트렌드 코리아 2026",
        authors: ["김난도", "전미영"],
        publisher: "미래의창",
        coverUrl: "https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?auto=format&fit=crop&q=80&w=200&h=280",
        isbn: "9788959897100",
        pageCount: 400,
        infoLink: "https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=324900000",
        genre: "business"
    },
    {
        title: "부의 시나리오",
        authors: ["오건영"],
        publisher: "페이지2",
        coverUrl: "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&q=80&w=200&h=280",
        isbn: "9791191543063",
        pageCount: 412,
        infoLink: "https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=272268700",
        genre: "business"
    },
    {
        title: "역행자",
        authors: ["자청"],
        publisher: "웅진지식하우스",
        coverUrl: "https://images.unsplash.com/photo-1531988042231-d39a9cc12a9a?auto=format&fit=crop&q=80&w=200&h=280",
        isbn: "9788901260716",
        pageCount: 314,
        infoLink: "https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=295470760",
        genre: "self-help"
    },
    {
        title: "원씽 (The One Thing)",
        authors: ["게리 켈러"],
        publisher: "비즈니스북스",
        coverUrl: "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&q=80&w=200&h=280",
        isbn: "9788997575169",
        pageCount: 280,
        infoLink: "https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=30002837",
        genre: "self-help"
    }
];

// Elements References (Initialized in initSearch)
let inputSearchQuery = null;
let btnSearchSubmit = null;
let btnSearchClear = null;
let searchGrid = null;
let searchEmptyState = null;
let searchStatusWrapper = null;
let searchSpinner = null;
let searchErrorMessage = null;
let searchErrorText = null;
let categoryChips = null;

let currentGenreFilter = '';
let currentSearchQuery = '';

// Initialize Search Tab Event Listeners
export function initSearch() {
    inputSearchQuery = document.getElementById('inputSearchQuery');
    btnSearchSubmit = document.getElementById('btnSearchSubmit');
    btnSearchClear = document.getElementById('btnSearchClear');
    searchGrid = document.getElementById('searchGrid');
    searchEmptyState = document.getElementById('searchEmptyState');
    searchStatusWrapper = document.getElementById('searchStatusWrapper');
    searchSpinner = document.getElementById('searchSpinner');
    searchErrorMessage = document.getElementById('searchErrorMessage');
    searchErrorText = document.getElementById('searchErrorText');
    categoryChips = document.querySelectorAll('.search-category-chips .chip');

    btnSearchSubmit?.addEventListener('click', () => {
        executeSearch();
    });
    
    inputSearchQuery?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            executeSearch();
        }
    });
    
    inputSearchQuery?.addEventListener('input', () => {
        if (inputSearchQuery.value.trim().length > 0) {
            btnSearchClear?.classList.remove('hidden');
        } else {
            btnSearchClear?.classList.add('hidden');
        }
    });
    
    btnSearchClear?.addEventListener('click', () => {
        inputSearchQuery.value = '';
        btnSearchClear.classList.add('hidden');
        inputSearchQuery.focus();
    });
    
    // Bind Genre chips
    categoryChips.forEach(chip => {
        chip.addEventListener('click', (e) => {
            categoryChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            
            currentGenreFilter = chip.dataset.genre || '';
            executeSearch(true); // Retain existing search input or default keyword
        });
    });
}

// Perform Google Books API request
async function executeSearch(isGenreSwitch = false) {
    let keyword = inputSearchQuery.value.trim();
    
    // If no keyword, let's provide a default trending subject search depending on the genre
    if (!keyword) {
        if (currentGenreFilter === 'novel') keyword = '소설';
        else if (currentGenreFilter === 'humanities') keyword = '인문학';
        else if (currentGenreFilter === 'it') keyword = '컴퓨터 프로그래밍';
        else if (currentGenreFilter === 'business') keyword = '경영 경제';
        else if (currentGenreFilter === 'self-help') keyword = '자기계발';
        else {
            showToast('검색어를 입력해 주세요!', 'warning');
            return;
        }
    }
    
    currentSearchQuery = keyword;
    
    // Toggle Loading states
    searchEmptyState.classList.add('hidden');
    searchGrid.classList.add('hidden');
    searchStatusWrapper.classList.remove('hidden');
    searchSpinner.classList.remove('hidden');
    searchErrorMessage.classList.add('hidden');
    
    try {
        let apiQuery = encodeURIComponent(keyword);
        
        // Append subject parameter according to Google Books standard tags
        if (currentGenreFilter) {
            let googleSubject = '';
            if (currentGenreFilter === 'novel') googleSubject = 'fiction';
            else if (currentGenreFilter === 'humanities') googleSubject = 'philosophy';
            else if (currentGenreFilter === 'it') googleSubject = 'computers';
            else if (currentGenreFilter === 'business') googleSubject = 'business';
            else if (currentGenreFilter === 'self-help') googleSubject = 'self-help';
            
            if (googleSubject) {
                apiQuery += `+subject:${googleSubject}`;
            }
        }
        
        const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${apiQuery}&maxResults=20&orderBy=relevance&projection=full`);
        if (!response.ok) throw new Error('API 네트워크 통신 중 오류가 발생했습니다.');
        
        const data = await response.json();
        
        if (!data.items || data.items.length === 0) {
            renderNoResults();
        } else {
            renderSearchResults(data.items);
        }
    } catch (err) {
        console.warn('Google Books API failed, launching real-time Open Library API fallback...', err);
        executeOpenLibrarySearch(keyword);
    } finally {
        searchSpinner.classList.add('hidden');
    }
}

// Perform Open Library Online Search Fallback
async function executeOpenLibrarySearch(keyword) {
    try {
        const response = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(keyword)}&limit=15`);
        if (!response.ok) throw new Error('Open Library API failed');
        
        const data = await response.json();
        if (!data.docs || data.docs.length === 0) {
            executeMockSearch(keyword);
            return;
        }
        
        // Map Open Library docs to Google Books items schema
        const items = data.docs.map(doc => {
            const isbn = doc.isbn && doc.isbn.length > 0 ? doc.isbn[0] : '';
            const coverUrl = doc.cover_i 
                ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
                : 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=200&h=280';
                
            return {
                id: doc.key || isbn,
                volumeInfo: {
                    title: doc.title || '제목 없음',
                    authors: doc.author_name || ['작가 미상'],
                    publisher: doc.publisher && doc.publisher.length > 0 ? doc.publisher[0] : '출판사 정보 없음',
                    imageLinks: {
                        thumbnail: coverUrl
                    },
                    industryIdentifiers: isbn ? [
                        { type: 'ISBN_13', identifier: isbn }
                    ] : [],
                    pageCount: doc.number_of_pages_median || 200,
                    infoLink: isbn ? `https://openlibrary.org/isbn/${isbn}` : `https://openlibrary.org${doc.key}`
                }
            };
        });
        
        showToast('Google API 트래픽 초과로 실시간 Open Library 데이터로 대체 검색합니다.', 'info');
        renderSearchResults(items);
    } catch (err) {
        console.warn('Open Library also failed, launching offline database search fallback...', err);
        showToast('Google API 및 Open Library 네트워크 제한으로 로컬 백업 DB 검색으로 전환합니다.', 'warning');
        executeMockSearch(keyword);
    }
}

// Perform Mock Offline Fallback Search
function executeMockSearch(keyword) {
    const query = keyword.toLowerCase();
    
    // Filter books matching title, author, or publisher
    let filtered = MOCK_BOOKS.filter(book => {
        const matchesKeyword = 
            book.title.toLowerCase().includes(query) ||
            book.authors.some(a => a.toLowerCase().includes(query)) ||
            book.publisher.toLowerCase().includes(query);
            
        // Filter by category chip as well!
        if (currentGenreFilter) {
            return matchesKeyword && book.genre === currentGenreFilter;
        }
        return matchesKeyword;
    });
    
    // Map to Google Books API format so we can use existing renderSearchResults!
    const formatted = filtered.map(book => ({
        id: book.isbn,
        volumeInfo: {
            title: book.title,
            authors: book.authors,
            publisher: book.publisher,
            imageLinks: {
                thumbnail: book.coverUrl
            },
            industryIdentifiers: [
                { type: 'ISBN_13', identifier: book.isbn }
            ],
            pageCount: book.pageCount,
            infoLink: book.infoLink
        }
    }));
    
    if (formatted.length === 0) {
        renderNoResults();
    } else {
        renderSearchResults(formatted);
    }
}

// Show No Results State
function renderNoResults() {
    searchStatusWrapper.classList.add('hidden');
    searchGrid.classList.add('hidden');
    searchEmptyState.classList.remove('hidden');
    
    const emptyTitle = searchEmptyState.querySelector('h3');
    const emptyDesc = searchEmptyState.querySelector('p');
    if (emptyTitle && emptyDesc) {
        emptyTitle.textContent = `"${currentSearchQuery}"에 대한 검색 결과가 없습니다`;
        emptyDesc.textContent = '다른 검색어로 검색해 보거나 오타를 확인해보세요.';
    }
}

// Show Error Message Banner
function showSearchError(message) {
    searchSpinner.classList.add('hidden');
    searchErrorMessage.classList.remove('hidden');
    searchErrorText.textContent = message;
}

// Helper to extract ISBN
function extractISBN(identifiers) {
    if (!identifiers || !Array.isArray(identifiers)) return null;
    const isbn13 = identifiers.find(id => id.type === 'ISBN_13');
    if (isbn13) return isbn13.identifier;
    const isbn10 = identifiers.find(id => id.type === 'ISBN_10');
    if (isbn10) return isbn10.identifier;
    return null;
}

// Render Results Grid
function renderSearchResults(items) {
    searchStatusWrapper.classList.add('hidden');
    searchGrid.classList.remove('hidden');
    searchGrid.innerHTML = '';
    
    items.forEach(item => {
        const info = item.volumeInfo;
        const id = item.id;
        
        // Clean Cover Image URL (HTTP -> HTTPS for SSL)
        let coverUrl = 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=200&h=280';
        if (info.imageLinks) {
            coverUrl = info.imageLinks.thumbnail || info.imageLinks.smallThumbnail;
            if (coverUrl.startsWith('http://')) {
                coverUrl = coverUrl.replace('http://', 'https://');
            }
        }
        
        const title = info.title || '제목 없음';
        const authors = info.authors || ['작가 미상'];
        const publisher = info.publisher || '출판사 정보 없음';
        const rating = info.averageRating || null;
        const isbn = extractISBN(info.industryIdentifiers) || '';
        const infoLink = info.infoLink || info.previewLink || '';
        
        const card = document.createElement('div');
        card.className = 'book-card';
        
        let ratingHtml = '';
        if (rating) {
            ratingHtml = `
                <div class="book-card-rating">
                    <i class="fa-solid fa-star"></i>
                    <span>${rating.toFixed(1)}</span>
                </div>
            `;
        }
        
        card.innerHTML = `
            <div class="book-card-cover-wrapper">
                <img src="${coverUrl}" alt="${title}" class="book-card-cover" loading="lazy">
                ${rating ? `<span class="book-card-badge"><i class="fa-solid fa-star"></i> ${rating}</span>` : ''}
            </div>
            <div class="book-card-details">
                <h4 class="book-card-title" title="${title}">${title}</h4>
                <p class="book-card-author" title="${authors.join(', ')}">${authors.join(', ')}</p>
                <p class="book-card-publisher" title="${publisher}">${publisher}</p>
                ${ratingHtml}
                <div class="book-card-actions">
                    <button class="btn-card-action primary btn-add-library" 
                        data-title="${encodeURIComponent(title)}"
                        data-authors="${encodeURIComponent(JSON.stringify(authors))}"
                        data-cover="${encodeURIComponent(coverUrl)}"
                        data-publisher="${encodeURIComponent(publisher)}"
                        data-isbn="${isbn}"
                        data-pages="${info.pageCount || 0}"
                        data-url="${encodeURIComponent(infoLink)}">
                        <i class="fa-solid fa-plus"></i> 서재에 추가
                    </button>
                    <button class="btn-card-action secondary btn-add-cart"
                        data-title="${encodeURIComponent(title)}"
                        data-authors="${encodeURIComponent(JSON.stringify(authors))}"
                        data-cover="${encodeURIComponent(coverUrl)}"
                        data-isbn="${isbn}"
                        data-url="${encodeURIComponent(infoLink)}">
                        <i class="fa-solid fa-cart-shopping"></i> 장바구니
                    </button>
                </div>
            </div>
        `;
        
        searchGrid.appendChild(card);
    });
    
    // Bind dynamic card actions
    bindCardActions();
}

// Bind clicks on individual cards
function bindCardActions() {
    // Add to Library Click Handler
    searchGrid.querySelectorAll('.btn-add-library').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const user = getCurrentUser();
            if (!user) {
                showToast('로그인이 필요한 기능입니다. 로그인 모달을 엽니다.', 'warning');
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
            btnEl.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> 추가 중...';
            
            try {
                // Check if book already exists in library
                const { data: existing, error: checkError } = await supabase
                    .from('books')
                    .select('id, status')
                    .eq('user_id', user.id)
                    .eq('title', title)
                    .eq('isbn', isbn)
                    .maybeSingle();
                
                if (checkError) throw checkError;
                
                if (existing) {
                    showToast(`"${title}" 도서는 이미 서재에 등록되어 있습니다.`, 'warning');
                    btnEl.innerHTML = '<i class="fa-solid fa-check"></i> 등록됨';
                    btnEl.className = 'btn-card-action success-static';
                    return;
                }
                
                // Add to Books Table
                const { error: insertError } = await supabase
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
                
                if (insertError) throw insertError;
                
                showToast(`"${title}" 도서가 '읽고 싶은 책'으로 내 서재에 추가되었습니다!`, 'success');
                btnEl.innerHTML = '<i class="fa-solid fa-check"></i> 등록됨';
                btnEl.className = 'btn-card-action success-static';
                
                // Refresh library count badge
                window.dispatchEvent(new CustomEvent('library-updated'));
            } catch (err) {
                console.error(err);
                showToast('서재 추가 중 오류가 발생했습니다: ' + err.message, 'danger');
                btnEl.disabled = false;
                btnEl.innerHTML = '<i class="fa-solid fa-plus"></i> 서재에 추가';
            }
        });
    });
    
    // Add to Cart Click Handler
    searchGrid.querySelectorAll('.btn-add-cart').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const user = getCurrentUser();
            if (!user) {
                showToast('로그인이 필요한 기능입니다. 로그인 모달을 엽니다.', 'warning');
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
            btnEl.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> 담는 중...';
            
            try {
                // Check if book already exists in shopping cart
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
                    btnEl.innerHTML = '<i class="fa-solid fa-check"></i> 담김';
                    btnEl.className = 'btn-card-action success-static';
                    return;
                }
                
                // Add to Cart Table
                const { error: insertError } = await supabase
                    .from('cart_items')
                    .insert({
                        user_id: user.id,
                        title,
                        authors,
                        cover_url: coverUrl,
                        isbn,
                        purchase_url: infoLink
                    });
                
                if (insertError) throw insertError;
                
                showToast(`"${title}" 도서가 장바구니에 담겼습니다!`, 'success');
                btnEl.innerHTML = '<i class="fa-solid fa-check"></i> 담김';
                btnEl.className = 'btn-card-action success-static';
                
                // Refresh cart badges
                window.dispatchEvent(new CustomEvent('cart-updated'));
            } catch (err) {
                console.error(err);
                showToast('장바구니 추가 중 오류가 발생했습니다: ' + err.message, 'danger');
                btnEl.disabled = false;
                btnEl.innerHTML = '<i class="fa-solid fa-cart-shopping"></i> 장바구니';
            }
        });
    });
}
