// Nơi duy nhất đọc địa chỉ backend. Giá trị lấy từ .env.development (npm run dev) hoặc .env.production (npm run build)
const API_BASE = import.meta.env.VITE_API_URL;

async function handleResponse(res) {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(data.error || data.message || 'Có lỗi xảy ra, vui lòng thử lại');
        err.code = data.code; // vd: EMAIL_NOT_VERIFIED
        err.status = res.status;
        err.attemptsLeft = data.attemptsLeft; // đăng nhập sai: số lượt còn lại trước khi bị chặn
        throw err;
    }
    return data;
}

export async function authFetch(path, { method = 'GET', body, token } = {}) {
    let res;
    try {
        res = await fetch(`${API_BASE}${path}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
        });
    } catch {
        throw new Error('Lỗi kết nối, thử lại sau');
    }
    return handleResponse(res);
}

// Tải file (VD phiếu Excel): trả về Blob, lỗi thì server vẫn trả JSON { error } như các API khác
export async function authFetchBlob(path, { token } = {}) {
    let res;
    try {
        res = await fetch(`${API_BASE}${path}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
    } catch {
        throw new Error('Lỗi kết nối, thử lại sau');
    }
    if (!res.ok) return handleResponse(res);
    return res.blob();
}

export { API_BASE, handleResponse };
