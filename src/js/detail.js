// Universal Book Detail Modal Module
import { supabase } from './supabase.js';
import { getCurrentUser, toggleAuthModal, showToast } from './auth.js';

// UI Reference
let bookDetailModal = null;
let btnBookDetailClose = null;

// Book metadata mapping
let currentBook = null;
let isLocalBook = false;
let localBookId = null;

// Initialize Detail Modal Events
export function initBookDetail() {
    bookDetailModal = document.getElementById('bookDetailModal');
    btnBookDetailClose = document.getElementById('btnBookDetailClose');

    // Close Modal Events
    btnBookDetailClose?.addEventListener('click', () => toggleDetailModal(false));
    bookDetailModal?.addEventListener('click', (e) => {
        if (e.target === bookDetailModal) {
            toggleDetailModal(false);
        }
    });

    // Add Library Action
    document.getElementById('btnDetailAddLibrary')?.addEventListener('click', handleAddLibrary);
    
    // Add Cart Action
    document.getElementById('btnDetailAddCart')?.addEventListener('click', handleAddCart);

    // Status Selection Dropdown Change
    document.getElementById('detailStatusSelect')?.addEventListener('change', handleStatusChange);

    // Log Progress Trigger
    document.getElementById('btnDetailLogProgress')?.addEventListener('click', () => {
        if (!currentBook) return;
        toggleDetailModal(false);
        
        // Populate and open existing progress modal from library.js
        setTimeout(() => {
            const progressModal = document.getElementById('progressModal');
            document.getElementById('progressBookId').value = localBookId;
            document.getElementById('progressBookTitle').textContent = currentBook.title;
            document.getElementById('progressBookAuthor').textContent = currentBook.authors.join(', ');
            document.getElementById('progressBookCover').src = currentBook.cover_url;
            
            document.getElementById('progressCurrentPage').value = currentBook.current_page || 0;
            document.getElementById('progressTotalPages').value = currentBook.total_pages > 0 ? currentBook.total_pages : '';
            document.getElementById('progressNotes').value = '';
            
            progressModal?.classList.remove('hidden');
            setTimeout(() => progressModal?.classList.add('active'), 10);
        }, 300);
    });

    // Review Trigger
    document.getElementById('btnDetailReview')?.addEventListener('click', () => {
        if (!currentBook) return;
        toggleDetailModal(false);
        
        // Populate and open existing review modal from library.js
        setTimeout(() => {
            const reviewModal = document.getElementById('reviewModal');
            document.getElementById('reviewBookId').value = localBookId;
            document.getElementById('reviewBookTitle').textContent = currentBook.title;
            document.getElementById('reviewBookAuthor').textContent = currentBook.authors.join(', ');
            document.getElementById('reviewBookCover').src = currentBook.cover_url;
            document.getElementById('reviewContent').value = currentBook.review || '';
            
            const savedRating = currentBook.rating || 5;
            const starInput = document.getElementById(`star${savedRating}`);
            if (starInput) starInput.checked = true;
            
            reviewModal?.classList.remove('hidden');
            setTimeout(() => reviewModal?.classList.add('active'), 10);
        }, 300);
    });

    // Delete Book from Library
    document.getElementById('btnDetailRemoveLibrary')?.addEventListener('click', handleRemoveLibrary);
}

// Open / Close Detail Modal
export function toggleDetailModal(show) {
    if (!bookDetailModal) return;
    if (show) {
        bookDetailModal.classList.remove('hidden');
        setTimeout(() => bookDetailModal.classList.add('active'), 10);
    } else {
        bookDetailModal.classList.remove('active');
        setTimeout(() => bookDetailModal.classList.add('hidden'), 300);
    }
}

