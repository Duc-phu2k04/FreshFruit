import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { TrendingUp, Package, DollarSign, ShoppingCart, Apple, Globe, Gift } from 'lucide-react';

const StatCard = ({ icon: Icon, title, value, subtitle, color = "blue" }) => {
  const colorClasses = {
    blue: "bg-blue-500",
    green: "bg-green-500", 
    purple: "bg-purple-500",
    orange: "bg-orange-500",
    red: "bg-red-500",
    indigo: "bg-indigo-500"
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow duration-300">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`${colorClasses[color]} p-3 rounded-full`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  );
};

const CategoryCard = ({ icon: Icon, title, revenue, quantity, color }) => {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
      <div className="flex items-center mb-4">
        <div className={`bg-${color}-100 p-3 rounded-full mr-4`}>
          <Icon className={`h-6 w-6 text-${color}-600`} />
        </div>
        <h3 className="text-xl font-semibold text-gray-800">{title}</h3>
      </div>
      
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Tổng doanh thu:</span>
          <span className="font-bold text-green-600 text-lg">{revenue}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Số lượng đã bán:</span>
          <span className="font-bold text-blue-600 text-lg">{quantity}</span>
        </div>
      </div>
      
      <div className={`mt-4 h-2 bg-${color}-100 rounded-full overflow-hidden`}>
        <div className={`h-full bg-${color}-500 rounded-full`} style={{width: '75%'}}></div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    overview: null,
    categories: null,
    topProducts: null,
    orderStatus: null
  });

  // Fetch data từ API
  useEffect(() => {
    const fetchStatistics = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };

        // Gọi các API thống kê song song
        const [overviewRes, categoryRes, statusRes] = await Promise.all([
          axios.get('http://localhost:3000/api/statistics/overview', { headers }),
          axios.get('http://localhost:3000/api/statistics/by-category', { headers }),
          axios.get('http://localhost:3000/api/statistics/order-status', { headers })
        ]);

        setStats({
          overview: overviewRes.data?.data,
          categories: categoryRes.data?.data?.categories || [],
          topProducts: categoryRes.data?.data?.topProducts || [],
          orderStatus: statusRes.data?.data
        });
      } catch (err) {
        console.error('Error fetching statistics:', err);
        setError(err.response?.data?.message || 'Lỗi khi tải thống kê');
      } finally {
        setLoading(false);
      }
    };

    fetchStatistics();
  }, []);

  // Helper function để format số
  const formatNumber = (num) => {
    if (!num) return '0';
    return num.toLocaleString('vi-VN');
  };

  const formatCurrency = (num) => {
    if (!num) return '0₫';
    return `${num.toLocaleString('vi-VN')}₫`;
  };

  // Mapping categories với icons
  const getCategoryIcon = (categoryName) => {
    const name = categoryName?.toLowerCase() || '';
    if (name.includes('nội địa') || name.includes('trong nước')) return Apple;
    if (name.includes('nhập khẩu') || name.includes('import')) return Globe;
    if (name.includes('combo') || name.includes('set')) return Gift;
    return Package; // default
  };

  const getCategoryColor = (categoryName) => {
    const name = categoryName?.toLowerCase() || '';
    if (name.includes('nội địa') || name.includes('trong nước')) return 'green';
    if (name.includes('nhập khẩu') || name.includes('import')) return 'blue';
    if (name.includes('combo') || name.includes('set')) return 'purple';
    return 'gray'; // default
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải thống kê...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-2">⚠️</div>
          <p className="text-red-600">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  const overview = stats.overview || {};

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Thống Kê Bán Hàng</h1>
          <p className="text-gray-600">Tổng quan về doanh số và hiệu quả kinh doanh</p>
        </div>

        {/* Tổng quan chung */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={DollarSign}
            title="Tổng Doanh Thu"
            value={formatCurrency(overview.totalRevenue)}
            subtitle="Đã thanh toán"
            color="green"
          />
          <StatCard
            icon={Package}
            title="Tổng Sản Phẩm Đã Bán"
            value={formatNumber(overview.totalProductsSold)}
            subtitle="Đơn vị"
            color="blue"
          />
          <StatCard
            icon={ShoppingCart}
            title="Đơn Hàng Thành Công"
            value={formatNumber(overview.successfulOrders)}
            subtitle={`Tổng ${formatNumber(overview.totalOrders)} đơn`}
            color="purple"
          />
          <StatCard
            icon={TrendingUp}
            title="Tăng Trưởng"
            value={`${overview.growthRate >= 0 ? '+' : ''}${overview.growthRate}%`}
            subtitle="So với tháng trước"
            color={overview.growthRate >= 0 ? "green" : "red"}
          />
        </div>

        {/* Thống kê theo danh mục */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Thống Kê Theo Danh Mục</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stats.categories.length > 0 ? (
            stats.categories.map((category, index) => {
              const IconComponent = getCategoryIcon(category.categoryName);
              const color = getCategoryColor(category.categoryName);
              
              return (
                <CategoryCard
                  key={category.categoryId || index}
                  icon={IconComponent}
                  title={category.categoryName}
                  revenue={formatCurrency(category.totalRevenue)}
                  quantity={`${formatNumber(category.totalQuantity)} sản phẩm`}
                  color={color}
                />
              );
            })
          ) : (
            <div className="col-span-3 text-center text-gray-500 py-8">
              Chưa có dữ liệu danh mục
            </div>
          )}
        </div>

        {/* Thống kê bổ sung */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top sản phẩm */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Top Sản Phẩm Bán Chạy</h3>
            <div className="space-y-3">
              {stats.topProducts.length > 0 ? (
                stats.topProducts.slice(0, 5).map((product, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <div>
                      <span className="text-gray-800 font-medium">{product.productName}</span>
                      <span className="text-gray-500 text-sm ml-2">
                        ({formatNumber(product.totalQuantity)} đã bán)
                      </span>
                    </div>
                    <span className="font-bold text-green-600">
                      {formatCurrency(product.totalRevenue)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500">Chưa có dữ liệu</p>
              )}
            </div>
          </div>

          {/* Tình trạng đơn hàng */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Tình Trạng Đơn Hàng</h3>
            <div className="space-y-4">
              {stats.orderStatus?.orderStatus ? (
                stats.orderStatus.orderStatus.map((status) => {
                  const statusLabels = {
                    pending: { label: 'Đang xử lý', color: 'orange' },
                    confirmed: { label: 'Đã xác nhận', color: 'blue' },
                    shipping: { label: 'Đang giao', color: 'purple' },
                    delivered: { label: 'Đã giao hàng', color: 'green' },
                    cancelled: { label: 'Đã hủy', color: 'red' }
                  };
                  
                  const statusInfo = statusLabels[status._id] || { label: status._id, color: 'gray' };
                  
                  return (
                    <div key={status._id} className="flex justify-between items-center">
                      <span className="text-gray-600">{statusInfo.label}:</span>
                      <span className={`font-bold text-${statusInfo.color}-600`}>
                        {formatNumber(status.count)} đơn
                      </span>
                    </div>
                  );
                })
              ) : (
                <p className="text-gray-500">Chưa có dữ liệu</p>
              )}
            </div>
          </div>
        </div>
        </div>
      </div>
    
  );
};

export default Dashboard;