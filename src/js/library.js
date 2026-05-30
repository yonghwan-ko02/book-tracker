// Library Module - Manage Library Books, Reading Progress, Logs and Reviews
import { supabase } from './supabase.js';
import { getCurrentUser, showToast } from './auth.js';

// UI references (Initialized in initLibrary)
let libraryGrid = null;
let libraryEmptyState = null;
let libraryTabs = null;

// Modals references (Initialized in initLibrary)
let progressModal = null;
let progressForm = null;
let reviewModal = null;
let reviewForm = null;

let activeTabStatus = 'all';

// Initialize Library Module Event listeners
export function initLibrary() {
    libraryGrid = document.getElementById('libraryGrid');
    libraryEmptyState = document.getElementById('libraryEmptyState');
    libraryTabs = document.querySelectorAll('.library-tabs .tab-btn');
    progressModal = document.getElementById('progressModal');
    progressForm = document.getElementById('progressForm');
    reviewModal = document.getElementById('reviewModal');
    reviewForm = document.getElementById('reviewForm');

    // Bind Notion Export actions
    document.getElementById('btnExportNotionCsv')?.addEventListener('click', handleNotionCsvExport);
    document.getElementById('btnCopyNotionMarkdown')?.addEventListener('click', handleNotionMarkdownExport);

    libraryTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            libraryTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeTabStatus = tab.dataset.status;
            fetchAndRenderLibrary();
        });
    });
    
    // Bind progress modal events
    document.getElementById('btnProgressModalClose')?.addEventListener('click', () => toggleProgressModal(false));
    progressForm?.addEventListener('submit', handleProgressSubmit);
    
    // Bind review modal events
    document.getElementById('btnReviewModalClose')?.addEventListener('click', () => toggleReviewModal(false));
    reviewForm?.addEventListener('submit', handleReviewSubmit);
    
    // Listen to custom updates
    window.addEventListener('library-updated', () => {
        fetchAndRenderLibrary();
    });
    
    document.getElementById('btnGoToSearch')?.addEventListener('click', () => {
        // Switch to search panel
        document.getElementById('navSearch')?.click();
    });
}

// Open / Close Progress Modal Dialog
function toggleProgressModal(show) {
    if (show) {
        progressModal.classList.remove('hidden');
        setTimeout(() => progressModal.classList.add('active'), 10);
    } else {
        progressModal.classList.remove('active');
        setTimeout(() => progressModal.classList.add('hidden'), 300);
    }
}

// Open / Close Review Modal Dialog
function toggleReviewModal(show) {
    if (show) {
        reviewModal.classList.remove('hidden');
        setTimeout(() => reviewModal.classList.add('active'), 10);
    } else {
        reviewModal.classList.remove('active');
        setTimeout(() => reviewModal.classList.add('hidden'), 300);
    }
}

// Core library fetch and render method
export async function fetchAndRenderLibrary() {
    const user = getCurrentUser();
    if (!user) {
        renderGuestLibrary();
        return;
    }
    
    try {
        let query = supabase
            .from('books')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });
            
        if (activeTabStatus !== 'all') {
            query = query.eq('status', activeTabStatus);
        }
        
        const { data: books, error } = await query;
        
        if (error) throw error;
        
        // Dynamically recalculate statistics and update badges
        updateTabBadges(user.id);
        
        if (!books || books.length === 0) {
            libraryGrid.innerHTML = '';
            libraryEmptyState.classList.remove('hidden');
            libraryGrid.classList.add('hidden');
        } else {
            libraryEmptyState.classList.add('hidden');
            libraryGrid.classList.remove('hidden');
            renderBooks(books);
        }
    } catch (err) {
        console.error(err);
        showToast('서재 데이터를 가져오는 데 오류가 발생했습니다: ' + err.message, 'danger');
    }
}

