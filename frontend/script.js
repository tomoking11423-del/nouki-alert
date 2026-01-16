/* ============================================================================
   納期アラート - JavaScript
   ============================================================================ */

// GAS Web App URL
const API_URL = 'https://script.google.com/macros/s/AKfycbyW0Dm2GmZWfNnza-Bte3wSrXHRsEafFHl3HYjPe59yAVxsfp9rZs8BITPUb8hUEosJ/exec';

// グローバル変数
let tantoshaList = [];

// ============================================================================
// 初期化
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    loadDashboard();
    loadTantoshaList();
});

// ============================================================================
// ナビゲーション
// ============================================================================

function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // アクティブ状態の切り替え
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            // ページの切り替え
            const pageName = item.dataset.page;
            showPage(pageName);
        });
    });
}

function showPage(pageName) {
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => page.classList.remove('active'));

    const targetPage = document.getElementById(`page-${pageName}`);
    if (targetPage) {
        targetPage.classList.add('active');

        // ページ固有のデータ読み込み
        switch (pageName) {
            case 'dashboard':
                loadDashboard();
                break;
            case 'anken':
                loadAnkenList();
                break;
            case 'tantosha':
                loadTantoshaTable();
                break;
        }
    }
}

// ============================================================================
// API通信
// ============================================================================

async function apiGet(action, params = {}) {
    const url = new URL(API_URL);
    url.searchParams.append('action', action);
    Object.keys(params).forEach(key => {
        url.searchParams.append(key, params[key]);
    });

    try {
        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        showToast('通信エラーが発生しました', 'error');
        return { success: false, error: error.message };
    }
}

async function apiPost(action, data) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action, ...data })
        });

        // no-corsモードではレスポンスを読めないので、成功を仮定
        return { success: true };
    } catch (error) {
        console.error('API Error:', error);
        showToast('通信エラーが発生しました', 'error');
        return { success: false, error: error.message };
    }
}

// ============================================================================
// ダッシュボード
// ============================================================================

async function loadDashboard() {
    const result = await apiGet('getDashboard');

    if (result.success) {
        const data = result.data;

        // 統計を更新
        document.getElementById('stat-total').textContent = data.stats.total;
        document.getElementById('stat-overdue').textContent = data.stats.overdue;
        document.getElementById('stat-week').textContent = data.stats.dueThisWeek;
        document.getElementById('stat-waiting').textContent = data.stats.waiting;

        // 超過案件リストを更新
        renderAnkenList('overdue-list', data.overdueList, true);

        // 今週の納期リストを更新
        renderAnkenList('thisweek-list', data.thisWeekList, false);
    }
}

