// Cart Module - Manage Shopping Cart, Mock Pricing and Checkout Redirection
import { supabase } from './supabase.js';
import { getCurrentUser, showToast } from './auth.js';
import { showBookDetail } from './detail.js';

// UI elements references (Initialized in initCart)
let cartList = null;
let cartEmptyState = null;
let cartBadgeCount = null;
let cartSummaryCount = null;
let cartSummaryPrice = null;
let cartSummaryTotal = null;

let cartItems = [];

// Initialize Cart tab event listeners
export function initCart() {
    cartList = document.getElementById('cartList');
    cartEmptyState = document.getElementById('cartEmptyState');
    cartBadgeCount = document.getElementById('cartBadgeCount');
    cartSummaryCount = document.getElementById('cartSummaryCount');
    cartSummaryPrice = document.getElementById('cartSummaryPrice');
    cartSummaryTotal = document.getElementById('cartSummaryTotal');

    // Bind main checkout buttons
    document.getElementById('btnCheckoutKyobo')?.addEventListener('click', () => {
        handleBulkCheckout('kyobo');
    });
    
    document.getElementById('btnCheckoutAladin')?.addEventListener('click', () => {
        handleBulkCheckout('aladin');
    });
    
    // Listen to custom updates
    window.addEventListener('cart-updated', () => {
        fetchAndRenderCart();
    });
}

// Core cart fetch and render method
export async function fetchAndRenderCart() {
    const user = getCurrentUser();
    if (!user) {
        renderGuestCart();
        return;
    }
    
    try {
        const { data: items, error } = await supabase
            .from('cart_items')
            .select('*')
            .order('added_at', { ascending: false });
            
        if (error) throw error;
        
        cartItems = items || [];
        updateCartBadges();
        
        if (cartItems.length === 0) {
            cartList.innerHTML = '';
            cartEmptyState.classList.remove('hidden');
            cartList.classList.add('hidden');
        } else {
            cartEmptyState.classList.add('hidden');
            cartList.classList.remove('hidden');
            renderCartList();
        }
    } catch (err) {
        console.error(err);
        showToast('장바구니 조회가 취소되었습니다: ' + err.message, 'danger');
    }
}

// Render cart layout for guests
function renderGuestCart() {
    cartItems = [];
    updateCartBadges();
    cartList.innerHTML = '';
    cartEmptyState.classList.remove('hidden');
    cartList.classList.add('hidden');
    
    const emptyTitle = cartEmptyState.querySelector('h3');
    const emptyDesc = cartEmptyState.querySelector('p');
    if (emptyTitle && emptyDesc) {
        emptyTitle.textContent = '로그인이 필요한 장바구니';
        emptyDesc.textContent = '로그인하시면 나만의 위시리스트를 저장하고 인터넷 서점과 실시간 연동하여 편리하게 도서를 구매하실 수 있습니다.';
    }
}

// Calculate prices and update badge quantities
function updateCartBadges() {
    const totalCount = cartItems.length;
    
    // Show/Hide badge count on sidebar
    if (totalCount > 0) {
        cartBadgeCount.textContent = totalCount;
        cartBadgeCount.classList.remove('hidden');
    } else {
        cartBadgeCount.classList.add('hidden');
    }
    
    // Update summary column info
    cartSummaryCount.textContent = `${totalCount}권`;
    
    // Compute pricing structure (mockup standard: 14,800 KRW average cost per book)
    const unitPrice = 14800;
    const totalPrice = totalCount * unitPrice;
    
    // Format numbers as Korean Won string
    const priceStr = totalPrice.toLocaleString('ko-KR') + '원';
    cartSummaryPrice.textContent = priceStr;
    cartSummaryTotal.textContent = priceStr;
}

// Helper to assemble store direct links (Searching by Title + Author is 99% more accurate on Korean sites!)
function getStoreLink(isbn, title, authors, store) {
    const firstAuthor = (authors && Array.isArray(authors) && authors.length > 0) ? authors[0] : '';
    const query = `${title} ${firstAuthor}`.trim();
    const keyword = encodeURIComponent(query);
    
    if (store === 'kyobo') {
        return `https://search.kyobobook.co.kr/search?keyword=${keyword}`;
    } else if (store === 'aladin') {
        return `https://www.aladin.co.kr/search/wsearchresult.aspx?SearchWord=${keyword}`;
    }
    return '';
}

// Draw cart item DOM entries
function renderCartList() {
    cartList.innerHTML = '';
    
    cartItems.forEach(item => {
        const row = document.createElement('div');
        row.className = 'cart-item';
        
        // Click triggers detailed modal
        row.addEventListener('click', (e) => {
            if (e.target.closest('.cart-item-actions') || e.target.closest('.btn-cart-remove')) return;
            showBookDetail(item);
        });
        
        // Dynamic bookstore search hrefs
        const kyoboUrl = getStoreLink(item.isbn, item.title, item.authors, 'kyobo');
        const aladinUrl = getStoreLink(item.isbn, item.title, item.authors, 'aladin');
        
        row.innerHTML = `
            <img src="${item.cover_url || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=200&h=280'}" alt="${item.title}" class="cart-item-cover" loading="lazy">
            <div class="cart-item-details">
                <h4 class="cart-item-title" title="${item.title}">${item.title}</h4>
                <p class="cart-item-author" title="${item.authors?.join(', ') || '작가 미상'}">${item.authors?.join(', ') || '작가 미상'}</p>
                <div class="cart-item-price-info">정가 14,800원</div>
            </div>
            <div class="cart-item-actions">
                <a href="${kyoboUrl}" target="_blank" class="btn-card-action outline" title="교보문고 검색 구매">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i> 교보문고
                </a>
                <a href="${aladinUrl}" target="_blank" class="btn-card-action outline" title="알라딘 검색 구매">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i> 알라딘
                </a>
                <button class="btn-cart-remove" data-id="${item.id}" data-title="${encodeURIComponent(item.title)}" title="장바구니 삭제">
                    <i class="fa-regular fa-trash-can"></i>
                </button>
            </div>
        `;
        
        cartList.appendChild(row);
    });
    
    // Bind click handlers to garbage icons
    bindCartActions();
}

