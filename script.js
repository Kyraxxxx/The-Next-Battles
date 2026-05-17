import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getDatabase, ref, onValue, set, get, update, remove } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

// FIREBASE CONFIG (SEU DATACENTER)
const firebaseConfig = {
    apiKey: "AIzaSyC1hgfD7YKSMhz1fbLMcgRGW1lrnph-pnE",
    authDomain: "scriptblox-1afc6.firebaseapp.com",
    databaseURL: "https://scriptblox-1afc6-default-rtdb.firebaseio.com",
    projectId: "scriptblox-1afc6",
    storageBucket: "scriptblox-1afc6.firebasestorage.app",
    messagingSenderId: "682733385412",
    appId: "1:682733385412:web:857b5c679c40c52d7c7b91",
    measurementId: "G-0WCRJKZG95"
};

// INICIALIZAÇÃO FIREBASE
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// CONFIGURAÇÃO E ESTADO
const ADMIN_PASSWORD = 'pintogrande';
const ADMIN_PIN = '1994';

let state = {
    currentUser: JSON.parse(localStorage.getItem('tnb_user')) || null,
    users: [],
    notifications: []
};

// INICIALIZAÇÃO DA PÁGINA
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    startRealtimeSync(); // Conecta no Datacenter
});

function initApp() {
    if (state.currentUser) {
        document.body.classList.add('logged-in');
        window.showDashboard();
    } else {
        window.showScreen('login-screen');
    }
}

// 🌐 CONEXÃO EM TEMPO REAL COM O FIREBASE
function startRealtimeSync() {
    const usersRef = ref(db, 'users');
    const notifsRef = ref(db, 'notifications');

    // Escuta mudanças nos Usuários
    onValue(usersRef, (snapshot) => {
        const data = snapshot.val();
        state.users = data ? Object.values(data).map(u => ({...u, gifts: u.gifts || []})) : [];
        
        // Se eu for deletado do DB, faço logout forçado
        if (state.currentUser && !state.users.find(u => u.name === state.currentUser.name)) {
            window.handleLogout();
        } else if (state.currentUser) {
            // Atualizo meu próprio state com os dados da nuvem
            state.currentUser = state.users.find(u => u.name === state.currentUser.name);
            localStorage.setItem('tnb_user', JSON.stringify(state.currentUser));
        }
        
        updateUI();
    });

    // Escuta mudanças nas Notificações
    onValue(notifsRef, (snapshot) => {
        const data = snapshot.val();
        state.notifications = data ? Object.entries(data).map(([id, val]) => ({ id, ...val })) : [];
        updateUI();
    });
}

// FORMATADOR DE CHAVES
function getDbKey(name) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
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
    document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
    if (el) el.classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
    const targetEl = document.getElementById(target);
    if (targetEl) {
        targetEl.classList.add('active');
        updateUI();
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

// LOGIN & LOGOUT (AGORA NO FIREBASE)
window.handleLogin = async (e) => {
    e.preventDefault();
    const user = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value.trim();
    
    if(!user) return window.showToast('Nome inválido!');
    const dbKey = getDbKey(user);
    
    // Busca usuário no Firebase
    const userRef = ref(db, 'users/' + dbKey);
    const snapshot = await get(userRef);
    
    if (snapshot.exists()) {
        const foundUser = snapshot.val();
        if (pass === ADMIN_PASSWORD || foundUser.pass === pass) {
            state.currentUser = foundUser;
            if (pass === ADMIN_PASSWORD && !foundUser.isAdmin) {
                // Força virar admin se usou a senha mestra
                foundUser.isAdmin = true;
                foundUser.role = 'DONO';
                await set(userRef, foundUser);
            }
            localStorage.setItem('tnb_user', JSON.stringify(foundUser));
            window.showDashboard();
            document.body.classList.add('logged-in');
        } else {
            window.showToast('Senha incorreta!');
        }
    } else {
        // Cria NOVO usuário no Datacenter
        const newUser = {
            name: user,
            pass: pass,
            role: (pass === ADMIN_PASSWORD ? 'DONO' : 'JOGADOR'),
            isAdmin: (pass === ADMIN_PASSWORD),
            gifts: [],
            wins: 0
        };
        await set(userRef, newUser);
        state.currentUser = newUser;
        localStorage.setItem('tnb_user', JSON.stringify(newUser));
        window.showDashboard();
        document.body.classList.add('logged-in');
    }
};

window.handleLogout = () => {
    state.currentUser = null;
    localStorage.removeItem('tnb_user');
    location.reload();
};

// ADMIN AÇÕES (GRAVANDO DIRETO NA NUVEM)
window.addWin = (name) => {
    const key = getDbKey(name);
    const user = state.users.find(u => u.name === name);
    if (user) {
        update(ref(db, 'users/' + key), { wins: (user.wins || 0) + 1 });
    }
};

window.removeWin = (name) => {
    const key = getDbKey(name);
    const user = state.users.find(u => u.name === name);
    if (user && user.wins > 0) {
        update(ref(db, 'users/' + key), { wins: user.wins - 1 });
    }
};

window.changeRole = (name, role) => {
    const key = getDbKey(name);
    const isAdmin = ['DONO', 'SUB DONO', 'ADMIN'].includes(role);
    update(ref(db, 'users/' + key), { role: role, isAdmin: isAdmin }).then(() => {
        window.showToast(`Cargo de ${name} alterado!`);
    });
};

window.handleSendGift = (e) => {
    e.preventDefault();
    const name = document.getElementById('gift-target-user').value;
    const code = document.getElementById('gift-code').value;
    const key = getDbKey(name);
    const user = state.users.find(u => u.name === name);
    
    if (user) {
        const newGifts = [...(user.gifts || []), { code, date: new Date().toLocaleDateString() }];
        update(ref(db, 'users/' + key), { gifts: newGifts }).then(() => {
            window.showToast('Gift despachado globalmente!');
            e.target.reset();
        });
    }
};

window.handleRequestGift = (e) => {
    e.preventDefault();
    const to = document.getElementById('request-staff-select').value;
    const msg = document.getElementById('request-message').value;
    const newId = Date.now().toString();
    
    set(ref(db, 'notifications/' + newId), {
        from: state.currentUser.name,
        fromRole: state.currentUser.role,
        to: to,
        msg: msg,
        time: new Date().toLocaleTimeString()
    }).then(() => {
        window.showToast('Pedido enviado para o Staff!');
        e.target.reset();
    });
};

window.clearNotif = (notifId) => {
    remove(ref(db, 'notifications/' + notifId));
};

window.copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => window.showToast('Código copiado!'));
};