// Render library items if user is not authenticated
function renderGuestLibrary() {
    libraryGrid.innerHTML = '';
    libraryEmptyState.classList.remove('hidden');
    libraryGrid.classList.add('hidden');
    
    // Update labels to invite guest users to login
    const emptyTitle = libraryEmptyState.querySelector('h3');
    const emptyDesc = libraryEmptyState.querySelector('p');
    if (emptyTitle && emptyDesc) {
        emptyTitle.textContent = '내 서재에 오신 것을 환영합니다!';
        emptyDesc.textContent = '로그인하시면 서재 책 관리, 개인 페이지 기록, 진척도 및 장바구니 데이터를 평생 동기화할 수 있습니다.';
    }
}

// Dynamic library tab badges updates
async function updateTabBadges(userId) {
    try {
        const { data: countData, error } = await supabase
            .from('books')
            .select('status');
            
        if (error) throw error;
        
        let all = 0, toRead = 0, reading = 0, completed = 0;
        
        countData.forEach(book => {
            all++;
            if (book.status === 'to_read') toRead++;
            else if (book.status === 'reading') reading++;
            else if (book.status === 'completed') completed++;
        });
        
        document.getElementById('libraryBadgeAll').textContent = all;
        document.getElementById('libraryBadgeToRead').textContent = toRead;
        document.getElementById('libraryBadgeReading').textContent = reading;
        document.getElementById('libraryBadgeCompleted').textContent = completed;
    } catch (err) {
        console.error(err);
    }
}

// Draw library items
function renderBooks(books) {
    libraryGrid.innerHTML = '';
    
    books.forEach(book => {
        const card = document.createElement('div');
        card.className = 'book-card';
        
        // Progress percentage calculation
        let pct = 0;
        if (book.total_pages > 0) {
            pct = Math.round((book.current_page / book.total_pages) * 100);
            pct = Math.min(Math.max(pct, 0), 100);
        }
        
        let actionsHtml = '';
        let badgeHtml = '';
        
        if (book.status === 'to_read') {
            badgeHtml = `<span class="book-card-badge" style="color:var(--warning)"><i class="fa-solid fa-hourglass-start"></i> 읽기 전</span>`;
            actionsHtml = `
                <button class="btn-card-action primary btn-start-reading" data-id="${book.id}" data-title="${encodeURIComponent(book.title)}">
                    <i class="fa-solid fa-play"></i> 독서 시작
                </button>
            `;
        } else if (book.status === 'reading') {
            badgeHtml = `<span class="book-card-badge" style="color:var(--blue)"><i class="fa-solid fa-spinner fa-spin"></i> 읽는 중</span>`;
            actionsHtml = `
                <button class="btn-card-action primary btn-log-progress" 
                    data-id="${book.id}" 
                    data-title="${encodeURIComponent(book.title)}"
                    data-author="${encodeURIComponent(book.authors?.join(', ') || '작가 미상')}"
                    data-cover="${encodeURIComponent(book.cover_url || '')}"
                    data-current="${book.current_page}"
                    data-total="${book.total_pages}">
                    <i class="fa-solid fa-pen"></i> 기록
                </button>
                <button class="btn-card-action secondary btn-finish-reading" 
                    data-id="${book.id}"
                    data-title="${encodeURIComponent(book.title)}"
                    data-author="${encodeURIComponent(book.authors?.join(', ') || '작가 미상')}"
                    data-cover="${encodeURIComponent(book.cover_url || '')}">
                    <i class="fa-solid fa-circle-check"></i> 완독
                </button>
            `;
        } else if (book.status === 'completed') {
            badgeHtml = `<span class="book-card-badge" style="color:var(--success)"><i class="fa-solid fa-circle-check"></i> 완독</span>`;
            
            // Draw review stars if completed
            let stars = '';
            if (book.rating) {
                for (let i = 1; i <= 5; i++) {
                    stars += `<i class="fa-${i <= book.rating ? 'solid' : 'regular'} fa-star"></i>`;
                }
            }
            
            actionsHtml = `
                <div class="book-card-rating" style="font-size: 11px; margin-bottom: 6px;">
                    ${stars || '평가 없음'}
                </div>
                <div style="display: flex; gap: 6px; width: 100%;">
                    <button class="btn-card-action primary btn-log-progress" 
                        data-id="${book.id}" 
                        data-title="${encodeURIComponent(book.title)}"
                        data-author="${encodeURIComponent(book.authors?.join(', ') || '작가 미상')}"
                        data-cover="${encodeURIComponent(book.cover_url || '')}"
                        data-current="${book.current_page}"
                        data-total="${book.total_pages}">
                        <i class="fa-solid fa-pen"></i> 기록
                    </button>
                    <button class="btn-card-action secondary btn-finish-reading" 
                        data-id="${book.id}"
                        data-title="${encodeURIComponent(book.title)}"
                        data-author="${encodeURIComponent(book.authors?.join(', ') || '작가 미상')}"
                        data-cover="${encodeURIComponent(book.cover_url || '')}">
                        <i class="fa-solid fa-star"></i> 리뷰
                    </button>
                    <button class="btn-card-action outline btn-reset-status" 
                        data-id="${book.id}"
                        data-title="${encodeURIComponent(book.title)}"
                        title="독서 상태 다시 읽기로 변경"
                        style="max-width: 32px; min-width: 32px; padding: 0;">
                        <i class="fa-solid fa-rotate-left"></i>
                    </button>
                </div>
            `;
        }
        
        let progressHtml = '';
        if (book.status !== 'to_read') {
            progressHtml = `
                <div class="book-card-progress">
                    <div class="progress-bar-sm">
                        <div class="progress-bar-fill-sm" style="width: ${pct}%; background: ${book.status === 'completed' ? 'var(--success)' : 'var(--primary-accent)'}"></div>
                    </div>
                    <div class="progress-label-sm">
                        <span>진행도</span>
                        <span>${pct}% (${book.current_page}/${book.total_pages}p)</span>
                    </div>
                </div>
            `;
        }
        
        card.innerHTML = `
            <div class="book-card-cover-wrapper">
                <img src="${book.cover_url || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=200&h=280'}" alt="${book.title}" class="book-card-cover" loading="lazy">
                ${badgeHtml}
            </div>
            <div class="book-card-details">
                <h4 class="book-card-title" title="${book.title}">${book.title}</h4>
                <p class="book-card-author" title="${book.authors?.join(', ') || '작가 미상'}">${book.authors?.join(', ') || '작가 미상'}</p>
                <p class="book-card-publisher" title="${book.publisher || ''}">${book.publisher || ''}</p>
                ${progressHtml}
                <div class="book-card-actions" style="margin-top: 8px;">
                    ${actionsHtml}
                </div>
            </div>
        `;
        
        libraryGrid.appendChild(card);
    });
    
    // Bind individual library actions
    bindLibraryActions();
}

