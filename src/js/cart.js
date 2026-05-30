// Cart Module - Manage Shopping Cart, Mock Pricing and Checkout Redirection
import { supabase } from './supabase.js';
import { getCurrentUser, showToast } from './auth.js';

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
    
    const storeName = store === 'kyobo' ? '교보문고' : '알라딘';
    
    // To prevent browser block warnings on multiple window.open,
    // open the first item, and notify user that they can open the rest manually via individual buttons
    const firstItem = cartItems[0];
    const firstLink = getStoreLink(firstItem.isbn, firstItem.title, firstItem.authors, store);
    window.open(firstLink, '_blank');
    
    if (cartItems.length > 1) {
        showToast(`브라우저 보안으로 1번째 도서의 ${storeName} 구매 페이지가 열렸습니다. 나머지 도서들은 리스트의 개별 연동 버튼을 클릭해 주세요!`, 'info');
    } else {
        showToast(`도서 구매를 위해 ${storeName} 페이지로 이동합니다!`, 'success');
    }
}