// UI UPDATE (ATUALIZADA)
function updateUI() {
    if (!state.currentUser) return;

    try {
        const adminLink = document.getElementById('admin-link');
        if (adminLink) adminLink.style.display = 'flex';
    } catch(e) {}

    try {
        const staffs = state.users.filter(u => ['DONO', 'SUB DONO', 'ADMIN', 'STAFF'].includes(u.role || ''));
        const staffGrid = document.getElementById('staffs-display-grid');
        if (staffGrid) {
            staffGrid.innerHTML = staffs.map(s => {
                const roleClass = (s.role || 'JOGADOR').toLowerCase().replace(/\s/g, '');
                return `
                    <div class="staff-card">
                        <span class="role-badge role-${roleClass}">${s.role || 'JOGADOR'}</span>
                        <h3>${s.name}</h3>
                        <p>No Datacenter</p>
                    </div>
                `;
            }).join('');
        }
    } catch(e) {}

    try {
        const staffs = state.users.filter(u => ['DONO', 'SUB DONO', 'ADMIN', 'STAFF'].includes(u.role || ''));
        const staffSelect = document.getElementById('request-staff-select');
        if (staffSelect) {
            staffSelect.innerHTML = staffs.map(s => `<option value="${s.name}">${s.name} (${s.role})</option>`).join('');
        }
    } catch(e) {}

    try {
        const giftSelect = document.getElementById('gift-target-user');
        if (giftSelect) {
            giftSelect.innerHTML = state.users.map(u => `<option value="${u.name}">${u.name}</option>`).join('');
        }
    } catch(e) {}

    try {
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
    } catch(e) {}

    try {
        const userInDb = state.users.find(u => u.name === state.currentUser.name);
        const giftsContainer = document.getElementById('gifts-container');
        if (giftsContainer && userInDb) {
            if (!userInDb.gifts || userInDb.gifts.length === 0) {
                giftsContainer.innerHTML = '<p>Nenhum gift recebido ainda.</p>';
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
    } catch(e) {}

    try {
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
    } catch(e) {}

    try {
        const notifContainer = document.getElementById('admin-notifications');
        if (notifContainer) {
            const myNotifs = state.notifications.filter(n => n.to === state.currentUser.name);
            if (myNotifs.length === 0) {
                notifContainer.innerHTML = '<p>Sem pedidos no momento.</p>';
            } else {
                notifContainer.innerHTML = myNotifs.map((n) => `
                    <div class="notif-item">
                        <strong>${n.from} (${n.fromRole})</strong>: ${n.msg}
                        <button onclick="clearNotif('${n.id}')" class="btn-small">OK</button>
                    </div>
                `).join('');
            }
        }
    } catch(e) {}
}
