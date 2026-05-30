// Auth Module - Authentication and Profile Management
import { supabase } from './supabase.js';

// Toast Notification Utility
export function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconClass = 'fa-info-circle';
    if (type === 'success') iconClass = 'fa-circle-check';
    if (type === 'warning') iconClass = 'fa-triangle-exclamation';
    if (type === 'danger') iconClass = 'fa-circle-xmark';
    
    toast.innerHTML = `
        <i class="fa-solid ${iconClass}"></i>
        <div class="toast-message">${message}</div>
    `;
    
    container.appendChild(toast);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
        toast.style.animation = 'fadeOutUp 0.4s ease forwards';
        setTimeout(() => {
            toast.remove();
        }, 400);
    }, 3600);
}

// UI State References (Initialized in initAuth)
let authModal = null;
let profileLoading = null;
let profileLoaded = null;
let profileGuest = null;
let userNameText = null;
let userEmailText = null;

let currentUser = null;
let onAuthChangedCallback = null;

// Initialize Auth State & Event Listeners
export function initAuth(onAuthChanged) {
    onAuthChangedCallback = onAuthChanged;
    
    // Resolve UI elements
    authModal = document.getElementById('authModal');
    profileLoading = document.getElementById('profileLoading');
    profileLoaded = document.getElementById('profileLoaded');
    profileGuest = document.getElementById('profileGuest');
    userNameText = document.getElementById('userNameText');
    userEmailText = document.getElementById('userEmailText');
    
    // Register Supabase Session Listener
    supabase.auth.onAuthStateChange((event, session) => {
        handleAuthStateChange(session);
    });
    
    bindEvents();
    
    // Frictionless Silent Auto-Login to bypass auth modals during testing
    autoLoginDemo();
}

// Background silent auto-login helper
async function autoLoginDemo() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) return;
        
        const demoEmail = 'demo@luminaread.com';
        const demoPassword = 'password123';
        
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: demoEmail,
            password: demoPassword
        });
        
        if (signInError) {
            if (signInError.status === 400 || signInError.message.includes('Invalid login credentials')) {
                const { error: signUpError } = await supabase.auth.signUp({
                    email: demoEmail,
                    password: demoPassword
                });
                if (!signUpError) {
                    await supabase.auth.signInWithPassword({
                        email: demoEmail,
                        password: demoPassword
                    });
                }
            }
        }
    } catch (err) {
        console.warn('Silent auto-login failed in background:', err);
    }
}

// Bind UI triggers
function bindEvents() {
    // Open/Close Auth Modal
    document.getElementById('btnLoginTrigger')?.addEventListener('click', () => {
        toggleAuthModal(true);
    });
    
    document.getElementById('btnAuthModalClose')?.addEventListener('click', () => {
        toggleAuthModal(false);
    });
    
    // Switch between Login and Signup modes
    const tabBtnLogin = document.getElementById('tabBtnLogin');
    const tabBtnSignup = document.getElementById('tabBtnSignup');
    const btnAuthSubmit = document.getElementById('btnAuthSubmit');
    const authForm = document.getElementById('authForm');
    
    tabBtnLogin?.addEventListener('click', () => {
        tabBtnLogin.classList.add('active');
        tabBtnSignup?.classList.remove('active');
        btnAuthSubmit.textContent = '로그인';
        authForm.dataset.mode = 'login';
    });
    
    tabBtnSignup?.addEventListener('click', () => {
        tabBtnSignup.classList.add('active');
        tabBtnLogin.classList.remove('active');
        btnAuthSubmit.textContent = '회원가입';
        authForm.dataset.mode = 'signup';
    });
    
    // Handle form submit
    authForm?.addEventListener('submit', handleAuthSubmit);
    
    // Logout trigger
    document.getElementById('btnLogout')?.addEventListener('click', handleLogout);
    
    // Demo account quick login
    document.getElementById('btnDemoLogin')?.addEventListener('click', handleDemoLogin);
}