// Bind clicks on individual cart item actions
function bindCartActions() {
    cartList.querySelectorAll('.btn-cart-remove').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const btnEl = e.currentTarget;
            const itemId = btnEl.dataset.id;
            const title = decodeURIComponent(btnEl.dataset.title);
            
            btnEl.disabled = true;
            btnEl.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
            
            try {
                const { error } = await supabase
                    .from('cart_items')
                    .delete()
                    .eq('id', itemId);
                    
                if (error) throw error;
                
                showToast(`"${title}" 도서가 장바구니에서 삭제되었습니다.`, 'info');
                
                // Reload list & trigger badges update
                fetchAndRenderCart();
                window.dispatchEvent(new CustomEvent('dashboard-updated'));
            } catch (err) {
                console.error(err);
                showToast('장바구니 항목 삭제 중 에러 발생: ' + err.message, 'danger');
                btnEl.disabled = false;
                btnEl.innerHTML = '<i class="fa-regular fa-trash-can"></i>';
            }
        });
    });
}

// Redirect user to official Korean bookstores in separate tabs safely
function handleBulkCheckout(store) {
    if (cartItems.length === 0) {
        showToast('장바구니가 비어 있습니다. 먼저 구매할 책을 검색해 담아 주세요!', 'warning');
        return;
    }
    
    // Launch the premium Multi-Purchase Checkout Hub Modal!
    openCheckoutHubModal(store);
}

// Draw a gorgeous Checkout Hub Modal to bypass browser popup blocking
function openCheckoutHubModal(store) {
    const storeName = store === 'kyobo' ? '교보문고' : '알라딘';
    const accentColor = store === 'kyobo' ? '#00874a' : '#ec2227';
    const storeIcon = store === 'kyobo' ? 'fa-book-open' : 'fa-cart-shopping';
    
    // Create Modal Element dynamically
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'checkoutHubModal';
    modal.style.zIndex = '2000';
    
    let itemsHtml = '';
    cartItems.forEach((item, index) => {
        const link = getStoreLink(item.isbn, item.title, item.authors, store);
        const author = (item.authors && Array.isArray(item.authors) && item.authors.length > 0) ? item.authors[0] : '작가 미상';
        
        itemsHtml += `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: var(--border-radius-sm); margin-bottom: 10px; gap: 12px;">
                <div style="display: flex; align-items: center; gap: 12px; overflow: hidden; flex-grow: 1;">
                    <img src="${item.cover_url || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=200&h=280'}" style="width: 40px; height: 56px; object-fit: cover; border-radius: 4px; box-shadow: 0 2px 6px rgba(0,0,0,0.4);" />
                    <div style="overflow: hidden;">
                        <h4 style="font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: white; text-align: left;" title="${item.title}">${item.title}</h4>
                        <p style="font-size: 11px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: left;">${author}</p>
                    </div>
                </div>
                <a href="${link}" target="_blank" class="btn-card-action" style="background: ${accentColor}; color: white; height: 32px; font-size: 11px; padding: 0 14px; font-weight: 600; border-radius: 6px; display: flex; align-items: center; gap: 6px; flex-shrink: 0; justify-content: center; width: auto; min-width: 65px;">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i> 이동
                </a>
            </div>
        `;
    });
    
    modal.innerHTML = `
        <div class="modal-card" style="max-width: 460px; padding: 24px; border-color: ${accentColor}; box-shadow: 0 10px 40px rgba(0,0,0,0.6); position: relative;">
            <button class="modal-close" id="btnCloseCheckoutHub"><i class="fa-solid fa-xmark"></i></button>
            <h3 class="modal-title" style="font-size: 18px; margin-bottom: 6px; display: flex; align-items: center; gap: 10px;">
                <i class="fa-solid ${storeIcon}" style="color: ${accentColor}"></i> ${storeName} 다중 구매 연동 센터
            </h3>
            <p class="modal-desc" style="margin-bottom: 20px; font-size: 12px; line-height: 1.5; color: var(--text-secondary);">
                크롬 등 최신 브라우저 보안 규정상 한 번에 여러 탭을 여는 것이 차단됩니다. 아래 리스트의 <strong>[이동]</strong> 버튼을 누르시면 안전하고 빠르게 해당 상품 페이지가 연동됩니다.
            </p>
            <div style="max-height: 280px; overflow-y: auto; padding-right: 4px;">
                ${itemsHtml}
            </div>
            <div style="margin-top: 16px;">
                <p style="font-size: 10px; color: var(--text-muted); line-height: 1.4; text-align: center;">
                    * 각 도서의 제목과 저자명을 기반으로 국내 공식 서점에서 정확한 도서를 찾아 드립니다.
                </p>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Bind Close Event
    const closeBtn = modal.querySelector('#btnCloseCheckoutHub');
    closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    });
}
