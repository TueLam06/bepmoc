import { authFetch, authFetchBlob } from "../../api/http";

export const getAllOrders = (token, status) => {
    const query = status ? `?status=${status}` : "";
    return authFetch(`/api/admin/orders${query}`, { token });
};

export const getOrderById = (id, token) =>
    authFetch(`/api/admin/orders/${id}`, { token });

export const updateOrderStatus = (id, status, token) =>
    authFetch(`/api/admin/orders/${id}/status`, {
        method: "PATCH",
        body: { status },
        token,
    });

// shippingFee: số nguyên VND, null để xoá
export const updateShippingFee = (id, shippingFee, token) =>
    authFetch(`/api/admin/orders/${id}/shipping-fee`, {
        method: "PATCH",
        body: { shipping_fee: shippingFee },
        token,
    });

export const updateTrackingCode = (id, trackingCode, token) =>
    authFetch(`/api/admin/orders/${id}/tracking`, {
        method: "PATCH",
        body: { tracking_code: trackingCode },
        token,
    });

// Phiếu "ĐƠN HÀNG" dạng Excel
export const exportOrderDocument = (id, token) =>
    authFetchBlob(`/api/admin/orders/${id}/export`, { token });

export const deleteOrder = (id, token) =>
    authFetch(`/api/admin/orders/${id}`, { method: "DELETE", token });

export const getRevenueStats = (token) =>
    authFetch("/api/admin/orders/stats/revenue", { token });