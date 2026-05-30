// Main Application Coordinator & Panel Router Module
import { supabase } from './supabase.js';
import { initAuth, getCurrentUser, showToast } from './auth.js';
import { initSearch } from './search.js';
import { initLibrary, fetchAndRenderLibrary } from './library.js';
import { initCart, fetchAndRenderCart } from './cart.js';
import { fetchAndRenderAIRecommendations } from './ai.js';

// Panel title mapping metadata
const panelMetadata = {
    dashboard: {
        title: '독서 대시보드',
        subtitle: '나의 독서 행동 데이터와 연간 목표 진행도를 모니터링합니다.'
    },
    search: {
        title: '도서 검색하기',
        subtitle: '수백만 권의 도서 중에서 마음에 드는 책을 찾고 내 서재나 카트에 저장해보세요.'
    },
    library: {
        title: '나의 개인 서재',
        subtitle: '읽고 싶은 책, 읽는 중인 책, 그리고 완독한 나의 모든 인생작들을 관리합니다.'
    },
    cart: {
        title: '장바구니 & 구매',
        subtitle: '장바구니에 소중히 보관한 도서 목록을 확인하고 실제 인터넷 대형 서점으로 연동합니다.'
    }
};

// SVG circumference constant for goal progress ring
const RING_CIRCUMFERENCE = 314.16;

// Annual goal variables
let annualReadingGoal = 12;

// Initialize app when DOM is fully loaded (Safe readyState check)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// Bootstrapper function
function initApp() {
    // Load saved annual reading goal from localStorage
    const savedGoal = localStorage.getItem('annual_reading_goal');
    if (savedGoal) {
        annualReadingGoal = parseInt(savedGoal) || 12;
    }
    
    // Core Sub-modules initializations
    initAuth(handleUserChanged);
    initSearch();
    initLibrary();
    initCart();
    
    // Bind global dashboard listener updates
    window.addEventListener('dashboard-updated', () => {
        fetchAndRenderDashboard();
    });
    
    // Bind main shell event handlers
    bindRouterEvents();
    bindGoalModalEvents();
}

// Single-page router switches
function bindRouterEvents() {
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    const panels = document.querySelectorAll('.panel-container .content-panel');
    const currentPanelTitle = document.getElementById('currentPanelTitle');
    const currentPanelSubtitle = document.getElementById('currentPanelSubtitle');
    
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            const targetPanel = item.dataset.panel;
            if (!targetPanel) return;
            
            // Switch navigation active link styling
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Switch visible panel cards
            panels.forEach(panel => panel.classList.remove('active'));
            const targetPanelEl = document.getElementById(`panel${targetPanel.charAt(0).toUpperCase() + targetPanel.slice(1)}`);
            if (targetPanelEl) {
                targetPanelEl.classList.add('active');
            }
            
            // Update page header contents
            const meta = panelMetadata[targetPanel];
            if (meta && currentPanelTitle && currentPanelSubtitle) {
                currentPanelTitle.textContent = meta.title;
                currentPanelSubtitle.textContent = meta.subtitle;
            }
            
            // Dispatch active views fetches
            triggerPanelActiveFetch(targetPanel);
        });
    });
}

// Router callbacks depending on active viewport panel
function triggerPanelActiveFetch(panel) {
    if (panel === 'dashboard') {
        fetchAndRenderDashboard();
    } else if (panel === 'library') {
        fetchAndRenderLibrary();
    } else if (panel === 'cart') {
        fetchAndRenderCart();
    }
}

// Handle User login changes
function handleUserChanged(user) {
    // Force reload active viewport contents
    const activeNav = document.querySelector('.sidebar-nav .nav-item.active');
    const activePanel = activeNav ? activeNav.dataset.panel : 'dashboard';
    
    // Fetch statistics and sync badges
    fetchAndRenderDashboard();
    fetchAndRenderLibrary();
    fetchAndRenderCart();
}