// Show/Hide Modal Dialog
export function toggleAuthModal(show) {
    if (show) {
        authModal.classList.remove('hidden');
        setTimeout(() => authModal.classList.add('active'), 10);
    } else {
        authModal.classList.remove('active');
        setTimeout(() => authModal.classList.add('hidden'), 300);
    }
}

// React to Authentication status shifts
async function handleAuthStateChange(session) {
    profileLoading.classList.add('hidden');
    
    if (session?.user) {
        currentUser = session.user;
        userNameText.textContent = currentUser.email.split('@')[0].toUpperCase();
        userEmailText.textContent = currentUser.email;
        
        profileLoaded.classList.remove('hidden');
        profileGuest.classList.add('hidden');
    } else {
        currentUser = null;
        userNameText.textContent = '게스트';
        userEmailText.textContent = 'demo@luminaread.com';
        
        profileLoaded.classList.add('hidden');
        profileGuest.classList.remove('hidden');
    }
    
    if (onAuthChangedCallback) {
        onAuthChangedCallback(currentUser);
    }
}

// Process email & password forms
async function handleAuthSubmit(e) {
    e.preventDefault();
    
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const mode = e.target.dataset.mode || 'login';
    
    const btnAuthSubmit = document.getElementById('btnAuthSubmit');
    const originalText = btnAuthSubmit.textContent;
    btnAuthSubmit.disabled = true;
    btnAuthSubmit.innerHTML = '<div class="spinner-small"></div>';
    
    try {
        if (mode === 'signup') {
            const { data, error } = await supabase.auth.signUp({
                email,
                password
            });
            
            if (error) throw error;
            
            showToast('가입을 환영합니다! 이메일이 자동 승인 처리되었습니다.', 'success');
            
            // Auto sign in right away
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password
            });
            
            if (signInError) throw signInError;
            
            toggleAuthModal(false);
        } else {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) throw error;
            
            showToast('성공적으로 로그인되었습니다.', 'success');
            toggleAuthModal(false);
        }
    } catch (err) {
        console.error(err);
        showToast(err.message || '인증 에러가 발생했습니다.', 'danger');
    } finally {
        btnAuthSubmit.disabled = false;
        btnAuthSubmit.textContent = originalText;
    }
}

// Logout session
async function handleLogout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        showToast('로그아웃되었습니다.', 'info');
    } catch (err) {
        console.error(err);
        showToast(err.message || '로그아웃 에러가 발생했습니다.', 'danger');
    }
}

// One-click demo login shortcut
async function handleDemoLogin() {
    const demoEmail = 'demo@luminaread.com';
    const demoPassword = 'password123';
    
    const btnDemo = document.getElementById('btnDemoLogin');
    btnDemo.disabled = true;
    btnDemo.innerHTML = '<div class="spinner-small"></div> 1초 로그인 중...';
    
    try {
        // Try sign in first
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: demoEmail,
            password: demoPassword
        });
        
        if (signInError) {
            // If sign in fails because user doesn't exist, sign them up!
            if (signInError.status === 400 || signInError.message.includes('Invalid login credentials')) {
                const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                    email: demoEmail,
                    password: demoPassword
                });
                
                if (signUpError) throw signUpError;
                
                // Sign in after signup
                const { error: secondSignInError } = await supabase.auth.signInWithPassword({
                    email: demoEmail,
                    password: demoPassword
                });
                
                if (secondSignInError) throw secondSignInError;
            } else {
                throw signInError;
            }
        }
        
        showToast('데모 계정으로 간편 로그인 완료!', 'success');
        toggleAuthModal(false);
    } catch (err) {
        console.error(err);
        showToast('데모 로그인 도중 오류가 발생했습니다: ' + err.message, 'danger');
    } finally {
        btnDemo.disabled = false;
        btnDemo.innerHTML = '<i class="fa-solid fa-bolt"></i> 1초만에 데모 계정 로그인';
    }
}

// Getter for current session user
export function getCurrentUser() {
    return currentUser;
}
