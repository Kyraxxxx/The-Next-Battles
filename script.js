// CONFIGURAÇÃO E ESTADO
const ADMIN_PASSWORD = 'pintogrande';
const ADMIN_PIN = '1994';

const channel = new BroadcastChannel('tnb_realtime');

let state = {
    currentUser: JSON.parse(localStorage.getItem('tnb_user')) || null,
    users: (JSON.parse(localStorage.getItem('tnb_users')) || [
        { name: 'Admin', pass: ADMIN_PASSWORD, role: 'DONO', isAdmin: true, gifts: [], wins: 10 },
        { name: 'Player1', pass: '123', role: 'JOGADOR', isAdmin: false, gifts: [], wins: 5 }
    ]).map(u => ({ ...u, role: u.role || 'JOGADOR', wins: u.wins || 0, gifts: u.gifts || [] })),
    notifications: JSON.parse(localStorage.getItem('tnb_notifications')) || []
};

// INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    if (state.currentUser) {
        document.body.classList.add('logged-in');
        showDashboard();
    } else {
        showScreen('login-screen');
    }
    updateUI();
}

// NAVEGAÇÃO GLOBAL
window.showScreen = (screenId) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(screenId);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('active');
    }
};

window.showDashboard = () => {
    window.showScreen('welcome-animation');
    setTimeout(() => {
        window.showScreen('dashboard');
        updateUI();
    }, 2000);
};

window.switchTab = (el, target) => {
    // Remove active de todos os botões da sidebar
    document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
    if (el) el.classList.add('active');
    
    // Troca o conteúdo das abas
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
    const targetEl = document.getElementById(target);
    if (targetEl) {
        targetEl.classList.add('active');
        updateUI(); // Garante que os dados apareçam na hora
    }
};

// MODAIS
let modalCallback = null;

window.handleAdminClick = (el) => {
    window.openModal('Acesso Staff', 'Digite o PIN de Verificação:', (val) => {
        if (val === ADMIN_PIN) {
            window.switchTab(el, 'admin-section');
        } else {
            window.showToast('PIN Incorreto!');
        }
    });
};

window.openModal = (title, text, callback) => {
    modalCallback = callback;
    const modal = document.getElementById('custom-modal');
    modal.querySelector('h2').textContent = title;
    modal.querySelector('p').textContent = text;
    document.getElementById('modal-input').value = '';
    modal.classList.remove('hidden');
};

window.confirmModal = () => {
    const val = document.getElementById('modal-input').value;
    document.getElementById('custom-modal').classList.add('hidden');
    if (modalCallback) modalCallback(val);
    modalCallback = null;
};

window.closeModal = () => {
    document.getElementById('custom-modal').classList.add('hidden');
    modalCallback = null;
};

window.showToast = (message) => {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
};

// LOGIN & LOGOUT
window.handleLogin = (e) => {
    e.preventDefault();
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    
    const cleanUser = sanitize(user);
    let foundUser = state.users.find(u => u.name.toLowerCase() === cleanUser.toLowerCase());
    
    if (foundUser) {
        if (pass === ADMIN_PASSWORD || foundUser.pass === pass) {
            state.currentUser = foundUser;
            if (pass === ADMIN_PASSWORD) foundUser.isAdmin = true;
            saveState();
            window.showDashboard();
        } else {
            window.showToast('Senha incorreta!');
        }
    } else {
        const newUser = {
            name: cleanUser,
            pass: pass,
            role: (pass === ADMIN_PASSWORD ? 'DONO' : 'JOGADOR'),
            isAdmin: (pass === ADMIN_PASSWORD),
            gifts: [],
            wins: 0
        };
        state.users.push(newUser);
        state.currentUser = newUser;
        saveState();
        window.showDashboard();
    }
};

window.handleLogout = () => {
    state.currentUser = null;
    localStorage.removeItem('tnb_user');
    location.reload();
};

function sanitize(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/<[^>]*>?/gm, '');
}

// ADMIN AÇÕES
window.addWin = (name) => {
    const user = state.users.find(u => u.name === name);
    if (user) { user.wins++; syncData(); }
};

window.removeWin = (name) => {
    const user = state.users.find(u => u.name === name);
    if (user && user.wins > 0) { user.wins--; syncData(); }
};

window.changeRole = (name, role) => {
    const user = state.users.find(u => u.name === name);
    if (user) {
        user.role = role;
        user.isAdmin = ['DONO', 'SUB DONO', 'ADMIN'].includes(role);
        syncData();
        window.showToast(`Cargo de ${name} alterado!`);
    }
};

window.handleSendGift = (e) => {
    e.preventDefault();
    const name = document.getElementById('gift-target-user').value;
    const code = document.getElementById('gift-code').value;
    const user = state.users.find(u => u.name === name);
    if (user) {
        user.gifts.push({ code, date: new Date().toLocaleDateString() });
        syncData();
        window.showToast('Gift enviado!');
        e.target.reset();
    }
};

window.handleRequestGift = (e) => {
    e.preventDefault();
    const to = document.getElementById('request-staff-select').value;
    const msg = document.getElementById('request-message').value;
    state.notifications.push({
        from: state.currentUser.name,
        fromRole: state.currentUser.role,
        to: to,
        msg: msg,
        time: new Date().toLocaleTimeString()
    });
    syncData();
    window.showToast('Pedido enviado!');
    e.target.reset();
};

window.clearNotif = (index) => {
    state.notifications.splice(index, 1);
    syncData();
};

window.copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => window.showToast('Código copiado!'));
};