// Bind Annual goal popup triggers
function bindGoalModalEvents() {
    const goalModal = document.getElementById('goalModal');
    const btnEditGoal = document.getElementById('btnEditGoal');
    const btnGoalModalClose = document.getElementById('btnGoalModalClose');
    const goalForm = document.getElementById('goalForm');
    const inputGoalNumber = document.getElementById('inputGoalNumber');
    
    const toggleGoalModal = (show) => {
        if (show) {
            inputGoalNumber.value = annualReadingGoal;
            goalModal.classList.remove('hidden');
            setTimeout(() => goalModal.classList.add('active'), 10);
        } else {
            goalModal.classList.remove('active');
            setTimeout(() => goalModal.classList.add('hidden'), 300);
        }
    };
    
    btnEditGoal?.addEventListener('click', () => {
        const user = getCurrentUser();
        if (!user) {
            showToast('목표를 개인 보드에 저장하려면 로그인이 필요합니다.', 'warning');
            return;
        }
        toggleGoalModal(true);
    });
    
    btnGoalModalClose?.addEventListener('click', () => toggleGoalModal(false));
    
    goalForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const value = parseInt(inputGoalNumber.value) || 12;
        annualReadingGoal = value;
        localStorage.setItem('annual_reading_goal', value);
        
        showToast(`2026년 독서 목표가 ${value}권으로 설정되었습니다! 화이팅!`, 'success');
        toggleGoalModal(false);
        fetchAndRenderDashboard();
    });
}

// Fetch dashboard statistical metrics and updates UI
async function fetchAndRenderDashboard() {
    const user = getCurrentUser();
    if (!user) {
        renderGuestDashboard();
        return;
    }
    
    try {
        // 1. Fetch books statistics
        const { data: books, error: booksError } = await supabase
            .from('books')
            .select('*');
            
        if (booksError) throw booksError;
        
        // 2. Fetch total cumulative pages logged from reading_logs
        const { data: logs, error: logsError } = await supabase
            .from('reading_logs')
            .select('pages_read');
            
        if (logsError) throw logsError;
        
        // Compute statistics counts
        let totalBooks = 0;
        let completedBooks = 0;
        let readingBooks = 0;
        let toReadBooks = 0;
        
        books.forEach(book => {
            totalBooks++;
            if (book.status === 'completed') completedBooks++;
            else if (book.status === 'reading') readingBooks++;
            else if (book.status === 'to_read') toReadBooks++;
        });
        
        let cumulativePages = 0;
        logs.forEach(log => {
            cumulativePages += log.pages_read || 0;
        });
        
        // Render simple cards metrics
        const progressPct = totalBooks > 0 ? Math.round((completedBooks / totalBooks) * 100) : 0;
        document.getElementById('statsProgressPct').textContent = `${progressPct}%`;
        document.getElementById('statsProgressFill').style.width = `${progressPct}%`;
        document.getElementById('statsProgressFooter').textContent = `총 ${totalBooks}권 중 ${completedBooks}권 완독`;
        
        document.getElementById('statsReadingCount').textContent = readingBooks;
        document.getElementById('statsReadingFooter').textContent = `현재 진행 중인 도서 ${readingBooks}권`;
        
        document.getElementById('statsToReadCount').textContent = toReadBooks;
        document.getElementById('statsToReadFooter').textContent = `버킷리스트 위시 ${toReadBooks}권`;
        
        document.getElementById('statsTotalPages').innerHTML = `${cumulativePages.toLocaleString()} <span class="unit">p</span>`;
        
        // 3. Render Annual Reading Goal Radial progress dial
        renderAnnualReadingGoal(completedBooks);
        
        // 4. Render Active reading book showcase
        renderActiveShowcase(books);
        
        // 5. Render Timeline Feed
        renderTimelineActivity(user.id);
        
        // 6. Render AI Book Recommendations
        fetchAndRenderAIRecommendations(books);
        
    } catch (err) {
        console.error(err);
        showToast('대시보드 통계를 업데이트하지 못했습니다: ' + err.message, 'danger');
    }
}