// Bind events on library items
function bindLibraryActions() {
    // Start Reading action click handler
    libraryGrid.querySelectorAll('.btn-start-reading').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const btnEl = e.currentTarget;
            const bookId = btnEl.dataset.id;
            const title = decodeURIComponent(btnEl.dataset.title);
            
            btnEl.disabled = true;
            btnEl.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> 시작 중...';
            
            try {
                const { error } = await supabase
                    .from('books')
                    .update({
                        status: 'reading',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', bookId);
                    
                if (error) throw error;
                
                showToast(`"${title}" 독서를 시작합니다! 기록 탭을 사용해 매일 독서량을 저장해 보세요.`, 'info');
                
                // Refresh list & dashboard
                fetchAndRenderLibrary();
                window.dispatchEvent(new CustomEvent('dashboard-updated'));
            } catch (err) {
                console.error(err);
                showToast('독서 시작 처리 도중 에러가 발생했습니다: ' + err.message, 'danger');
                btnEl.disabled = false;
                btnEl.innerHTML = '<i class="fa-solid fa-play"></i> 독서 시작';
            }
        });
    });
    
    // Log Progress click handler
    libraryGrid.querySelectorAll('.btn-log-progress').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const btnEl = e.currentTarget;
            
            document.getElementById('progressBookId').value = btnEl.dataset.id;
            document.getElementById('progressBookTitle').textContent = decodeURIComponent(btnEl.dataset.title);
            document.getElementById('progressBookAuthor').textContent = decodeURIComponent(btnEl.dataset.author);
            document.getElementById('progressBookCover').src = decodeURIComponent(btnEl.dataset.cover);
            
            const current = parseInt(btnEl.dataset.current) || 0;
            const total = parseInt(btnEl.dataset.total) || 0;
            
            document.getElementById('progressCurrentPage').value = current;
            document.getElementById('progressTotalPages').value = total > 0 ? total : '';
            document.getElementById('progressNotes').value = '';
            
            toggleProgressModal(true);
        });
    });
    
    // Complete Reading click handler
    libraryGrid.querySelectorAll('.btn-finish-reading').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const btnEl = e.currentTarget;
            
            document.getElementById('reviewBookId').value = btnEl.dataset.id;
            document.getElementById('reviewBookTitle').textContent = decodeURIComponent(btnEl.dataset.title);
            document.getElementById('reviewBookAuthor').textContent = decodeURIComponent(btnEl.dataset.author);
            document.getElementById('reviewBookCover').src = decodeURIComponent(btnEl.dataset.cover);
            document.getElementById('reviewContent').value = '';
            
            // Check star 1 as default
            document.getElementById('star1').checked = true;
            
            toggleReviewModal(true);
        });
    });

    // Reset status back to reading click handler
    libraryGrid.querySelectorAll('.btn-reset-status').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const btnEl = e.currentTarget;
            const bookId = btnEl.dataset.id;
            const title = decodeURIComponent(btnEl.dataset.title);
            
            btnEl.disabled = true;
            btnEl.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
            
            try {
                const { error } = await supabase
                    .from('books')
                    .update({
                        status: 'reading',
                        current_page: 0,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', bookId);
                    
                if (error) throw error;
                
                showToast(`"${title}" 도서 상태를 '읽는 중'으로 변경하고 진행도를 초기화했습니다!`, 'info');
                
                fetchAndRenderLibrary();
                window.dispatchEvent(new CustomEvent('dashboard-updated'));
            } catch (err) {
                console.error(err);
                showToast('상태 변경 실패: ' + err.message, 'danger');
                btnEl.disabled = false;
                btnEl.innerHTML = '<i class="fa-solid fa-rotate-left"></i>';
            }
        });
    });
}