// UI UPDATE
function updateUI() {
    if (!state.currentUser) return;

    try {
        // Sidebar Staff Button Force Visibility
        const adminLink = document.getElementById('admin-link');
        if (adminLink) adminLink.style.display = 'flex';
    } catch(e) { console.error(e); }

    try {
        // Staff Grid
        const staffs = state.users.filter(u => ['DONO', 'SUB DONO', 'ADMIN', 'STAFF'].includes(u.role || ''));
        const staffGrid = document.getElementById('staffs-display-grid');
        if (staffGrid) {
            staffGrid.innerHTML = staffs.map(s => {
                const roleClass = (s.role || 'JOGADOR').toLowerCase().replace(/\s/g, '');
                return `
                    <div class="staff-card">
                        <span class="role-badge role-${roleClass}">${s.role || 'JOGADOR'}</span>
                        <h3>${s.name}</h3>
                        <p>Online</p>
                    </div>
                `;
            }).join('');
        }
    } catch(e) { console.error(e); }

    try {
        const staffs = state.users.filter(u => ['DONO', 'SUB DONO', 'ADMIN', 'STAFF'].includes(u.role || ''));
        // Selects
        const staffSelect = document.getElementById('request-staff-select');
        if (staffSelect) {
            staffSelect.innerHTML = staffs.map(s => `<option value="${s.name}">${s.name} (${s.role})</option>`).join('');
        }
    } catch(e) { console.error(e); }

    try {
        const giftSelect = document.getElementById('gift-target-user');
        if (giftSelect) {
            giftSelect.innerHTML = state.users.map(u => `<option value="${u.name}">${u.name}</option>`).join('');
        }
    } catch(e) { console.error(e); }

    try {
        // Rankings
        const rankingBody = document.getElementById('ranking-body');
        if (rankingBody) {
            rankingBody.innerHTML = [...state.users]
                .sort((a, b) => (b.wins || 0) - (a.wins || 0))
                .map((u, i) => {
                    const roleClass = (u.role || 'JOGADOR').toLowerCase().replace(/\s/g, '');
                    return `
                        <tr>
                            <td>${i + 1}º</td>
                            <td>${u.name}</td>
                            <td>${u.wins || 0}</td>
                            <td><span class="role-badge role-${roleClass}">${u.role || 'JOGADOR'}</span></td>
                        </tr>
                    `;
                }).join('');
        }
    } catch(e) { console.error(e); }

    try {
        // My Gifts
        const userInDb = state.users.find(u => u.name === state.currentUser.name);
        const giftsContainer = document.getElementById('gifts-container');
        if (giftsContainer && userInDb) {
            if (userInDb.gifts.length === 0) {
                giftsContainer.innerHTML = '<p>Nenhum gift ganho.</p>';
            } else {
                giftsContainer.innerHTML = userInDb.gifts.map(g => `
                    <div class="gift-card">
                        <h3>Roblox Gift Card</h3>
                        <span class="gift-code-display">${g.code}</span>
                        <button class="btn-copy" onclick="copyToClipboard('${g.code}')">COPIAR</button>
                        <a href="https://www.roblox.com/redeem" target="_blank" class="btn-redeem">RESGATAR</a>
                    </div>
                `).join('');
            }
        }
    } catch(e) { console.error(e); }

    try {
        // Admin List
        const adminUserList = document.getElementById('admin-user-list');
        if (adminUserList) {
            adminUserList.innerHTML = state.users.map(u => {
                const roleClass = (u.role || 'JOGADOR').toLowerCase().replace(/\s/g, '');
                return `
                    <tr>
                        <td>${u.name}</td>
                        <td><span class="role-badge role-${roleClass}">${u.role || 'JOGADOR'}</span></td>
                        <td>
                            <button onclick="addWin('${u.name}')" class="btn-small">+1</button>
                            <button onclick="removeWin('${u.name}')" class="btn-small">-1</button>
                        </td>
                        <td>
                            <select onchange="changeRole('${u.name}', this.value)" class="btn-small role-select-btn">
                                <option value="JOGADOR" ${u.role === 'JOGADOR' ? 'selected' : ''}>JOGADOR</option>
                                <option value="STAFF" ${u.role === 'STAFF' ? 'selected' : ''}>STAFF</option>
                                <option value="ADMIN" ${u.role === 'ADMIN' ? 'selected' : ''}>ADMIN</option>
                                <option value="SUB DONO" ${u.role === 'SUB DONO' ? 'selected' : ''}>SUB DONO</option>
                                <option value="DONO" ${u.role === 'DONO' ? 'selected' : ''}>DONO</option>
                            </select>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    } catch(e) { console.error(e); }

    try {
        // Admin Notifs
        const notifContainer = document.getElementById('admin-notifications');
        if (notifContainer) {
            const myNotifs = state.notifications.filter(n => n.to === state.currentUser.name);
            if (myNotifs.length === 0) {
                notifContainer.innerHTML = '<p>Sem pedidos.</p>';
            } else {
                notifContainer.innerHTML = myNotifs.map((n, i) => `
                    <div class="notif-item">
                        <strong>${n.from} (${n.fromRole})</strong>: ${n.msg}
                        <button onclick="clearNotif(${i})" class="btn-small">OK</button>
                    </div>
                `).join('');
            }
        }
    } catch(e) { console.error(e); }
}

function saveState() {
    localStorage.setItem('tnb_users', JSON.stringify(state.users));
    localStorage.setItem('tnb_notifications', JSON.stringify(state.notifications));
    if (state.currentUser) localStorage.setItem('tnb_user', JSON.stringify(state.currentUser));
}

function syncData() {
    saveState();
    channel.postMessage({ type: 'SYNC', users: state.users, notifications: state.notifications });
    updateUI();
}

channel.onmessage = (e) => {
    if (e.data.type === 'SYNC') {
        state.users = e.data.users;
        state.notifications = e.data.notifications;
        saveState();
        updateUI();
    }
};