// Open detailed modal with rich dynamic metadata fetching
export async function showBookDetail(bookData) {
    // Normalizing dynamic bookData schemas (Search model, Library model, Cart model)
    const title = bookData.title || bookData.volumeInfo?.title || '제목 없음';
    let authors = bookData.authors || bookData.volumeInfo?.authors || ['작가 미상'];
    if (typeof authors === 'string') {
        try {
            authors = JSON.parse(authors);
        } catch {
            authors = [authors];
        }
    }
    
    let coverUrl = bookData.cover_url || bookData.coverUrl || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=200&h=280';
    if (bookData.volumeInfo?.imageLinks) {
        coverUrl = bookData.volumeInfo.imageLinks.thumbnail || bookData.volumeInfo.imageLinks.smallThumbnail || coverUrl;
    }
    if (coverUrl.startsWith('http://')) {
        coverUrl = coverUrl.replace('http://', 'https://');
    }

    const publisher = bookData.publisher || bookData.volumeInfo?.publisher || '출판사 정보 없음';
    const pubdate = bookData.publishedDate || bookData.volumeInfo?.publishedDate || '발행일 정보 없음';
    
    // Extract ISBN
    let isbn = bookData.isbn || '';
    if (!isbn && bookData.volumeInfo?.industryIdentifiers) {
        const identifiers = bookData.volumeInfo.industryIdentifiers;
        const isbn13 = identifiers.find(id => id.type === 'ISBN_13');
        if (isbn13) isbn = isbn13.identifier;
        else {
            const isbn10 = identifiers.find(id => id.type === 'ISBN_10');
            if (isbn10) isbn = isbn10.identifier;
        }
    }

    const totalPages = parseInt(bookData.total_pages || bookData.pageCount || bookData.volumeInfo?.pageCount) || 0;
    const description = bookData.description || bookData.volumeInfo?.description || '줄거리 및 책 소개 정보가 아직 등록되지 않았습니다.';
    const infoLink = bookData.purchase_url || bookData.purchaseUrl || bookData.volumeInfo?.infoLink || '';

    currentBook = {
        title,
        authors,
        cover_url: coverUrl,
        publisher,
        isbn,
        total_pages: totalPages,
        description,
        purchase_url: infoLink
    };

    // Render UI Fields immediately
    document.getElementById('detailBookCover').src = coverUrl;
    document.getElementById('detailBookTitle').textContent = title;
    document.getElementById('detailBookAuthor').textContent = authors.join(', ');
    document.getElementById('detailBookPublisher').textContent = publisher;
    document.getElementById('detailBookPubdate').textContent = pubdate;
    document.getElementById('detailBookIsbn').textContent = isbn || 'ISBN 미제공';
    document.getElementById('detailBookPages').textContent = totalPages > 0 ? `${totalPages} p` : '페이지 정보 없음';
    document.getElementById('detailBookDesc').textContent = description;

    // Create Buy Store links
    setupStoreLinks(title, authors[0], isbn);

    // Initial loading state for Supabase local checks
    isLocalBook = false;
    localBookId = null;
    
    // Hide sections during fetch
    document.getElementById('detailLocalActions').classList.add('hidden');
    document.getElementById('detailSectionProgress').classList.add('hidden');
    document.getElementById('detailSectionReview').classList.add('hidden');
    document.getElementById('btnDetailAddLibrary').classList.remove('hidden');

    const user = getCurrentUser();
    if (user) {
        try {
            // Check if book exists in local user database
            const { data: localData, error } = await supabase
                .from('books')
                .select('*')
                .eq('user_id', user.id)
                .eq('title', title)
                .maybeSingle();

            if (!error && localData) {
                isLocalBook = true;
                localBookId = localData.id;
                
                // Merge local properties
                currentBook.current_page = localData.current_page || 0;
                currentBook.status = localData.status;
                currentBook.rating = localData.rating;
                currentBook.review = localData.review;
                currentBook.updated_at = localData.updated_at;

                // Sync status badges and dropdown UI
                renderLocalStatusUI();
            } else {
                // If not in database, reset status badges
                document.getElementById('detailStatusBadge').innerHTML = `<i class="fa-solid fa-book-open"></i> 미등록 도서`;
                document.getElementById('detailStatusBadge').style.color = 'var(--text-secondary)';
            }

            // Sync Cart Button status
            const { data: cartData } = await supabase
                .from('cart_items')
                .select('id')
                .eq('user_id', user.id)
                .eq('title', title)
                .maybeSingle();

            const btnCart = document.getElementById('btnDetailAddCart');
            if (cartData) {
                btnCart.innerHTML = `<i class="fa-solid fa-cart-arrow-down"></i> 장바구니에서 빼기`;
                btnCart.dataset.inCart = "true";
            } else {
                btnCart.innerHTML = `<i class="fa-solid fa-cart-shopping"></i> 장바구니 담기`;
                btnCart.dataset.inCart = "false";
            }

        } catch (err) {
            console.error('Error fetching local book status:', err);
        }
    } else {
        // Guest mode defaults
        document.getElementById('detailStatusBadge').innerHTML = `<i class="fa-solid fa-circle-info"></i> 비회원 모드`;
        document.getElementById('detailStatusBadge').style.color = 'var(--text-muted)';
        document.getElementById('btnDetailAddCart').innerHTML = `<i class="fa-solid fa-cart-shopping"></i> 장바구니 담기`;
        document.getElementById('btnDetailAddCart').dataset.inCart = "false";
    }

    toggleDetailModal(true);
}

