import ProductCard2 from "./card2";


const products = [
    {
        id: 1,
        title: 'Giỏ quà biếu tặng 3',
        price: '1.200.000 VND',
        image: 'https://example.com/qua3.jpg',
    },
    {
        id: 2,
        title: 'Giỏ quà biếu tặng 4',
        price: '2.000.000 VND',
        image: 'https://example.com/qua4.jpg',
    },
    {
        id: 3,
        title: 'Giỏ quà biếu tặng 5',
        price: '1.000.000 VND',
        image: 'https://example.com/qua5.jpg',
    },
    {
        id: 4,
        title: 'Giỏ quà biếu tặng 1',
        price: '800.000 VND',
        image: 'https://example.com/qua1.jpg',
    },
];

const ProductList = () => {
    return (
        <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {products.map(product => (
                    <ProductCard2 key={product.id} {...product} />
                ))}
            </div>
        </div>
    );
};

export default ProductList;
