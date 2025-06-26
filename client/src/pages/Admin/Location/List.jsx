import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../../../utils/axiosConfig'; // Đảm bảo đường dẫn này đúng

// Import các icon cần thiết
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

// Import component Loader (tùy chọn)
import Loader from '../../../components/common/Loader'; // Sửa lại đường dẫn nếu cần

export default function LocationList() {
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // --- LẤY DỮ LIỆU ---
    useEffect(() => {
        const fetchLocations = async () => {
            try {
                setLoading(true);
                const res = await axiosInstance.get('/locations'); // API endpoint cho locations
                setLocations(res.data.data || res.data);
            } catch (err) {
                setError('Lỗi khi tải danh sách vị trí. Vui lòng thử lại.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchLocations();
    }, []);

    // --- HÀM XỬ LÝ XÓA ---
    const handleDelete = async (locationId) => {
        if (window.confirm('Bạn có chắc chắn muốn xóa vị trí này không?')) {
            try {
                await axiosInstance.delete(`/locations/${locationId}`);
                setLocations(prevLocations => prevLocations.filter(loc => loc._id !== locationId));
            } catch (err) {
                setError('Xóa vị trí thất bại.');
                console.error(err);
            }
        }
    };

    // --- LOGIC TÌM KIẾM VÀ LỌC DỮ LIỆU ---
    const filteredCountries = useMemo(() =>
        locations.filter(location =>
            location.type === 'country' &&
            location.name.toLowerCase().includes(searchTerm.toLowerCase())
        ), [locations, searchTerm]
    );

    const filteredCities = useMemo(() =>
        locations.filter(location =>
            location.type === 'province' &&
            location.name.toLowerCase().includes(searchTerm.toLowerCase())
        ), [locations, searchTerm]
    );

    // --- HÀM HIỂN THỊ BẢNG ---
    const renderTable = (data, title, emptyMessage) => {
        if (data.length === 0) {
            return <p className="text-center text-gray-500 bg-gray-100 p-4 rounded-lg">{emptyMessage}</p>;
        }

        return (
            <div className="overflow-x-auto bg-white rounded-lg shadow mb-8">
                <h2 className="text-xl font-semibold text-gray-700 p-4 border-b">{title}</h2>
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tên vị trí</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loại</th>
                            <th scope="col" className="relative px-6 py-3">
                                <span className="sr-only">Hành động</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {data.map((location) => (
                            <tr key={location._id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{location.name}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${location.type === 'country'
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-blue-100 text-blue-800'
                                        }`}>
                                        {location.type === 'country' ? 'Quốc gia' : 'Tỉnh thành'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div className="flex items-center justify-end space-x-4">
                                        <Link to={`/admin/locations/edit/${location._id}`} className="text-indigo-600 hover:text-indigo-900 flex items-center">
                                            <PencilIcon className="h-5 w-5 mr-1" />
                                            Sửa
                                        </Link>
                                        <button onClick={() => handleDelete(location._id)} className="text-red-600 hover:text-red-900 flex items-center">
                                            <TrashIcon className="h-5 w-5 mr-1" />
                                            Xóa
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    // --- LOGIC HIỂN THỊ NỘI DUNG CHÍNH ---
    const renderContent = () => {
        if (loading) {
            return <div className="text-center p-10"><Loader /></div>;
        }

        if (error) {
            return <p className="text-center text-red-500 bg-red-100 p-4 rounded-lg">{error}</p>;
        }

        return (
            <>
                {renderTable(filteredCountries, 'Danh sách Quốc gia', 'Không tìm thấy quốc gia nào.')}
                {renderTable(filteredCities, 'Danh sách Tỉnh/Thành phố', 'Không tìm thấy tỉnh/thành phố nào.')}
            </>
        );
    };

    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Quản lý vị trí</h1>
                <div className="flex items-center gap-4 w-full md:w-auto">
                    {/* Ô tìm kiếm */}
                    <input
                        type="text"
                        placeholder="Tìm kiếm theo tên..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="block w-full md:w-64 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {/* Nút thêm mới */}
                    <Link
                        to="/admin/locations/add" // Đường dẫn đến trang tạo vị trí mới
                        className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                    >
                        <PlusIcon className="h-5 w-5" />
                        <span>Thêm vị trí</span>
                    </Link>
                </div>
            </div>

            {renderContent()}
        </div>
    );
}