// Generate direct bookstore query links
function setupStoreLinks(title, firstAuthor, isbn) {
    const btnKyobo = document.getElementById('btnDetailStoreKyobo');
    const btnAladin = document.getElementById('btnDetailStoreAladin');
    
    // Accurate Search terms: prefer ISBN first, fallback to Title + Author
    const searchQuery = isbn ? isbn : `${title} ${firstAuthor || ''}`;
    
    btnKyobo.href = `https://search.kyobobook.co.kr/search?keyword=${encodeURIComponent(searchQuery)}`;
    btnAladin.href = `https://www.aladin.co.kr/search/wsearchresult.aspx?SearchWord=${encodeURIComponent(searchQuery)}`;
}

// Sync UI details if book resides in user library
function renderLocalStatusUI() {
    const status = currentBook.status;
    const badge = document.getElementById('detailStatusBadge');
    
    document.getElementById('btnDetailAddLibrary').classList.add('hidden');
    document.getElementById('detailLocalActions').classList.remove('hidden');
    document.getElementById('detailStatusSelect').value = status;
    
    const progressSection = document.getElementById('detailSectionProgress');
    const reviewSection = document.getElementById('detailSectionReview');
    
    progressSection.classList.add('hidden');
    reviewSection.classList.add('hidden');
    document.getElementById('btnDetailReview').classList.add('hidden');

    if (status === 'to_read') {
        badge.innerHTML = `<span style="color:var(--warning)"><i class="fa-solid fa-hourglass-start"></i> 읽기 전</span>`;
    } else if (status === 'reading') {
        badge.innerHTML = `<span style="color:var(--blue)"><i class="fa-solid fa-spinner fa-spin"></i> 읽는 중</span>`;
        
        // Show progress slider stats
        progressSection.classList.remove('hidden');
        const pct = currentBook.total_pages > 0 
            ? Math.round((currentBook.current_page / currentBook.total_pages) * 100)
            : 0;
        
        document.getElementById('detailProgressFill').style.width = `${pct}%`;
        document.getElementById('detailProgressText').textContent = `진행도 ${pct}% (${currentBook.current_page} / ${currentBook.total_pages}p)`;
        document.getElementById('btnDetailReview').classList.remove('hidden');
    } else if (status === 'completed') {
        badge.innerHTML = `<span style="color:var(--success)"><i class="fa-solid fa-circle-check"></i> 완독</span>`;
        
        // Show completed reviews
        reviewSection.classList.remove('hidden');
        
        // Render Stars
        const starsContainer = document.getElementById('detailReviewStars');
        starsContainer.innerHTML = '';
        const rating = currentBook.rating || 5;
        for (let i = 1; i <= 5; i++) {
            starsContainer.innerHTML += `<i class="fa-${i <= rating ? 'solid' : 'regular'} fa-star"></i>`;
        }
        
        const reviewDate = currentBook.updated_at ? new Date(currentBook.updated_at).toLocaleDateString('ko-KR') : '날짜 없음';
        document.getElementById('detailReviewDate').textContent = reviewDate;
        document.getElementById('detailReviewContent').textContent = currentBook.review || '작성된 감상평이 없습니다. 간편하게 아래 리뷰 단추로 기록해보세요.';
        
        document.getElementById('btnDetailReview').classList.remove('hidden');
    }
}

// Add to library trigger
async function handleAddLibrary() {
    const user = getCurrentUser();
    if (!user) {
        showToast('로그인이 필요한 기능입니다.', 'warning');
        toggleDetailModal(false);
        toggleAuthModal(true);
        return;
    }

    const btn = document.getElementById('btnDetailAddLibrary');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> 추가 중...';

    try {
        const { error } = await supabase
            .from('books')
            .insert({
                user_id: user.id,
                title: currentBook.title,
                authors: currentBook.authors,
                publisher: currentBook.publisher,
                cover_url: currentBook.cover_url,
                isbn: currentBook.isbn,
                total_pages: currentBook.total_pages,
                current_page: 0,
                status: 'to_read',
                purchase_url: currentBook.purchase_url
            });

        if (error) throw error;

        showToast(`"${currentBook.title}" 도서가 서재에 추가되었습니다.`, 'success');
        
        // Fetch newly created book data
        const { data: newBook } = await supabase
            .from('books')
            .select('*')
            .eq('user_id', user.id)
            .eq('title', currentBook.title)
            .single();

        isLocalBook = true;
        localBookId = newBook.id;
        currentBook.status = 'to_read';
        currentBook.current_page = 0;
        
        renderLocalStatusUI();
        
        // Refresh other views
        window.dispatchEvent(new CustomEvent('library-updated'));
        window.dispatchEvent(new CustomEvent('dashboard-updated'));
    } catch (err) {
        console.error(err);
        showToast('서재 추가 중 오류: ' + err.message, 'danger');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-plus"></i> 내 서재에 추가';
    }
}