// Reset dashboard to default guest values
function renderGuestDashboard() {
    document.getElementById('statsProgressPct').textContent = '0%';
    document.getElementById('statsProgressFill').style.width = '0%';
    document.getElementById('statsProgressFooter').textContent = '총 0권 중 0권 완독';
    document.getElementById('statsReadingCount').textContent = '0';
    document.getElementById('statsReadingFooter').textContent = '현재 진행중인 도서 수';
    document.getElementById('statsToReadCount').textContent = '0';
    document.getElementById('statsToReadFooter').textContent = '찜해둔 독서 버킷리스트';
    document.getElementById('statsTotalPages').innerHTML = `0 <span class="unit">p</span>`;
    
    // Annual Goal Ring resetting
    const ring = document.getElementById('goalProgressRing');
    if (ring) ring.style.strokeDashoffset = RING_CIRCUMFERENCE;
    document.getElementById('goalProgressPct').textContent = '0%';
    document.getElementById('goalCountRatio').textContent = `0 / 12권`;
    document.getElementById('goalDescText').textContent = '로그인하시면 나만의 연간 완독 목표를 관리하실 수 있습니다.';
    document.getElementById('goalMotivation').textContent = '독서 기록을 시각화해 보세요!';
    
    // Active showcase reset
    const showcase = document.getElementById('dashboardActiveShowcase');
    if (showcase) {
        showcase.innerHTML = `
            <div class="showcase-empty">
                <i class="fa-solid fa-right-to-bracket"></i>
                <p>회원만의 독서 트래커 서비스<br>로그인하시고 나의 첫 책을 추가해 보세요!</p>
            </div>
        `;
    }
    
    // Timeline reset
    const timeline = document.getElementById('dashboardTimeline');
    if (timeline) {
        timeline.innerHTML = `
            <div class="timeline-empty">
                <p>최근 기록된 독서 기록이 없습니다.</p>
            </div>
        `;
    }
    
    // AI Recommendations reset
    fetchAndRenderAIRecommendations([]);
}

// Computes and renders annual reading goal radial indicators
function renderAnnualReadingGoal(completedCount) {
    const goalRatio = completedCount / annualReadingGoal;
    const goalPct = Math.min(Math.round(goalRatio * 100), 1000);
    
    // Radial SVG stroke dash offsets calculations
    const strokeOffset = RING_CIRCUMFERENCE - (Math.min(goalRatio, 1) * RING_CIRCUMFERENCE);
    const ring = document.getElementById('goalProgressRing');
    if (ring) {
        ring.style.strokeDashoffset = strokeOffset;
    }
    
    document.getElementById('goalProgressPct').textContent = `${goalPct}%`;
    document.getElementById('goalCountRatio').textContent = `${completedCount} / ${annualReadingGoal}권`;
    document.getElementById('goalDescText').textContent = `올해 목표한 도서 ${annualReadingGoal}권 중 ${completedCount}권을 성공적으로 완독하셨습니다.`;
    
    // Dynamic motivational tagline depending on percent finished
    const motivationEl = document.getElementById('goalMotivation');
    if (motivationEl) {
        if (goalPct === 0) motivationEl.textContent = '아직 늦지 않았습니다. 첫 페이지를 펼쳐보세요! ✨';
        else if (goalPct < 30) motivationEl.textContent = '좋은 출발입니다! 한 페이지씩 꾸준히 읽어보아요! 🌱';
        else if (goalPct < 70) motivationEl.textContent = '벌써 절반을 향해 달리고 있네요! 대단하십니다! 🔥';
        else if (goalPct < 100) motivationEl.textContent = '고지가 눈 앞입니다! 완주의 기쁨을 향해 달려요! 🏃‍♂️';
        else motivationEl.textContent = '축하합니다! 2026년 연간 독서 완독 목표를 달성하셨습니다! 🏆';
    }
}