// Handle progress recording form submission
async function handleProgressSubmit(e) {
    e.preventDefault();
    
    const user = getCurrentUser();
    if (!user) return;
    
    const bookId = document.getElementById('progressBookId').value;
    const currentPage = parseInt(document.getElementById('progressCurrentPage').value) || 0;
    const totalPages = parseInt(document.getElementById('progressTotalPages').value) || 0;
    const notes = document.getElementById('progressNotes').value.trim();
    
    if (currentPage > totalPages) {
        showToast('현재 페이지가 전체 페이지 수보다 클 수 없습니다.', 'warning');
        return;
    }
    
    const btnSubmit = progressForm.querySelector('button[type="submit"]');
    const originalText = btnSubmit.textContent;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> 저장 중...';
    
    try {
        // 1. Get original current page to calculate pages read
        const { data: originalBook, error: fetchError } = await supabase
            .from('books')
            .select('current_page, title')
            .eq('id', bookId)
            .single();
            
        if (fetchError) throw fetchError;
        
        const pagesLogged = Math.max(currentPage - originalBook.current_page, 0);
        
        // 2. Update books table
        // If current page matches total pages, auto transition status to completed!
        const autoComplete = (currentPage === totalPages && totalPages > 0);
        const updatePayload = {
            current_page: currentPage,
            total_pages: totalPages,
            updated_at: new Date().toISOString()
        };
        
        if (autoComplete) {
            updatePayload.status = 'completed';
        } else {
            updatePayload.status = 'reading'; // revert/set to reading status if pages are modified
        }
        
        const { error: updateError } = await supabase
            .from('books')
            .update(updatePayload)
            .eq('id', bookId);
            
        if (updateError) throw updateError;
        
        // 3. Write record to reading_logs
        const { error: logError } = await supabase
            .from('reading_logs')
            .insert({
                user_id: user.id,
                book_id: bookId,
                pages_read: pagesLogged,
                notes: notes || `${currentPage}페이지까지 기록을 업데이트했습니다.`
            });
            
        if (logError) throw logError;
        
        showToast(`"${originalBook.title}" 도서의 진척도가 저장되었습니다. (+${pagesLogged}p)`, 'success');
        
        if (autoComplete) {
            showToast(`축하합니다! "${originalBook.title}"을(를) 완독하셨습니다. 완독 도서로 전환됩니다.`, 'success');
        }
        
        toggleProgressModal(false);
        fetchAndRenderLibrary();
        
        // Dispatch global alerts
        window.dispatchEvent(new CustomEvent('dashboard-updated'));
    } catch (err) {
        console.error(err);
        showToast('기록 저장 중 에러가 발생했습니다: ' + err.message, 'danger');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = originalText;
    }
}