// Modify reading status via details dropdown options
async function handleStatusChange(e) {
    if (!isLocalBook || !localBookId) return;

    const newStatus = e.target.value;
    const user = getCurrentUser();
    if (!user) return;

    try {
        let updatePayload = {
            status: newStatus,
            updated_at: new Date().toISOString()
        };

        // Auto resetting / completing pages
        if (newStatus === 'completed') {
            updatePayload.current_page = currentBook.total_pages > 0 ? currentBook.total_pages : 200;
        } else if (newStatus === 'to_read') {
            updatePayload.current_page = 0;
        }

        const { error } = await supabase
            .from('books')
            .update(updatePayload)
            .eq('id', localBookId);

        if (error) throw error;

        currentBook.status = newStatus;
        if (updatePayload.current_page !== undefined) {
            currentBook.current_page = updatePayload.current_page;
        }

        showToast(`독서 상태가 '${newStatus === 'completed' ? '완독' : (newStatus === 'reading' ? '읽는 중' : '읽기 전')}'으로 설정되었습니다.`, 'info');
        renderLocalStatusUI();

        // Refresh sibling windows
        window.dispatchEvent(new CustomEvent('library-updated'));
        window.dispatchEvent(new CustomEvent('dashboard-updated'));
    } catch (err) {
        console.error(err);
        showToast('상태 변경 실패: ' + err.message, 'danger');
    }
}

// Remove book completely from user's active library
async function handleRemoveLibrary() {
    if (!isLocalBook || !localBookId) return;
    if (!confirm(`"${currentBook.title}" 도서를 내 서재에서 정말로 제거할까요? 모든 독서 로그가 함께 지워집니다.`)) return;

    const btn = document.getElementById('btnDetailRemoveLibrary');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 삭제 중...';

    try {
        const { error } = await supabase
            .from('books')
            .delete()
            .eq('id', localBookId);

        if (error) throw error;

        showToast(`"${currentBook.title}" 도서가 서재에서 완전히 제거되었습니다.`, 'success');
        toggleDetailModal(false);

        // Refresh states
        window.dispatchEvent(new CustomEvent('library-updated'));
        window.dispatchEvent(new CustomEvent('dashboard-updated'));
    } catch (err) {
        console.error(err);
        showToast('도서 삭제에 실패했습니다: ' + err.message, 'danger');
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-trash-can"></i> 서재에서 삭제';
    }
}

// Toggle Cart addition
async function handleAddCart() {
    const user = getCurrentUser();
    if (!user) {
        showToast('로그인이 필요한 기능입니다.', 'warning');
        toggleDetailModal(false);
        toggleAuthModal(true);
        return;
    }

    const btn = document.getElementById('btnDetailAddCart');
    const inCart = btn.dataset.inCart === "true";
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> 처리 중...';

    try {
        if (inCart) {
            // Remove from cart
            const { error } = await supabase
                .from('cart_items')
                .delete()
                .eq('user_id', user.id)
                .eq('title', currentBook.title);

            if (error) throw error;

            showToast(`"${currentBook.title}" 도서가 장바구니에서 삭제되었습니다.`, 'info');
            btn.innerHTML = `<i class="fa-solid fa-cart-shopping"></i> 장바구니 담기`;
            btn.dataset.inCart = "false";
        } else {
            // Add to cart
            const { error } = await supabase
                .from('cart_items')
                .insert({
                    user_id: user.id,
                    title: currentBook.title,
                    authors: currentBook.authors,
                    cover_url: currentBook.cover_url,
                    isbn: currentBook.isbn,
                    purchase_url: currentBook.purchase_url
                });

            if (error) throw error;

            showToast(`"${currentBook.title}" 도서가 장바구니에 추가되었습니다!`, 'success');
            btn.innerHTML = `<i class="fa-solid fa-cart-arrow-down"></i> 장바구니에서 빼기`;
            btn.dataset.inCart = "true";
        }

        // Sync global cart components
        window.dispatchEvent(new CustomEvent('cart-updated'));
    } catch (err) {
        console.error(err);
        showToast('장바구니 조작 실패: ' + err.message, 'danger');
    } finally {
        btn.disabled = false;
    }
}