// Render currently reading main book widget
function renderActiveShowcase(books) {
    const showcaseContainer = document.getElementById('dashboardActiveShowcase');
    if (!showcaseContainer) return;
    
    // Retrieve the first book marked as 'reading'
    const activeBook = books.find(book => book.status === 'reading');
    
    if (!activeBook) {
        showcaseContainer.innerHTML = `
            <div class="showcase-empty">
                <i class="fa-solid fa-book-open-reader"></i>
                <p>현재 읽고 있는 도서가 없습니다.<br>내 서재에서 독서를 시작해보세요!</p>
            </div>
        `;
        return;
    }
    
    let progressRatio = 0;
    if (activeBook.total_pages > 0) {
        progressRatio = Math.round((activeBook.current_page / activeBook.total_pages) * 100);
        progressRatio = Math.min(Math.max(progressRatio, 0), 100);
    }
    
    showcaseContainer.innerHTML = `
        <div class="active-showcase-item">
            <img src="${activeBook.cover_url || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=200&h=280'}" alt="${activeBook.title}" class="showcase-cover">
            <div class="showcase-details">
                <h4 class="showcase-title" title="${activeBook.title}">${activeBook.title}</h4>
                <p class="showcase-author" title="${activeBook.authors?.join(', ') || '작가 미상'}">${activeBook.authors?.join(', ') || '작가 미상'}</p>
                <div class="showcase-progress-wrap">
                    <div class="showcase-progress-bar">
                        <div class="showcase-progress-fill" style="width: ${progressRatio}%"></div>
                    </div>
                    <div class="showcase-progress-text">
                        <span>진척률 ${progressRatio}%</span>
                        <span>${activeBook.current_page} / ${activeBook.total_pages} 페이지</span>
                    </div>
                </div>
                <button class="btn-card-action primary btn-showcase-log" 
                    data-id="${activeBook.id}"
                    data-title="${encodeURIComponent(activeBook.title)}"
                    data-author="${encodeURIComponent(activeBook.authors?.join(', ') || '작가 미상')}"
                    data-cover="${encodeURIComponent(activeBook.cover_url || '')}"
                    data-current="${activeBook.current_page}"
                    data-total="${activeBook.total_pages}">
                    <i class="fa-solid fa-feather"></i> 빠른 오늘 독서량 기록
                </button>
            </div>
        </div>
    `;
    
    // Bind quick page update logging next to showcase card
    showcaseContainer.querySelector('.btn-showcase-log')?.addEventListener('click', (e) => {
        const btn = e.currentTarget;
        document.getElementById('progressBookId').value = btn.dataset.id;
        document.getElementById('progressBookTitle').textContent = decodeURIComponent(btn.dataset.title);
        document.getElementById('progressBookAuthor').textContent = decodeURIComponent(btn.dataset.author);
        document.getElementById('progressBookCover').src = decodeURIComponent(btn.dataset.cover);
        
        document.getElementById('progressCurrentPage').value = btn.dataset.current;
        document.getElementById('progressTotalPages').value = btn.dataset.total;
        document.getElementById('progressNotes').value = '';
        
        // Open progress modal popup directly!
        const modal = document.getElementById('progressModal');
        modal.classList.remove('hidden');
        setTimeout(() => modal.classList.add('active'), 10);
    });
}

// Fetch historical reading logs timeline joined with book titles
async function renderTimelineActivity(userId) {
    const timelineContainer = document.getElementById('dashboardTimeline');
    if (!timelineContainer) return;
    
    try {
        const { data: logs, error } = await supabase
            .from('reading_logs')
            .select(`
                id,
                pages_read,
                notes,
                logged_at,
                books (
                    title,
                    cover_url
                )
            `)
            .eq('user_id', userId)
            .order('logged_at', { ascending: false })
            .limit(5);
            
        if (error) throw error;
        
        if (!logs || logs.length === 0) {
            timelineContainer.innerHTML = `
                <div class="timeline-empty">
                    <p>기록된 독서 기록이 없습니다.<br>오늘 읽은 페이지를 기록해 타임라인을 채워보세요!</p>
                </div>
            `;
            return;
        }
        
        timelineContainer.innerHTML = '';
        
        logs.forEach(log => {
            const date = new Date(log.logged_at);
            const timeStr = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
            
            const bookTitle = log.books?.title || '정보가 없는 도서';
            
            const item = document.createElement('div');
            item.className = 'timeline-item';
            
            let noteHtml = '';
            if (log.notes) {
                noteHtml = `<div class="timeline-note">"${log.notes}"</div>`;
            }
            
            item.innerHTML = `
                <div class="timeline-icon">
                    <i class="fa-solid fa-book-open"></i>
                </div>
                <div class="timeline-content">
                    <div class="timeline-text">
                        <strong>${bookTitle}</strong> 도서를 <strong>${log.pages_read}p</strong> 만큼 읽었습니다.
                    </div>
                    <div class="timeline-meta">${timeStr}</div>
                    ${noteHtml}
                </div>
            `;
            
            timelineContainer.appendChild(item);
        });
    } catch (err) {
        console.error(err);
        timelineContainer.innerHTML = `
            <div class="timeline-empty">
                <p>타임라인 데이터를 로드하지 못했습니다: ${err.message}</p>
            </div>
        `;
    }
}