// Handle complete reading modal form submission
async function handleReviewSubmit(e) {
    e.preventDefault();
    
    const user = getCurrentUser();
    if (!user) return;
    
    const bookId = document.getElementById('reviewBookId').value;
    const ratingInput = reviewForm.querySelector('input[name="rating"]:checked');
    const rating = ratingInput ? parseInt(ratingInput.value) : 5;
    const reviewContent = document.getElementById('reviewContent').value.trim();
    
    const btnSubmit = reviewForm.querySelector('button[type="submit"]');
    const originalText = btnSubmit.textContent;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> 완독 처리 중...';
    
    try {
        // 1. Fetch total pages of the book to set current_page = total_pages
        const { data: book, error: fetchError } = await supabase
            .from('books')
            .select('total_pages, current_page, title')
            .eq('id', bookId)
            .single();
            
        if (fetchError) throw fetchError;
        
        const finalPages = book.total_pages > 0 ? book.total_pages : 200; // fallback if pages unrecorded
        const pagesLogged = Math.max(finalPages - book.current_page, 0);
        
        // 2. Update books table
        const { error: updateError } = await supabase
            .from('books')
            .update({
                current_page: finalPages,
                total_pages: finalPages,
                status: 'completed',
                rating,
                review: reviewContent,
                updated_at: new Date().toISOString()
            })
            .eq('id', bookId);
            
        if (updateError) throw updateError;
        
        // 3. Write final log to reading_logs
        const { error: logError } = await supabase
            .from('reading_logs')
            .insert({
                user_id: user.id,
                book_id: bookId,
                pages_read: pagesLogged,
                notes: reviewContent || '독서를 성공적으로 마치고 완독 평점을 남겼습니다.'
            });
            
        if (logError) throw logError;
        
        showToast(`"${book.title}" 도서를 완독 처리하였습니다! 멋진 감상평을 기록해 주셔서 감사합니다.`, 'success');
        
        toggleReviewModal(false);
        fetchAndRenderLibrary();
        
        // Dispatch alerts
        window.dispatchEvent(new CustomEvent('dashboard-updated'));
    } catch (err) {
        console.error(err);
        showToast('완독 저장 중 에러가 발생했습니다: ' + err.message, 'danger');
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = originalText;
    }
}

