// 8 danh mục của shop, theo đúng thứ tự trên Shopee (sort_order = vị trí trong mảng)
const CATEGORIES = [
    { name: 'Đũa gỗ siêu sạch', slug: 'dua-go' },
    { name: 'Muôi – Thìa', slug: 'muoi-thia' },
    { name: 'Thớt – Khay – Đĩa', slug: 'thot-khay-dia' },
    { name: 'Phụ kiện bàn ăn', slug: 'phu-kien-ban-an' },
    { name: 'Lược sừng xuất khẩu', slug: 'luoc-sung' },
    { name: 'Lược gỗ thơm', slug: 'luoc-go' },
    { name: 'Dụng cụ massage', slug: 'massage' },
    { name: 'Đồ thờ cúng', slug: 'do-tho-cung' },
];

// Thêm/cập nhật danh mục, trả về map slug -> id
async function upsertCategories(client) {
    const ids = {};
    for (const [i, { name, slug }] of CATEGORIES.entries()) {
        const { rows } = await client.query(
            `INSERT INTO categories (name, slug, sort_order) VALUES ($1, $2, $3)
             ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order
             RETURNING id`,
            [name, slug, i]
        );
        ids[slug] = rows[0].id;
    }
    return ids;
}

module.exports = { CATEGORIES, upsertCategories };