function renderAnkenList(elementId, list, isOverdue) {
    const container = document.getElementById(elementId);

    if (!list || list.length === 0) {
        container.innerHTML = '<p class="no-data">該当する案件はありません</p>';
        return;
    }

    container.innerHTML = list.map(anken => {
        const daysText = anken['残り日数'] < 0
            ? `${Math.abs(anken['残り日数'])}日超過`
            : anken['残り日数'] === 0
                ? '本日'
                : `あと${anken['残り日数']}日`;

        const daysClass = anken['残り日数'] < 0 ? 'overdue' : 'urgent';

        return `
            <div class="anken-item ${isOverdue ? 'overdue' : 'urgent'}">
                <div class="anken-item-info">
                    <h4>${escapeHtml(anken['案件名'])}</h4>
                    <p>${escapeHtml(anken['クライアント名'])} / ${escapeHtml(anken['担当者'])}</p>
                </div>
                <div class="anken-item-deadline">
                    <div class="date">${formatDate(anken['納期'])}</div>
                    <div class="days badge-days ${daysClass}">${daysText}</div>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================================================
// 案件一覧
// ============================================================================

async function loadAnkenList() {
    const status = document.getElementById('filter-status').value;
    const tantosha = document.getElementById('filter-tantosha').value;

    const params = {};
    if (status !== 'all') params.status = status;
    if (tantosha !== 'all') params.tantosha = tantosha;

    const result = await apiGet('getAnkenList', params);
    const tbody = document.getElementById('anken-table-body');

    if (result.success && result.data.length > 0) {
        tbody.innerHTML = result.data.map(anken => {
            const daysText = anken['残り日数'] < 0
                ? `${Math.abs(anken['残り日数'])}日超過`
                : anken['残り日数'] === 0
                    ? '本日'
                    : `${anken['残り日数']}日`;

            const daysClass = anken['残り日数'] < 0
                ? 'overdue'
                : anken['残り日数'] <= 3
                    ? 'urgent'
                    : 'normal';

            return `
                <tr>
                    <td>${escapeHtml(anken['案件ID'])}</td>
                    <td>${escapeHtml(anken['案件名'])}</td>
                    <td>${escapeHtml(anken['クライアント名'])}</td>
                    <td>${escapeHtml(anken['担当者'])}</td>
                    <td>${formatDate(anken['納期'])}</td>
                    <td><span class="badge-days ${daysClass}">${daysText}</span></td>
                    <td><span class="badge badge-status ${anken['ステータス']}">${anken['ステータス']}</span></td>
                    <td><span class="badge badge-priority ${anken['優先度']}">${anken['優先度']}</span></td>
                    <td>
                        <button class="btn-soft small" onclick="editAnken('${anken['案件ID']}')">編集</button>
                    </td>
                </tr>
            `;
        }).join('');
    } else {
        tbody.innerHTML = '<tr><td colspan="9" class="no-data">案件がありません</td></tr>';
    }
}

// ============================================================================
// 案件フォーム
// ============================================================================

function showAnkenForm(ankenId = null) {
    const modal = document.getElementById('anken-modal');
    const title = document.getElementById('anken-modal-title');
    const submitBtn = document.getElementById('anken-submit-btn');
    const form = document.getElementById('anken-form');

    // 担当者プルダウンを更新
    updateTantoshaSelect('anken-tantosha');

    if (ankenId) {
        title.textContent = '案件編集';
        submitBtn.textContent = '更新';
        loadAnkenForEdit(ankenId);
    } else {
        title.textContent = '案件登録';
        submitBtn.textContent = '登録';
        form.reset();
        document.getElementById('anken-id').value = '';
        document.getElementById('anken-jutyu').value = new Date().toISOString().split('T')[0];
    }

    modal.classList.add('active');
}

async function loadAnkenForEdit(ankenId) {
    const result = await apiGet('getAnken', { id: ankenId });

    if (result.success) {
        const anken = result.data;
        document.getElementById('anken-id').value = anken['案件ID'];
        document.getElementById('anken-name').value = anken['案件名'];
        document.getElementById('anken-client').value = anken['クライアント名'];
        document.getElementById('anken-tantosha').value = anken['担当者'];
        document.getElementById('anken-jutyu').value = formatDateForInput(anken['受注日']);
        document.getElementById('anken-deadline').value = formatDateForInput(anken['納期']);
        document.getElementById('anken-status').value = anken['ステータス'];
        document.getElementById('anken-priority').value = anken['優先度'];
        document.getElementById('anken-memo').value = anken['備考'] || '';
    }
}

function editAnken(ankenId) {
    showAnkenForm(ankenId);
}

async function submitAnkenForm(event) {
    event.preventDefault();

    const ankenId = document.getElementById('anken-id').value;
    const isEdit = !!ankenId;

    const data = {
        ankenName: document.getElementById('anken-name').value,
        clientName: document.getElementById('anken-client').value,
        tantosha: document.getElementById('anken-tantosha').value,
        jutyuDate: document.getElementById('anken-jutyu').value,
        deadline: document.getElementById('anken-deadline').value,
        status: document.getElementById('anken-status').value,
        priority: document.getElementById('anken-priority').value,
        memo: document.getElementById('anken-memo').value
    };

    if (isEdit) {
        data.id = ankenId;
    }

    const action = isEdit ? 'updateAnken' : 'addAnken';
    const result = await apiPost(action, data);

    showToast(isEdit ? '案件を更新しました' : '案件を登録しました', 'success');
    closeAnkenModal();

    // データを再読み込み（少し待ってから）
    setTimeout(() => {
        loadAnkenList();
        loadDashboard();
    }, 1000);
}

function closeAnkenModal() {
    document.getElementById('anken-modal').classList.remove('active');
}

// ============================================================================
// 担当者管理
// ============================================================================

async function loadTantoshaList() {
    const result = await apiGet('getTantoshaList');

    if (result.success) {
        tantoshaList = result.data;
        updateTantoshaSelect('filter-tantosha');
        updateTantoshaSelect('anken-tantosha');
    }
}

async function loadTantoshaTable() {
    const result = await apiGet('getTantoshaList');
    const tbody = document.getElementById('tantosha-table-body');

    if (result.success && result.data.length > 0) {
        tantoshaList = result.data;

        tbody.innerHTML = result.data.map(t => `
            <tr>
                <td>${escapeHtml(t['担当者ID'])}</td>
                <td>${escapeHtml(t['氏名'])}</td>
                <td>${escapeHtml(t['メールアドレス'] || '-')}</td>
                <td>${escapeHtml(t['SlackメンバーID'] || '-')}</td>
                <td>
                    <button class="btn-soft small" onclick="editTantosha('${t['担当者ID']}')">編集</button>
                </td>
            </tr>
        `).join('');
    } else {
        tbody.innerHTML = '<tr><td colspan="5" class="no-data">担当者がいません</td></tr>';
    }
}

function updateTantoshaSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    const currentValue = select.value;
    const isFilter = selectId.includes('filter');

    select.innerHTML = isFilter
        ? '<option value="all">すべて</option>'
        : '<option value="">選択してください</option>';

    tantoshaList.forEach(t => {
        const option = document.createElement('option');
        option.value = t['氏名'];
        option.textContent = t['氏名'];
        select.appendChild(option);
    });

    select.value = currentValue;
}

// ============================================================================
// 担当者フォーム
// ============================================================================

function showTantoshaForm(tantoshaId = null) {
    const modal = document.getElementById('tantosha-modal');
    const title = document.getElementById('tantosha-modal-title');
    const submitBtn = document.getElementById('tantosha-submit-btn');
    const form = document.getElementById('tantosha-form');

    if (tantoshaId) {
        title.textContent = '担当者編集';
        submitBtn.textContent = '更新';
        loadTantoshaForEdit(tantoshaId);
    } else {
        title.textContent = '担当者登録';
        submitBtn.textContent = '登録';
        form.reset();
        document.getElementById('tantosha-id').value = '';
    }

    modal.classList.add('active');
}

function loadTantoshaForEdit(tantoshaId) {
    const tantosha = tantoshaList.find(t => t['担当者ID'] === tantoshaId);

    if (tantosha) {
        document.getElementById('tantosha-id').value = tantosha['担当者ID'];
        document.getElementById('tantosha-name').value = tantosha['氏名'];
        document.getElementById('tantosha-email').value = tantosha['メールアドレス'] || '';
        document.getElementById('tantosha-slack').value = tantosha['SlackメンバーID'] || '';
    }
}

function editTantosha(tantoshaId) {
    showTantoshaForm(tantoshaId);
}

async function submitTantoshaForm(event) {
    event.preventDefault();

    const tantoshaId = document.getElementById('tantosha-id').value;
    const isEdit = !!tantoshaId;

    const data = {
        name: document.getElementById('tantosha-name').value,
        email: document.getElementById('tantosha-email').value,
        slackId: document.getElementById('tantosha-slack').value
    };

    if (isEdit) {
        data.id = tantoshaId;
    }

    const action = isEdit ? 'updateTantosha' : 'addTantosha';
    const result = await apiPost(action, data);

    showToast(isEdit ? '担当者を更新しました' : '担当者を登録しました', 'success');
    closeTantoshaModal();

    // データを再読み込み
    setTimeout(() => {
        loadTantoshaList();
        loadTantoshaTable();
    }, 1000);
}

function closeTantoshaModal() {
    document.getElementById('tantosha-modal').classList.remove('active');
}

// ============================================================================
// ユーティリティ
// ============================================================================

function formatDate(dateValue) {
    if (!dateValue) return '-';

    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return '-';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}/${month}/${day}`;
}

function formatDateForInput(dateValue) {
    if (!dateValue) return '';

    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function escapeHtml(text) {
    if (!text) return '';

    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