// 4. Notion CSV Exporter (Korean character-safe with BOM)
async function handleNotionCsvExport() {
    const user = getCurrentUser();
    if (!user) {
        showToast('로그인이 필요한 기능입니다.', 'warning');
        return;
    }
    
    const btn = document.getElementById('btnExportNotionCsv');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> CSV 생성 중...';
    
    try {
        const { data: books, error } = await supabase
            .from('books')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });
            
        if (error) throw error;
        
        if (!books || books.length === 0) {
            showToast('서재에 등록된 도서가 없습니다. 먼저 도서를 검색해 서재에 등록해 주세요!', 'warning');
            return;
        }
        
        // Assemble CSV lines
        const headers = ["Title", "Authors", "Publisher", "ISBN", "Total Pages", "Current Page", "Status", "Rating", "Review"];
        const rows = books.map(book => [
            `"${book.title.replace(/"/g, '""')}"`,
            `"${(book.authors || []).join(', ').replace(/"/g, '""')}"`,
            `"${(book.publisher || '').replace(/"/g, '""')}"`,
            `"${book.isbn || ''}"`,
            book.total_pages || 0,
            book.current_page || 0,
            `"${book.status}"`,
            book.rating || '',
            `"${(book.review || '').replace(/"/g, '""')}"`
        ]);
        
        // Join with carriage returns and add UTF-8 BOM (\uFEFF)
        const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        
        // Download logic in browser
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `LuminaRead_Notion_Database_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast('노션 업로드용 CSV 파일 다운로드 완료! 노션 보드에서 업로드해 보세요.', 'success');
    } catch (err) {
        console.error(err);
        showToast('CSV 내보내기 실패: ' + err.message, 'danger');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// 5. Notion Markdown Exporter
async function handleNotionMarkdownExport() {
    const user = getCurrentUser();
    if (!user) {
        showToast('로그인이 필요한 기능입니다.', 'warning');
        return;
    }
    
    const btn = document.getElementById('btnCopyNotionMarkdown');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 복사 중...';
    
    try {
        // Query books & logs
        const { data: books, error: booksError } = await supabase
            .from('books')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });
            
        if (booksError) throw booksError;
        
        if (!books || books.length === 0) {
            showToast('서재에 등록된 도서가 없습니다.', 'warning');
            return;
        }
        
        // Generate gorgeous Notion markdown template
        let md = `# 📚 LuminaRead 독서 포트폴리오\n\n`;
        md += `> **분석 날짜**: ${new Date().toLocaleDateString('ko-KR')}\n`;
        md += `> **사용자 이메일**: ${user.email}\n`;
        md += `> **총 등록 도서**: ${books.length}권\n\n`;
        
        md += `## 🎯 독서 요약 보드\n\n`;
        md += `| 도서명 | 저자 | 진행률 | 상태 | 평점 | 한줄평 |\n`;
        md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
        
        books.forEach(b => {
            const pct = b.total_pages > 0 ? Math.round((b.current_page / b.total_pages) * 100) : 0;
            const statusKor = b.status === 'completed' ? '🟢 완독' : (b.status === 'reading' ? '🔵 읽는 중' : '🟡 읽기 전');
            const ratingStars = b.rating ? '★'.repeat(b.rating) + '☆'.repeat(5 - b.rating) : '평가 없음';
            const reviewShort = b.review ? b.review.replace(/\n/g, ' ') : '';
            
            md += `| **${b.title}** | ${b.authors.join(', ')} | ${pct}% (${b.current_page}/${b.total_pages}p) | ${statusKor} | ${ratingStars} | ${reviewShort} |\n`;
        });
        
        md += `\n\n## 📝 상세 독서 로그 및 일지\n\n`;
        
        // Gather logs
        const { data: logs, error: logsError } = await supabase
            .from('reading_logs')
            .select(`
                id,
                pages_read,
                notes,
                logged_at,
                books (
                    title
                )
            `)
            .eq('user_id', user.id)
            .order('logged_at', { ascending: false });
            
        if (!logsError && logs && logs.length > 0) {
            logs.forEach(log => {
                const dateStr = new Date(log.logged_at).toLocaleDateString('ko-KR');
                md += `- **[${dateStr}] ${log.books?.title || '도서'}** (+${log.pages_read}p 기록)\n`;
                if (log.notes) {
                    md += `  > 💬 "${log.notes}"\n`;
                }
            });
        } else {
            md += `*기록된 상세 데일리 로그가 없습니다.*\n`;
        }
        
        md += `\n\n---\n*LuminaRead AI Book Tracker를 통해 자동으로 동기화된 독서 포트폴리오입니다.*`;
        
        // Write to clipboard
        await navigator.clipboard.writeText(md);
        showToast('노션 포트폴리오 마크다운이 클립보드에 복사되었습니다! 노션 페이지에 붙여넣어 보세요!', 'success');
    } catch (err) {
        console.error(err);
        showToast('포트폴리오 생성 및 복사 실패: ' + err.message, 'danger');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}
