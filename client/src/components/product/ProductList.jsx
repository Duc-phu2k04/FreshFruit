import ProductCard2 from "./card2";

const products = [
    {
        id: 1,
        title: 'Giỏ quà biếu tặng 3',
        price: '1.200.000 VND',
        image: 'https://fujifruit.com.vn/wp-content/uploads/2023/06/z4886185236077_7a474f75072e7165ce557fcae90698c4.jpg',
    },
    {
        id: 2,
        title: 'Giỏ quà biếu tặng 4',
        price: '2.000.000 VND',
        image: 'https://fujifruit.com.vn/wp-content/uploads/2023/06/z4886185236077_7a474f75072e7165ce557fcae90698c4.jpg',
    },
    {
        id: 3,
        title: 'Giỏ quà biếu tặng 5',
        price: '1.000.000 VND',
        image: 'https://fujifruit.com.vn/wp-content/uploads/2023/06/z4886185236077_7a474f75072e7165ce557fcae90698c4.jpg',
    },
    {
        id: 4,
        title: 'Giỏ quà biếu tặng 1',
        price: '800.000 VND',
        image: 'https://fujifruit.com.vn/wp-content/uploads/2023/06/z4886185236077_7a474f75072e7165ce557fcae90698c4.jpg',
    },
];

const ProductList = () => {
    return (
        <div className="p-4 max-w-7xl mx-auto">
            <div className="grid grid-cols-2 gap-6 sm:gap-8">
                {products.map(product => (
                    <ProductCard2 key={product.id} {...product} />
                ))}
            </div>
        </div>
    );
};

export default ProductList;